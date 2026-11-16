import { describe, expect, it, vi } from "vitest";
import { loadGallery, type GalleryStore } from "./gallery";
import type { GalleryPhoto, PhotoRef, RestaurantData } from "./restaurants";

const SESSION = "11111111-1111-4111-8111-111111111111";
const JUNIPER = "ChIJjuniper";
const CARD_PHOTO = "https://lh3.googleusercontent.com/p/card";

const ref = (n: number): PhotoRef => ({
  name: `places/${JUNIPER}/photos/p${n}`,
  attributions: [{ name: `Author ${n}` }],
});
const resolved = (n: number): GalleryPhoto => ({
  uri: `https://lh3.googleusercontent.com/p/p${n}`,
  attributions: [{ name: `Author ${n}` }],
});

/** A dealt card: its first photo already resolved, and the names of `count` photos. */
function card(count: number, overrides: Partial<RestaurantData> = {}): RestaurantData {
  const refs = Array.from({ length: count }, (_, i) => ref(i + 1));
  return {
    name: "Juniper & Rice",
    photoUri: CARD_PHOTO,
    photoAttributions: [{ name: "Author 1" }],
    ...(count ? { details: { photos: refs } } : {}),
    ...overrides,
  };
}

type Memory = { galleries: Map<string, GalleryPhoto[]>; restaurants: Map<string, RestaurantData> };

function memoryStore(seed: { data?: RestaurantData; gallery?: GalleryPhoto[] } = {}) {
  const db: Memory = { galleries: new Map(), restaurants: new Map() };
  if (seed.data) db.restaurants.set(JUNIPER, seed.data);
  if (seed.gallery) db.galleries.set(JUNIPER, seed.gallery);
  const store: GalleryStore = {
    async findGallery(_sessionId, placeId) {
      return db.galleries.get(placeId) ?? null;
    },
    async findRestaurant(_sessionId, placeId) {
      const data = db.restaurants.get(placeId);
      return data ? { data } : null;
    },
    async insertGallery(_sessionId, placeId, photos) {
      if (db.galleries.has(placeId)) return false;
      db.galleries.set(placeId, photos);
      return true;
    },
  };
  return { ...store, db };
}

function fakePlaces(refs: PhotoRef[] = []) {
  return {
    photoRefs: vi.fn(async () => refs),
    photoUri: vi.fn(async (name: string): Promise<string | null> => {
      return `https://lh3.googleusercontent.com/p/${name.split("/").pop()}`;
    }),
  };
}

const input = (status = "swiping") => ({ sessionId: SESSION, placeId: JUNIPER, status });

describe("loadGallery", () => {
  it("returns a kept gallery without calling Google", async () => {
    const store = memoryStore({ data: card(4), gallery: [resolved(1), resolved(2)] });
    const places = fakePlaces();

    expect(await loadGallery({ store, places }, input())).toEqual([resolved(1), resolved(2)]);
    expect(places.photoRefs).not.toHaveBeenCalled();
    expect(places.photoUri).not.toHaveBeenCalled();
  });

  it("starts from the card's photo and resolves only photos 2 to 4", async () => {
    const store = memoryStore({ data: card(4) });
    const places = fakePlaces();

    const photos = await loadGallery({ store, places }, input());

    expect(photos).toEqual([
      { uri: CARD_PHOTO, attributions: [{ name: "Author 1" }] },
      resolved(2),
      resolved(3),
      resolved(4),
    ]);
    expect(places.photoRefs).not.toHaveBeenCalled();
    expect(places.photoUri.mock.calls.map(([name]) => name)).toEqual([ref(2).name, ref(3).name, ref(4).name]);
    expect(store.db.galleries.get(JUNIPER)).toEqual(photos);
  });

  it("keeps the gallery, so a second open costs nothing", async () => {
    const store = memoryStore({ data: card(3) });
    await loadGallery({ store, places: fakePlaces() }, input());

    const again = fakePlaces();
    expect(await loadGallery({ store, places: again }, input())).toHaveLength(3);
    expect(again.photoUri).not.toHaveBeenCalled();
  });

  it("never resolves more than four photos", async () => {
    const data = card(0, { photoUri: null, photoAttributions: undefined, details: { photos: [1, 2, 3, 4, 5, 6].map(ref) } });
    const store = memoryStore({ data });
    const places = fakePlaces();

    expect(await loadGallery({ store, places }, input())).toHaveLength(4);
    expect(places.photoUri).toHaveBeenCalledTimes(4);
  });

  it("asks Google for the names when a card was dealt without them", async () => {
    const store = memoryStore({ data: card(0) });
    const places = fakePlaces([ref(1), ref(2)]);

    const photos = await loadGallery({ store, places }, input());

    expect(places.photoRefs).toHaveBeenCalledWith(JUNIPER);
    expect(photos).toEqual([{ uri: CARD_PHOTO, attributions: [{ name: "Author 1" }] }, resolved(2)]);
    expect(places.photoUri).toHaveBeenCalledTimes(1);
  });

  it("resolves every photo of an explore result in the lobby", async () => {
    const store = memoryStore();
    const places = fakePlaces([ref(1), ref(2), ref(3), ref(4), ref(5)]);

    const photos = await loadGallery({ store, places }, input("lobby"));

    expect(photos).toEqual([resolved(1), resolved(2), resolved(3), resolved(4)]);
    expect(store.db.galleries.get(JUNIPER)).toEqual(photos);
  });

  it("gives nothing for a place outside the session once picking has started", async () => {
    const store = memoryStore();
    const places = fakePlaces([ref(1)]);

    expect(await loadGallery({ store, places }, input("swiping"))).toEqual([]);
    expect(places.photoRefs).not.toHaveBeenCalled();
    expect(places.photoUri).not.toHaveBeenCalled();
  });

  it("leaves out a failed photo and doesn't keep the gallery, so the next open retries", async () => {
    const store = memoryStore({ data: card(3) });
    const places = fakePlaces();
    places.photoUri.mockRejectedValueOnce(new Error("timeout"));

    const photos = await loadGallery({ store, places }, input());

    expect(photos).toEqual([{ uri: CARD_PHOTO, attributions: [{ name: "Author 1" }] }, resolved(3)]);
    expect(store.db.galleries.has(JUNIPER)).toBe(false);
  });

  it("leaves out a photo Google has no URI for, and keeps the rest", async () => {
    const store = memoryStore({ data: card(3) });
    const places = fakePlaces();
    places.photoUri.mockResolvedValueOnce(null);

    const photos = await loadGallery({ store, places }, input());

    expect(photos).toHaveLength(2);
    expect(store.db.galleries.get(JUNIPER)).toEqual(photos);
  });

  it("returns the card's photo alone when the names can't be fetched", async () => {
    const store = memoryStore({ data: card(0) });
    const places = fakePlaces();
    places.photoRefs.mockRejectedValueOnce(new Error("timeout"));

    expect(await loadGallery({ store, places }, input())).toEqual([
      { uri: CARD_PHOTO, attributions: [{ name: "Author 1" }] },
    ]);
    expect(store.db.galleries.has(JUNIPER)).toBe(false);
  });

  it("keeps nothing for a place with no photos", async () => {
    const store = memoryStore({ data: card(0, { photoUri: null, photoAttributions: undefined }) });

    expect(await loadGallery({ store, places: fakePlaces() }, input())).toEqual([]);
    expect(store.db.galleries.has(JUNIPER)).toBe(false);
  });

  it("hands back the other request's gallery when two opens race", async () => {
    const store = memoryStore({ data: card(2) });
    const theirs = [resolved(1), resolved(2), resolved(3)];
    // The other request stores its gallery between our lookup and our insert.
    store.insertGallery = async () => {
      store.db.galleries.set(JUNIPER, theirs);
      return false;
    };

    expect(await loadGallery({ store, places: fakePlaces() }, input())).toEqual(theirs);
  });
});
