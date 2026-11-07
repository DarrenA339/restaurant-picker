import { describe, expect, it, vi } from "vitest";
import { addSpot, MAX_ADDS, removeAdd, type AddInsert, type AddStore } from "./adds";
import type { GooglePlace } from "./places/place";
import type { RestaurantRow } from "./restaurants";

const SESSION = "11111111-1111-4111-8111-111111111111";
const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FRIEND = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TOKEN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const JUNIPER = "ChIJjuniper";
const PHOTO = "https://lh3.googleusercontent.com/p/juniper";

const juniper: GooglePlace = {
  id: JUNIPER,
  displayName: { text: "Juniper & Rice" },
  primaryTypeDisplayName: { text: "Korean Restaurant" },
  priceLevel: "PRICE_LEVEL_MODERATE",
  rating: 4.8,
  userRatingCount: 412,
  location: { latitude: 42.3808, longitude: -71.1095 },
  photos: [
    {
      name: "places/ChIJjuniper/photos/abc",
      authorAttributions: [{ displayName: "Sam", uri: "https://maps.google.com/maps/contrib/1" }],
    },
  ],
};

type Memory = { restaurants: RestaurantRow[]; adds: AddInsert[] };

/** The store over two arrays, with the same conflict and cascade behaviour as the tables. */
function memoryStore(seed: Partial<Memory> = {}): AddStore & { db: Memory } {
  const db: Memory = { restaurants: seed.restaurants ?? [], adds: seed.adds ?? [] };
  const sameSpot = (sessionId: string, placeId: string) => (row: { session_id: string; place_id: string }) =>
    row.session_id === sessionId && row.place_id === placeId;
  return {
    db,
    async countMemberSpots(sessionId) {
      return db.restaurants.filter((r) => r.session_id === sessionId && r.source === "member").length;
    },
    async findRestaurant(sessionId, placeId) {
      return db.restaurants.find(sameSpot(sessionId, placeId)) ?? null;
    },
    async insertRestaurant(row) {
      if (db.restaurants.some(sameSpot(row.session_id, row.place_id))) return null;
      const full: RestaurantRow = {
        ...row,
        batch: row.batch ?? null,
        created_at: "2026-11-06T18:00:00.000Z",
      };
      db.restaurants.push(full);
      return full;
    },
    async insertAdd(add) {
      if (db.adds.some((a) => sameSpot(add.session_id, add.place_id)(a) && a.user_id === add.user_id)) {
        return false;
      }
      db.adds.push(add);
      return true;
    },
    async deleteAdd(sessionId, userId, placeId) {
      const before = db.adds.length;
      db.adds = db.adds.filter((a) => !(sameSpot(sessionId, placeId)(a) && a.user_id === userId));
      return before - db.adds.length;
    },
    async countAdds(sessionId, placeId) {
      return db.adds.filter(sameSpot(sessionId, placeId)).length;
    },
    async deleteRestaurant(sessionId, placeId) {
      const before = db.restaurants.length;
      db.restaurants = db.restaurants.filter(
        (r) => !(sameSpot(sessionId, placeId)(r) && r.source === "member" && r.batch === null),
      );
      const removed = before - db.restaurants.length;
      if (removed) db.adds = db.adds.filter((a) => !sameSpot(sessionId, placeId)(a)); // FK cascade
      return removed;
    },
  };
}

function fakePlaces(place: GooglePlace = juniper) {
  return {
    details: vi.fn(async () => place),
    photoUri: vi.fn(async () => PHOTO),
  };
}

function memberSpot(placeId: string, overrides: Partial<RestaurantRow> = {}): RestaurantRow {
  return {
    session_id: SESSION,
    place_id: placeId,
    source: "member",
    batch: null,
    created_at: "2026-11-06T17:00:00.000Z",
    data: { name: placeId, photoUri: null },
    ...overrides,
  };
}

function add(userId: string, placeId: string): AddInsert {
  return { session_id: SESSION, user_id: userId, place_id: placeId };
}

const input = (overrides: Partial<Parameters<typeof addSpot>[1]> = {}) => ({
  sessionId: SESSION,
  userId: ME,
  placeId: JUNIPER,
  sessionToken: TOKEN,
  status: "lobby" as const,
  ...overrides,
});

describe("addSpot", () => {
  it("adds a new spot: one details call with the session token, one photo, then both rows", async () => {
    const store = memoryStore();
    const places = fakePlaces();

    const result = await addSpot({ store, places }, input());

    expect(result).toMatchObject({ ok: true, joined: false });
    expect(places.details).toHaveBeenCalledTimes(1);
    expect(places.details).toHaveBeenCalledWith(JUNIPER, TOKEN);
    expect(places.photoUri).toHaveBeenCalledTimes(1);
    expect(places.photoUri).toHaveBeenCalledWith("places/ChIJjuniper/photos/abc");

    expect(store.db.restaurants).toHaveLength(1);
    const row = store.db.restaurants[0];
    expect(row).toMatchObject({ session_id: SESSION, place_id: JUNIPER, source: "member", batch: null });
    expect(row.data).toEqual({
      name: "Juniper & Rice",
      cuisine: "Korean",
      priceLevel: 2,
      rating: 4.8,
      userRatingCount: 412,
      location: { lat: 42.3808, lng: -71.1095 },
      photoUri: PHOTO,
      photoAttributions: [{ name: "Sam", uri: "https://maps.google.com/maps/contrib/1" }],
    });
    expect(store.db.adds).toEqual([add(ME, JUNIPER)]);
  });

  it("stores no photo when the place has none, with no photo call", async () => {
    const store = memoryStore();
    const places = fakePlaces({ ...juniper, photos: [] });

    const result = await addSpot({ store, places }, input());

    expect(result.ok).toBe(true);
    expect(places.photoUri).not.toHaveBeenCalled();
    expect(store.db.restaurants[0].data).toMatchObject({ photoUri: null });
  });

  it("still adds the spot when the photo lookup fails", async () => {
    const store = memoryStore();
    const places = fakePlaces();
    places.photoUri.mockRejectedValueOnce(new Error("429"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await addSpot({ store, places }, input());

    expect(result.ok).toBe(true);
    expect(store.db.restaurants[0].data).toMatchObject({ name: "Juniper & Rice", photoUri: null });
  });

  it("writes nothing when Place Details fails", async () => {
    const store = memoryStore();
    const places = fakePlaces();
    places.details.mockRejectedValueOnce(new Error("503"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await addSpot({ store, places }, input());

    expect(result).toEqual({ ok: false, code: "google" });
    expect(places.photoUri).not.toHaveBeenCalled();
    expect(store.db.restaurants).toHaveLength(0);
    expect(store.db.adds).toHaveLength(0);
  });

  it("refuses once picking has started, without calling Google", async () => {
    const store = memoryStore();
    const places = fakePlaces();

    const result = await addSpot({ store, places }, input({ status: "swiping" }));

    expect(result).toEqual({ ok: false, code: "not_lobby" });
    expect(places.details).not.toHaveBeenCalled();
    expect(store.db.restaurants).toHaveLength(0);
  });

  it("rejects the same member adding the same spot twice, without calling Google", async () => {
    const store = memoryStore({ restaurants: [memberSpot(JUNIPER)], adds: [add(ME, JUNIPER)] });
    const places = fakePlaces();

    const result = await addSpot({ store, places }, input());

    expect(result).toEqual({ ok: false, code: "duplicate" });
    expect(places.details).not.toHaveBeenCalled();
    expect(store.db.adds).toHaveLength(1);
  });

  it("joins a spot another member already added: one card, no Google call", async () => {
    const existing = memberSpot(JUNIPER, { data: { name: "Juniper & Rice", photoUri: PHOTO } });
    const store = memoryStore({ restaurants: [existing], adds: [add(FRIEND, JUNIPER)] });
    const places = fakePlaces();

    const result = await addSpot({ store, places }, input());

    expect(result).toEqual({ ok: true, restaurant: existing, joined: true });
    expect(places.details).not.toHaveBeenCalled();
    expect(places.photoUri).not.toHaveBeenCalled();
    expect(store.db.restaurants).toHaveLength(1);
    expect(store.db.adds).toEqual([add(FRIEND, JUNIPER), add(ME, JUNIPER)]);
  });

  it(`caps a session at ${MAX_ADDS} member spots`, async () => {
    const seeded = Array.from({ length: MAX_ADDS - 1 }, (_, i) => memberSpot(`spot-${i}`));
    const store = memoryStore({ restaurants: seeded });
    const places = fakePlaces();

    const fortieth = await addSpot({ store, places }, input());
    expect(fortieth.ok).toBe(true);
    expect(store.db.restaurants).toHaveLength(MAX_ADDS);

    const fortyFirst = await addSpot({ store, places }, input({ placeId: "ChIJone-too-many" }));
    expect(fortyFirst).toEqual({ ok: false, code: "cap" });
    expect(places.details).toHaveBeenCalledTimes(1);
    expect(store.db.restaurants).toHaveLength(MAX_ADDS);
  });

  it("still lets a member join an existing spot at the cap", async () => {
    const seeded = Array.from({ length: MAX_ADDS }, (_, i) => memberSpot(`spot-${i}`));
    const store = memoryStore({ restaurants: seeded, adds: [add(FRIEND, "spot-3")] });
    const places = fakePlaces();

    const result = await addSpot({ store, places }, input({ placeId: "spot-3" }));

    expect(result).toMatchObject({ ok: true, joined: true });
    expect(places.details).not.toHaveBeenCalled();
    expect(store.db.adds).toHaveLength(2);
  });

  it("counts only member spots toward the cap, not dealt suggestions", async () => {
    const seeded = Array.from({ length: MAX_ADDS }, (_, i) =>
      memberSpot(`suggested-${i}`, { source: "suggested", batch: 1 }),
    );
    const store = memoryStore({ restaurants: seeded });

    const result = await addSpot({ store, places: fakePlaces() }, input());

    expect(result.ok).toBe(true);
  });

  it("joins the card when another member inserted it between the lookup and the insert", async () => {
    const store = memoryStore();
    const friendsRow = memberSpot(JUNIPER, { data: { name: "Juniper & Rice", photoUri: PHOTO } });
    const insertRestaurant = store.insertRestaurant;
    store.insertRestaurant = async (row) => {
      // The friend's insert lands first; ours then conflicts.
      store.db.restaurants.push(friendsRow);
      store.db.adds.push(add(FRIEND, JUNIPER));
      return insertRestaurant(row);
    };

    const result = await addSpot({ store, places: fakePlaces() }, input());

    expect(result).toEqual({ ok: true, restaurant: friendsRow, joined: true });
    expect(store.db.restaurants).toHaveLength(1);
    expect(store.db.adds).toEqual([add(FRIEND, JUNIPER), add(ME, JUNIPER)]);
  });
});

describe("removeAdd", () => {
  const remove = (store: AddStore, overrides: Partial<Parameters<typeof removeAdd>[1]> = {}) =>
    removeAdd({ store }, { sessionId: SESSION, userId: ME, placeId: JUNIPER, status: "lobby", ...overrides });

  it("removes the add and the card when nobody else added it", async () => {
    const store = memoryStore({ restaurants: [memberSpot(JUNIPER)], adds: [add(ME, JUNIPER)] });

    expect(await remove(store)).toEqual({ ok: true });
    expect(store.db.adds).toHaveLength(0);
    expect(store.db.restaurants).toHaveLength(0);
  });

  it("keeps the card when another member also added it", async () => {
    const store = memoryStore({
      restaurants: [memberSpot(JUNIPER)],
      adds: [add(ME, JUNIPER), add(FRIEND, JUNIPER)],
    });

    expect(await remove(store)).toEqual({ ok: true });
    expect(store.db.adds).toEqual([add(FRIEND, JUNIPER)]);
    expect(store.db.restaurants).toHaveLength(1);
  });

  it("refuses once picking has started", async () => {
    const store = memoryStore({ restaurants: [memberSpot(JUNIPER)], adds: [add(ME, JUNIPER)] });

    expect(await remove(store, { status: "swiping" })).toEqual({ ok: false, code: "not_lobby" });
    expect(store.db.adds).toHaveLength(1);
  });

  it("reports not_found for a spot this member never added, touching nothing", async () => {
    const store = memoryStore({ restaurants: [memberSpot(JUNIPER)], adds: [add(FRIEND, JUNIPER)] });

    expect(await remove(store)).toEqual({ ok: false, code: "not_found" });
    expect(store.db.adds).toEqual([add(FRIEND, JUNIPER)]);
    expect(store.db.restaurants).toHaveLength(1);
  });
});
