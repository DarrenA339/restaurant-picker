import { describe, expect, it } from "vitest";
import {
  canStart,
  fillCount,
  peopleLabel,
  startNote,
  suggestionsText,
  useMethodLabel,
  votingMethodLabel,
} from "./lobby-copy";
import { distanceMi, formatMiles, restaurantMeta } from "./restaurants";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  exploreFiltersFrom,
  parseCuisineList,
  pricePillText,
  priceRange,
  pricesBetween,
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

  it("fills the first batch to 20 only when suggestions are on", () => {
    expect(fillCount(14, true)).toBe(6);
    expect(fillCount(25, true)).toBe(0);
    expect(fillCount(14, false)).toBe(0);
  });

  it("writes the start note for both cases", () => {
    expect(startNote(14, true)).toBe("14 added spots first, then 6 suggestions");
    expect(startNote(1, true)).toBe("1 added spot first, then 19 suggestions");
    expect(startNote(14, false)).toBe("14 spots, all added by the group");
    expect(startNote(1, false)).toBe("1 spot, all added by the group");
    expect(startNote(0, false)).toBe("Add a spot or turn suggestions on to start.");
  });

  it("only lets the host start with something to deal", () => {
    expect(canStart(0, false)).toBe(false);
    expect(canStart(0, true)).toBe(true);
    expect(canStart(1, false)).toBe(true);
  });

  it("explains suggestions from the host's filters, or who turned them off", () => {
    const base = { filters: DEFAULT_FILTERS, totalAdds: 14, hostName: "Sam" };
    expect(suggestionsText({ ...base, suggestionsOn: true, isHost: true })).toBe(
      "6 more spots near Harvard Square that fit the plan, up to 2 mi and $ to $$. They come after the group’s adds.",
    );
    expect(suggestionsText({ ...base, suggestionsOn: false, isHost: true })).toBe(
      "Off. The deck is only what the group added.",
    );
    expect(suggestionsText({ ...base, suggestionsOn: false, isHost: false })).toBe(
      "Sam turned these off. The deck is only what the group added.",
    );
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
});

describe("explore filters", () => {
  it("start as the session's filters and count what's on", () => {
    const filters = exploreFiltersFrom(DEFAULT_FILTERS);
    expect(filters).toEqual({ openNow: true, prices: [1, 2], cuisines: [] });
    expect(activeFilterCount(filters)).toBe(3);
    expect(activeFilterCount({ openNow: false, prices: [], cuisines: [] })).toBe(0);
    expect(activeFilterCount({ openNow: false, prices: [3], cuisines: ["Thai", "Korean"] })).toBe(3);
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

  it("parse a cuisine list from a query string", () => {
    expect(parseCuisineList("")).toEqual([]);
    expect(parseCuisineList("Korean,Thai,Korean")).toEqual(["Korean", "Thai"]);
    expect(parseCuisineList("Korean,Martian")).toBeNull();
  });
});
