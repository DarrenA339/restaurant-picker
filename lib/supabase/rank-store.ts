import "server-only";
import type { RankStore } from "@/lib/finish-ranking";
import { readRestaurantData } from "@/lib/restaurants";
import { supabaseAdmin } from "./admin";

/** The RankStore over the secret-key client. */
export function adminRankStore(admin = supabaseAdmin()): RankStore {
  return {
    async listMemberIds(sessionId) {
      const { data, error } = await admin.from("members").select("user_id").eq("session_id", sessionId);
      if (error) throw error;
      return data.map((row) => row.user_id);
    },

    async listDealtPlaces(sessionId) {
      const { data, error } = await admin
        .from("restaurants")
        .select("place_id, data")
        .eq("session_id", sessionId)
        .not("batch", "is", null)
        .order("batch", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((row) => ({ placeId: row.place_id, rating: readRestaurantData(row.data)?.rating ?? null }));
    },

    async listSwipes(sessionId) {
      const { data, error } = await admin
        .from("swipes")
        .select("user_id, place_id, value, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((row) => ({ userId: row.user_id, placeId: row.place_id, value: row.value }));
    },

    async listBallots(sessionId) {
      const { data, error } = await admin.from("ballots").select("payload").eq("session_id", sessionId);
      if (error) throw error;
      return data.map((row) => row.payload);
    },

    async getFinalists(sessionId) {
      const { data, error } = await admin.from("results").select("finalists").eq("session_id", sessionId).maybeSingle();
      if (error) throw error;
      return data?.finalists ?? null;
    },

    async saveResult(row) {
      const { error } = await admin.from("results").upsert(row, { onConflict: "session_id" });
      if (error) throw error;
    },

    async claimDone(sessionId) {
      const { data, error } = await admin
        .from("sessions")
        .update({ status: "done" })
        .eq("id", sessionId)
        .eq("status", "ranking")
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },
  };
}
