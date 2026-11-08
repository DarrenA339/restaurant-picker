import { describe, expect, it } from "vitest";
import { judge, rankByAttributes } from "./attributes";
import type { GooglePlace } from "./place";
import { DEFAULT_FILTERS, type SearchFilters } from "../session-filters";

const none: SearchFilters = {
  distanceMi: DEFAULT_FILTERS.distanceMi,
  prices: [],
  cuisines: [],
  meals: [],
  minRating: 0,
  openNow: false,
  vegetarian: false,
  goodFor: [],
  amenities: [],
  drinks: [],
};

const place = (id: string, extra: Partial<GooglePlace> = {}): GooglePlace => ({ id, ...extra });

describe("judge", () => {
  it("matches everything when no filter is on", () => {
    expect(judge(place("p"), none)).toBe("match");
  });

  it("drops only confirmed misses and keeps unknowns", () => {
    const f = { ...none, drinks: ["wine" as const] };
    expect(judge(place("yes", { servesWine: true }), f)).toBe("match");
    expect(judge(place("no", { servesWine: false }), f)).toBe("no");
    expect(judge(place("unknown"), f)).toBe("unknown");
  });

  it("treats cuisines and meals as any-of", () => {
    const f = { ...none, cuisines: ["korean_restaurant" as const, "thai_restaurant" as const], meals: ["breakfast" as const, "brunch" as const] };
    expect(judge(place("k", { types: ["restaurant", "thai_restaurant"], servesBrunch: true }), f)).toBe("match");
    expect(judge(place("x", { types: ["restaurant", "pizza_restaurant"], servesBreakfast: true }), f)).toBe("no");
    expect(judge(place("?", { types: ["korean_restaurant"], servesBreakfast: false }), f)).toBe("unknown");
    expect(judge(place("??", { types: ["korean_restaurant"], servesBreakfast: false, servesBrunch: false }), f)).toBe("no");
  });

  it("requires every amenity, good-for, and drink pick", () => {
    const f = { ...none, amenities: ["outdoor" as const, "wheelchair" as const], goodFor: ["kids" as const] };
    expect(
      judge(place("ok", { outdoorSeating: true, accessibilityOptions: { wheelchairAccessibleEntrance: true }, goodForChildren: true }), f),
    ).toBe("match");
    expect(judge(place("partial", { outdoorSeating: true, goodForChildren: true }), f)).toBe("unknown");
    expect(judge(place("no", { outdoorSeating: true, accessibilityOptions: { wheelchairAccessibleEntrance: false }, goodForChildren: true }), f)).toBe("no");
  });

  it("judges rating, open now, price, and vegetarian", () => {
    const f = { ...none, minRating: 4.5 as const, openNow: true, prices: [1 as const, 2 as const], vegetarian: true };
    const good = place("g", { rating: 4.6, currentOpeningHours: { openNow: true }, priceLevel: "PRICE_LEVEL_MODERATE", servesVegetarianFood: true });
    expect(judge(good, f)).toBe("match");
    expect(judge(place("low", { rating: 4.2 }), f)).toBe("no");
    expect(judge(place("closed", { currentOpeningHours: { openNow: false } }), f)).toBe("no");
    expect(judge(place("pricey", { priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }), f)).toBe("no");
    expect(judge(place("meat", { servesVegetarianFood: false }), f)).toBe("no");
    expect(judge(place("blank"), f)).toBe("unknown");
  });
});

describe("rankByAttributes", () => {
  it("drops misses and puts confirmed matches before unknowns, keeping order within each", () => {
    const f = { ...none, drinks: ["beer" as const] };
    const places = [place("u1"), place("m1", { servesBeer: true }), place("n1", { servesBeer: false }), place("u2"), place("m2", { servesBeer: true })];
    expect(rankByAttributes(places, f).map((p) => p.id)).toEqual(["m1", "m2", "u1", "u2"]);
  });
});
