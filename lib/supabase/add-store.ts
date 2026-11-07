import "server-only";
import type { AddStore } from "@/lib/adds";
import { supabaseAdmin } from "./admin";

const UNIQUE_VIOLATION = "23505";

/** The AddStore over the secret-key client: writes the server owns, conflicts as plain results. */
export function adminAddStore(admin = supabaseAdmin()): AddStore {
  return {
    async countMemberSpots(sessionId) {
      const { count, error } = await admin
        .from("restaurants")
        .select("place_id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("source", "member");
      if (error) throw error;
      return count ?? 0;
    },

    async findRestaurant(sessionId, placeId) {
      const { data, error } = await admin
        .from("restaurants")
        .select("*")
        .eq("session_id", sessionId)
        .eq("place_id", placeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async insertRestaurant(row) {
      const { data, error } = await admin.from("restaurants").insert(row).select("*").single();
      if (error?.code === UNIQUE_VIOLATION) return null;
      if (error) throw error;
      return data;
    },

    async insertAdd(add) {
      const { error } = await admin.from("adds").insert(add);
      if (error?.code === UNIQUE_VIOLATION) return false;
      if (error) throw error;
      return true;
    },

    async deleteAdd(sessionId, userId, placeId) {
      const { count, error } = await admin
        .from("adds")
        .delete({ count: "exact" })
        .eq("session_id", sessionId)
        .eq("user_id", userId)
        .eq("place_id", placeId);
      if (error) throw error;
      return count ?? 0;
    },

    async countAdds(sessionId, placeId) {
      const { count, error } = await admin
        .from("adds")
        .select("user_id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("place_id", placeId);
      if (error) throw error;
      return count ?? 0;
    },

    async deleteRestaurant(sessionId, placeId) {
      const { count, error } = await admin
        .from("restaurants")
        .delete({ count: "exact" })
        .eq("session_id", sessionId)
        .eq("place_id", placeId)
        .eq("source", "member")
        .is("batch", null);
      if (error) throw error;
      return count ?? 0;
    },
  };
}
