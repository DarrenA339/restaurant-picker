/**
 * The host's filters, stored in sessions.filters (jsonb). Pure helpers shared
 * by the Create form, the sessions route (validation), and the Join screen.
 */

export const DISTANCES_MI = [0.5, 1, 2, 5] as const;
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
