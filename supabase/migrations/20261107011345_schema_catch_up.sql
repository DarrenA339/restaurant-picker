-- Schema catch-up (build plan phase 4): brings the database up to the data
-- model in docs/SPEC.md ("Tables").
--
--   * sessions gains suggestions_on and voting_method (plurality | borda |
--     quadratic, default borda). The host changes both from the lobby through
--     PATCH /api/sessions/[id]; the method locks at Start.
--   * restaurants gains source (member | suggested) and batch becomes nullable:
--     a member's add is stored when it is added and has no batch until dealt.
--   * adds records who added which spot. Members read only their own rows (the
--     lobby's "You added this"), so who added everything else stays hidden.
--   * ballots replaces rankings. A ballot's payload is {pick}, {ordering} or
--     {votes} depending on the session's voting method. Only the ballot route
--     writes it, because a quadratic ballot's credit budget must be checked on
--     the server. Any rankings rows are carried over as {ordering}.
--   * A trigger on swipes spends one of members.vetoes_left for every veto and
--     rejects the veto once none are left, so the cap holds no matter which
--     client writes the swipe. Changing a veto to yes/no refunds it.
--   * restaurants joins the Realtime publication so the lobby's add list grows
--     live on every phone.
--
-- Grants follow the same rules as the initial migration: `authenticated` gets
-- exactly what the spec's "Members can read / write" columns allow, `anon`
-- gets nothing, and `service_role` is granted everything explicitly because
-- this project uses Supabase's locked-down default privileges.

-- ---------------------------------------------------------------------------
-- sessions: suggestions toggle and voting method
-- ---------------------------------------------------------------------------

create type public.voting_method as enum ('plurality', 'borda', 'quadratic');

alter table public.sessions
  add column suggestions_on boolean not null default true,
  add column voting_method  public.voting_method not null default 'borda';

comment on column public.sessions.suggestions_on is
  'When false the deck is only the group''s adds. Host changes it in the lobby.';
comment on column public.sessions.voting_method is
  'How the final round is decided. Host changes it in the lobby; it locks at Start.';

-- ---------------------------------------------------------------------------
-- restaurants: source, and batch is null until the card is dealt
-- ---------------------------------------------------------------------------

create type public.restaurant_source as enum ('member', 'suggested');

-- Every row that exists before this migration was dealt from a search.
alter table public.restaurants
  add column source public.restaurant_source not null default 'suggested';
alter table public.restaurants
  alter column source drop default,
  alter column batch drop not null;

comment on table public.restaurants is
  'Every spot in a session: member adds (stored when added) and suggestions (stored when dealt). Places data kept for the life of the session only.';
comment on column public.restaurants.source is
  'member: added by someone in the lobby. suggested: came from a Places search.';
comment on column public.restaurants.batch is
  'Batch the card was dealt in (1-based). Null until dealt, which only happens to member adds waiting in the lobby.';

-- ---------------------------------------------------------------------------
-- adds: who added which spot
-- ---------------------------------------------------------------------------

create table public.adds (
  session_id uuid not null,
  user_id    uuid not null,
  place_id   text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id, place_id),
  foreign key (session_id, user_id)  references public.members (session_id, user_id) on delete cascade,
  foreign key (session_id, place_id) references public.restaurants (session_id, place_id) on delete cascade
);

create index adds_session_place_idx on public.adds (session_id, place_id);

comment on table public.adds is
  'Who added which spot. Written only by the add route. RLS limits every member to their own rows, so the lobby can mark "You added this" without revealing who added anything else.';

-- ---------------------------------------------------------------------------
-- ballots: the final-round vote, written only by the ballot route
-- ---------------------------------------------------------------------------

create table public.ballots (
  session_id uuid not null,
  user_id    uuid not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, user_id),
  foreign key (session_id, user_id) references public.members (session_id, user_id) on delete cascade,
  -- Exactly one of the three shapes from the spec. The ballot route checks the
  -- shape against the session's method and the quadratic credit budget.
  constraint ballots_payload_shape check (
    jsonb_typeof(payload) = 'object' and (
      (payload ? 'pick'     and jsonb_typeof(payload -> 'pick')     = 'string' and payload - 'pick'     = '{}'::jsonb) or
      (payload ? 'ordering' and jsonb_typeof(payload -> 'ordering') = 'array'  and payload - 'ordering' = '{}'::jsonb) or
      (payload ? 'votes'    and jsonb_typeof(payload -> 'votes')    = 'object' and payload - 'votes'    = '{}'::jsonb)
    )
  )
);

comment on table public.ballots is
  'One final-round ballot per member: {pick} for plurality, {ordering} for Borda, {votes} for quadratic. Written only by the ballot route.';

insert into public.ballots (session_id, user_id, payload, created_at)
select session_id, user_id, jsonb_build_object('ordering', to_jsonb(ordering)), created_at
from public.rankings;

drop table public.rankings;

-- ---------------------------------------------------------------------------
-- Veto limit: members.vetoes_left is the counter and the lock
-- ---------------------------------------------------------------------------

-- Runs as the function owner so it can change vetoes_left, which clients
-- cannot write. The conditional UPDATE takes the member's row lock, so two
-- concurrent vetoes from one phone can't both get through.
create function private.enforce_veto_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Spending a veto: a new veto row, or an existing swipe changed to veto.
  if tg_op in ('INSERT', 'UPDATE')
     and new.value = 'veto'
     and (tg_op = 'INSERT' or old.value <> 'veto') then
    update public.members
       set vetoes_left = vetoes_left - 1
     where session_id = new.session_id
       and user_id = new.user_id
       and vetoes_left > 0;
    if not found then
      raise exception 'veto limit reached: no vetoes left in this session'
        using errcode = 'check_violation',
              hint = 'Each member gets members.vetoes_left vetoes per session.';
    end if;
  end if;

  -- Refunding a veto: a veto changed to yes/no, or a veto row deleted.
  if (tg_op = 'UPDATE' and old.value = 'veto' and new.value <> 'veto')
     or (tg_op = 'DELETE' and old.value = 'veto') then
    update public.members
       set vetoes_left = vetoes_left + 1
     where session_id = old.session_id
       and user_id = old.user_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_veto_limit() from public;

create trigger swipes_enforce_veto_limit
  before insert or update of value or delete on public.swipes
  for each row execute function private.enforce_veto_limit();

comment on column public.members.vetoes_left is
  'Vetoes this member can still spend. Kept in sync by the trigger on swipes; the default is the per-session veto limit.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.adds    enable row level security;
alter table public.ballots enable row level security;

-- adds: only your own rows. No insert/update/delete policies: the server writes.
create policy "adds: read own"
  on public.adds for select to authenticated
  using (user_id = (select auth.uid()));

-- ballots: only your own row. No insert/update/delete policies: the ballot route writes.
create policy "ballots: read own"
  on public.ballots for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants (see header). The table-level select grants on sessions and
-- restaurants already cover their new columns.
-- ---------------------------------------------------------------------------

revoke all on table public.adds, public.ballots from anon, authenticated;

grant select on table public.adds    to authenticated;
grant select on table public.ballots to authenticated;

grant all on table public.adds, public.ballots to service_role;

-- ---------------------------------------------------------------------------
-- Realtime: the lobby's add list. Postgres Changes respects the restaurants
-- select policy, so members only receive their own session's rows.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.restaurants;
