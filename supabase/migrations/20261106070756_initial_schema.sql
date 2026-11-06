-- Initial schema: the six tables from docs/SPEC.md ("Tech stack and data model"),
-- row-level security, grants, and the Realtime publication.
--
-- Grants: this project uses Supabase's locked-down default privileges
-- (https://github.com/orgs/supabase/discussions/45329), so new tables give the
-- API roles no select/insert/update/delete. Every table below therefore grants
-- `authenticated` exactly what the spec's "Members can read / write" columns
-- allow, grants `service_role` everything (server routes use the secret key),
-- and revokes the leftover truncate/references/trigger/maintain from `anon`
-- and `authenticated`. `anon` gets nothing: anonymous sign-ins use `authenticated`.
--
-- Client writes use column lists so server-owned columns (vetoes_left, the done
-- flags, created_at) can't be set from a phone. PostgREST upserts set every
-- payload column, so clients insert and then update instead of upserting.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.session_status as enum ('lobby', 'swiping', 'ranking', 'done');
create type public.swipe_value as enum ('yes', 'no', 'veto');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  host_id     uuid not null references auth.users (id) on delete cascade,
  status      public.session_status not null default 'lobby',
  filters     jsonb not null default '{}'::jsonb,
  center_lat  double precision,
  center_lng  double precision,
  batch       integer not null default 0 check (batch >= 0),
  search_body jsonb,
  page_token  text,
  created_at  timestamptz not null default now()
);

create index sessions_host_id_idx on public.sessions (host_id);

comment on table public.sessions is 'One group decision. Written only by server routes.';
comment on column public.sessions.batch is 'Number of batches dealt so far; 0 in the lobby. restaurants.batch starts at 1.';
comment on column public.sessions.search_body is 'Original Places Text Search request body; paged requests must match it byte-for-byte.';

create table public.members (
  session_id   uuid not null references public.sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  lat          double precision,
  lng          double precision,
  vetoes_left  integer not null default 2 check (vetoes_left >= 0),
  done_swiping boolean not null default false,
  done_ranking boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index members_user_id_idx on public.members (user_id);

comment on table public.members is 'Who is in a session. Members insert their own row and may update display_name, lat, lng; the server owns the rest.';

create table public.restaurants (
  session_id uuid not null references public.sessions (id) on delete cascade,
  place_id   text not null,
  batch      integer not null check (batch >= 1),
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, place_id)
);

create index restaurants_session_batch_idx on public.restaurants (session_id, batch);

comment on table public.restaurants is 'Dealt cards. Places data stored for the life of the session only.';

create table public.swipes (
  session_id uuid not null,
  user_id    uuid not null,
  place_id   text not null,
  value      public.swipe_value not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, place_id),
  foreign key (session_id, user_id)  references public.members (session_id, user_id) on delete cascade,
  foreign key (session_id, place_id) references public.restaurants (session_id, place_id) on delete cascade
);

create index swipes_session_place_idx on public.swipes (session_id, place_id);

comment on table public.swipes is 'Approval ballots. RLS limits every member to their own rows; the server tallies with the secret key.';

create table public.rankings (
  session_id uuid not null,
  user_id    uuid not null,
  ordering   text[] not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id),
  foreign key (session_id, user_id) references public.members (session_id, user_id) on delete cascade
);

comment on table public.rankings is 'Each member''s ordering of the finalists (place_ids, best first).';

create table public.results (
  session_id         uuid primary key references public.sessions (id) on delete cascade,
  finalists          text[] not null,
  scores             jsonb not null default '{}'::jsonb,
  winner_place_id    text,
  runner_up_place_id text,
  created_at         timestamptz not null default now()
);

comment on table public.results is 'Outcome computed by the server once ranking (or an instant match) finishes.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.sessions    enable row level security;
alter table public.members     enable row level security;
alter table public.restaurants enable row level security;
alter table public.swipes      enable row level security;
alter table public.rankings    enable row level security;
alter table public.results     enable row level security;

-- Membership check used by every "their session" policy. Security definer so it
-- can read members without re-entering the members policy (which would recurse).
-- It lives in `private`, a schema the Data API does not expose, so it cannot be
-- called over REST; policies still run it because `authenticated` has execute.
create schema private;
grant usage on schema private to authenticated, service_role;

create function private.is_session_member(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.session_id = sid
      and m.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.is_session_member(uuid) from public;
grant execute on function private.is_session_member(uuid) to authenticated, service_role;

-- sessions: members (and the host) read their own session; nobody but the server writes.
create policy "sessions: members read their session"
  on public.sessions for select to authenticated
  using (host_id = (select auth.uid()) or private.is_session_member(id));

-- members: everyone in the session reads the member list; each member writes only
-- their own row. The own-row branch also lets `insert ... returning` work, since
-- the helper can't see a row inserted by the statement that is still running.
create policy "members: members read their session"
  on public.members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_session_member(session_id));

create policy "members: insert own row"
  on public.members for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "members: update own row"
  on public.members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- restaurants: members read their session's dealt cards; server only writes.
create policy "restaurants: members read their session"
  on public.restaurants for select to authenticated
  using (private.is_session_member(session_id));

-- swipes: only your own rows, in every direction. Tallies stay hidden by the database.
create policy "swipes: read own"
  on public.swipes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "swipes: insert own"
  on public.swipes for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "swipes: update own"
  on public.swipes for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- rankings: same shape as swipes.
create policy "rankings: read own"
  on public.rankings for select to authenticated
  using (user_id = (select auth.uid()));

create policy "rankings: insert own"
  on public.rankings for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "rankings: update own"
  on public.rankings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- results: members read their session's result; server only writes.
create policy "results: members read their session"
  on public.results for select to authenticated
  using (private.is_session_member(session_id));

-- ---------------------------------------------------------------------------
-- Grants (see header)
-- ---------------------------------------------------------------------------

revoke all on table public.sessions, public.members, public.restaurants,
                    public.swipes, public.rankings, public.results
  from anon, authenticated;

grant select on table public.sessions to authenticated;

grant select on table public.members to authenticated;
grant insert (session_id, user_id, display_name, lat, lng) on table public.members to authenticated;
grant update (display_name, lat, lng) on table public.members to authenticated;

grant select on table public.restaurants to authenticated;

grant select on table public.swipes to authenticated;
grant insert (session_id, user_id, place_id, value) on table public.swipes to authenticated;
grant update (value) on table public.swipes to authenticated;

grant select on table public.rankings to authenticated;
grant insert (session_id, user_id, ordering) on table public.rankings to authenticated;
grant update (ordering) on table public.rankings to authenticated;

grant select on table public.results to authenticated;

grant all on table public.sessions, public.members, public.restaurants,
                   public.swipes, public.rankings, public.results
  to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: lobby presence and status changes. Postgres Changes respects the
-- select policies above, so members only receive rows they can read.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.sessions, public.members;
