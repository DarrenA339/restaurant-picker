/**
 * The Places API (New) field mask from docs/SPEC.md ("Search field mask").
 * Google bills a request at the highest tier among the fields asked for, so
 * a new field goes in the spec's table first: one Enterprise + Atmosphere
 * field (servesVegetarianFood) already puts every call on the top tier, and
 * the two extra Pro fields below ride along at no extra cost.
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
  // Enterprise
  "rating",
  "userRatingCount",
  "priceLevel",
  "currentOpeningHours",
  "websiteUri",
  // Enterprise + Atmosphere
  "servesVegetarianFood",
] as const;

/** Place Details: plain field names. */
export const DETAILS_FIELD_MASK = PLACE_FIELDS.join(",");

/** Text Search and Nearby Search: `places.`-prefixed, plus the page token. */
export const SEARCH_FIELD_MASK = [
  ...PLACE_FIELDS.map((field) => `places.${field}`),
  "nextPageToken",
].join(",");

/**
 * A typed starting area: only Essentials fields, so resolving one bills
 * Place Details Essentials, not the card tier.
 */
export const AREA_FIELD_MASK = "location,formattedAddress";

/** Autocomplete: the id and the two text lines of each prediction. */
export const AUTOCOMPLETE_FIELD_MASK = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.structuredFormat",
  "suggestions.queryPrediction.text",
].join(",");
