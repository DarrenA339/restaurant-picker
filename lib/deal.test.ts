import { describe, expect, it, vi } from "vitest";
import {
  dealBatch,
  type DealSession,
  type DealStore,
  type PoolRow,
  type RestaurantInsert,
  type RestaurantLite,
  type YesRow,
} from "./deal";
import type { AddRow, DeckSearchBody, NearbyBody } from "./deck";
import type { GooglePlace } from "./places/place";
import { DEFAULT_FILTERS } from "./session-filters";

const SESSION = "11111111-1111-4111-8111-111111111111";
const A = "user-a";
const B = "user-b";
const harvard = { lat: 42.3736, lng: -71.119 };

function add(user_id: string, place_id: string, minute: number): AddRow {
  return { user_id, place_id, created_at: `2026-11-06T18:${String(minute).padStart(2, "0")}:00.000Z` };
}

function place(id: string, miles = 0.5, extra: Partial<GooglePlace> = {}): GooglePlace {
  return {
    id,
    displayName: { text: `Place ${id}` },
    location: { latitude: harvard.lat, longitude: harvard.lng + miles / 51.6 },
    priceLevel: "PRICE_LEVEL_MODERATE",
    photos: [{ name: `places/${id}/photos/p` }],
    ...extra,
  };
}

function places(prefix: string, count: number, miles = 0.5) {
  return Array.from({ length: count }, (_, i) => place(`${prefix}${i + 1}`, miles));
}

type Memory = {
  session: DealSession;
  adds: AddRow[];
  restaurants: (RestaurantLite & { session_id: string; data?: unknown })[];
  members: string[];
  inserted: RestaurantInsert[];
  yes: YesRow[];
  doneResets: number;
  autoDone: string[];
  claims: { expect: { status: string; batch: number }; next: unknown }[];
};

type Seed = {
  session?: Partial<DealSession>;
  adds?: AddRow[];
  restaurants?: (RestaurantLite & { session_id: string })[];
  members?: string[];
};

function memory(overrides: Seed = {}) {
  const db: Memory = {
    session: {
      id: SESSION,
      status: "lobby",
      batch: 0,
      filters: DEFAULT_FILTERS,
      center_lat: harvard.lat,
      center_lng: harvard.lng,
      batch_size: 20,
      deck_mix: "mostly_adds",
      search_body: null,
      page_token: null,
      ...overrides.session,
    },
    adds: overrides.adds ?? [],
    restaurants: overrides.restaurants ?? [],
    members: overrides.members ?? [A, B],
    inserted: [],
    yes: [],
    doneResets: 0,
    autoDone: [],
    claims: [],
  };
  // Every add has its member-source row from the lobby.
  for (const a of db.adds) {
    if (!db.restaurants.some((r) => r.place_id === a.place_id)) {
      db.restaurants.push({ session_id: SESSION, place_id: a.place_id, source: "member", batch: null });
    }
  }
  const store: DealStore = {
    async listAdds() {
      return db.adds;
    },
    async listRestaurants() {
      return db.restaurants.map(({ place_id, source, batch }) => ({ place_id, source, batch }));
    },
    async listMemberIds() {
      return db.members;
    },
    async listPool() {
      return db.restaurants
        .filter((r) => r.source === "suggested" && r.batch === null)
        .map((r) => ({ place_id: r.place_id, data: r.data as PoolRow["data"] }));
    },
    async claimBatch(_id, expect, next) {
      db.claims.push({ expect, next });
      if (db.session.status !== expect.status || db.session.batch !== expect.batch) return false;
      db.session = { ...db.session, ...next };
      return true;
    },
    async dealAdds(_id, placeIds, batch) {
      for (const r of db.restaurants) if (placeIds.includes(r.place_id) && r.batch === null) r.batch = batch;
    },
    async insertSuggestions(rows) {
      for (const row of rows) {
        if (db.restaurants.some((r) => r.place_id === row.place_id)) continue;
        db.inserted.push(row);
        db.restaurants.push({
          session_id: SESSION,
          place_id: row.place_id,
          source: "suggested",
          batch: row.batch ?? null,
          data: row.data,
        });
      }
    },
    async dealPool(_id, rows, batch) {
      for (const row of rows) {
        const kept = db.restaurants.find((r) => r.place_id === row.place_id && r.batch === null);
        if (kept) Object.assign(kept, { batch, data: row.data });
      }
    },
    async recordYes(rows) {
      db.yes.push(...rows);
    },
    async resetDoneSwiping() {
      db.doneResets += 1;
      db.autoDone = [];
    },
    async markDoneSwiping(_id, userIds) {
      db.autoDone = userIds;
    },
  };
  return { db, store };
}

function google(pages: { places?: GooglePlace[]; nextPageToken?: string }[] = [], nearby: GooglePlace[][] = []) {
  let page = 0;
  let circle = 0;
  return {
    searchText: vi.fn<(body: DeckSearchBody & { pageToken?: string }) => Promise<{ places?: GooglePlace[]; nextPageToken?: string }>>(
      async () => pages[page++] ?? { places: [] },
    ),
    searchNearby: vi.fn<(body: NearbyBody) => Promise<{ places?: GooglePlace[] }>>(
      async () => ({ places: nearby[circle++] ?? [] }),
    ),
    photoUri: vi.fn(async (name: string) => `https://lh3.googleusercontent.com/${name}`),
  };
}

const input = (db: Memory, start = true) => ({ session: db.session, hostLocation: null, start });

/** What the tally does between batches: swiping → deciding. */
const decide = (db: Memory) => {
  db.session = { ...db.session, status: "deciding" };
};

describe("dealBatch: start", () => {
  it("deals the adds, fills the batch from one Text Search, and resolves photos only for dealt cards", async () => {
    const { db, store } = memory({ adds: [add(A, "a1", 1), add(B, "b1", 2), add(A, "a2", 3)] });
    const g = google([{ places: places("s", 25), nextPageToken: "page2" }]);

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, batch: 1, adds: ["a1", "b1", "a2"], exhausted: false });
    if (!result.ok) throw new Error("failed");
    expect(result.suggestions).toHaveLength(17);
    expect(result.suggestions).toEqual(places("s", 17).map((p) => p.id));
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(g.searchText.mock.calls[0][0]).toMatchObject({ textQuery: "restaurants", pageSize: 20, openNow: true });
    expect(g.searchText.mock.calls[0][0]).not.toHaveProperty("pageToken");
    expect(g.searchNearby).not.toHaveBeenCalled();
    expect(g.photoUri).toHaveBeenCalledTimes(17);

    expect(db.inserted[0]).toMatchObject({ source: "suggested", batch: 1, place_id: "s1" });
    // The 8 results the batch didn't use wait in the pool, with no photo yet.
    const pool = db.inserted.filter((row) => row.batch === null);
    expect(pool.map((row) => row.place_id)).toEqual(places("s", 25).slice(17).map((p) => p.id));
    expect(pool[0].data).toMatchObject({ name: "Place s18", photoUri: null });
    expect(db.inserted[0].data).toMatchObject({ name: "Place s1", photoUri: "https://lh3.googleusercontent.com/places/s1/photos/p" });
    expect(db.restaurants.filter((r) => r.source === "member").map((r) => r.batch)).toEqual([1, 1, 1]);
    expect(db.yes).toEqual([
      { session_id: SESSION, user_id: A, place_id: "a1" },
      { session_id: SESSION, user_id: B, place_id: "b1" },
      { session_id: SESSION, user_id: A, place_id: "a2" },
    ]);
    expect(db.session).toMatchObject({ status: "swiping", batch: 1, page_token: "page2" });
    expect(db.session.search_body).toMatchObject({ nearbyNext: 0, body: { textQuery: "restaurants" } });
    expect(db.doneResets).toBe(1);
  });

  it("deals only the adds when the mix is adds only, without calling Google", async () => {
    const { db, store } = memory({ session: { deck_mix: "adds_only" }, adds: [add(A, "a1", 1), add(B, "b1", 2)] });
    const g = google();

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, batch: 1, adds: ["a1", "b1"], suggestions: [], exhausted: false });
    expect(g.searchText).not.toHaveBeenCalled();
    expect(g.photoUri).not.toHaveBeenCalled();
    expect(db.session.search_body).toBeNull();
  });

  it("refuses to start with no adds when the mix is adds only, touching nothing", async () => {
    const { db, store } = memory({ session: { deck_mix: "adds_only" } });
    const g = google();

    expect(await dealBatch({ store, places: g }, input(db))).toEqual({ ok: false, code: "nothing_to_deal" });
    expect(db.claims).toHaveLength(0);
    expect(db.session.status).toBe("lobby");
  });

  it("filters suggestions by distance and skips places already in the session", async () => {
    const { db, store } = memory({ adds: [add(A, "a1", 1)] });
    const g = google([{ places: [place("far", 5), place("a1"), place("near", 1), place("near"), place("edge", 2.5)] }]);

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, adds: ["a1"], suggestions: ["near"] });
  });

  it("refuses when the session has left the lobby", async () => {
    const { db, store } = memory({ session: { status: "swiping", batch: 1 } });
    expect(await dealBatch({ store, places: google() }, input(db))).toEqual({ ok: false, code: "not_lobby" });
  });

  it("gives way when someone else started first", async () => {
    const { db, store } = memory({ adds: [add(A, "a1", 1)] });
    const g = google([{ places: places("s", 5) }]);
    store.claimBatch = async () => false;

    expect(await dealBatch({ store, places: g }, input(db))).toEqual({ ok: false, code: "conflict" });
    expect(db.inserted).toHaveLength(0);
    expect(db.yes).toHaveLength(0);
  });

  it("deals a shared spot once and records both members' yes", async () => {
    const { db, store } = memory({
      session: { deck_mix: "adds_only" },
      adds: [add(A, "shared", 1), add(B, "shared", 2), add(B, "b1", 3)],
    });

    const result = await dealBatch({ store, places: google() }, input(db));

    expect(result).toMatchObject({ ok: true, adds: ["shared", "b1"] });
    expect(db.yes.map((y) => `${y.user_id}:${y.place_id}`)).toEqual([`${A}:shared`, `${B}:shared`, `${B}:b1`]);
  });
});

describe("dealBatch: later batches", () => {
  it("splits each batch by the mix, deals the pool before calling Google again", async () => {
    const adds = [
      ...Array.from({ length: 6 }, (_, i) => add(A, `a${i + 1}`, i)),
      ...Array.from({ length: 6 }, (_, i) => add(B, `b${i + 1}`, 20 + i)),
    ];
    const { db, store } = memory({ session: { batch_size: 10, deck_mix: "mostly_adds" }, adds });
    const g = google([{ places: places("s", 20), nextPageToken: "page2" }]);

    // 75% of 10, rounded, is 8 adds; 2 suggestions fill the rest.
    const first = await dealBatch({ store, places: g }, input(db));
    decide(db);
    expect(first).toMatchObject({
      ok: true,
      batch: 1,
      adds: ["a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4"],
      suggestions: ["s1", "s2"],
    });
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(g.photoUri).toHaveBeenCalledTimes(2);
    expect(db.restaurants.filter((r) => r.source === "suggested" && r.batch === null)).toHaveLength(18);

    // Only 4 adds are left, so suggestions fill the other 6, straight from the pool.
    const second = await dealBatch({ store, places: g }, input(db, false));
    expect(second).toMatchObject({
      ok: true,
      batch: 2,
      adds: ["a5", "b5", "a6", "b6"],
      suggestions: ["s3", "s4", "s5", "s6", "s7", "s8"],
    });
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(g.photoUri).toHaveBeenCalledTimes(8);
    const s3 = db.restaurants.find((r) => r.place_id === "s3");
    expect(s3).toMatchObject({ batch: 2, data: { photoUri: "https://lh3.googleusercontent.com/places/s3/photos/p" } });
    expect(db.restaurants.filter((r) => r.batch === 2)).toHaveLength(10);
    expect(db.session.page_token).toBe("page2");
  });

  it("fills with adds when the suggestions run out", async () => {
    const adds = Array.from({ length: 10 }, (_, i) => add(i % 2 ? B : A, `m${i + 1}`, i));
    const { db, store } = memory({ session: { batch_size: 10, deck_mix: "mostly_new" }, adds });
    const g = google([{ places: [place("only")] }]);

    const result = await dealBatch({ store, places: g }, input(db));

    // 25% of 10 rounds to 3 adds, but one suggestion is all the area has.
    expect(result).toMatchObject({ ok: true, suggestions: ["only"] });
    if (!result.ok) throw new Error("failed");
    expect(result.adds).toHaveLength(9);
  });

  it("gives every mix its share of adds", async () => {
    const shares = { adds_only: 10, mostly_adds: 8, half: 5, mostly_new: 3 } as const;
    for (const [mix, expected] of Object.entries(shares)) {
      const adds = Array.from({ length: 12 }, (_, i) => add(i % 2 ? B : A, `m${i + 1}`, i));
      const { db, store } = memory({ session: { batch_size: 10, deck_mix: mix as keyof typeof shares }, adds });
      const result = await dealBatch({ store, places: google([{ places: places("s", 20) }]) }, input(db));
      if (!result.ok) throw new Error("failed");
      expect([mix, result.adds.length, result.suggestions.length]).toEqual([mix, expected, 10 - expected]);
    }
  });

  it("marks a member done when the batch is only their own adds, but never the whole group", async () => {
    const adds = [add(A, "a1", 1), add(A, "a2", 2)];
    const two = memory({ session: { batch_size: 5, deck_mix: "adds_only" }, adds });
    await dealBatch({ store: two.store, places: google() }, input(two.db));
    expect(two.db.autoDone).toEqual([A]);

    // Alone, someone still has to finish the batch for the tally to run.
    const solo = memory({ session: { batch_size: 5, deck_mix: "adds_only" }, adds, members: [A] });
    await dealBatch({ store: solo.store, places: google() }, input(solo.db));
    expect(solo.db.autoDone).toEqual([]);

    // A suggestion in the batch gives everyone something to swipe.
    const mixed = memory({ session: { batch_size: 5, deck_mix: "half" }, adds });
    await dealBatch({ store: mixed.store, places: google([{ places: places("s", 5) }]) }, input(mixed.db));
    expect(mixed.db.autoDone).toEqual([]);
  });

  it("pages the same Text Search with the stored body and token", async () => {
    const { db, store } = memory();
    const g = google([
      { places: places("p", 20), nextPageToken: "page2" },
      { places: places("q", 20), nextPageToken: "page3" },
    ]);

    await dealBatch({ store, places: g }, input(db));
    decide(db);
    const second = await dealBatch({ store, places: g }, input(db, false));

    expect(second).toMatchObject({ ok: true, batch: 2 });
    expect(g.searchText).toHaveBeenCalledTimes(2);
    const [firstBody, secondBody] = g.searchText.mock.calls.map((c) => c[0]);
    expect(secondBody).toEqual({ ...firstBody, pageToken: "page2" });
    expect(db.session.page_token).toBe("page3");
  });

  it("fetches one extra page when the filters leave the batch short, never a third", async () => {
    const { db, store } = memory({ session: { filters: { ...DEFAULT_FILTERS, drinks: ["wine"] } } });
    const noWine = places("x", 12).map((p) => ({ ...p, servesWine: false }));
    const g = google([
      { places: [...places("p", 8), ...noWine], nextPageToken: "page2" },
      { places: [...places("q", 6), ...noWine], nextPageToken: "page3" },
      { places: places("r", 20), nextPageToken: "page4" },
    ]);

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, batch: 1, exhausted: false });
    if (!result.ok) throw new Error("failed");
    expect(g.searchText).toHaveBeenCalledTimes(2);
    expect(g.searchText.mock.calls[1][0]).toMatchObject({ pageToken: "page2" });
    expect(result.suggestions).toEqual([...places("p", 8), ...places("q", 6)].map((p) => p.id));
    expect(db.session.page_token).toBe("page3");
    expect(g.searchNearby).not.toHaveBeenCalled();
  });

  it("deals confirmed matches before unknown ones", async () => {
    const { db, store } = memory({ session: { filters: { ...DEFAULT_FILTERS, openNow: false, prices: [], amenities: ["outdoor"] } } });
    const g = google([{ places: [place("maybe"), place("patio", 0.5, { outdoorSeating: true }), place("inside", 0.5, { outdoorSeating: false })] }]);

    const result = await dealBatch({ store, places: g }, input(db));

    if (!result.ok) throw new Error("failed");
    expect(result.suggestions).toEqual(["patio", "maybe"]);
  });

  it("switches to Nearby Search over smaller circles once the pages run out, filtering price and open-now", async () => {
    const { db, store } = memory();
    const nearby1 = [...places("n", 10), place("pricey", 0.3, { priceLevel: "PRICE_LEVEL_VERY_EXPENSIVE" }), place("closed", 0.3, { currentOpeningHours: { openNow: false } })];
    const nearby2 = [...places("n", 5), ...places("m", 10)];
    const g = google([{ places: places("p", 20) }], [nearby1, nearby2]);

    await dealBatch({ store, places: g }, input(db));
    expect(db.session.page_token).toBeNull();
    decide(db);

    const second = await dealBatch({ store, places: g }, input(db, false));

    expect(second).toMatchObject({ ok: true, batch: 2, exhausted: false });
    if (!second.ok) throw new Error("failed");
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(g.searchNearby).toHaveBeenCalledTimes(2);
    expect(g.searchNearby.mock.calls[0][0]).toMatchObject({ includedTypes: ["restaurant"], maxResultCount: 20 });
    expect(second.suggestions).toEqual([...places("n", 10).map((p) => p.id), ...places("m", 10).map((p) => p.id)]);
    expect(db.session.search_body).toMatchObject({ nearbyNext: 2 });
  });

  it("reports an exhausted area once every circle is used and nothing new turns up", async () => {
    const { db, store } = memory({ session: { status: "deciding", batch: 3, search_body: { body: { textQuery: "restaurants" }, nearbyNext: 7 }, page_token: null } });
    const g = google();

    expect(await dealBatch({ store, places: g }, input(db, false))).toEqual({ ok: false, code: "nothing_to_deal" });
    expect(g.searchText).not.toHaveBeenCalled();
    expect(g.searchNearby).not.toHaveBeenCalled();
  });

  it("refuses to deal a later batch unless the session is deciding", async () => {
    const { db, store } = memory({ session: { status: "swiping", batch: 1 } });
    expect(await dealBatch({ store, places: google() }, input(db, false))).toEqual({ ok: false, code: "not_swiping" });
  });
});
