import {
  distanceMi,
  type DayHours,
  type GalleryPhoto,
  type LatLng,
  type PhotoAttribution,
  type PhotoRef,
  type PlaceAttribute,
  type PlaceDetails,
  type PlaceReview,
  type PlaceSummary,
  type RestaurantData,
} from "@/lib/restaurants";
import type { PriceLevel, SessionFilters } from "@/lib/session-filters";

/** The subset of Google's Place resource the field mask asks for. */
export type LocalizedText = { text?: string; languageCode?: string };

export type GooglePhoto = {
  name?: string;
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[];
};

export type GoogleMoney = { currencyCode?: string; units?: string; nanos?: number };

export type GoogleReview = {
  relativePublishTimeDescription?: string;
  text?: LocalizedText;
  originalText?: LocalizedText;
  rating?: number;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  googleMapsUri?: string;
};

export type GooglePlace = {
  id?: string;
  displayName?: LocalizedText;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  internationalPhoneNumber?: string;
  priceRange?: { startPrice?: GoogleMoney; endPrice?: GoogleMoney };
  editorialSummary?: LocalizedText;
  generativeSummary?: {
    overview?: LocalizedText;
    overviewFlagContentUri?: string;
    disclosureText?: LocalizedText;
  };
  reviewSummary?: {
    text?: LocalizedText;
    flagContentUri?: string;
    disclosureText?: LocalizedText;
    reviewsUri?: string;
  };
  reviews?: GoogleReview[];
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
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
  types?: string[];
  primaryType?: string;
  accessibilityOptions?: { wheelchairAccessibleEntrance?: boolean };
  servesVegetarianFood?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesLunch?: boolean;
  servesDinner?: boolean;
  servesDessert?: boolean;
  servesCoffee?: boolean;
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  reservable?: boolean;
  outdoorSeating?: boolean;
  dineIn?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  allowsDogs?: boolean;
  liveMusic?: boolean;
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

function photoCredit(photo: GooglePhoto | undefined): PhotoAttribution[] {
  return (photo?.authorAttributions ?? []).flatMap((a): PhotoAttribution[] => {
    const name = a.displayName?.trim();
    if (!name) return [];
    return [a.uri ? { name, uri: a.uri } : { name }];
  });
}

/** The details sheet shows this many photos and reviews at most. */
export const MAX_GALLERY_PHOTOS = 4;
export const MAX_REVIEWS = 3;

/** Whole dollars from Google's Money; undefined for other currencies. */
function dollars(money: GoogleMoney | undefined): number | undefined {
  if (!money || money.currencyCode !== "USD") return undefined;
  const units = Number(money.units ?? "0");
  return Number.isFinite(units) ? units : undefined;
}

/** "$20–30", "$20" when both ends match, "$100+" when Google gives no upper end. */
export function formatPriceRange(range: GooglePlace["priceRange"]): string | undefined {
  const start = dollars(range?.startPrice);
  if (start === undefined) return undefined;
  if (!range?.endPrice) return `$${start}+`;
  const end = dollars(range.endPrice);
  if (end === undefined) return undefined;
  return end === start ? `$${start}` : `$${start}–${end}`;
}

/**
 * Google's summary of a place, in the order the sheet prefers: the editorial
 * line, else the AI overview, else the AI review summary. The text is kept
 * exactly as sent. An AI summary is kept only with Google's disclosure line,
 * which its policies require beside it, and brings its report link along.
 */
function toSummary(place: GooglePlace): PlaceSummary | undefined {
  const editorial = place.editorialSummary?.text;
  if (editorial?.trim()) return { kind: "editorial", text: editorial };

  const generative = place.generativeSummary;
  const overview = generative?.overview?.text;
  const overviewDisclosure = generative?.disclosureText?.text;
  if (generative && overview?.trim() && overviewDisclosure) {
    const summary: PlaceSummary = { kind: "generative", text: overview, disclosure: overviewDisclosure };
    if (generative.overviewFlagContentUri) summary.flagUri = generative.overviewFlagContentUri;
    return summary;
  }

  const review = place.reviewSummary;
  const reviewText = review?.text?.text;
  const reviewDisclosure = review?.disclosureText?.text;
  if (review && reviewText?.trim() && reviewDisclosure) {
    const summary: PlaceSummary = { kind: "review", text: reviewText, disclosure: reviewDisclosure };
    if (review.flagContentUri) summary.flagUri = review.flagContentUri;
    if (review.reviewsUri) summary.reviewsUri = review.reviewsUri;
    return summary;
  }
  return undefined;
}

/** Which Google flag earns which chip; a chip needs a confirmed true. */
const ATTRIBUTE_FLAGS: [PlaceAttribute, (place: GooglePlace) => boolean | undefined][] = [
  ["groups", (p) => p.goodForGroups],
  ["reservations", (p) => p.reservable],
  ["outdoor", (p) => p.outdoorSeating],
  ["beer", (p) => p.servesBeer],
  ["wine", (p) => p.servesWine],
  ["cocktails", (p) => p.servesCocktails],
  ["dessert", (p) => p.servesDessert],
  ["kids", (p) => p.goodForChildren],
  ["dogs", (p) => p.allowsDogs],
  ["wheelchair", (p) => p.accessibilityOptions?.wheelchairAccessibleEntrance],
  ["dine_in", (p) => p.dineIn],
  ["takeout", (p) => p.takeout],
  ["delivery", (p) => p.delivery],
  ["credit_cards", (p) => p.paymentOptions?.acceptsCreditCards],
  ["debit_cards", (p) => p.paymentOptions?.acceptsDebitCards],
  ["cash_only", (p) => p.paymentOptions?.acceptsCashOnly],
  ["contactless", (p) => p.paymentOptions?.acceptsNfc],
];

/** "Monday: 11:30 AM – 10:00 PM" → { day: "Monday", hours: "11:30 AM – 10:00 PM" }. */
function toWeekHours(descriptions: string[] | undefined): DayHours[] {
  return (descriptions ?? []).flatMap((line): DayHours[] => {
    const at = line.indexOf(": ");
    if (at < 1) return [];
    const day = line.slice(0, at).trim();
    const hours = line.slice(at + 2).trim();
    return day && hours ? [{ day, hours }] : [];
  });
}

function toReviews(reviews: GoogleReview[] | undefined): PlaceReview[] {
  const kept: PlaceReview[] = [];
  for (const review of reviews ?? []) {
    if (kept.length === MAX_REVIEWS) break;
    const author = review.authorAttribution?.displayName?.trim();
    const text = (review.text?.text ?? review.originalText?.text)?.trim();
    // Google requires the author next to a review, so one without a name is skipped.
    if (!author || !text) continue;
    const item: PlaceReview = { author, text };
    if (review.authorAttribution?.uri) item.authorUri = review.authorAttribution.uri;
    if (review.authorAttribution?.photoUri) item.authorPhotoUri = review.authorAttribution.photoUri;
    if (finite(review.rating)) item.rating = review.rating;
    if (review.relativePublishTimeDescription) item.relativeTime = review.relativePublishTimeDescription;
    if (review.googleMapsUri) item.googleMapsUri = review.googleMapsUri;
    kept.push(item);
  }
  return kept;
}

/**
 * What the details sheet adds to a card, from the same Places result.
 * Undefined when Google sent none of it, so the key is left off the row.
 */
export function toPlaceDetails(place: GooglePlace): PlaceDetails | undefined {
  const details: PlaceDetails = {};

  const summary = toSummary(place);
  if (summary) details.summary = summary;

  const priceRange = formatPriceRange(place.priceRange);
  if (priceRange) details.priceRange = priceRange;

  const weekHours = toWeekHours(place.currentOpeningHours?.weekdayDescriptions);
  if (weekHours.length) {
    details.weekHours = weekHours;
    if (finite(place.utcOffsetMinutes)) details.utcOffsetMinutes = place.utcOffsetMinutes;
  }

  const address = place.shortFormattedAddress?.trim();
  if (address) details.address = address;
  const phone = place.internationalPhoneNumber?.trim();
  if (phone) details.phone = phone;

  const attributes = ATTRIBUTE_FLAGS.filter(([, read]) => read(place) === true).map(([key]) => key);
  if (attributes.length) details.attributes = attributes;

  const reviews = toReviews(place.reviews);
  if (reviews.length) details.reviews = reviews;

  const photos = (place.photos ?? []).slice(0, MAX_GALLERY_PHOTOS).flatMap((photo): PhotoRef[] => {
    if (!photo.name) return [];
    const credit = photoCredit(photo);
    return [credit.length ? { name: photo.name, attributions: credit } : { name: photo.name }];
  });
  if (photos.length) details.photos = photos;

  return Object.keys(details).length ? details : undefined;
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

  // Attribution belongs with the photo it credits, so none without a photo.
  const attributions = photoUri ? photoCredit(place.photos?.[0]) : [];
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

  const details = toPlaceDetails(place);
  if (details) data.details = details;

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

export type BoundsLiteral = { north: number; south: number; east: number; west: number };

/** Google's largest bias circle. */
export const MAX_RADIUS_M = 50_000;
const MIN_VIEWPORT_RADIUS_M = 100;

/**
 * "Search this area": the circle a map viewport stands for, centered on it
 * with half its diagonal as the radius, inside Google's limits.
 */
export function areaFromBounds(bounds: BoundsLiteral): SearchArea {
  const center = { lat: (bounds.north + bounds.south) / 2, lng: (bounds.east + bounds.west) / 2 };
  const corner = { lat: bounds.north, lng: bounds.east };
  const radiusM = Math.min(
    MAX_RADIUS_M,
    Math.max(MIN_VIEWPORT_RADIUS_M, distanceMi(center, corner) * METERS_PER_MILE),
  );
  return { center, radiusM };
}

/** The details sheet's hours line: "Open until 11 PM", "Open now", "Closed now", or nothing. */
export function hoursLine(data: Pick<RestaurantData, "openNow" | "closesAt">): string | undefined {
  if (data.openNow === true) return data.closesAt ? `Open until ${data.closesAt}` : "Open now";
  if (data.openNow === false) return "Closed now";
  return undefined;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Which line of the week is today at the place: its index, or -1. Matched by
 * day name because where Google starts the week depends on the locale. Uses
 * the place's UTC offset when there is one, else the default zone.
 */
export function todayIn(
  weekHours: DayHours[],
  utcOffsetMinutes: number | undefined,
  now: Date,
  fallbackZone = DEFAULT_ZONE,
): number {
  let today: string;
  if (finite(utcOffsetMinutes)) {
    today = WEEKDAYS[new Date(now.getTime() + utcOffsetMinutes * 60_000).getUTCDay()];
  } else {
    today = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: fallbackZone })
      .format(now)
      .toLowerCase();
  }
  return weekHours.findIndex((line) => line.day.toLowerCase() === today);
}

/**
 * The website button's label: "Menu" only when the link itself is a menu
 * page (a "menu" or "menus" word in its host, path, or fragment).
 */
export function websiteLabel(uri: string): "Menu" | "Website" {
  try {
    const url = new URL(uri);
    const words = `${url.hostname}${url.pathname}${url.hash}`.toLowerCase().split(/[^a-z]+/);
    return words.some((word) => word === "menu" || word === "menus") ? "Menu" : "Website";
  } catch {
    return "Website";
  }
}

/** A phone number as a tel: link, keeping only the digits and a leading plus. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

// ---------------------------------------------------------------------------
// Route payloads shared with the client
// ---------------------------------------------------------------------------

/** One autocomplete place prediction: "Juniper & Rice" / "Mass Ave, Cambridge". */
export type Prediction = { placeId: string; mainText: string; secondaryText: string };

export type AutocompleteResult = { places: Prediction[]; queries: { text: string }[] };

export type SearchResult = { places: PlaceResult[] };

export type GalleryResult = { photos: GalleryPhoto[] };

/** A resolved starting area: Google's address line for it, and where it is. */
export type AreaResult = { placeId: string; address: string; location: LatLng };

/** The lower-48 states, as the bias for starting-area predictions. */
export const US_BOUNDS = {
  low: { latitude: 24.396, longitude: -125.0 },
  high: { latitude: 49.384, longitude: -66.934 },
};
