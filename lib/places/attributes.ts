import type { GooglePlace } from "@/lib/places/place";
import { PRICE_LEVEL_ENUM } from "@/lib/places/place";
import type { Amenity, Drink, GoodFor, Meal, SearchFilters } from "@/lib/session-filters";

/**
 * The filters Google can't apply in a Text Search (and none of them in a
 * Nearby Search), judged on the server after the search. Google often has
 * no value for an attribute, so a place is dropped only when it is
 * confirmed not to match, and confirmed matches rank above unknown ones.
 */

export type Verdict = "match" | "unknown" | "no";

const MEAL_FIELD: Record<Meal, keyof GooglePlace> = {
  breakfast: "servesBreakfast",
  brunch: "servesBrunch",
  lunch: "servesLunch",
  dinner: "servesDinner",
  dessert: "servesDessert",
  coffee: "servesCoffee",
};

const GOOD_FOR_FIELD: Record<GoodFor, keyof GooglePlace> = {
  groups: "goodForGroups",
  kids: "goodForChildren",
  sports: "goodForWatchingSports",
};

const DRINK_FIELD: Record<Drink, keyof GooglePlace> = {
  beer: "servesBeer",
  wine: "servesWine",
  cocktails: "servesCocktails",
};

const AMENITY_FIELD: Record<Exclude<Amenity, "wheelchair">, keyof GooglePlace> = {
  reservations: "reservable",
  outdoor: "outdoorSeating",
  dine_in: "dineIn",
  takeout: "takeout",
  delivery: "delivery",
  dogs: "allowsDogs",
  live_music: "liveMusic",
};

function flag(place: GooglePlace, field: keyof GooglePlace): boolean | undefined {
  const value = place[field];
  return typeof value === "boolean" ? value : undefined;
}

function amenityFlag(place: GooglePlace, amenity: Amenity): boolean | undefined {
  if (amenity === "wheelchair") {
    const entrance = place.accessibilityOptions?.wheelchairAccessibleEntrance;
    return typeof entrance === "boolean" ? entrance : undefined;
  }
  return flag(place, AMENITY_FIELD[amenity]);
}

/** Any of the picked flags true → match; all of them known false → no; otherwise unknown. */
function anyOf(flags: (boolean | undefined)[]): Verdict {
  if (flags.length === 0) return "match";
  if (flags.some((f) => f === true)) return "match";
  if (flags.every((f) => f === false)) return "no";
  return "unknown";
}

/** Every picked flag must hold: one known false → no; all known true → match; otherwise unknown. */
function allOf(flags: (boolean | undefined)[]): Verdict {
  if (flags.some((f) => f === false)) return "no";
  if (flags.every((f) => f === true)) return "match";
  return "unknown";
}

function combine(verdicts: Verdict[]): Verdict {
  if (verdicts.includes("no")) return "no";
  if (verdicts.every((v) => v === "match")) return "match";
  return "unknown";
}

/**
 * How a place fares against the filters. Cuisines and meals are "any of"
 * (a Korean or Thai place; somewhere that does breakfast or brunch); good
 * for, amenities, drinks, dietary, rating, open now, and price must all
 * hold. Price and open now are judged too, which matters for Nearby Search,
 * where Google applies neither.
 */
export function judge(place: GooglePlace, filters: SearchFilters): Verdict {
  const verdicts: Verdict[] = [];

  if (filters.cuisines.length) {
    const types = place.types;
    if (!types) verdicts.push("unknown");
    else verdicts.push(filters.cuisines.some((type) => types.includes(type)) ? "match" : "no");
  }
  if (filters.meals.length) verdicts.push(anyOf(filters.meals.map((meal) => flag(place, MEAL_FIELD[meal]))));
  if (filters.minRating > 0) {
    verdicts.push(
      typeof place.rating !== "number" ? "unknown" : place.rating >= filters.minRating ? "match" : "no",
    );
  }
  if (filters.openNow) {
    const open = place.currentOpeningHours?.openNow;
    verdicts.push(typeof open !== "boolean" ? "unknown" : open ? "match" : "no");
  }
  if (filters.prices.length) {
    const wanted = new Set(filters.prices.map((level) => PRICE_LEVEL_ENUM[level]));
    verdicts.push(!place.priceLevel ? "unknown" : wanted.has(place.priceLevel) ? "match" : "no");
  }
  if (filters.vegetarian) verdicts.push(allOf([flag(place, "servesVegetarianFood")]));
  if (filters.goodFor.length) verdicts.push(allOf(filters.goodFor.map((g) => flag(place, GOOD_FOR_FIELD[g]))));
  if (filters.amenities.length) verdicts.push(allOf(filters.amenities.map((a) => amenityFlag(place, a))));
  if (filters.drinks.length) verdicts.push(allOf(filters.drinks.map((d) => flag(place, DRINK_FIELD[d]))));

  return combine(verdicts);
}

/** The places that aren't confirmed misses, confirmed matches first and Google's order kept within each group. */
export function rankByAttributes<T extends GooglePlace>(places: readonly T[], filters: SearchFilters): T[] {
  const matches: T[] = [];
  const unknowns: T[] = [];
  for (const place of places) {
    const verdict = judge(place, filters);
    if (verdict === "match") matches.push(place);
    else if (verdict === "unknown") unknowns.push(place);
  }
  return [...matches, ...unknowns];
}
