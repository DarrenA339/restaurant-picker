import { describe, expect, it } from "vitest";
import {
  autoYes,
  BATCH_SIZE,
  buildMemberDeck,
  deckSearchBody,
  hashSeed,
  pickSuggestions,
  readSearchState,
  roundRobinAdds,
  seededShuffle,
  subCircles,
  textSearchBody,
  writeSearchBody,
  type AddRow,
} from "./deck";
import type { GooglePlace } from "./places/place";
import { DEFAULT_FILTERS } from "./session-filters";

const A = "user-a";
const B = "user-b";
const C = "user-c";

function add(user_id: string, place_id: string, minute: number): AddRow {
  return { user_id, place_id, created_at: `2026-11-06T18:${String(minute).padStart(2, "0")}:00.000Z` };
}

const harvard = { lat: 42.3736, lng: -71.119 };

/** A place `miles` east of Harvard Square. */
function place(id: string, miles: number, extra: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id,
    displayName: { text: id },
    location: { latitude: harvard.lat, longitude: harvard.lng + miles / 51.6 },
    priceLevel: "PRICE_LEVEL_MODERATE",
    ...extra,
  };
}

describe("roundRobinAdds", () => {
  it("interleaves members in the order of their first add, each in their own order", () => {
    const adds = [add(A, "a1", 1), add(B, "b1", 2), add(A, "a2", 3), add(A, "a3", 4), add(C, "c1", 5), add(B, "b2", 6)];
    expect(roundRobinAdds(adds, new Set())).toEqual(["a1", "b1", "c1", "a2", "b2", "a3"]);
  });

  it("deals a place two members added once, where it first comes up, and both still count", () => {
    const adds = [add(A, "shared", 1), add(B, "b1", 2), add(B, "shared", 3), add(B, "b2", 4)];
    expect(roundRobinAdds(adds, new Set())).toEqual(["shared", "b1", "b2"]);
    expect(autoYes(["shared"], adds)).toEqual([
      { user_id: A, place_id: "shared" },
      { user_id: B, place_id: "shared" },
    ]);
  });

  it("skips adds that were already dealt", () => {
    const adds = [add(A, "a1", 1), add(A, "a2", 2), add(B, "b1", 3)];
    expect(roundRobinAdds(adds, new Set(["a1", "b1"]))).toEqual(["a2"]);
  });

  it("orders by time, not by the array", () => {
    const adds = [add(B, "b1", 5), add(A, "a1", 1)];
    expect(roundRobinAdds(adds, new Set())).toEqual(["a1", "b1"]);
  });
});

describe("pickSuggestions", () => {
  const rules = { center: harvard, maxMi: 2, exclude: new Set<string>(), limit: BATCH_SIZE };

  it("keeps places within the max distance, in order, deduped and not already in", () => {
    const places = [place("near", 0.5), place("far", 3), place("near", 0.5), place("added", 1), place("ok", 1.9)];
    const picked = pickSuggestions(places, { ...rules, exclude: new Set(["added"]) });
    expect(picked.map((p) => p.placeId)).toEqual(["near", "ok"]);
  });

  it("stops at the limit and skips places with no location", () => {
    const places = [{ id: "nowhere", displayName: { text: "?" } }, place("p1", 0.1), place("p2", 0.2), place("p3", 0.3)];
    expect(pickSuggestions(places, { ...rules, limit: 2 }).map((p) => p.placeId)).toEqual(["p1", "p2"]);
  });

  it("judges the filters: confirmed misses go, confirmed matches come first, unknowns keep their place", () => {
    const places = [
      place("unknown-price", 0.3),
      place("pricey", 0.2, { priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }),
      place("closed", 0.4, { currentOpeningHours: { openNow: false } }),
      place("cheap-open", 0.1, { priceLevel: "PRICE_LEVEL_INEXPENSIVE", currentOpeningHours: { openNow: true } }),
      place("no-wine", 0.5, { priceLevel: "PRICE_LEVEL_INEXPENSIVE", currentOpeningHours: { openNow: true }, servesWine: false }),
    ];
    const filters = { ...DEFAULT_FILTERS, prices: [1 as const, 2 as const], openNow: true, drinks: ["wine" as const] };
    const picked = pickSuggestions(places, { ...rules, filters });
    expect(picked.map((p) => p.placeId)).toEqual(["unknown-price", "cheap-open"]);
    const sure = pickSuggestions([...places, place("sure", 0.6, { priceLevel: "PRICE_LEVEL_MODERATE", currentOpeningHours: { openNow: true }, servesWine: true })], { ...rules, filters });
    expect(sure.map((p) => p.placeId)).toEqual(["sure", "unknown-price", "cheap-open"]);
    // The limit applies after ranking, so a sure match is never cut for an unknown one.
    expect(pickSuggestions([...places, place("sure", 0.6, { priceLevel: "PRICE_LEVEL_MODERATE", currentOpeningHours: { openNow: true }, servesWine: true })], { ...rules, filters, limit: 1 }).map((p) => p.placeId)).toEqual(["sure"]);
  });
});

describe("autoYes", () => {
  it("records a yes only for adds in the batch, once per member and place", () => {
    const adds = [add(A, "p1", 1), add(B, "p2", 2), add(A, "p1", 3), add(B, "later", 4)];
    expect(autoYes(["p1", "p2"], adds)).toEqual([
      { user_id: A, place_id: "p1" },
      { user_id: B, place_id: "p2" },
    ]);
  });
});

describe("subCircles", () => {
  it("covers the area with the center and six circles around it at half the radius", () => {
    const circles = subCircles({ center: harvard, radiusM: 3200 });
    expect(circles).toHaveLength(7);
    expect(circles[0]).toEqual({ center: harvard, radiusM: 1600 });
    for (const circle of circles.slice(1)) {
      expect(circle.radiusM).toBe(1600);
      const dLat = (circle.center.lat - harvard.lat) * 111_320;
      const dLng = (circle.center.lng - harvard.lng) * 111_320 * Math.cos((harvard.lat * Math.PI) / 180);
      expect(Math.hypot(dLat, dLng)).toBeCloseTo(1920, -1);
    }
  });
});

describe("deckSearchBody", () => {
  it("asks for restaurants (or the cuisines) in the area with the session's filters", () => {
    const body = deckSearchBody(DEFAULT_FILTERS, { center: harvard, radiusM: 3218 });
    expect(body).toEqual({
      textQuery: "restaurants",
      includedType: "restaurant",
      pageSize: 20,
      locationBias: { circle: { center: { latitude: harvard.lat, longitude: harvard.lng }, radius: 3218 } },
      openNow: true,
      priceLevels: ["PRICE_LEVEL_INEXPENSIVE", "PRICE_LEVEL_MODERATE"],
      languageCode: "en",
      regionCode: "us",
    });
    const cuisines = deckSearchBody(
      { ...DEFAULT_FILTERS, cuisines: ["korean_restaurant", "thai_restaurant"], openNow: false, prices: [] },
      { center: harvard, radiusM: 2000 },
    );
    expect(cuisines.textQuery).toBe("Korean or Thai restaurants");
    expect(cuisines.includedType).toBe("restaurant");
    expect(cuisines).not.toHaveProperty("openNow");
    expect(cuisines).not.toHaveProperty("priceLevels");
    expect(cuisines).not.toHaveProperty("minRating");
  });

  it("uses Google's own filters where they exist: one cuisine as includedType, the rating floor, no price filter for the full range", () => {
    const one = deckSearchBody(
      { ...DEFAULT_FILTERS, cuisines: ["korean_restaurant"], minRating: 4.5, prices: [1, 2, 3, 4] },
      { center: harvard, radiusM: 2000 },
    );
    expect(one).toMatchObject({ textQuery: "Korean restaurants", includedType: "korean_restaurant", minRating: 4.5 });
    expect(one).not.toHaveProperty("priceLevels");
    expect(textSearchBody({ ...DEFAULT_FILTERS, cuisines: ["thai_restaurant"] }, { center: harvard, radiusM: 2000 }, "dumplings").textQuery).toBe("Thai dumplings");
  });
});

describe("search state", () => {
  it("round-trips through the session columns and starts empty", () => {
    expect(readSearchState(null, null)).toEqual({ body: null, pageToken: null, nearbyNext: 0 });
    const body = deckSearchBody(DEFAULT_FILTERS, { center: harvard, radiusM: 2000 });
    const stored = writeSearchBody({ body, pageToken: "tok", nearbyNext: 2 });
    expect(readSearchState(stored, "tok")).toEqual({ body, pageToken: "tok", nearbyNext: 2 });
    expect(writeSearchBody({ body: null, pageToken: null, nearbyNext: 0 })).toBeNull();
  });
});

describe("buildMemberDeck", () => {
  const cards = [
    ...Array.from({ length: 4 }, (_, i) => ({ place_id: `add-${i + 1}`, source: "member" as const, batch: 1 })),
    ...Array.from({ length: 6 }, (_, i) => ({ place_id: `sug-${i + 1}`, source: "suggested" as const, batch: 1 })),
    { place_id: "later", source: "suggested" as const, batch: 2 },
    { place_id: "undealt", source: "member" as const, batch: null },
  ];
  const mine = new Set(["add-2"]);

  it("takes the batch minus the member's own adds, adds before suggestions", () => {
    const deck = buildMemberDeck(cards, { userId: A, batch: 1, myAddIds: mine });
    expect(deck).toHaveLength(9);
    expect(deck.map((c) => c.place_id)).not.toContain("add-2");
    expect(deck.map((c) => c.place_id)).not.toContain("later");
    expect(deck.map((c) => c.place_id)).not.toContain("undealt");
    expect(deck.slice(0, 3).every((c) => c.source === "member")).toBe(true);
    expect(deck.slice(3).every((c) => c.source === "suggested")).toBe(true);
  });

  it("gives the same member the same order every time, whatever the input order", () => {
    const once = buildMemberDeck(cards, { userId: A, batch: 1, myAddIds: mine });
    const again = buildMemberDeck([...cards].reverse(), { userId: A, batch: 1, myAddIds: mine });
    expect(again.map((c) => c.place_id)).toEqual(once.map((c) => c.place_id));
  });

  it("gives different members different orders", () => {
    const a = buildMemberDeck(cards, { userId: A, batch: 1, myAddIds: new Set() }).map((c) => c.place_id);
    const b = buildMemberDeck(cards, { userId: B, batch: 1, myAddIds: new Set() }).map((c) => c.place_id);
    expect(a).not.toEqual(b);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it("shuffles deterministically from a seed", () => {
    expect(seededShuffle([1, 2, 3, 4, 5], hashSeed("x"))).toEqual(seededShuffle([1, 2, 3, 4, 5], hashSeed("x")));
    expect(seededShuffle([1, 2, 3, 4, 5], hashSeed("x"))).not.toEqual(seededShuffle([1, 2, 3, 4, 5], hashSeed("y")));
  });
});
