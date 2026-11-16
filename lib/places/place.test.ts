import { describe, expect, it } from "vitest";
import { AUTOCOMPLETE_FIELD_MASK, DETAILS_FIELD_MASK, PLACE_FIELDS, SEARCH_FIELD_MASK } from "./fields";
import {
  areaFromBounds,
  BOSTON,
  BOSTON_RADIUS_M,
  cuisineFrom,
  formatLocalTime,
  hoursLine,
  MAX_RADIUS_M,
  searchArea,
  formatPriceRange,
  telHref,
  todayIn,
  toPlaceDetails,
  toRestaurantData,
  websiteLabel,
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
      details: {
        photos: [
          {
            name: "places/ChIJjuniper/photos/abc",
            attributions: [{ name: "Sam", uri: "https://maps.google.com/maps/contrib/1" }],
          },
          { name: "places/ChIJjuniper/photos/def", attributions: [{ name: "Not used" }] },
        ],
      },
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

  it("credits a photo only when one is shown", () => {
    expect(toRestaurantData(full, null)).not.toHaveProperty("photoAttributions");
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

describe("areaFromBounds", () => {
  it("centers on the viewport with half the diagonal as radius", () => {
    const area = areaFromBounds({ north: 42.38, south: 42.36, east: -71.1, west: -71.14 });
    expect(area.center.lat).toBeCloseTo(42.37, 6);
    expect(area.center.lng).toBeCloseTo(-71.12, 6);
    // About 1.1 mi from the center to the corner.
    expect(area.radiusM).toBeGreaterThan(1900);
    expect(area.radiusM).toBeLessThan(2100);
  });

  it("stays inside Google's limits", () => {
    expect(areaFromBounds({ north: 60, south: 20, east: -60, west: -120 }).radiusM).toBe(MAX_RADIUS_M);
    const tiny = areaFromBounds({ north: 42.37001, south: 42.37, east: -71.12, west: -71.12001 });
    expect(tiny.radiusM).toBe(100);
  });
});

describe("hoursLine", () => {
  it("reads the open state and closing time", () => {
    expect(hoursLine({ openNow: true, closesAt: "11 PM" })).toBe("Open until 11 PM");
    expect(hoursLine({ openNow: true })).toBe("Open now");
    expect(hoursLine({ openNow: false, closesAt: "11 PM" })).toBe("Closed now");
    expect(hoursLine({})).toBeUndefined();
  });
});

describe("toPlaceDetails", () => {
  const review = (n: number) => ({
    relativePublishTimeDescription: `${n} weeks ago`,
    text: { text: `Review ${n}` },
    rating: 5,
    authorAttribution: {
      displayName: `Author ${n}`,
      uri: `https://maps.google.com/contrib/${n}`,
      photoUri: `https://lh3.googleusercontent.com/a/${n}`,
    },
    googleMapsUri: `https://maps.google.com/review/${n}`,
  });

  it("is undefined when Google sent nothing for the sheet", () => {
    expect(toPlaceDetails({ displayName: { text: "Tanuki" }, rating: 4.2 })).toBeUndefined();
  });

  it("prefers the editorial summary and keeps its text unchanged", () => {
    const details = toPlaceDetails({
      editorialSummary: { text: "  Casual Korean spot. " },
      generativeSummary: { overview: { text: "AI overview" }, disclosureText: { text: "Summarized with Gemini" } },
      reviewSummary: { text: { text: "AI reviews" }, disclosureText: { text: "Summarized with Gemini" } },
    });
    expect(details?.summary).toEqual({ kind: "editorial", text: "  Casual Korean spot. " });
  });

  it("falls back to the AI overview with Google's disclosure and report link", () => {
    const details = toPlaceDetails({
      generativeSummary: {
        overview: { text: "Lively spot for stews." },
        disclosureText: { text: "Summarized with Gemini" },
        overviewFlagContentUri: "https://www.google.com/local/review/rap/report?d=1",
      },
      reviewSummary: { text: { text: "AI reviews" } },
    });
    expect(details?.summary).toEqual({
      kind: "generative",
      text: "Lively spot for stews.",
      disclosure: "Summarized with Gemini",
      flagUri: "https://www.google.com/local/review/rap/report?d=1",
    });
  });

  it("skips an AI summary that came without Google's disclosure line", () => {
    const details = toPlaceDetails({
      generativeSummary: { overview: { text: "No disclosure" } },
      reviewSummary: { text: { text: "People praise the banchan." }, disclosureText: { text: "Summarized with Gemini" } },
    });
    expect(details?.summary).toEqual({
      kind: "review",
      text: "People praise the banchan.",
      disclosure: "Summarized with Gemini",
    });
    expect(toPlaceDetails({ reviewSummary: { text: { text: "No disclosure" } } })).toBeUndefined();
  });

  it("falls back last to the review summary with its reviews link", () => {
    const details = toPlaceDetails({
      editorialSummary: { text: "   " },
      reviewSummary: {
        text: { text: "People praise the banchan." },
        disclosureText: { text: "Summarized with Gemini" },
        flagContentUri: "https://www.google.com/report",
        reviewsUri: "https://www.google.com/maps/place//reviews",
      },
    });
    expect(details?.summary).toEqual({
      kind: "review",
      text: "People praise the banchan.",
      disclosure: "Summarized with Gemini",
      flagUri: "https://www.google.com/report",
      reviewsUri: "https://www.google.com/maps/place//reviews",
    });
  });

  it("keeps three reviews, skipping any without an author or text", () => {
    const details = toPlaceDetails({
      reviews: [
        review(1),
        { text: { text: "No author" } },
        { authorAttribution: { displayName: "No text" } },
        review(2),
        { originalText: { text: "Solo en español" }, authorAttribution: { displayName: "Ana" } },
        review(3),
      ],
    });
    expect(details?.reviews).toEqual([
      {
        author: "Author 1",
        text: "Review 1",
        authorUri: "https://maps.google.com/contrib/1",
        authorPhotoUri: "https://lh3.googleusercontent.com/a/1",
        rating: 5,
        relativeTime: "1 weeks ago",
        googleMapsUri: "https://maps.google.com/review/1",
      },
      expect.objectContaining({ author: "Author 2" }),
      { author: "Ana", text: "Solo en español" },
    ]);
  });

  it("keeps the names of four photos at most", () => {
    const photos = [1, 2, 3, 4, 5, 6].map((n) => ({ name: `places/X/photos/p${n}` }));
    expect(toPlaceDetails({ photos })?.photos).toEqual([
      { name: "places/X/photos/p1" },
      { name: "places/X/photos/p2" },
      { name: "places/X/photos/p3" },
      { name: "places/X/photos/p4" },
    ]);
  });

  it("lists only the attributes Google confirms", () => {
    const details = toPlaceDetails({
      goodForGroups: true,
      reservable: false,
      servesWine: true,
      allowsDogs: true,
      accessibilityOptions: { wheelchairAccessibleEntrance: true },
      paymentOptions: { acceptsCreditCards: true, acceptsCashOnly: false, acceptsNfc: true },
      // Not on the sheet's list.
      liveMusic: true,
      servesBrunch: true,
    });
    expect(details?.attributes).toEqual(["groups", "wine", "dogs", "wheelchair", "credit_cards", "contactless"]);
  });

  it("splits the week into days and keeps the offset with it", () => {
    const details = toPlaceDetails({
      currentOpeningHours: {
        weekdayDescriptions: ["Monday: 11:30 AM – 10:00 PM", "Tuesday: Closed", "garbage"],
      },
      utcOffsetMinutes: -300,
    });
    expect(details?.weekHours).toEqual([
      { day: "Monday", hours: "11:30 AM – 10:00 PM" },
      { day: "Tuesday", hours: "Closed" },
    ]);
    expect(details?.utcOffsetMinutes).toBe(-300);
  });

  it("carries the short address and phone number", () => {
    const details = toPlaceDetails({
      shortFormattedAddress: "1186 Mass Ave, Cambridge",
      internationalPhoneNumber: "+1 617-555-0142",
    });
    expect(details).toEqual({ address: "1186 Mass Ave, Cambridge", phone: "+1 617-555-0142" });
  });
});

describe("formatPriceRange", () => {
  const usd = (units: string) => ({ currencyCode: "USD", units });

  it("prints a dollar range", () => {
    expect(formatPriceRange({ startPrice: usd("20"), endPrice: usd("30") })).toBe("$20–30");
    expect(formatPriceRange({ startPrice: usd("10"), endPrice: usd("10") })).toBe("$10");
  });

  it("prints an open-ended range with a plus", () => {
    expect(formatPriceRange({ startPrice: usd("100") })).toBe("$100+");
  });

  it("gives nothing without a start or in another currency", () => {
    expect(formatPriceRange(undefined)).toBeUndefined();
    expect(formatPriceRange({ endPrice: usd("30") })).toBeUndefined();
    expect(
      formatPriceRange({ startPrice: { currencyCode: "EUR", units: "20" }, endPrice: usd("30") }),
    ).toBeUndefined();
  });
});

describe("todayIn", () => {
  const week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
    (day) => ({ day, hours: "Noon – 9 PM" }),
  );

  it("finds today in the place's own zone", () => {
    // 03:00 UTC on Saturday is still Friday evening in Boston (UTC-5).
    const now = new Date("2026-11-07T03:00:00Z");
    expect(todayIn(week, -300, now)).toBe(4);
    expect(todayIn(week, 0, now)).toBe(5);
  });

  it("falls back to Boston time without an offset", () => {
    expect(todayIn(week, undefined, new Date("2026-11-07T03:00:00Z"))).toBe(4);
  });

  it("works whichever day Google starts the week on", () => {
    const sundayFirst = [week[6], ...week.slice(0, 6)];
    expect(todayIn(sundayFirst, -300, new Date("2026-11-07T03:00:00Z"))).toBe(5);
  });

  it("is -1 when today isn't listed", () => {
    expect(todayIn(week.slice(0, 2), -300, new Date("2026-11-07T03:00:00Z"))).toBe(-1);
  });
});

describe("websiteLabel", () => {
  it("says Menu only for a menu page", () => {
    expect(websiteLabel("https://juniper.example/menu")).toBe("Menu");
    expect(websiteLabel("https://juniper.example/menus/dinner.pdf")).toBe("Menu");
    expect(websiteLabel("https://menu.juniper.example/")).toBe("Menu");
    expect(websiteLabel("https://juniper.example/#menu")).toBe("Menu");
  });

  it("says Website for everything else", () => {
    expect(websiteLabel("https://juniper.example/")).toBe("Website");
    expect(websiteLabel("https://juniper.example/about?ref=menu")).toBe("Website");
    expect(websiteLabel("https://menufy.example/juniper")).toBe("Website");
    expect(websiteLabel("not a url")).toBe("Website");
  });
});

describe("telHref", () => {
  it("keeps the digits and the plus", () => {
    expect(telHref("+1 617-555-0142")).toBe("tel:+16175550142");
  });
});
