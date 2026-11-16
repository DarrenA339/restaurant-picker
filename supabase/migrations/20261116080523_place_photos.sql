-- The details sheet's gallery: up to four resolved photo URIs per place, with
-- their author credits. The photos route fills a row the first time anyone in
-- the session opens that place's sheet, so later opens (by any member) cost no
-- Google calls. Keyed by place id rather than a restaurants row because an
-- explore result can be opened before it is added.
--
-- Server only: no policies and no grants to authenticated. Members get the
-- photos from the route, which checks membership first.
create table public.place_photos (
  session_id uuid not null references public.sessions (id) on delete cascade,
  place_id   text not null,
  photos     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, place_id)
);

comment on table public.place_photos is
  'A place''s details-sheet gallery (resolved photo URIs and their credits), fetched once per session when a sheet first opens. Server only: read and written by the photos route with the secret key.';

alter table public.place_photos enable row level security;

revoke all on table public.place_photos from anon, authenticated;
grant all on table public.place_photos to service_role;
