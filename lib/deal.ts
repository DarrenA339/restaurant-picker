import type { Json, Tables, TablesInsert } from "@/lib/database.types";
import {
  autoYes,
  deckSearchBody,
  nearbyBody,
  nothingToSwipe,
  pickSuggestions,
  readSearchState,
  roundRobinAdds,
  splitBatch,
  subCircles,
  writeSearchBody,
  type AddRow,
  type DeckSearchBody,
  type NearbyBody,
  type SearchState,
} from "@/lib/deck";
import { searchArea, toRestaurantData, type GooglePlace } from "@/lib/places/place";
import { readRestaurantData, type LatLng } from "@/lib/restaurants";
import { DEFAULT_FILTERS, parseFilters } from "@/lib/session-filters";

export type DealSession = Pick<
  Tables<"sessions">,
  | "id"
  | "status"
  | "batch"
  | "batch_size"
  | "deck_mix"
  | "filters"
  | "center_lat"
  | "center_lng"
  | "search_body"
  | "page_token"
>;

export type RestaurantLite = Pick<Tables<"restaurants">, "place_id" | "source" | "batch">;
export type RestaurantInsert = TablesInsert<"restaurants">;
export type YesRow = { session_id: string; user_id: string; place_id: string };
/** A suggestion kept from an earlier search and not dealt yet (a restaurants row with no batch). */
export type PoolRow = { place_id: string; data: Json };

export type BatchClaim = {
  status: Tables<"sessions">["status"];
  batch: number;
  search_body: Json | null;
  page_token: string | null;
};

/** The database side of dealing, small enough to fake in memory (lib/supabase/deal-store.ts is real). */
export type DealStore = {
  listAdds(sessionId: string): Promise<AddRow[]>;
  listRestaurants(sessionId: string): Promise<RestaurantLite[]>;
  listMemberIds(sessionId: string): Promise<string[]>;
  /** The undealt suggestions (source suggested, no batch), oldest first. */
  listPool(sessionId: string): Promise<PoolRow[]>;
  /** Moves the session on only if it is still where we read it; false when someone else got there first. */
  claimBatch(
    sessionId: string,
    expect: { status: Tables<"sessions">["status"]; batch: number },
    next: BatchClaim,
  ): Promise<boolean>;
  /** Stamps the batch number on undealt adds. */
  dealAdds(sessionId: string, placeIds: string[], batch: number): Promise<void>;
  /** New suggestion rows: dealt ones carry the batch, spare ones none (the pool). */
  insertSuggestions(rows: RestaurantInsert[]): Promise<void>;
  /** Pooled suggestions dealt now: the batch number and the data with its photo. */
  dealPool(sessionId: string, rows: PoolRow[], batch: number): Promise<void>;
  /** Each adder's automatic yes; rows that already exist are left alone. */
  recordYes(rows: YesRow[]): Promise<void>;
  /** A new batch: nobody is done with it yet. */
  resetDoneSwiping(sessionId: string): Promise<void>;
  /** Members with nothing to swipe in this batch are done with it already. */
  markDoneSwiping(sessionId: string, userIds: string[]): Promise<void>;
};

/** What dealing needs from Google (lib/places/google.ts, or vi.fn() in tests). */
export type DealPlaces = {
  searchText(body: DeckSearchBody & { pageToken?: string }): Promise<{ places?: GooglePlace[]; nextPageToken?: string }>;
  searchNearby(body: NearbyBody): Promise<{ places?: GooglePlace[] }>;
  photoUri(photoName: string): Promise<string | null>;
};

export type DealDeps = { store: DealStore; places: DealPlaces };

export type DealInput = {
  session: DealSession;
  /** The host's rough location, the fallback center for a session without one. */
  hostLocation: LatLng | null;
  /** Start (lobby → batch 1) rather than the next batch while swiping. */
  start: boolean;
};

export type DealResult =
  | {
      ok: true;
      batch: number;
      adds: string[];
      suggestions: string[];
      /** The mix wants suggestions but the area has nothing left to offer. */
      exhausted: boolean;
    }
  | { ok: false; code: "not_lobby" | "not_swiping" | "nothing_to_deal" | "conflict" };

const PHOTO_CONCURRENCY = 5;
/** Extra Text Search pages per deal when the server-side filters leave a batch short. */
const EXTRA_PAGES = 1;

/** Runs `fn` over `items`, at most `limit` at a time, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** A suggestion that can be dealt: fresh from Google, or waiting in the pool. */
type Candidate = { placeId: string; data: Json; pooled: boolean };

function isRecord(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deals one batch of `sessions.batch_size` cards (docs/SPEC.md "Deck order"):
 *
 *   1. the split: the group's undealt adds, round-robin by member, get the
 *      mix's share of the batch (100, 75, 50 or 25 percent, rounded) and
 *      suggestions the rest; when either runs out the other fills in, and
 *      "only our adds" never takes a suggestion;
 *   2. suggestions come from the pool first: results of earlier searches
 *      kept as restaurants rows with no batch. Google is called only when
 *      the pool is short: the stored Text Search's next page (the first page
 *      on the first fill), then, past its pages, Nearby Search over smaller
 *      circles; everything filtered by distance and deduped against the
 *      session. Results this batch doesn't use go into the pool;
 *   3. one photo per suggestion dealt (never for the pool), each adder's
 *      automatic yes on their dealt adds, the batch number stamped on, done
 *      flags reset (a member whose batch is all their own adds is done
 *      already), and the session moved to swiping with a conditional update
 *      so two taps deal once. Batch 1 comes from the lobby; later batches
 *      from deciding.
 *
 * Google is called before the claim, so a lost race costs at most one
 * search's worth of calls and never writes a second batch.
 */
export async function dealBatch(deps: DealDeps, input: DealInput): Promise<DealResult> {
  const { store, places } = deps;
  const { session, hostLocation, start } = input;
  if (start && session.status !== "lobby") return { ok: false, code: "not_lobby" };
  // Later batches come from deciding: the host's "Deal N more", or the tally finding no finalists.
  if (!start && session.status !== "deciding") return { ok: false, code: "not_swiping" };
  const batch = session.batch + 1;
  const size = session.batch_size;
  const mix = session.deck_mix;

  const [adds, restaurants] = await Promise.all([
    store.listAdds(session.id),
    store.listRestaurants(session.id),
  ]);
  const dealt = new Set(restaurants.filter((r) => r.batch !== null).map((r) => r.place_id));
  const known = new Set(restaurants.map((r) => r.place_id));

  const queue = roundRobinAdds(adds, dealt);
  // What the batch wants from suggestions if there turn out to be enough of them.
  const need = splitBatch(size, mix, queue.length, Infinity).suggestions;

  const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;
  const area = searchArea(session, filters, hostLocation);
  let state: SearchState = readSearchState(session.search_body, session.page_token);
  const candidates: Candidate[] = [];
  let exhausted = false;

  if (need > 0) {
    for (const row of await store.listPool(session.id)) {
      candidates.push({ placeId: row.place_id, data: row.data, pooled: true });
    }

    const exclude = new Set(known);
    // Every filter is judged on the results: Google applies only some of them
    // in a Text Search and none in a Nearby Search (lib/places/attributes.ts).
    // Everything that passes is kept, dealt now or pooled for a later batch.
    const rules = { center: area.center, maxMi: filters.distanceMi, exclude, filters, limit: Infinity };
    const take = (found: GooglePlace[]) => {
      for (const picked of pickSuggestions(found, rules)) {
        candidates.push({
          placeId: picked.placeId,
          data: toRestaurantData(picked.place, null) as unknown as Json,
          pooled: false,
        });
        exclude.add(picked.placeId);
      }
    };

    // Text Search, only while the pool is short: the first page, or the next
    // one while Google has more. When the filters leave the batch short, one
    // extra page (never a third per deal).
    const body = state.body ?? deckSearchBody(filters, area);
    for (let page = 0; page < 1 + EXTRA_PAGES; page += 1) {
      if (!(candidates.length < need && (!state.body || state.pageToken))) break;
      const result = await places.searchText(
        state.pageToken ? { ...body, pageToken: state.pageToken } : body,
      );
      state = { body, pageToken: result.nextPageToken ?? null, nearbyNext: state.nearbyNext };
      take(result.places ?? []);
    }

    // Past the pages: smaller circles, every filter judged here since Nearby has none.
    const circles = subCircles(area);
    while (candidates.length < need && state.body && !state.pageToken && state.nearbyNext < circles.length) {
      const circle = circles[state.nearbyNext];
      state = { ...state, nearbyNext: state.nearbyNext + 1 };
      const result = await places.searchNearby(nearbyBody(circle));
      take(result.places ?? []);
    }

    exhausted = candidates.length === 0 && !state.pageToken && state.nearbyNext >= circles.length;
  }

  const split = splitBatch(size, mix, queue.length, candidates.length);
  const batchAdds = queue.slice(0, split.adds);
  const picked = candidates.slice(0, split.suggestions);
  const spare = candidates.slice(split.suggestions).filter((c) => !c.pooled);
  if (batchAdds.length + picked.length === 0) return { ok: false, code: "nothing_to_deal" };

  // One photo per card dealt; a failed photo is a blank tile, never a lost card.
  // The pool keeps only the photo's name, so a card nobody sees costs nothing.
  const withPhotos = await mapLimit(picked, PHOTO_CONCURRENCY, async (candidate): Promise<Candidate> => {
    const photo = readRestaurantData(candidate.data)?.details?.photos?.[0];
    if (!photo || !isRecord(candidate.data)) return candidate;
    try {
      const photoUri = await places.photoUri(photo.name);
      if (!photoUri) return candidate;
      const data: { [key: string]: Json | undefined } = { ...candidate.data, photoUri };
      // Attribution belongs with the photo it credits.
      if (photo.attributions?.length) data.photoAttributions = photo.attributions as unknown as Json;
      return { ...candidate, data };
    } catch (error) {
      console.warn("suggestion photo failed", candidate.placeId, error);
      return candidate;
    }
  });

  const claimed = await store.claimBatch(
    session.id,
    { status: session.status, batch: session.batch },
    { status: "swiping", batch, search_body: writeSearchBody(state), page_token: state.pageToken },
  );
  if (!claimed) return { ok: false, code: "conflict" };

  // New rows keep Google's order (confirmed matches first) through created_at:
  // the pool is dealt oldest first, and a single insert would stamp them all alike.
  const now = Date.now();
  const dealtFresh = withPhotos.filter((c) => !c.pooled);
  const fresh = [...dealtFresh, ...spare].map(
    (candidate, index): RestaurantInsert => ({
      session_id: session.id,
      place_id: candidate.placeId,
      source: "suggested",
      batch: index < dealtFresh.length ? batch : null,
      data: candidate.data,
      created_at: new Date(now + index).toISOString(),
    }),
  );
  const fromPool = withPhotos.filter((c) => c.pooled).map((c) => ({ place_id: c.placeId, data: c.data }));
  if (fresh.length) await store.insertSuggestions(fresh);
  if (fromPool.length) await store.dealPool(session.id, fromPool, batch);
  if (batchAdds.length) await store.dealAdds(session.id, batchAdds, batch);
  const yes = autoYes(batchAdds, adds).map((row) => ({ session_id: session.id, ...row }));
  if (yes.length) await store.recordYes(yes);
  await store.resetDoneSwiping(session.id);

  // A member whose batch is only their own adds has nothing to swipe. Someone
  // still has to finish the batch from their phone for the tally to run, so
  // this never marks the whole group.
  const suggestions = withPhotos.map((c) => c.placeId);
  const idle = nothingToSwipe([...batchAdds, ...suggestions], adds);
  if (idle.length) {
    const memberIds = await store.listMemberIds(session.id);
    if (memberIds.some((id) => !idle.includes(id))) await store.markDoneSwiping(session.id, idle);
  }

  return { ok: true, batch, adds: batchAdds, suggestions, exhausted };
}
