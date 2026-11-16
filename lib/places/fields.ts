/**
 * The Places API (New) field mask from docs/SPEC.md ("Search field mask").
 * Google bills a request at the highest tier among the fields asked for, so
 * a new field goes in the spec's table first: one Enterprise + Atmosphere
 * field (servesVegetarianFood) already puts every call on the top tier, so
 * the lower-tier fields and the details sheet's fields ride along at no
 * extra cost.
 */
export const PLACE_FIELDS = [
  // Pro
  "id",
  "displayName",
  "location",
  "photos",
  "googleMapsUri",
  "primaryTypeDisplayName",
  "utcOffsetMinutes",
  "shortFormattedAddress",
  // Enterprise
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours",
  "websiteUri",
  "priceRange",
  "internationalPhoneNumber",
  // Essentials (types) and Pro (primaryType, accessibility)
  "types",
  "primaryType",
  "accessibilityOptions",
  // Enterprise + Atmosphere: the filter attributes
  "servesVegetarianFood",
  "servesBreakfast",
  "servesBrunch",
  "servesLunch",
  "servesDinner",
  "servesDessert",
  "servesCoffee",
  "servesBeer",
  "servesWine",
  "servesCocktails",
  "goodForChildren",
  "goodForGroups",
  "goodForWatchingSports",
  "reservable",
  "outdoorSeating",
  "dineIn",
  "takeout",
  "delivery",
  "allowsDogs",
  "liveMusic",
  // Enterprise + Atmosphere: the details sheet (summary, reviews, payment chips)
  "editorialSummary",
  "generativeSummary",
  "reviewSummary",
  "reviews",
  "paymentOptions",
] as const;

/** Place Details: plain field names. */
export const DETAILS_FIELD_MASK = PLACE_FIELDS.join(",");

/** Text Search: `places.`-prefixed, plus the page token. */
export const SEARCH_FIELD_MASK = [
  ...PLACE_FIELDS.map((field) => `places.${field}`),
  "nextPageToken",
].join(",");

/** Nearby Search: the same fields; it has no pages. */
export const NEARBY_FIELD_MASK = PLACE_FIELDS.map((field) => `places.${field}`).join(",");

/**
 * A typed starting area: only Essentials fields, so resolving one bills
 * Place Details Essentials, not the card tier.
 */
export const AREA_FIELD_MASK = "location,formattedAddress";

/**
 * A place's photo names and credits, for the details sheet's gallery. Place
 * Details bills these two fields at the IDs Only tier, which is free; the
 * photos themselves are billed when each one is resolved.
 */
export const PHOTOS_FIELD_MASK = "id,photos";

/** Autocomplete: the id and the two text lines of each prediction. */
export const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
  "suggestions.queryPrediction.text",
].join(",");
