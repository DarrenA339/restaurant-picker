import type { Json, Tables } from "@/lib/database.types";
import { priceLabel, type PriceLevel } from "@/lib/session-filters";

export type RestaurantRow = Tables<"restaurants">;

export type LatLng = { lat: number; lng: number };

/** Who took the photo, shown next to it per Google's attribution rules. */
export type PhotoAttribution = { name: string; uri?: string };

/**
 * What restaurants.data holds. The add and deal routes write it from the
 * Places field mask in docs/SPEC.md (see lib/places/place.ts); everything
 * but `name` is optional so a sparse Places result still renders.
 */
export type RestaurantData = {
  name: string;
  cuisine?: string;
  priceLevel?: PriceLevel;
  rating?: number;
  userRatingCount?: number;
  location?: LatLng;
  photoUri?: string | null;
  photoAttributions?: PhotoAttribution[];
  googleMapsUri?: string;
  websiteUri?: string;
  openNow?: boolean;
  /** "11 PM" style, already formatted for the card. */
  closesAt?: string;
  servesVegetarianFood?: boolean;
};

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function attributions(value: unknown): PhotoAttribution[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.flatMap((item): PhotoAttribution[] => {
    if (typeof item !== "object" || item === null) return [];
    const a = item as Record<string, unknown>;
    const name = str(a.name);
    if (!name) return [];
    const uri = str(a.uri);
    return [uri ? { name, uri } : { name }];
  });
  return list.length ? list : undefined;
}

/** Lenient read of a stored data blob; null only when there is no name. */
export function readRestaurantData(json: Json): RestaurantData | null {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return null;
  const d = json as Record<string, unknown>;
  const name = str(d.name);
  if (!name) return null;

  const priceLevel = num(d.priceLevel);
  const loc =
    typeof d.location === "object" && d.location !== null
      ? (d.location as Record<string, unknown>)
      : null;
  const lat = loc ? num(loc.lat) : undefined;
  const lng = loc ? num(loc.lng) : undefined;

  return {
    name,
    cuisine: str(d.cuisine),
    priceLevel:
      priceLevel && priceLevel >= 1 && priceLevel <= 4
        ? (priceLevel as PriceLevel)
        : undefined,
    rating: num(d.rating),
    userRatingCount: num(d.userRatingCount),
    location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
    photoUri: str(d.photoUri) ?? null,
    photoAttributions: attributions(d.photoAttributions),
    googleMapsUri: str(d.googleMapsUri),
    websiteUri: str(d.websiteUri),
    openNow: typeof d.openNow === "boolean" ? d.openNow : undefined,
    closesAt: str(d.closesAt),
    servesVegetarianFood:
      typeof d.servesVegetarianFood === "boolean" ? d.servesVegetarianFood : undefined,
  };
}

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles. */
export function distanceMi(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

/** "0.7 mi", "1.1 mi", "3 mi": one decimal under 10, none above. */
export function formatMiles(mi: number): string {
  const rounded = mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi);
  return `${rounded} mi`;
}

/** The lobby row's second line: "Korean · $$ · 0.7 mi", skipping unknowns. */
export function restaurantMeta(data: RestaurantData, origin: LatLng | null): string {
  const parts: string[] = [];
  if (data.cuisine) parts.push(data.cuisine);
  if (data.priceLevel) parts.push(priceLabel(data.priceLevel));
  if (origin && data.location) parts.push(formatMiles(distanceMi(origin, data.location)));
  return parts.join(" · ");
}

/** The explore row's second line adds the rating: "Chinese · $ · ★ 4.6 · 0.8 mi". */
export function searchMeta(data: RestaurantData, origin: LatLng | null): string {
  const parts: string[] = [];
  if (data.cuisine) parts.push(data.cuisine);
  if (data.priceLevel) parts.push(priceLabel(data.priceLevel));
  if (data.rating !== undefined) parts.push(`★ ${data.rating.toFixed(1)}`);
  if (origin && data.location) parts.push(formatMiles(distanceMi(origin, data.location)));
  return parts.join(" · ");
}
