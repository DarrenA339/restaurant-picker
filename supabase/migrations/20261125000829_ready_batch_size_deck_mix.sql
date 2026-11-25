-- Lobby ready check, batch size and deck mix (docs/SPEC.md "Ready check",
-- "Deck order").
--
--   * members.ready: a guest's "I'm done adding" in the lobby. Members set it
--     on their own row only (the existing "members: update own row" policy,
--     plus the column added to the column-limited update grant). It goes back
--     to false when the session leaves the lobby.
--   * sessions.batch_size: cards per batch, 1 to 20, default 10. The host
--     picks 5, 10, 15 or 20 through PATCH /api/sessions/[id].
--   * sessions.deck_mix replaces sessions.suggestions_on: how much of each
--     batch is the group's adds (100, 75, 50 or 25 percent). Sessions that
--     had suggestions off become adds_only; the rest get the default.
--
-- sessions stays server-written: authenticated has no update grant on it, so
-- batch_size and deck_mix can only change through the route.

-- ---------------------------------------------------------------------------
-- members.ready
-- ---------------------------------------------------------------------------

alter table public.members add column ready boolean not null default false;

comment on column public.members.ready is
  'The member tapped "I''m done adding" in the lobby. Set by the member on their own row; reset when the session leaves the lobby.';

grant update (ready) on table public.members to authenticated;

-- ---------------------------------------------------------------------------
-- sessions.batch_size and sessions.deck_mix
-- ---------------------------------------------------------------------------

alter table public.sessions
  add column batch_size smallint not null default 10
  constraint sessions_batch_size_check check (batch_size between 1 and 20);

comment on column public.sessions.batch_size is
  'Cards dealt per batch. The host picks 5, 10, 15 or 20 in the lobby; locked at Start.';

create type public.deck_mix as enum ('adds_only', 'mostly_adds', 'half', 'mostly_new');

alter table public.sessions add column deck_mix public.deck_mix not null default 'mostly_adds';

comment on column public.sessions.deck_mix is
  'The share of each batch that is the group''s adds: adds_only 100%, mostly_adds 75%, half 50%, mostly_new 25%. Suggestions fill the rest. Locked at Start.';

update public.sessions set deck_mix = 'adds_only' where not suggestions_on;

alter table public.sessions drop column suggestions_on;

-- ---------------------------------------------------------------------------
-- Ready flags reset when the session leaves the lobby
-- ---------------------------------------------------------------------------

create function private.reset_ready_on_start()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.members set ready = false where session_id = new.id and ready;
  return null;
end;
$$;

revoke all on function private.reset_ready_on_start() from public, anon, authenticated;
grant execute on function private.reset_ready_on_start() to service_role;

create trigger sessions_reset_ready
  after update of status on public.sessions
  for each row
  when (old.status = 'lobby' and new.status <> 'lobby')
  execute function private.reset_ready_on_start();
