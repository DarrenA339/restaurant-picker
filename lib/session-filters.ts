/**
 * The host's filters, stored in sessions.filters (jsonb). Pure helpers shared
 * by the Create form, the sessions route (validation), and the Join screen.
 */

import { cuisineLabel, toCuisineType, type CuisineType } from "@/lib/places/cuisines";

/** The distance slider's snap points. */
export const DISTANCES_MI = [0.25, 0.5, 1, 2, 3, 5, 10] as const;
export type DistanceMi = (typeof DISTANCES_MI)[number];

/** Google price levels: 1 = $ … 4 = $$$$. */
export const PRICE_LEVELS = [1, 2, 3, 4] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const MEALS = ["breakfast", "brunch", "lunch", "dinner", "dessert", "coffee"] as const;
export type Meal = (typeof MEALS)[number];
export const mealLabel: Record<Meal, string> = {
  breakfast: "Breakfast",
  brunch: "Brunch",
  lunch: "Lunch",
  dinner: "Dinner",
  dessert: "Dessert",
  coffee: "Coffee",
};

export const RATINGS = [0, 4, 4.5] as const;
export type MinRating = (typeof RATINGS)[number];
export const ratingLabel: Record<MinRating, string> = { 0: "Any", 4: "4.0+", 4.5: "4.5+" };

export const GOOD_FOR = ["groups", "kids", "sports"] as const;
export type GoodFor = (typeof GOOD_FOR)[number];
export const goodForLabel: Record<GoodFor, string> = {
  groups: "Groups",
  kids: "Kids",
  sports: "Watching sports",
};

export const AMENITIES = [
  "reservations",
  "outdoor",
  "dine_in",
  "takeout",
  "delivery",
  "dogs",
  "wheelchair",
  "live_music",
] as const;
export type Amenity = (typeof AMENITIES)[number];
export const amenityLabel: Record<Amenity, string> = {
  reservations: "Reservations",
  outdoor: "Outdoor seating",
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
  dogs: "Dogs allowed",
  wheelchair: "Wheelchair accessible",
  live_music: "Live music",
};

export const DRINKS = ["beer", "wine", "cocktails"] as const;
export type Drink = (typeof DRINKS)[number];
export const drinkLabel: Record<Drink, string> = { beer: "Beer", wine: "Wine", cocktails: "Cocktails" };

export type SessionFilters = {
  /** What the host typed, or "Your location" after "Use my location". */
  areaLabel: string;
  distanceMi: DistanceMi;
  /** Empty means any price. */
  prices: PriceLevel[];
  /** Google place types, e.g. "korean_restaurant"; any of them. */
  cuisines: CuisineType[];
  /** Any of them. */
  meals: Meal[];
  minRating: MinRating;
  openNow: boolean;
  vegetarian: boolean;
  /** All of them. */
  goodFor: GoodFor[];
  amenities: Amenity[];
  drinks: Drink[];
};

/** Everything but where: what a search is filtered by (the session's, or the explore map's own). */
export type SearchFilters = Omit<SessionFilters, "areaLabel">;

export const DEFAULT_FILTERS: SessionFilters = {
  areaLabel: "Harvard Square, Cambridge",
  distanceMi: 2,
  prices: [1, 2],
  cuisines: [],
  meals: [],
  minRating: 0,
  openNow: true,
  vegetarian: false,
  goodFor: [],
  amenities: [],
  drinks: [],
};

export const MAX_AREA_LABEL = 80;

/** The explore map's filters: the session's until a member changes them for their own search. */
export type ExploreFilters = SearchFilters;

export function exploreFiltersFrom(filters: SessionFilters): ExploreFilters {
  const { areaLabel: _label, ...rest } = filters;
  void _label;
  return structuredClone(rest);
}

/** Nothing on: what Reset gives. */
export function clearedFilters(filters: SearchFilters): SearchFilters {
  return {
    ...filters,
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
}

/** How many filters are on, for the Filters button's badge: each pick counts, a narrowed price range counts once. */
export function activeFilterCount(filters: SearchFilters): number {
  const priceNarrowed = filters.prices.length > 0 && filters.prices.length < PRICE_LEVELS.length ? 1 : 0;
  return (
    (filters.openNow ? 1 : 0) +
    priceNarrowed +
    filters.cuisines.length +
    filters.meals.length +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.vegetarian ? 1 : 0) +
    filters.goodFor.length +
    filters.amenities.length +
    filters.drinks.length
  );
}

/** "korean_restaurant,thai_restaurant" → the types; null when one isn't a cuisine type. */
export function parseCuisineList(value: string): CuisineType[] | null {
  if (value === "") return [];
  const out: CuisineType[] = [];
  for (const raw of value.split(",")) {
    const type = toCuisineType(raw);
    if (!type) return null;
    if (!out.includes(type)) out.push(type);
  }
  return out;
}

/** "a,b" → the allowed values; null when one isn't allowed; [] for an empty string. */
export function parseList<T extends readonly string[]>(allowed: T, value: string): T[number][] | null {
  return listOf(allowed, value === "" ? [] : value.split(","));
}

/** The query-string form of search filters, for GET /api/places/search. */
export function searchFiltersToParams(filters: SearchFilters): Record<string, string> {
  return {
    distance: String(filters.distanceMi),
    prices: filters.prices.join(","),
    cuisines: filters.cuisines.join(","),
    meals: filters.meals.join(","),
    minRating: String(filters.minRating),
    openNow: String(filters.openNow),
    vegetarian: String(filters.vegetarian),
    goodFor: filters.goodFor.join(","),
    amenities: filters.amenities.join(","),
    drinks: filters.drinks.join(","),
  };
}

/**
 * The search filters a request carries, each over the session's own; null
 * when a value is malformed. A missing key keeps the session's value, so
 * the explore map's first search is the session's.
 */
export function searchFiltersFromParams(
  base: SearchFilters,
  get: (key: string) => string | null,
): SearchFilters | null {
  const out: SearchFilters = structuredClone(base);
  const distance = get("distance");
  if (distance !== null) {
    const mi = Number(distance);
    if (!isOneOf(DISTANCES_MI, mi)) return null;
    out.distanceMi = mi;
  }
  const prices = get("prices");
  if (prices !== null) {
    const levels = prices === "" ? [] : prices.split(",").map(Number);
    if (!levels.every((n) => isOneOf(PRICE_LEVELS, n))) return null;
    out.prices = [...new Set(levels as PriceLevel[])].sort((a, b) => a - b);
  }
  const cuisines = get("cuisines");
  if (cuisines !== null) {
    const list = parseCuisineList(cuisines);
    if (!list) return null;
    out.cuisines = list;
  }
  const rating = get("minRating");
  if (rating !== null) {
    const n = Number(rating);
    if (!isOneOf(RATINGS, n)) return null;
    out.minRating = n;
  }
  for (const key of ["openNow", "vegetarian"] as const) {
    const value = get(key);
    if (value === null) continue;
    if (value !== "true" && value !== "false") return null;
    out[key] = value === "true";
  }
  const meals = get("meals");
  const goodFor = get("goodFor");
  const amenities = get("amenities");
  const drinks = get("drinks");
  const mealList = meals === null ? out.meals : parseList(MEALS, meals);
  const goodForList = goodFor === null ? out.goodFor : parseList(GOOD_FOR, goodFor);
  const amenityList = amenities === null ? out.amenities : parseList(AMENITIES, amenities);
  const drinkList = drinks === null ? out.drinks : parseList(DRINKS, drinks);
  if (!mealList || !goodForList || !amenityList || !drinkList) return null;
  out.meals = mealList;
  out.goodFor = goodForList;
  out.amenities = amenityList;
  out.drinks = drinkList;
  return out;
}

function isOneOf<T extends readonly unknown[]>(
  list: T,
  value: unknown,
): value is T[number] {
  return (list as readonly unknown[]).includes(value);
}

/** Strict parse of untrusted JSON (a route body or a stored row). */
export function parseFilters(input: unknown): SessionFilters | null {
  if (typeof input !== "object" || input === null) return null;
  const f = input as Record<string, unknown>;

  const areaLabel = typeof f.areaLabel === "string" ? f.areaLabel.trim() : "";
  if (areaLabel.length < 1 || areaLabel.length > MAX_AREA_LABEL) return null;

  if (!isOneOf(DISTANCES_MI, f.distanceMi)) return null;

  if (
    !Array.isArray(f.prices) ||
    !f.prices.every((p) => isOneOf(PRICE_LEVELS, p))
  ) {
    return null;
  }
  const prices = [...new Set(f.prices as PriceLevel[])].sort((a, b) => a - b);

  // Cuisines are Google types; the first sessions stored a few plain names, which still map.
  if (!Array.isArray(f.cuisines)) return null;
  const cuisines: CuisineType[] = [];
  for (const raw of f.cuisines) {
    const type = toCuisineType(raw);
    if (!type) return null;
    if (!cuisines.includes(type)) cuisines.push(type);
  }

  if (typeof f.openNow !== "boolean" || typeof f.vegetarian !== "boolean") {
    return null;
  }

  // The sections added later default to off, so earlier sessions still parse.
  const meals = listOf(MEALS, f.meals);
  const goodFor = listOf(GOOD_FOR, f.goodFor);
  const amenities = listOf(AMENITIES, f.amenities);
  const drinks = listOf(DRINKS, f.drinks);
  if (!meals || !goodFor || !amenities || !drinks) return null;
  const minRating = f.minRating === undefined ? 0 : isOneOf(RATINGS, f.minRating) ? f.minRating : null;
  if (minRating === null) return null;

  return {
    areaLabel,
    distanceMi: f.distanceMi,
    prices,
    cuisines,
    meals,
    minRating,
    openNow: f.openNow,
    vegetarian: f.vegetarian,
    goodFor,
    amenities,
    drinks,
  };
}

/** An optional list of values from `allowed`, deduped; missing means none; anything else is invalid. */
function listOf<T extends readonly string[]>(allowed: T, value: unknown): T[number][] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((v) => isOneOf(allowed, v))) return null;
  return [...new Set(value as T[number][])];
}

/** The filter sections a search can apply, for the routes. */
export function parseSearchFilters(input: unknown): SearchFilters | null {
  if (typeof input !== "object" || input === null) return null;
  const parsed = parseFilters({ ...(input as Record<string, unknown>), areaLabel: "x" });
  if (!parsed) return null;
  const { areaLabel: _label, ...rest } = parsed;
  void _label;
  return rest;
}

export function formatDistance(mi: DistanceMi): string {
  return `${mi} mi`;
}

export function priceLabel(level: PriceLevel): string {
  return "$".repeat(level);
}

/** The price slider's handles: the lowest and highest level that work; an empty list means every level. */
export function priceRange(prices: readonly PriceLevel[]): [PriceLevel, PriceLevel] {
  if (prices.length === 0) return [1, 4];
  return [Math.min(...prices) as PriceLevel, Math.max(...prices) as PriceLevel];
}

/** Every level from `lo` to `hi`, which is what the filters store. */
export function pricesBetween(lo: PriceLevel, hi: PriceLevel): PriceLevel[] {
  return PRICE_LEVELS.filter((level) => level >= lo && level <= hi);
}

/** The price slider's pill: "$ to $$", or "$$ only" when both handles sit on one level. */
export function pricePillText(prices: readonly PriceLevel[]): string {
  const [lo, hi] = priceRange(prices);
  return lo === hi ? `${priceLabel(lo)} only` : `${priceLabel(lo)} to ${priceLabel(hi)}`;
}

export const priceName: Record<PriceLevel, string> = {
  1: "Inexpensive",
  2: "Moderate",
  3: "Expensive",
  4: "Very expensive",
};

/** "$ to $$", "$$", or "any price". */
export function priceRangeText(prices: PriceLevel[]): string {
  if (prices.length === 0) return "any price";
  const min = Math.min(...prices) as PriceLevel;
  const max = Math.max(...prices) as PriceLevel;
  return min === max
    ? priceLabel(min)
    : `${priceLabel(min)} to ${priceLabel(max)}`;
}

/** The short area name: "Harvard Square, Cambridge" → "Harvard Square". */
export function shortArea(label: string): string {
  return label.split(",")[0].trim() || label;
}

/** The Join screen's one-liner: "Near Harvard Square, up to 2 mi, $ to $$". */
export function joinSummary(filters: SessionFilters): string {
  return `Near ${shortArea(filters.areaLabel)}, up to ${formatDistance(
    filters.distanceMi,
  )}, ${priceRangeText(filters.prices)}`;
}

/** The Create form's collapsed "More preferences" line: "Any cuisine, open now". */
export function moreSummary(filters: SessionFilters): string {
  const parts = [filters.cuisines.length ? filters.cuisines.map(cuisineLabel).join(", ") : "Any cuisine"];
  if (filters.meals.length) parts.push(filters.meals.map((m) => mealLabel[m].toLowerCase()).join(", "));
  if (filters.minRating > 0) parts.push(`${ratingLabel[filters.minRating]} rated`);
  const musts: string[] = [];
  if (filters.openNow) musts.push("open now");
  if (filters.vegetarian) musts.push("vegetarian options");
  musts.push(...filters.goodFor.map((g) => goodForLabel[g].toLowerCase()));
  musts.push(...filters.amenities.map((a) => amenityLabel[a].toLowerCase()));
  musts.push(...filters.drinks.map((d) => drinkLabel[d].toLowerCase()));
  if (musts.length) parts.push(musts.join(", "));
  return parts.join(", ");
}
