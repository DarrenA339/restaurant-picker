import { describe, expect, it, vi } from "vitest";
import {
  dealBatch,
  type DealSession,
  type DealStore,
  type RestaurantInsert,
  type RestaurantLite,
  type YesRow,
} from "./deal";
import { BATCH_SIZE, type AddRow, type DeckSearchBody, type NearbyBody } from "./deck";
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
  restaurants: (RestaurantLite & { session_id: string })[];
  inserted: RestaurantInsert[];
  yes: YesRow[];
  doneResets: number;
  claims: { expect: { status: string; batch: number }; next: unknown }[];
};

type Seed = {
  session?: Partial<DealSession>;
  adds?: AddRow[];
  restaurants?: (RestaurantLite & { session_id: string })[];
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
      suggestions_on: true,
      search_body: null,
      page_token: null,
      ...overrides.session,
    },
    adds: overrides.adds ?? [],
    restaurants: overrides.restaurants ?? [],
    inserted: [],
    yes: [],
    doneResets: 0,
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
        db.restaurants.push({ session_id: SESSION, place_id: row.place_id, source: "suggested", batch: row.batch ?? null });
      }
    },
    async recordYes(rows) {
      db.yes.push(...rows);
    },
    async resetDoneSwiping() {
      db.doneResets += 1;
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
  it("deals the adds first, then fills to 20 with one Text Search, one photo each", async () => {
    const { db, store } = memory({ adds: [add(A, "a1", 1), add(B, "b1", 2), add(A, "a2", 3)] });
    const g = google([{ places: places("s", 25), nextPageToken: "page2" }]);

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, batch: 1, adds: ["a1", "b1", "a2"], exhausted: false });
    if (!result.ok) throw new Error("failed");
    expect(result.suggestions).toHaveLength(BATCH_SIZE - 3);
    expect(result.suggestions).toEqual(places("s", 17).map((p) => p.id));
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(g.searchText.mock.calls[0][0]).toMatchObject({ textQuery: "restaurants", pageSize: 20, openNow: true });
    expect(g.searchText.mock.calls[0][0]).not.toHaveProperty("pageToken");
    expect(g.searchNearby).not.toHaveBeenCalled();
    expect(g.photoUri).toHaveBeenCalledTimes(17);

    expect(db.inserted[0]).toMatchObject({ source: "suggested", batch: 1, place_id: "s1" });
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

  it("deals only the adds when suggestions are off, without calling Google", async () => {
    const { db, store } = memory({ session: { suggestions_on: false }, adds: [add(A, "a1", 1), add(B, "b1", 2)] });
    const g = google();

    const result = await dealBatch({ store, places: g }, input(db));

    expect(result).toMatchObject({ ok: true, batch: 1, adds: ["a1", "b1"], suggestions: [], exhausted: false });
    expect(g.searchText).not.toHaveBeenCalled();
    expect(g.photoUri).not.toHaveBeenCalled();
    expect(db.session.search_body).toBeNull();
  });

  it("refuses to start with no adds and suggestions off, touching nothing", async () => {
    const { db, store } = memory({ session: { suggestions_on: false } });
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
      session: { suggestions_on: false },
      adds: [add(A, "shared", 1), add(B, "shared", 2), add(B, "b1", 3)],
    });

    const result = await dealBatch({ store, places: google() }, input(db));

    expect(result).toMatchObject({ ok: true, adds: ["shared", "b1"] });
    expect(db.yes.map((y) => `${y.user_id}:${y.place_id}`)).toEqual([`${A}:shared`, `${B}:shared`, `${B}:b1`]);
  });
});

describe("dealBatch: later batches", () => {
  it("deals more than 20 adds round-robin before any suggestion, then fills", async () => {
    const adds = [
      ...Array.from({ length: 15 }, (_, i) => add(A, `a${i + 1}`, i)),
      ...Array.from({ length: 10 }, (_, i) => add(B, `b${i + 1}`, 20 + i)),
    ];
    const { db, store } = memory({ adds });
    const g = google([{ places: places("s", 20) }]);

    const first = await dealBatch({ store, places: g }, input(db));
    decide(db);
    expect(first).toMatchObject({ ok: true, batch: 1, suggestions: [] });
    if (!first.ok) throw new Error("failed");
    expect(first.adds).toEqual([
      "a1", "b1", "a2", "b2", "a3", "b3", "a4", "b4", "a5", "b5",
      "a6", "b6", "a7", "b7", "a8", "b8", "a9", "b9", "a10", "b10",
    ]);
    expect(g.searchText).not.toHaveBeenCalled();

    const second = await dealBatch({ store, places: g }, input(db, false));
    expect(second).toMatchObject({ ok: true, batch: 2, adds: ["a11", "a12", "a13", "a14", "a15"] });
    if (!second.ok) throw new Error("failed");
    expect(second.suggestions).toHaveLength(15);
    expect(g.searchText).toHaveBeenCalledTimes(1);
    expect(db.restaurants.filter((r) => r.batch === 2)).toHaveLength(20);
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
