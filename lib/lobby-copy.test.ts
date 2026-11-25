import { describe, expect, it } from "vitest";
import {
  canStart,
  firstBatch,
  mixText,
  peopleLabel,
  readyLabel,
  startLabel,
  startNote,
  startWithoutQuestion,
  useMethodLabel,
  votingMethodLabel,
} from "./lobby-copy";
import { distanceLabel, distanceMi, formatMiles, readRestaurantData, restaurantMeta } from "./restaurants";
import {
  activeFilterCount,
  clearedFilters,
  DEFAULT_FILTERS,
  exploreFiltersFrom,
  parseCuisineList,
  parseFilters,
  pricePillText,
  priceRange,
  pricesBetween,
  searchFiltersFromParams,
  searchFiltersToParams,
} from "./session-filters";

describe("lobby copy", () => {
  it("labels the voting method like the design", () => {
    expect(votingMethodLabel("borda")).toBe("Ranked points (Borda count)");
    expect(votingMethodLabel("plurality")).toBe("One vote each (Plurality)");
    expect(useMethodLabel("quadratic")).toBe("Use quadratic votes");
  });

  it("counts people for the Who's here card", () => {
    expect(peopleLabel(1)).toBe("1 person");
    expect(peopleLabel(4)).toBe("4 people");
  });

  it("splits the first batch by the mix", () => {
    expect(firstBatch(14, 10, "mostly_adds")).toEqual({ adds: 8, suggestions: 2 });
    expect(firstBatch(3, 10, "mostly_adds")).toEqual({ adds: 3, suggestions: 7 });
    expect(firstBatch(14, 20, "adds_only")).toEqual({ adds: 14, suggestions: 0 });
  });

  it("writes the start note from the first batch", () => {
    expect(startNote(14, 10, "mostly_adds")).toBe("First 10 cards: 8 added, 2 new");
    expect(startNote(1, 20, "half")).toBe("First 20 cards: 1 added, 19 new");
    expect(startNote(14, 10, "adds_only")).toBe("First 10 cards: all added by the group");
    expect(startNote(1, 10, "adds_only")).toBe("First card: all added by the group");
    expect(startNote(0, 5, "mostly_new")).toBe("First 5 cards: all new places");
    expect(startNote(0, 10, "adds_only")).toBe("Add a spot, or move the mix toward new places, to start.");
  });

  it("only lets the host start with something to deal", () => {
    expect(canStart(0, "adds_only")).toBe(false);
    expect(canStart(0, "mostly_adds")).toBe(true);
    expect(canStart(1, "adds_only")).toBe(true);
  });

  it("explains the mix from the host's filters", () => {
    expect(mixText("mostly_adds", DEFAULT_FILTERS)).toBe(
      "About 75% of each batch is the group’s adds. The rest are new places near Harvard Square, up to 2 mi and $ to $$.",
    );
    expect(mixText("adds_only", DEFAULT_FILTERS)).toBe("Every card is a spot the group added. No new places.");
  });

  it("words the ready check", () => {
    expect(readyLabel(2, 3)).toBe("2 of 3 ready");
    expect(startLabel(false)).toBe("Start picking");
    expect(startLabel(true)).toBe("Everyone’s ready. Start picking");
    expect(startWithoutQuestion(["Nia"])).toBe("Start without Nia?");
    expect(startWithoutQuestion(["Nia", "Sam"])).toBe("Start without Nia and Sam?");
    expect(startWithoutQuestion(["Nia", "Sam", "Jo", "Lee"])).toBe("Start without Nia, Sam and 2 more?");
  });
});

describe("restaurant meta", () => {
  const harvardSquare = { lat: 42.3736, lng: -71.119 };

  it("measures distance in miles", () => {
    expect(distanceMi(harvardSquare, harvardSquare)).toBe(0);
    // Central Square is about a mile down Mass Ave.
    const central = { lat: 42.3653, lng: -71.1036 };
    expect(distanceMi(harvardSquare, central)).toBeGreaterThan(0.9);
    expect(distanceMi(harvardSquare, central)).toBeLessThan(1.1);
  });

  it("formats miles with one decimal under ten", () => {
    expect(formatMiles(0.7449)).toBe("0.7 mi");
    expect(formatMiles(1.06)).toBe("1.1 mi");
    expect(formatMiles(12.4)).toBe("12 mi");
  });

  it("joins only the parts it knows", () => {
    const data = { name: "Juniper & Rice", cuisine: "Korean", priceLevel: 2 as const };
    expect(restaurantMeta(data, harvardSquare)).toBe("Korean · $$");
    expect(restaurantMeta({ ...data, location: harvardSquare }, harvardSquare)).toBe(
      "Korean · $$ · 0 mi",
    );
    expect(restaurantMeta({ name: "Mystery" }, null)).toBe("");
  });

  it("says where a distance is measured from", () => {
    const central = { lat: 42.3653, lng: -71.1036 };
    const mit = { lat: 42.3601, lng: -71.0942 };
    // The viewer's own location wins, and only then is it "from you".
    expect(distanceLabel(harvardSquare, mit, central)).toBe("1 mi from you");
    expect(distanceLabel(null, mit, central)).toBe("0.6 mi from the meeting area");
    expect(distanceLabel(null, null, central)).toBeNull();
    expect(distanceLabel(harvardSquare, mit, undefined)).toBeNull();
  });
});

describe("stored details", () => {
  it("reads back what it understands and drops the rest", () => {
    const data = readRestaurantData({
      name: "Juniper & Rice",
      details: {
        summary: { kind: "editorial", text: "Casual Korean spot." },
        priceRange: "$20–30",
        weekHours: [{ day: "Monday", hours: "Closed" }, { day: 3 }],
        attributes: ["groups", "jacuzzi"],
        reviews: [{ author: "Dana L.", text: "Great.", rating: 5 }, { text: "No author" }],
        photos: [{ name: "places/X/photos/a", attributions: [{ name: "Sam" }] }, {}],
      },
    });
    expect(data?.details).toMatchObject({
      summary: { kind: "editorial", text: "Casual Korean spot." },
      priceRange: "$20–30",
      weekHours: [{ day: "Monday", hours: "Closed" }],
      attributes: ["groups"],
      reviews: [{ author: "Dana L.", text: "Great.", rating: 5 }],
      photos: [{ name: "places/X/photos/a", attributions: [{ name: "Sam" }] }],
    });
  });

  it("is absent on a row dealt before the sheet grew", () => {
    expect(readRestaurantData({ name: "Old card", details: {} })?.details).toBeUndefined();
    expect(readRestaurantData({ name: "Old card" })?.details).toBeUndefined();
  });
});

describe("explore filters", () => {
  it("start as the session's filters and count what's on", () => {
    const filters = exploreFiltersFrom(DEFAULT_FILTERS);
    expect(filters).toMatchObject({ openNow: true, prices: [1, 2], cuisines: [], meals: [], minRating: 0 });
    expect(filters).not.toHaveProperty("areaLabel");
    // Open now and a narrowed price range.
    expect(activeFilterCount(filters)).toBe(2);
    expect(activeFilterCount(clearedFilters(filters))).toBe(0);
    expect(
      activeFilterCount({
        ...clearedFilters(filters),
        prices: [1, 2, 3, 4],
        cuisines: ["thai_restaurant", "korean_restaurant"],
        meals: ["brunch"],
        minRating: 4.5,
        vegetarian: true,
        amenities: ["outdoor"],
      }),
    ).toBe(6);
  });

  it("parse stored filters, mapping the first sessions' cuisine names onto Google types", () => {
    const legacy = { ...DEFAULT_FILTERS, cuisines: ["Korean", "Pizza"] };
    expect(parseFilters(legacy)?.cuisines).toEqual(["korean_restaurant", "pizza_restaurant"]);
    expect(parseFilters({ ...DEFAULT_FILTERS, cuisines: ["Martian"] })).toBeNull();
    const { meals: _m, goodFor: _g, amenities: _a, drinks: _d, minRating: _r, ...older } = DEFAULT_FILTERS;
    void [_m, _g, _a, _d, _r];
    expect(parseFilters(older)).toMatchObject({ meals: [], goodFor: [], amenities: [], drinks: [], minRating: 0 });
    expect(parseFilters({ ...DEFAULT_FILTERS, minRating: 3 })).toBeNull();
  });

  it("map the price slider's handles to and from the stored levels", () => {
    expect(priceRange([1, 2])).toEqual([1, 2]);
    expect(priceRange([3])).toEqual([3, 3]);
    expect(priceRange([])).toEqual([1, 4]);
    expect(pricesBetween(2, 4)).toEqual([2, 3, 4]);
    expect(pricesBetween(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pricePillText([1, 2])).toBe("$ to $$");
    expect(pricePillText([2])).toBe("$$ only");
    expect(pricePillText([])).toBe("$ to $$$$");
  });

  it("round-trip search filters through a query string, over the session's", () => {
    const base = exploreFiltersFrom(DEFAULT_FILTERS);
    const changed = { ...base, prices: [3 as const, 4 as const], meals: ["brunch" as const], minRating: 4 as const, drinks: ["wine" as const], openNow: false };
    const params = new URLSearchParams(searchFiltersToParams(changed));
    expect(searchFiltersFromParams(base, (key) => params.get(key))).toEqual(changed);
    // A missing key keeps the session's value; a bad one rejects the request.
    expect(searchFiltersFromParams(base, () => null)).toEqual(base);
    expect(searchFiltersFromParams(base, (key) => (key === "openNow" ? "false" : null))).toEqual({ ...base, openNow: false });
    expect(searchFiltersFromParams(base, (key) => (key === "minRating" ? "3" : null))).toBeNull();
    expect(searchFiltersFromParams(base, (key) => (key === "meals" ? "tea" : null))).toBeNull();
    expect(searchFiltersFromParams(base, (key) => (key === "prices" ? "" : null))).toEqual({ ...base, prices: [] });
  });

  it("parse a cuisine list from a query string", () => {
    expect(parseCuisineList("")).toEqual([]);
    expect(parseCuisineList("korean_restaurant,thai_restaurant,korean_restaurant")).toEqual([
      "korean_restaurant",
      "thai_restaurant",
    ]);
    expect(parseCuisineList("korean_restaurant,martian_restaurant")).toBeNull();
  });
});
