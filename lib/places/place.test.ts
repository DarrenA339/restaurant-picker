import { describe, expect, it } from "vitest";
import { AUTOCOMPLETE_FIELD_MASK, DETAILS_FIELD_MASK, PLACE_FIELDS, SEARCH_FIELD_MASK } from "./fields";
import {
  BOSTON,
  BOSTON_RADIUS_M,
  cuisineFrom,
  formatLocalTime,
  searchArea,
  toRestaurantData,
  type GooglePlace,
} from "./place";

describe("field masks", () => {
  const specFields = [
    "id",
    "displayName",
    "location",
    "photos",
    "googleMapsUri",
    "rating",
    "userRatingCount",
    "priceLevel",
    "currentOpeningHours",
    "websiteUri",
    "servesVegetarianFood",
  ];

  it("ask for every field in the spec's table", () => {
    for (const field of specFields) expect(PLACE_FIELDS).toContain(field);
  });

  it("never use * and have no spaces", () => {
    for (const mask of [DETAILS_FIELD_MASK, SEARCH_FIELD_MASK, AUTOCOMPLETE_FIELD_MASK]) {
      expect(mask).not.toContain("*");
      expect(mask).not.toMatch(/\s/);
    }
  });

  it("prefix search fields with places. and add the page token", () => {
    expect(SEARCH_FIELD_MASK.split(",")).toContain("places.displayName");
    expect(SEARCH_FIELD_MASK.split(",")).toContain("nextPageToken");
    expect(DETAILS_FIELD_MASK.split(",")).toContain("displayName");
    expect(DETAILS_FIELD_MASK).not.toContain("places.");
  });
});

describe("formatLocalTime", () => {
  it("uses the place's UTC offset", () => {
    expect(formatLocalTime("2026-11-07T04:00:00Z", -300)).toBe("11 PM");
    expect(formatLocalTime("2026-07-07T02:30:00Z", -240)).toBe("10:30 PM");
    expect(formatLocalTime("2026-11-07T05:00:00Z", -300)).toBe("12 AM");
    expect(formatLocalTime("2026-11-07T17:05:00Z", -300)).toBe("12:05 PM");
  });

  it("falls back to Boston time without an offset", () => {
    expect(formatLocalTime("2026-11-07T04:00:00Z")).toBe("11 PM");
  });

  it("gives nothing for a bad timestamp", () => {
    expect(formatLocalTime("soon", -300)).toBeUndefined();
  });
});

describe("toRestaurantData", () => {
  const full: GooglePlace = {
    id: "ChIJjuniper",
    displayName: { text: "Juniper & Rice", languageCode: "en" },
    primaryTypeDisplayName: { text: "Korean Restaurant", languageCode: "en" },
    location: { latitude: 42.3808, longitude: -71.1095 },
    photos: [
      { name: "places/ChIJjuniper/photos/abc", authorAttributions: [{ displayName: "Sam", uri: "https://maps.google.com/maps/contrib/1" }] },
      { name: "places/ChIJjuniper/photos/def", authorAttributions: [{ displayName: "Not used" }] },
    ],
    googleMapsUri: "https://maps.google.com/?cid=1",
    websiteUri: "https://juniper.example",
    rating: 4.8,
    userRatingCount: 412,
    priceLevel: "PRICE_LEVEL_MODERATE",
    currentOpeningHours: { openNow: true, nextCloseTime: "2026-11-07T04:00:00Z" },
    utcOffsetMinutes: -300,
    servesVegetarianFood: true,
  };

  it("maps every field the card needs", () => {
    expect(toRestaurantData(full, "https://lh3.googleusercontent.com/p/x")).toEqual({
      name: "Juniper & Rice",
      cuisine: "Korean",
      priceLevel: 2,
      rating: 4.8,
      userRatingCount: 412,
      location: { lat: 42.3808, lng: -71.1095 },
      photoUri: "https://lh3.googleusercontent.com/p/x",
      photoAttributions: [{ name: "Sam", uri: "https://maps.google.com/maps/contrib/1" }],
      googleMapsUri: "https://maps.google.com/?cid=1",
      websiteUri: "https://juniper.example",
      openNow: true,
      closesAt: "11 PM",
      servesVegetarianFood: true,
    });
  });

  it("leaves out what Google didn't send", () => {
    const data = toRestaurantData({ displayName: { text: "  Tanuki  " } }, null);
    expect(data).toEqual({ name: "Tanuki", photoUri: null });
    expect(Object.keys(data)).toEqual(["name", "photoUri"]);
  });

  it("skips the closing time when the place is closed, and unknown price levels", () => {
    const data = toRestaurantData(
      {
        displayName: { text: "Night Owl" },
        priceLevel: "PRICE_LEVEL_UNSPECIFIED",
        currentOpeningHours: { openNow: false, nextOpenTime: "2026-11-07T22:00:00Z" },
      },
      null,
    );
    expect(data).toEqual({ name: "Night Owl", photoUri: null, openNow: false });
  });

  it("names a place with no display name", () => {
    expect(toRestaurantData({}, null).name).toBe("Unnamed spot");
  });
});

describe("cuisineFrom", () => {
  it("drops the trailing Restaurant", () => {
    expect(cuisineFrom("Korean Restaurant")).toBe("Korean");
    expect(cuisineFrom("Fast Food Restaurant")).toBe("Fast Food");
    expect(cuisineFrom("Restaurant")).toBe("Restaurant");
    expect(cuisineFrom("Cafe")).toBe("Cafe");
  });
});

describe("searchArea", () => {
  const harvard = { lat: 42.3736, lng: -71.119 };
  const central = { lat: 42.3653, lng: -71.1036 };

  it("uses the session center and its max distance", () => {
    const area = searchArea({ center_lat: harvard.lat, center_lng: harvard.lng }, { distanceMi: 2 }, central);
    expect(area.center).toEqual(harvard);
    expect(area.radiusM).toBeCloseTo(3218.7, 0);
  });

  it("never goes below 2 km", () => {
    expect(searchArea({ center_lat: 1, center_lng: 2 }, { distanceMi: 0.5 }, null).radiusM).toBe(2000);
  });

  it("falls back to the viewer, then to Boston", () => {
    expect(searchArea({ center_lat: null, center_lng: null }, { distanceMi: 1 }, central).center).toEqual(central);
    expect(searchArea({ center_lat: null, center_lng: null }, null, null)).toEqual({
      center: BOSTON,
      radiusM: BOSTON_RADIUS_M,
    });
  });
});
