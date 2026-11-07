import { describe, expect, it } from "vitest";
import {
  autoYes,
  BATCH_SIZE,
  deckSearchBody,
  pickSuggestions,
  readSearchState,
  roundRobinAdds,
  subCircles,
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

  it("applies price and open-now when asked (Nearby Search has no such filters)", () => {
    const places = [
      place("cheap", 0.1, { priceLevel: "PRICE_LEVEL_INEXPENSIVE" }),
      place("pricey", 0.2, { priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }),
      place("unknown-price", 0.3, { priceLevel: undefined }),
      place("closed", 0.4, { currentOpeningHours: { openNow: false } }),
      place("open", 0.5, { currentOpeningHours: { openNow: true } }),
    ];
    const picked = pickSuggestions(places, { ...rules, prices: [1, 2], openNow: true });
    expect(picked.map((p) => p.placeId)).toEqual(["cheap", "open"]);
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
      { ...DEFAULT_FILTERS, cuisines: ["Korean", "Thai"], openNow: false, prices: [] },
      { center: harvard, radiusM: 2000 },
    );
    expect(cuisines.textQuery).toBe("Korean or Thai restaurants");
    expect(cuisines).not.toHaveProperty("openNow");
    expect(cuisines).not.toHaveProperty("priceLevels");
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
