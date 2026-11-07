import type { LatLng, PhotoAttribution, RestaurantData } from "@/lib/restaurants";
import type { PriceLevel, SessionFilters } from "@/lib/session-filters";

/** The subset of Google's Place resource the field mask asks for. */
export type LocalizedText = { text?: string; languageCode?: string };

export type GooglePhoto = {
  name?: string;
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
};

export type GooglePlace = {
  id?: string;
  displayName?: LocalizedText;
  primaryTypeDisplayName?: LocalizedText;
  location?: { latitude?: number; longitude?: number };
  photos?: GooglePhoto[];
  googleMapsUri?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    nextCloseTime?: string;
    nextOpenTime?: string;
    weekdayDescriptions?: string[];
  };
  utcOffsetMinutes?: number;
  servesVegetarianFood?: boolean;
};

/**
 * What the add rules need from Google. lib/places/google.ts implements it
 * for real; lib/adds.test.ts implements it with vi.fn(), which is why this
 * type lives here and not next to the server client.
 */
export type PlacesPort = {
  details(placeId: string, sessionToken?: string): Promise<GooglePlace>;
  /** Resolves one photo once; null when Google returns no URI. */
  photoUri(photoName: string): Promise<string | null>;
};

/** One explore result: the place id and card data (no photo until it is added). */
export type PlaceResult = { placeId: string; data: RestaurantData };

/** Google's priceLevel enum as the 1..4 levels in sessions.filters. */
export const PRICE_LEVEL_ENUM: Record<PriceLevel, string> = {
  1: "PRICE_LEVEL_INEXPENSIVE",
  2: "PRICE_LEVEL_MODERATE",
  3: "PRICE_LEVEL_EXPENSIVE",
  4: "PRICE_LEVEL_VERY_EXPENSIVE",
};

const PRICE_LEVEL_FROM_ENUM = new Map<string, PriceLevel>(
  (Object.entries(PRICE_LEVEL_ENUM) as [string, string][]).map(([level, name]) => [
    name,
    Number(level) as PriceLevel,
  ]),
);

/** Boston only until the app grows: where a session with no location at all searches. */
export const DEFAULT_ZONE = "America/New_York";

function clock(hours24: number, minutes: number): string {
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const h = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return minutes === 0 ? `${h} ${suffix}` : `${h}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/**
 * An RFC 3339 instant as a local clock time, "11 PM" or "9:30 PM". Uses the
 * place's UTC offset when Google sends one, else the default zone.
 */
export function formatLocalTime(
  iso: string,
  offsetMinutes?: number,
  fallbackZone = DEFAULT_ZONE,
): string | undefined {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return undefined;
  if (typeof offsetMinutes === "number" && Number.isFinite(offsetMinutes)) {
    const local = new Date(ms + offsetMinutes * 60_000);
    return clock(local.getUTCHours(), local.getUTCMinutes());
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    timeZone: fallbackZone,
  }).formatToParts(new Date(ms));
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  const minute = Number(parts.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return undefined;
  return clock(hour % 24, minute);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** "Korean Restaurant" → "Korean"; "Restaurant" and "Cafe" stay as they are. */
export function cuisineFrom(typeName: string): string {
  const trimmed = typeName.trim();
  const stripped = trimmed.replace(/\s+restaurant$/i, "").trim();
  return stripped || trimmed;
}

/**
 * A Places result as the data blob stored on a restaurants row. Absent
 * fields are left out rather than set to undefined, so the JSON Google
 * didn't send doesn't turn into keys that are there but empty.
 */
export function toRestaurantData(place: GooglePlace, photoUri: string | null): RestaurantData {
  const data: RestaurantData = {
    name: place.displayName?.text?.trim() || "Unnamed spot",
    photoUri,
  };

  const typeName = place.primaryTypeDisplayName?.text?.trim();
  if (typeName) data.cuisine = cuisineFrom(typeName);

  const priceLevel = place.priceLevel ? PRICE_LEVEL_FROM_ENUM.get(place.priceLevel) : undefined;
  if (priceLevel) data.priceLevel = priceLevel;

  if (finite(place.rating)) data.rating = place.rating;
  if (finite(place.userRatingCount)) data.userRatingCount = place.userRatingCount;

  const lat = place.location?.latitude;
  const lng = place.location?.longitude;
  if (finite(lat) && finite(lng)) data.location = { lat, lng };

  const attributions = (place.photos?.[0]?.authorAttributions ?? []).flatMap(
    (a): PhotoAttribution[] => {
      const name = a.displayName?.trim();
      if (!name) return [];
      return [a.uri ? { name, uri: a.uri } : { name }];
    },
  );
  if (attributions.length) data.photoAttributions = attributions;

  if (place.googleMapsUri) data.googleMapsUri = place.googleMapsUri;
  if (place.websiteUri) data.websiteUri = place.websiteUri;

  const hours = place.currentOpeningHours;
  if (typeof hours?.openNow === "boolean") {
    data.openNow = hours.openNow;
    if (hours.openNow && hours.nextCloseTime) {
      const closesAt = formatLocalTime(hours.nextCloseTime, place.utcOffsetMinutes);
      if (closesAt) data.closesAt = closesAt;
    }
  }

  if (typeof place.servesVegetarianFood === "boolean") {
    data.servesVegetarianFood = place.servesVegetarianFood;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Where a session searches
// ---------------------------------------------------------------------------

export type SearchArea = { center: LatLng; radiusM: number };

/** Downtown Boston: the fallback when neither the session nor the viewer has a location. */
export const BOSTON: LatLng = { lat: 42.3601, lng: -71.0589 };
export const BOSTON_RADIUS_M = 15_000;

const METERS_PER_MILE = 1609.344;
/** Below this a bias circle is too tight to be useful for a text search. */
const MIN_RADIUS_M = 2000;

/**
 * The circle Google's searches are biased to: the session's center and max
 * distance, else the viewer's own location, else downtown Boston. A bias is
 * a preference, not a limit, so results can still fall outside it.
 */
export function searchArea(
  session: { center_lat: number | null; center_lng: number | null },
  filters: Pick<SessionFilters, "distanceMi"> | null,
  viewer: LatLng | null,
): SearchArea {
  const radiusM = Math.max(MIN_RADIUS_M, (filters?.distanceMi ?? 2) * METERS_PER_MILE);
  if (session.center_lat != null && session.center_lng != null) {
    return { center: { lat: session.center_lat, lng: session.center_lng }, radiusM };
  }
  if (viewer) return { center: viewer, radiusM };
  return { center: BOSTON, radiusM: BOSTON_RADIUS_M };
}

// ---------------------------------------------------------------------------
// Route payloads shared with the client
// ---------------------------------------------------------------------------

/** One autocomplete place prediction: "Juniper & Rice" / "Mass Ave, Cambridge". */
export type Prediction = { placeId: string; mainText: string; secondaryText: string };

export type AutocompleteResult = { places: Prediction[]; queries: { text: string }[] };

export type SearchResult = { places: PlaceResult[] };
