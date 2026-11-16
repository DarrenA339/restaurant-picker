import { MAX_GALLERY_PHOTOS } from "@/lib/places/place";
import {
  readRestaurantData,
  type GalleryPhoto,
  type PhotoRef,
  type RestaurantRow,
} from "@/lib/restaurants";

/**
 * The database side of a gallery, small enough to fake in memory.
 * lib/supabase/gallery-store.ts implements it with the secret key.
 */
export type GalleryStore = {
  /** The gallery already kept for this place in this session, or null. */
  findGallery(sessionId: string, placeId: string): Promise<GalleryPhoto[] | null>;
  findRestaurant(sessionId: string, placeId: string): Promise<Pick<RestaurantRow, "data"> | null>;
  /** True when stored, false when another request stored this place first. */
  insertGallery(sessionId: string, placeId: string, photos: GalleryPhoto[]): Promise<boolean>;
};

/** What a gallery needs from Google. */
export type GalleryPlaces = {
  /**
   * A place's photo names and credits. The route asks Place Details for only
   * `id,photos`, which Google bills at the free IDs Only tier.
   */
  photoRefs(placeId: string): Promise<PhotoRef[]>;
  /** Resolves one photo; null when Google returns no URI. This is the billed call. */
  photoUri(photoName: string): Promise<string | null>;
};

export type GalleryDeps = { store: GalleryStore; places: GalleryPlaces };

export type GalleryInput = {
  sessionId: string;
  placeId: string;
  /** Read by the route through RLS, which also proves membership. */
  status: string;
};

/**
 * The photos for a place's details sheet (docs/SPEC.md "Photos"), fetched
 * when a sheet opens and kept for the session:
 *
 *   1. a gallery already kept for the session is returned with no Google
 *      call, whoever opened the sheet first;
 *   2. a place in the session starts from the photo its card already has, so
 *      only photos 2 to 4 are resolved, from the names stored with the card
 *      (a card dealt before names were stored asks Google for them, free);
 *   3. a place not in the session is an explore result, which only exists in
 *      the lobby: all of its photos are resolved, up to four;
 *   4. a photo that fails is left out, and a gallery with a failure isn't
 *      kept, so the next open tries again.
 *
 * Two members opening the same sheet at once can both pay for the photos;
 * the second insert loses and that member is given the kept gallery.
 */
export async function loadGallery(deps: GalleryDeps, input: GalleryInput): Promise<GalleryPhoto[]> {
  const { store, places } = deps;
  const { sessionId, placeId, status } = input;

  const kept = await store.findGallery(sessionId, placeId);
  if (kept) return kept;

  const row = await store.findRestaurant(sessionId, placeId);
  if (!row && status !== "lobby") return [];

  const data = row ? readRestaurantData(row.data) : null;
  const photos: GalleryPhoto[] = [];
  if (data?.photoUri) {
    photos.push(
      data.photoAttributions
        ? { uri: data.photoUri, attributions: data.photoAttributions }
        : { uri: data.photoUri },
    );
  }

  let failed = false;
  let refs = data?.details?.photos ?? [];
  if (refs.length === 0) {
    try {
      refs = await places.photoRefs(placeId);
    } catch (error) {
      console.warn("gallery photo names failed", placeId, error);
      failed = true;
    }
  }

  // The card's photo is the place's first, so it isn't resolved a second time.
  const wanted = refs.slice(photos.length, MAX_GALLERY_PHOTOS);
  const resolved = await Promise.all(
    wanted.map(async (ref): Promise<GalleryPhoto | null> => {
      try {
        const uri = await places.photoUri(ref.name);
        if (!uri) return null;
        return ref.attributions ? { uri, attributions: ref.attributions } : { uri };
      } catch (error) {
        console.warn("gallery photo failed", placeId, error);
        failed = true;
        return null;
      }
    }),
  );
  for (const photo of resolved) if (photo) photos.push(photo);

  if (photos.length === 0 || failed) return photos;
  if (await store.insertGallery(sessionId, placeId, photos)) return photos;
  return (await store.findGallery(sessionId, placeId)) ?? photos;
}
