import type { RestaurantRow } from "@/lib/restaurants";

/**
 * Fake restaurants shaped exactly like `restaurants` rows (source member, no
 * batch yet). They filled the lobby until phase 6 wired the add routes; the
 * lobby and explore screens now read real rows, so this stays off and is
 * only here for design checks of a full list.
 */
export const USE_FIXTURES = false;

/** Harvard Square, where the fixture spots sit around. */
export const FIXTURE_ORIGIN = { lat: 42.3736, lng: -71.119 };

export const FIXTURE_SESSION_ID = "00000000-0000-0000-0000-00000000f1x7";

type Seed = {
  id: string;
  name: string;
  cuisine: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  userRatingCount: number;
  lat: number;
  lng: number;
};

const seeds: Seed[] = [
  { id: "juniper", name: "Juniper & Rice", cuisine: "Korean", priceLevel: 2, rating: 4.8, userRatingCount: 412, lat: 42.3808, lng: -71.1095 },
  { id: "golden", name: "Golden Fold Dumplings", cuisine: "Chinese", priceLevel: 1, rating: 4.6, userRatingCount: 388, lat: 42.3826, lng: -71.1292 },
  { id: "tanuki", name: "Tanuki Noodle House", cuisine: "Japanese", priceLevel: 2, rating: 4.7, userRatingCount: 256, lat: 42.3695, lng: -71.1128 },
  { id: "verbena", name: "Casa Verbena", cuisine: "Mexican", priceLevel: 1, rating: 4.5, userRatingCount: 198, lat: 42.3642, lng: -71.1049 },
  { id: "pleat", name: "Pleat & Steam", cuisine: "Taiwanese", priceLevel: 2, rating: 4.6, userRatingCount: 173, lat: 42.3861, lng: -71.1348 },
  { id: "marrow", name: "Marrow & Thyme", cuisine: "Mediterranean", priceLevel: 3, rating: 4.7, userRatingCount: 301, lat: 42.3718, lng: -71.1279 },
  { id: "ember", name: "Ember Pizza", cuisine: "Pizza", priceLevel: 2, rating: 4.4, userRatingCount: 520, lat: 42.3779, lng: -71.1091 },
  { id: "lotus", name: "Blue Lotus Thai", cuisine: "Thai", priceLevel: 2, rating: 4.5, userRatingCount: 240, lat: 42.3651, lng: -71.1221 },
];

export const FIXTURE_RESTAURANTS: RestaurantRow[] = seeds.map((seed, i) => ({
  session_id: FIXTURE_SESSION_ID,
  place_id: `fixture-${seed.id}`,
  source: "member",
  batch: null,
  created_at: new Date(Date.UTC(2026, 10, 6, 18, i)).toISOString(),
  data: {
    name: seed.name,
    cuisine: seed.cuisine,
    priceLevel: seed.priceLevel,
    rating: seed.rating,
    userRatingCount: seed.userRatingCount,
    location: { lat: seed.lat, lng: seed.lng },
    photoUri: null,
    googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(seed.name)}`,
    openNow: true,
    closesAt: "11 PM",
  },
}));

/** Which fixture spots count as "You added this", by role, like docs/design/04. */
export const FIXTURE_MY_ADDS = {
  host: ["fixture-juniper", "fixture-golden"],
  guest: ["fixture-verbena"],
} as const;
