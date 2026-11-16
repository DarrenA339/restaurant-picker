import type { Json, Tables } from "@/lib/database.types";
import { priceLabel, type PriceLevel } from "@/lib/session-filters";

export type RestaurantRow = Tables<"restaurants">;

export type LatLng = { lat: number; lng: number };

/** Who took the photo, shown next to it per Google's attribution rules. */
export type PhotoAttribution = { name: string; uri?: string };

/** One of a place's photos before it is resolved: Google's resource name and who to credit. */
export type PhotoRef = { name: string; attributions?: PhotoAttribution[] };

/** A resolved gallery photo, as the photos route returns it. */
export type GalleryPhoto = { uri: string; attributions?: PhotoAttribution[] };

/**
 * Google's own words about a place: its editorial summary, else one of the
 * two AI summaries. The text is shown unchanged; the AI kinds carry Google's
 * disclosure line and report link, which its policies require next to them.
 */
export type PlaceSummary = {
  kind: "editorial" | "generative" | "review";
  text: string;
  disclosure?: string;
  flagUri?: string;
  /** Review summaries only: Google's "See reviews" link. */
  reviewsUri?: string;
};

export type PlaceReview = {
  author: string;
  authorUri?: string;
  authorPhotoUri?: string;
  rating?: number;
  /** "2 weeks ago", as Google words it. */
  relativeTime?: string;
  text: string;
  /** The review itself on Google Maps. */
  googleMapsUri?: string;
};

/** One line of the week: "Monday" / "11:30 AM – 10:00 PM". */
export type DayHours = { day: string; hours: string };

/** The chips a place can earn; only attributes Google confirms as true are stored. */
export const ATTRIBUTE_LABELS = {
  groups: "Good for groups",
  reservations: "Takes reservations",
  outdoor: "Outdoor seating",
  beer: "Beer",
  wine: "Wine",
  cocktails: "Cocktails",
  dessert: "Dessert",
  kids: "Kid-friendly",
  dogs: "Dogs allowed",
  wheelchair: "Wheelchair accessible",
  dine_in: "Dine-in",
  takeout: "Takeout",
  delivery: "Delivery",
  credit_cards: "Credit cards",
  debit_cards: "Debit cards",
  cash_only: "Cash only",
  contactless: "Contactless pay",
} as const;

export type PlaceAttribute = keyof typeof ATTRIBUTE_LABELS;

/**
 * What only the details sheet shows. It rides along on the same Google call
 * as the card data (same billing tier), except the gallery: `photos` holds
 * names only, resolved by the photos route when a sheet opens.
 */
export type PlaceDetails = {
  summary?: PlaceSummary;
  /** "$20–30" or "$100+", already formatted. */
  priceRange?: string;
  weekHours?: DayHours[];
  /** The place's UTC offset, to find today in its own zone. */
  utcOffsetMinutes?: number;
  address?: string;
  phone?: string;
  attributes?: PlaceAttribute[];
  reviews?: PlaceReview[];
  photos?: PhotoRef[];
};

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
  details?: PlaceDetails;
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

function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

function summary(value: unknown): PlaceSummary | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const s = value as Record<string, unknown>;
  const text = str(s.text);
  const kind = s.kind;
  if (!text || (kind !== "editorial" && kind !== "generative" && kind !== "review")) return undefined;
  return {
    kind,
    text,
    disclosure: str(s.disclosure),
    flagUri: str(s.flagUri),
    reviewsUri: str(s.reviewsUri),
  };
}

/** Lenient read of the details blob; undefined when nothing in it is usable. */
function readPlaceDetails(value: unknown): PlaceDetails | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const d = value as Record<string, unknown>;

  const weekHours = list(d.weekHours).flatMap((item): DayHours[] => {
    const day = str(item.day);
    const hours = str(item.hours);
    return day && hours ? [{ day, hours }] : [];
  });
  const attributeKeys: unknown[] = Array.isArray(d.attributes) ? d.attributes : [];
  const attributeList = attributeKeys.filter(
    (key): key is PlaceAttribute => typeof key === "string" && key in ATTRIBUTE_LABELS,
  );
  const reviews = list(d.reviews).flatMap((item): PlaceReview[] => {
    const author = str(item.author);
    const text = str(item.text);
    if (!author || !text) return [];
    return [
      {
        author,
        text,
        authorUri: str(item.authorUri),
        authorPhotoUri: str(item.authorPhotoUri),
        rating: num(item.rating),
        relativeTime: str(item.relativeTime),
        googleMapsUri: str(item.googleMapsUri),
      },
    ];
  });
  const photos = list(d.photos).flatMap((item): PhotoRef[] => {
    const name = str(item.name);
    if (!name) return [];
    const credit = attributions(item.attributions);
    return [credit ? { name, attributions: credit } : { name }];
  });

  const details: PlaceDetails = {
    summary: summary(d.summary),
    priceRange: str(d.priceRange),
    weekHours: weekHours.length ? weekHours : undefined,
    utcOffsetMinutes: num(d.utcOffsetMinutes),
    address: str(d.address),
    phone: str(d.phone),
    attributes: attributeList.length ? attributeList : undefined,
    reviews: reviews.length ? reviews : undefined,
    photos: photos.length ? photos : undefined,
  };
  return Object.values(details).some((v) => v !== undefined) ? details : undefined;
}

/** Lenient read of a stored gallery (place_photos.photos, or the photos route's reply). */
export function readGallery(value: unknown): GalleryPhoto[] {
  return list(value).flatMap((item): GalleryPhoto[] => {
    const uri = str(item.uri);
    if (!uri) return [];
    const credit = attributions(item.attributions);
    return [credit ? { uri, attributions: credit } : { uri }];
  });
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
    details: readPlaceDetails(d.details),
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

/**
 * The distance line on a card or details sheet. Measured from the viewer's
 * own location and called "from you" only when they shared one; otherwise
 * from the session's starting area, and named as that.
 */
export function distanceLabel(
  viewer: LatLng | null,
  meetingArea: LatLng | null,
  location: LatLng | undefined,
): string | null {
  if (!location) return null;
  if (viewer) return `${formatMiles(distanceMi(viewer, location))} from you`;
  if (meetingArea) return `${formatMiles(distanceMi(meetingArea, location))} from the meeting area`;
  return null;
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
