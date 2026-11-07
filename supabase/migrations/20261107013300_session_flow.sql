-- Session flow (build plan phase 5, part 1): what Create and Join need.
--
--   * sessions.name: the title friends see ("Friday dinner").
--   * members.color: a person color 1..8 (the --color-person-N tokens in
--     app/globals.css), unique within a session so avatars never collide.
--   * join_session(code, display_name, color, lat, lng): the security-definer
--     join path from the spec's open decision. A friend who opens a link is
--     not a member yet, so they can't read sessions by code. This function
--     resolves the code, inserts the member row with a free color (the one
--     they asked for if nobody has it, else the lowest free), and returns
--     only the session id and status. Session rows stay private.
--
-- Because joining now goes through join_session, which also enforces the
-- 8-person cap and refuses ended sessions, the direct insert grant on
-- members goes away. Members still update their own display_name, lat, lng.
--
-- Member locations are rounded to 3 decimals (about 100 m) on the way in,
-- matching the Join screen's "rough area, never your exact address".

-- ---------------------------------------------------------------------------
-- sessions.name
-- ---------------------------------------------------------------------------

alter table public.sessions add column name text not null default 'Dinner';
alter table public.sessions alter column name drop default;
alter table public.sessions
  add constraint sessions_name_check check (char_length(btrim(name)) between 1 and 60);

comment on column public.sessions.name is 'What the host called it, e.g. "Friday dinner".';

-- ---------------------------------------------------------------------------
-- members.color
-- ---------------------------------------------------------------------------

alter table public.members add column color smallint not null default 1;
alter table public.members alter column color drop default;
alter table public.members
  add constraint members_color_check check (color between 1 and 8),
  add constraint members_session_color_unique unique (session_id, color);

comment on column public.members.color is
  'Person color 1..8 (--color-person-N in app/globals.css). Unique per session; join_session assigns it.';

-- ---------------------------------------------------------------------------
-- join_session
-- ---------------------------------------------------------------------------

create function public.join_session(
  p_code text,
  p_display_name text,
  p_color integer default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns table (id uuid, status public.session_status)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_display_name, ''));
  v_session public.sessions%rowtype;
  v_color smallint;
  v_members int;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'display_name_invalid' using errcode = '22023';
  end if;

  -- The row lock serializes joins to one session, so two friends joining at
  -- once can't both take the same color or push the group past 8.
  select s.* into v_session
  from public.sessions s
  where s.code = upper(btrim(coalesce(p_code, '')))
  for update;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0002';
  end if;

  -- Already a member (reopened the link): just hand the session back.
  if exists (
    select 1 from public.members m
    where m.session_id = v_session.id and m.user_id = v_uid
  ) then
    return query select v_session.id, v_session.status;
    return;
  end if;

  if v_session.status = 'done' then
    raise exception 'session_ended' using errcode = 'P0001';
  end if;

  select count(*) into v_members from public.members m where m.session_id = v_session.id;
  if v_members >= 8 then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  select g.c into v_color
  from generate_series(1, 8) as g(c)
  where not exists (
    select 1 from public.members m
    where m.session_id = v_session.id and m.color = g.c
  )
  order by (g.c = p_color) is true desc, g.c
  limit 1;

  insert into public.members (session_id, user_id, display_name, color, lat, lng)
  values (
    v_session.id, v_uid, v_name, v_color,
    round(p_lat::numeric, 3)::double precision,
    round(p_lng::numeric, 3)::double precision
  );

  return query select v_session.id, v_session.status;
end;
$$;

comment on function public.join_session(text, text, integer, double precision, double precision) is
  'Joins the signed-in user to the session with this code and returns only its id and status. Picks a free person color.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke insert on table public.members from authenticated;

revoke execute on function public.join_session(text, text, integer, double precision, double precision) from public, anon;
grant execute on function public.join_session(text, text, integer, double precision, double precision) to authenticated, service_role;
