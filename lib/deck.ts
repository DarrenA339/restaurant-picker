import type { Json } from "@/lib/database.types";
import { PRICE_LEVEL_ENUM, toRestaurantData, type GooglePlace, type SearchArea } from "@/lib/places/place";
import { distanceMi, type LatLng, type RestaurantData } from "@/lib/restaurants";
import type { PriceLevel, SessionFilters } from "@/lib/session-filters";

/**
 * Deck building, as pure functions (docs/SPEC.md "Deck order", "Data
 * sources", and the edge cases). lib/deal.ts runs them against the database
 * and Google; lib/deck.test.ts and lib/deal.test.ts run them against fakes.
 */

export const BATCH_SIZE = 20;

export type AddRow = { user_id: string; place_id: string; created_at: string };

/**
 * The group's undealt adds in deal order: round-robin by member, each
 * member's adds in the order they added them and members in the order of
 * their first add, so no one's list crowds out the others. A place two
 * members added appears once, the first time it comes up.
 */
export function roundRobinAdds(adds: readonly AddRow[], dealt: ReadonlySet<string>): string[] {
  const byMember = new Map<string, string[]>();
  const sorted = [...adds].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const add of sorted) {
    if (dealt.has(add.place_id)) continue;
    const list = byMember.get(add.user_id) ?? [];
    list.push(add.place_id);
    byMember.set(add.user_id, list);
  }
  const queues = [...byMember.values()];
  const longest = Math.max(0, ...queues.map((q) => q.length));
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (let round = 0; round < longest; round += 1) {
    for (const queue of queues) {
      const placeId = queue[round];
      if (placeId === undefined || seen.has(placeId)) continue;
      seen.add(placeId);
      ordered.push(placeId);
    }
  }
  return ordered;
}

export type SuggestionRules = {
  center: LatLng;
  /** The session's max distance; Google treats the circle as a hint, so this is the real limit. */
  maxMi: number;
  /** Places already in the session (and this batch's adds): never dealt twice. */
  exclude: ReadonlySet<string>;
  /** Nearby Search has no price or open-now filters, so those are applied here. */
  prices?: readonly PriceLevel[];
  openNow?: boolean;
  limit: number;
};

export type Suggestion = { placeId: string; place: GooglePlace; data: RestaurantData };

/** The search results that can be dealt: in range, not already in, deduped, at most `limit`. */
export function pickSuggestions(places: readonly GooglePlace[], rules: SuggestionRules): Suggestion[] {
  const picked: Suggestion[] = [];
  const seen = new Set(rules.exclude);
  for (const place of places) {
    if (picked.length >= rules.limit) break;
    const placeId = place.id;
    if (!placeId || seen.has(placeId)) continue;
    const data = toRestaurantData(place, null);
    if (!data.location) continue;
    if (distanceMi(rules.center, data.location) > rules.maxMi) continue;
    if (rules.prices?.length && (!data.priceLevel || !rules.prices.includes(data.priceLevel))) continue;
    if (rules.openNow && data.openNow === false) continue;
    seen.add(placeId);
    picked.push({ placeId, place, data });
  }
  return picked;
}

/** Each adder's automatic yes on their own adds in this batch (one per member and place). */
export function autoYes(
  batch: readonly string[],
  adds: readonly AddRow[],
): { user_id: string; place_id: string }[] {
  const inBatch = new Set(batch);
  const seen = new Set<string>();
  const yes: { user_id: string; place_id: string }[] = [];
  for (const add of adds) {
    if (!inBatch.has(add.place_id)) continue;
    const key = `${add.user_id}:${add.place_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    yes.push({ user_id: add.user_id, place_id: add.place_id });
  }
  return yes;
}

const METERS_PER_DEGREE_LAT = 111_320;

function offset(center: LatLng, eastM: number, northM: number): LatLng {
  const lat = center.lat + northM / METERS_PER_DEGREE_LAT;
  const lng = center.lng + eastM / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
}

/**
 * Past Text Search's 60 results the area is split for Nearby Search (20 per
 * call, no pages): the center and six circles around it at 0.6 r, each
 * half the radius, so together they cover the area with some overlap.
 */
export function subCircles(area: SearchArea): SearchArea[] {
  const radiusM = Math.round(area.radiusM / 2);
  const ring = area.radiusM * 0.6;
  const circles: SearchArea[] = [{ center: area.center, radiusM }];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    circles.push({ center: offset(area.center, ring * Math.cos(angle), ring * Math.sin(angle)), radiusM });
  }
  return circles;
}

type Circle = { center: { latitude: number; longitude: number }; radius: number };

/** The deck's Text Search body. Paged requests must repeat it exactly, so it is stored on the session. */
export type DeckSearchBody = {
  textQuery: string;
  includedType: "restaurant";
  pageSize: number;
  locationBias: { circle: Circle };
  openNow?: true;
  priceLevels?: string[];
  languageCode: "en";
  regionCode: "us";
};

export function deckSearchBody(filters: SessionFilters, area: SearchArea): DeckSearchBody {
  const body: DeckSearchBody = {
    textQuery: [filters.cuisines.join(" or "), "restaurants"].filter(Boolean).join(" "),
    includedType: "restaurant",
    pageSize: BATCH_SIZE,
    locationBias: {
      circle: { center: { latitude: area.center.lat, longitude: area.center.lng }, radius: area.radiusM },
    },
    languageCode: "en",
    regionCode: "us",
  };
  if (filters.openNow) body.openNow = true;
  if (filters.prices.length) body.priceLevels = filters.prices.map((level) => PRICE_LEVEL_ENUM[level]);
  return body;
}

export type NearbyBody = {
  includedTypes: string[];
  maxResultCount: number;
  locationRestriction: { circle: Circle };
  rankPreference: "POPULARITY";
  languageCode: "en";
  regionCode: "us";
};

export function nearbyBody(circle: SearchArea): NearbyBody {
  return {
    includedTypes: ["restaurant"],
    maxResultCount: BATCH_SIZE,
    locationRestriction: {
      circle: { center: { latitude: circle.center.lat, longitude: circle.center.lng }, radius: circle.radiusM },
    },
    rankPreference: "POPULARITY",
    languageCode: "en",
    regionCode: "us",
  };
}

/**
 * Where the suggestions search stands: the stored Text Search body (null
 * before the first search), Google's token for the next page (null once
 * the pages run out), and how many of the smaller circles have been used.
 * `sessions.search_body` holds `{ body, nearbyNext }`; `sessions.page_token`
 * holds the token.
 */
export type SearchState = { body: DeckSearchBody | null; pageToken: string | null; nearbyNext: number };

export function readSearchState(searchBody: Json | null, pageToken: string | null): SearchState {
  if (typeof searchBody !== "object" || searchBody === null || Array.isArray(searchBody)) {
    return { body: null, pageToken: null, nearbyNext: 0 };
  }
  const stored = searchBody as { body?: unknown; nearbyNext?: unknown };
  const body =
    typeof stored.body === "object" && stored.body !== null ? (stored.body as DeckSearchBody) : null;
  const nearbyNext = typeof stored.nearbyNext === "number" ? stored.nearbyNext : 0;
  return { body, pageToken: body ? pageToken : null, nearbyNext };
}

export function writeSearchBody(state: SearchState): Json | null {
  if (!state.body) return null;
  return { body: state.body as unknown as Json, nearbyNext: state.nearbyNext };
}
