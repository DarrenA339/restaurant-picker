import type { Json, Tables, TablesInsert } from "@/lib/database.types";
import {
  autoYes,
  BATCH_SIZE,
  deckSearchBody,
  nearbyBody,
  pickSuggestions,
  readSearchState,
  roundRobinAdds,
  subCircles,
  writeSearchBody,
  type AddRow,
  type DeckSearchBody,
  type NearbyBody,
  type SearchState,
  type Suggestion,
} from "@/lib/deck";
import { searchArea, toRestaurantData, type GooglePlace } from "@/lib/places/place";
import type { LatLng } from "@/lib/restaurants";
import { DEFAULT_FILTERS, parseFilters } from "@/lib/session-filters";

export type DealSession = Pick<
  Tables<"sessions">,
  "id" | "status" | "batch" | "filters" | "center_lat" | "center_lng" | "suggestions_on" | "search_body" | "page_token"
>;

export type RestaurantLite = Pick<Tables<"restaurants">, "place_id" | "source" | "batch">;
export type RestaurantInsert = TablesInsert<"restaurants">;
export type YesRow = { session_id: string; user_id: string; place_id: string };

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
  /** Moves the session on only if it is still where we read it; false when someone else got there first. */
  claimBatch(
    sessionId: string,
    expect: { status: Tables<"sessions">["status"]; batch: number },
    next: BatchClaim,
  ): Promise<boolean>;
  /** Stamps the batch number on undealt adds. */
  dealAdds(sessionId: string, placeIds: string[], batch: number): Promise<void>;
  insertSuggestions(rows: RestaurantInsert[]): Promise<void>;
  /** Each adder's automatic yes; rows that already exist are left alone. */
  recordYes(rows: YesRow[]): Promise<void>;
  /** A new batch: nobody is done with it yet. */
  resetDoneSwiping(sessionId: string): Promise<void>;
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
      /** Suggestions are on but the area has nothing left to offer. */
      exhausted: boolean;
    }
  | { ok: false; code: "not_lobby" | "not_swiping" | "nothing_to_deal" | "conflict" };

const PHOTO_CONCURRENCY = 5;

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

/**
 * Deals one batch of up to 20 cards (docs/SPEC.md "Deck order"):
 *
 *   1. the group's undealt adds first, round-robin by member;
 *   2. once every add is dealt, suggestions fill the rest while they are on:
 *      the stored Text Search's next page (the first page on the first
 *      fill), then, past its pages, Nearby Search over smaller circles;
 *      everything filtered by distance and deduped against the session;
 *   3. one photo per new card, each adder's automatic yes on their dealt
 *      adds, the batch number stamped on, done flags reset, and the session
 *      moved on with a conditional update so two taps deal once.
 *
 * Google is called before the claim, so a lost race costs at most one
 * search's worth of calls and never writes a second batch.
 */
export async function dealBatch(deps: DealDeps, input: DealInput): Promise<DealResult> {
  const { store, places } = deps;
  const { session, hostLocation, start } = input;
  if (start && session.status !== "lobby") return { ok: false, code: "not_lobby" };
  if (!start && session.status !== "swiping") return { ok: false, code: "not_swiping" };
  const batch = session.batch + 1;

  const [adds, restaurants] = await Promise.all([
    store.listAdds(session.id),
    store.listRestaurants(session.id),
  ]);
  const dealt = new Set(restaurants.filter((r) => r.batch !== null).map((r) => r.place_id));
  const known = new Set(restaurants.map((r) => r.place_id));

  const queue = roundRobinAdds(adds, dealt);
  const batchAdds = queue.slice(0, BATCH_SIZE);
  const addsLeft = queue.length - batchAdds.length;
  const need = BATCH_SIZE - batchAdds.length;

  const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;
  const area = searchArea(session, filters, hostLocation);
  let state: SearchState = readSearchState(session.search_body, session.page_token);
  const suggestions: Suggestion[] = [];
  let exhausted = false;

  if (need > 0 && session.suggestions_on && addsLeft === 0) {
    const exclude = new Set([...known, ...batchAdds]);
    const rules = { center: area.center, maxMi: filters.distanceMi, exclude, limit: need };

    // Text Search: the first page, or the next one while Google has more.
    if (!state.body || state.pageToken) {
      const body = state.body ?? deckSearchBody(filters, area);
      const result = await places.searchText(
        state.pageToken ? { ...body, pageToken: state.pageToken } : body,
      );
      state = { body, pageToken: result.nextPageToken ?? null, nearbyNext: state.nearbyNext };
      for (const picked of pickSuggestions(result.places ?? [], rules)) {
        suggestions.push(picked);
        exclude.add(picked.placeId);
      }
    }

    // Past the pages: smaller circles, filtered here since Nearby has no price or open-now filters.
    const circles = subCircles(area);
    while (suggestions.length < need && !state.pageToken && state.nearbyNext < circles.length) {
      const circle = circles[state.nearbyNext];
      state = { ...state, nearbyNext: state.nearbyNext + 1 };
      const result = await places.searchNearby(nearbyBody(circle));
      const picked = pickSuggestions(result.places ?? [], {
        ...rules,
        prices: filters.prices,
        openNow: filters.openNow,
        limit: need - suggestions.length,
      });
      for (const suggestion of picked) {
        suggestions.push(suggestion);
        exclude.add(suggestion.placeId);
      }
    }

    exhausted = suggestions.length === 0 && !state.pageToken && state.nearbyNext >= circles.length;
  }

  if (batchAdds.length + suggestions.length === 0) return { ok: false, code: "nothing_to_deal" };

  // One photo per new card; a failed photo is a blank tile, never a lost card.
  const rows = await mapLimit(suggestions, PHOTO_CONCURRENCY, async (suggestion): Promise<RestaurantInsert> => {
    let photoUri: string | null = null;
    const photoName = suggestion.place.photos?.[0]?.name;
    if (photoName) {
      try {
        photoUri = await places.photoUri(photoName);
      } catch (error) {
        console.warn("suggestion photo failed", suggestion.placeId, error);
      }
    }
    return {
      session_id: session.id,
      place_id: suggestion.placeId,
      source: "suggested",
      batch,
      data: toRestaurantData(suggestion.place, photoUri),
    };
  });

  const claimed = await store.claimBatch(
    session.id,
    { status: session.status, batch: session.batch },
    { status: "swiping", batch, search_body: writeSearchBody(state), page_token: state.pageToken },
  );
  if (!claimed) return { ok: false, code: "conflict" };

  if (rows.length) await store.insertSuggestions(rows);
  if (batchAdds.length) await store.dealAdds(session.id, batchAdds, batch);
  const yes = autoYes(batchAdds, adds).map((row) => ({ session_id: session.id, ...row }));
  if (yes.length) await store.recordYes(yes);
  await store.resetDoneSwiping(session.id);

  return { ok: true, batch, adds: batchAdds, suggestions: rows.map((row) => row.place_id), exhausted };
}
