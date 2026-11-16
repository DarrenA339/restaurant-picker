import "server-only";
import type { Json } from "@/lib/database.types";
import type { GalleryStore } from "@/lib/gallery";
import { readGallery } from "@/lib/restaurants";
import { supabaseAdmin } from "./admin";

const UNIQUE_VIOLATION = "23505";

/** The GalleryStore over the secret-key client: place_photos is server only. */
export function adminGalleryStore(admin = supabaseAdmin()): GalleryStore {
  return {
    async findGallery(sessionId, placeId) {
      const { data, error } = await admin
        .from("place_photos")
        .select("photos")
        .eq("session_id", sessionId)
        .eq("place_id", placeId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const photos = readGallery(data.photos);
      return photos.length ? photos : null;
    },

    async findRestaurant(sessionId, placeId) {
      const { data, error } = await admin
        .from("restaurants")
        .select("data")
        .eq("session_id", sessionId)
        .eq("place_id", placeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async insertGallery(sessionId, placeId, photos) {
      const { error } = await admin
        .from("place_photos")
        .insert({ session_id: sessionId, place_id: placeId, photos: photos as unknown as Json });
      if (error?.code === UNIQUE_VIOLATION) return false;
      if (error) throw error;
      return true;
    },
  };
}
