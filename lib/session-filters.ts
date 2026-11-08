/**
 * The host's filters, stored in sessions.filters (jsonb). Pure helpers shared
 * by the Create form, the sessions route (validation), and the Join screen.
 */

/** The distance slider's snap points. */
export const DISTANCES_MI = [0.25, 0.5, 1, 2, 3, 5, 10] as const;
export type DistanceMi = (typeof DISTANCES_MI)[number];

/** Google price levels: 1 = $ … 4 = $$$$. */
export const PRICE_LEVELS = [1, 2, 3, 4] as const;
export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const CUISINES = [
  "Korean",
  "Japanese",
  "Mexican",
  "Thai",
  "Italian",
  "Indian",
  "Mediterranean",
  "Pizza",
] as const;
export type Cuisine = (typeof CUISINES)[number];

export type SessionFilters = {
  /** What the host typed, or "Your location" after "Use mine". */
  areaLabel: string;
  distanceMi: DistanceMi;
  /** Empty means any price. */
  prices: PriceLevel[];
  cuisines: Cuisine[];
  openNow: boolean;
  vegetarian: boolean;
};

export const DEFAULT_FILTERS: SessionFilters = {
  areaLabel: "Harvard Square, Cambridge",
  distanceMi: 2,
  prices: [1, 2],
  cuisines: [],
  openNow: true,
  vegetarian: false,
};

export const MAX_AREA_LABEL = 80;

/** The explore map's filters: the session's until a member changes them for their own search. */
export type ExploreFilters = Pick<SessionFilters, "openNow" | "prices" | "cuisines">;

export function exploreFiltersFrom(filters: SessionFilters): ExploreFilters {
  return { openNow: filters.openNow, prices: [...filters.prices], cuisines: [...filters.cuisines] };
}

/** How many filters are on, for the Filters button's badge. */
export function activeFilterCount(filters: ExploreFilters): number {
  return (filters.openNow ? 1 : 0) + filters.prices.length + filters.cuisines.length;
}

/** "Korean,Thai" → ["Korean", "Thai"]; null when a name isn't one of CUISINES. */
export function parseCuisineList(value: string): Cuisine[] | null {
  if (value === "") return [];
  const names = value.split(",");
  if (!names.every((name) => isOneOf(CUISINES, name))) return null;
  return [...new Set(names as Cuisine[])];
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

  if (
    !Array.isArray(f.cuisines) ||
    !f.cuisines.every((c) => isOneOf(CUISINES, c))
  ) {
    return null;
  }
  const cuisines = [...new Set(f.cuisines as Cuisine[])];

  if (typeof f.openNow !== "boolean" || typeof f.vegetarian !== "boolean") {
    return null;
  }

  return {
    areaLabel,
    distanceMi: f.distanceMi,
    prices,
    cuisines,
    openNow: f.openNow,
    vegetarian: f.vegetarian,
  };
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
  const parts = [
    filters.cuisines.length ? filters.cuisines.join(", ") : "Any cuisine",
  ];
  const musts: string[] = [];
  if (filters.openNow) musts.push("open now");
  if (filters.vegetarian) musts.push("vegetarian options");
  if (musts.length) parts.push(musts.join(", "));
  return parts.join(", ");
}
