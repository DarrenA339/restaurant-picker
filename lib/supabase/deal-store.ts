import "server-only";
import type { DealStore } from "@/lib/deal";
import { supabaseAdmin } from "./admin";

/** The DealStore over the secret-key client. */
export function adminDealStore(admin = supabaseAdmin()): DealStore {
  return {
    async listAdds(sessionId) {
      const { data, error } = await admin
        .from("adds")
        .select("user_id, place_id, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },

    async listRestaurants(sessionId) {
      const { data, error } = await admin
        .from("restaurants")
        .select("place_id, source, batch")
        .eq("session_id", sessionId);
      if (error) throw error;
      return data;
    },

    async claimBatch(sessionId, expect, next) {
      const { data, error } = await admin
        .from("sessions")
        .update(next)
        .eq("id", sessionId)
        .eq("status", expect.status)
        .eq("batch", expect.batch)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async dealAdds(sessionId, placeIds, batch) {
      const { error } = await admin
        .from("restaurants")
        .update({ batch })
        .eq("session_id", sessionId)
        .in("place_id", placeIds)
        .is("batch", null);
      if (error) throw error;
    },

    async insertSuggestions(rows) {
      const { error } = await admin
        .from("restaurants")
        .upsert(rows, { onConflict: "session_id,place_id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async recordYes(rows) {
      const { error } = await admin.from("swipes").upsert(
        rows.map((row) => ({ ...row, value: "yes" as const })),
        { onConflict: "session_id,user_id,place_id", ignoreDuplicates: true },
      );
      if (error) throw error;
    },

    async resetDoneSwiping(sessionId) {
      const { error } = await admin
        .from("members")
        .update({ done_swiping: false })
        .eq("session_id", sessionId);
      if (error) throw error;
    },
  };
}
