# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A mobile-first group restaurant picker: a host creates a session with filters, friends join from a link with no account, everyone swipes yes/no/veto on Google Places results dealt in batches of 20, and a server-side voting rule (approval + Borda over the top 5) picks the winner. Scope is Boston/Cambridge/Somerville.

`docs/SPEC.md` is the source of truth for product behavior, routes, data model, voting rules, edge cases, Places API usage, and the phased build plan. Read it before implementing a feature, and keep it updated when a decision changes (it has an "Open decisions" checklist).

## Commands

```bash
npm run dev        # next dev (Turbopack). Writes PID/port to .next/dev/lock; reuse a running server
npm run build      # next build (Turbopack). Also validates Cache Components prerendering
npm run lint       # plain `eslint` (next lint was removed in Next 16; flat config in eslint.config.mjs)
npx tsc --noEmit   # typecheck
npx next typegen   # regenerate route types (PageProps / LayoutProps / RouteContext helpers)
npm run rls:check  # two anonymous users prove swipe isolation against the dev project (needs .env.local)
```

Tests (Vitest is installed; there is no `test` script or `vitest.config.mts` yet, add both when `lib/voting.ts` lands):

```bash
npx vitest run                       # all tests once
npx vitest run lib/voting.test.ts    # one file
npx vitest run -t "borda"            # tests matching a name
npx vitest                           # watch mode
```

Voting tests are pure-function unit tests, so a `node` environment is enough; only add `jsdom` + `@vitejs/plugin-react` if component tests are added. Vitest cannot test async Server Components.

## Next.js 16 rules that bite here

This is Next 16.4 with `cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`. Before touching framework APIs, read the matching guide under `node_modules/next/dist/docs/01-app/` (see `AGENTS.md`). The points that matter most for this codebase:

- **Request APIs are async only.** `params`, `searchParams`, `cookies()`, `headers()` must be awaited. Use the generated helpers: `PageProps<'/s/[code]'>`, `LayoutProps<'/'>`, `RouteContext<'/api/sessions/[id]/start'>` (globally available after `next dev`/`next typegen`).
- **Cache Components is on.** Any uncached read (Supabase query, `cookies()`, `fetch`) in a page or layout must sit inside `<Suspense>` or be wrapped in `'use cache'` + `cacheLife()`, or the build fails with a blocking-route error. Put the async data read as deep in the tree as possible. Reading the Supabase auth cookie is a request-time read, so authenticated UI streams behind Suspense; see `02-guides/authentication-with-cache-components.md`.
- **Route handlers:** `GET` handlers follow the same prerender model as pages. `POST` handlers (all of this app's `/api/sessions/...` routes) are never cached. `'use cache'` cannot go directly in a route handler body.
- **`proxy.ts` replaces `middleware.ts`** (export `proxy`, Node runtime only). The repo-root `proxy.ts` refreshes the Supabase session cookies on every page request; add any new proxy logic there rather than a second file.
- **Tailwind v4** is wired through the `@tailwindcss/turbopack` loader rule in `next.config.ts`; `app/globals.css` uses `@import "tailwindcss"` and `@theme inline`. There is no `tailwind.config.*`.
- `AGENTS.md` contains a block managed by `next dev`; commit it as-is rather than deleting it.

## Architecture

### Trust boundary

Two paths to data, and which one a piece of logic uses is the main design decision:

- **Browser → Supabase directly** (publishable key, anonymous sign-in, RLS): auth, reading the session/members/restaurants (plus the member's own adds and ballot), writing the member's own swipes, and Realtime subscriptions for lobby presence, the add list, and status changes. Joining is the `join_session` RPC (security definer, in `public` so it is callable); clients never insert `members` rows.
- **Browser → Next.js route handler → Supabase (secret key) / Google Places:** anything that needs a secret or decides an outcome. Creating sessions, dealing batches, tallying, computing winners. These live under `app/api/sessions/...` (see the server-routes table in the spec).

RLS is what keeps vote tallies hidden, not the UI: members can only read their own `swipes`, `adds`, and `ballots` rows. The server reads all of them with `SUPABASE_SECRET_KEY` when it deals and tallies. Don't add client-side reads that would leak counts or who added what. The veto cap is a trigger on `swipes` that decrements `members.vetoes_left` and rejects the veto at zero, so the UI only needs to read `vetoes_left`.

Supabase clients live in `lib/supabase/`: `browser.ts` for client components (`ensureSignedIn()` reuses an existing anonymous session before creating one), `server.ts` for server components and route handlers (acts as the visitor through cookies, so callers sit behind `<Suspense>`), and `admin.ts` for the secret key (server only). A server component that uses either server client must `await connection()` first: the auth client checks token expiry with `Date.now()`, which Cache Components refuses to prerender.

### Layout and desktop

Mobile is the design; from 1024px (Tailwind's `lg`) every screen takes the desktop layout in docs/SPEC.md "Desktop layout" from the pieces in `components/layout/`, so don't hand-roll widths in a screen:

- `AppShell` (used once, in `app/layout.tsx`): a 430px column below `lg`, full width above.
- `FlowScreen` (+ `ScreenFooter`): Create, Join, Done, Final round, Winner, edge states, placeholders. Renders the brand header (desktop only) and a centered 480px column; `footer` is sticky at the bottom on phones and inline at the end of the column on desktop. `as="form"` when the screen is one form.
- `WideScreen` + `TwoColumn`: Welcome (`variant="hero"`), Lobby and Swipe (`variant="panel"`, sticky right column). On phones the columns are `display: contents`, so children sit in the single column in source order; write the JSX in phone order and let `lg:` classes move things.
- `Brand` / `BrandHeader`: the "[APP NAME]" mark at its two sizes.
- `components/ui/sheet.tsx`: a bottom sheet on phones, a centered dialog from `lg` (`size="narrow"` 520px for filters and the voting method, `"wide"` 960px for details). `useIsDesktop()` in `components/layout/use-desktop.ts` is the matching media query for client logic.

Phone-only and desktop-only elements (the lobby's avatar stack vs. its "Who's here" list, "Invite" vs. "Copy invite link") are rendered once with `lg:hidden` / `hidden lg:flex`, not duplicated components.

### Session state machine

`sessions.status` drives everything: `lobby → swiping → (tally)`. After each tally, a unanimous yes goes straight to `done`; otherwise the host picks `ranking` or deals another batch (back to `swiping`), and a tally with no finalists deals the next batch automatically. `ranking → done` once everyone has ranked.

### Batch dealing (Google Places)

Each batch is one Places API (New) Text Search page + up to 20 photo resolutions. The session row stores the original `search_body` and the latest `page_token` because Google requires every paged request to match the first one byte-for-byte except the token. After 60 results (3 pages), `deal` switches to Nearby Search over sub-circles and dedupes by `place_id`. Text Search treats the radius as a hint, so filter by distance before dealing. Resolve each photo once server-side with `skipHttpRedirect=true` and store the `photoUri` on the restaurant row; never proxy photos per client. The field mask in the spec is cost-tiered; adding a field can move every search to a pricier SKU.

### Voting

All of it is pure functions in `lib/voting.ts` (instant match, finalist selection, Borda, tie-break seeded by session id) with Vitest tests, called only from server routes. Write the tests first for this module.

### Maps

`@vis.gl/react-google-maps` with `AdvancedMarker` (requires `NEXT_PUBLIC_MAP_ID`). Mount the map once per session and pan it; `gestureHandling="none"` on the swipe-screen strip so horizontal drags reach the card. Google's Places terms require results to be shown on a Google Map, so don't swap in Mapbox/MapLibre.

## Environment variables

Defined in `.env.local` (gitignored). The browser-exposed ones are the `NEXT_PUBLIC_*` keys.

| Variable | Server-only |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no |
| `SUPABASE_SECRET_KEY` | yes |
| `GOOGLE_PLACES_API_KEY` | yes (never import into a client component) |
| `NEXT_PUBLIC_MAPS_KEY` | no (Maps JavaScript API, referrer-restricted) |
| `NEXT_PUBLIC_MAP_ID` | no |


# Project
Group restaurant picker. Friends join by link, swipe yes/no/veto on cards dealt in batches of 20, then rank finalists. docs/SPEC.md is the source of truth; read it before planning any phase.

# Stack
Next.js App Router, TypeScript, Tailwind, Supabase (Postgres, anonymous auth, Realtime), Motion, @vis.gl/react-google-maps, Vitest.

# Rules
- GOOGLE_PLACES_API_KEY and SUPABASE_SECRET_KEY are server-only. Never NEXT_PUBLIC_, never imported in client components.
- NEXT_PUBLIC_MAPS_KEY is the only Google key allowed in the browser.
- Every Places request sets an explicit X-Goog-FieldMask. Never "*".
- Places data is fetched per batch on the server and stored. Clients never call the Places API.
- Until the batch-route phase, UI uses fake restaurants from lib/fixtures.ts (shaped like `restaurants` rows; flip `USE_FIXTURES` off when real adds land).
- Realtime: subscribe to `postgres_changes` filtered by session and, on any event, refetch that table for the session through RLS (`app/s/[code]/use-session-live.ts`). Never apply the event payload: delete events bypass RLS and carry only keys. When `sessions.status` changes, call `router.refresh()` and let the server gate pick the view.
- Every new table enables RLS and gets its policies plus explicit grants in the same migration, matching the "Members can read / write" columns in docs/SPEC.md. Grant to `authenticated` only (anonymous sign-ins use that role); grant nothing to `anon`. Also `grant all` to `service_role` explicitly: this project uses Supabase's locked-down default privileges, so new tables and functions give the API roles nothing until granted. Apply migrations with the Supabase MCP `apply_migration` tool, save the same SQL under `supabase/migrations/<version>_<name>.sql` using the version the MCP records, then regenerate `lib/database.types.ts` with `generate_typescript_types`.
- Client writes to `members` and `swipes` are column-limited by grants; `adds` and `ballots` are read-only for clients and written only by server routes. Never upsert from the browser (PostgREST sets every payload column, including the key); insert, then update the allowed columns on conflict. Policy helpers go in the `private` schema (not exposed by the Data API) as security-definer functions with `set search_path = ''`.
- Voting logic lives in lib/voting.ts as pure functions with Vitest tests.
- Mobile first. Check layouts at 390px wide.
- Before calling a task done, run `npm run lint`, `npm run build`, and `npx vitest run --passWithNoTests`.
- After any UI change, run the dev server and check the screen with the Playwright MCP at 390×844 and 1280×800. Compare mobile to its image in docs/design/, and desktop to its -desktop image, or to 03-join-desktop.png for flow screens without one. Fix differences before calling the task done.