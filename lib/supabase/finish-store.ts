import "server-only";
import type { FinishStore } from "@/lib/finish-batch";
import { supabaseAdmin } from "./admin";

/** The FinishStore over the secret-key client. */
export function adminFinishStore(admin = supabaseAdmin()): FinishStore {
  return {
    async listMemberIds(sessionId) {
      const { data, error } = await admin.from("members").select("user_id").eq("session_id", sessionId);
      if (error) throw error;
      return data.map((row) => row.user_id);
    },

    async listDealtPlaceIds(sessionId) {
      const { data, error } = await admin
        .from("restaurants")
        .select("place_id")
        .eq("session_id", sessionId)
        .not("batch", "is", null)
        .order("batch", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((row) => row.place_id);
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

    async claimFinish(sessionId, batch) {
      const { data, error } = await admin
        .from("sessions")
        .update({ status: "deciding" })
        .eq("id", sessionId)
        .eq("status", "swiping")
        .eq("batch", batch)
        .select("id");
      if (error) throw error;
      return data.length > 0;
    },

    async setStatus(sessionId, status) {
      const { error } = await admin.from("sessions").update({ status }).eq("id", sessionId).eq("status", "deciding");
      if (error) throw error;
    },

    async saveResult(row) {
      const { error } = await admin.from("results").upsert(row, { onConflict: "session_id" });
      if (error) throw error;
    },

    async clearResult(sessionId) {
      const { error } = await admin.from("results").delete().eq("session_id", sessionId);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Wiring for the routes
// ---------------------------------------------------------------------------

import { dealBatch, type DealSession } from "@/lib/deal";
import { finishBatch, type FinishResult } from "@/lib/finish-batch";
import type { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { adminDealStore } from "./deal-store";
import { viewerLocation } from "./visitor";

/** Finishes a batch for real: the admin stores, and Google (counted in `calls`) if a batch has to be dealt. */
export async function finishWithGoogle(
  admin: SupabaseClient<Database>,
  calls: CallLog,
  session: DealSession & { host_id: string },
): Promise<FinishResult> {
  const hostLocation = await viewerLocation(admin, session.id, session.host_id);
  return finishBatch(
    {
      store: adminFinishStore(admin),
      deal: (next) =>
        dealBatch({ store: adminDealStore(admin), places: googlePlaces(calls) }, { session: next, hostLocation, start: false }),
    },
    session,
  );
}
