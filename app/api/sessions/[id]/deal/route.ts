import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { dealBatch } from "@/lib/deal";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminDealStore } from "@/lib/supabase/deal-store";
import { viewerLocation, visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/deal: the host deals the next 20 (lib/deal.ts):
 * any remaining adds first, then the stored Text Search's next page, then
 * Nearby Search over smaller circles once the pages run out, deduped
 * against everything already in the session. Each batch resets everyone's
 * done flag. (The tally that decides whether a batch is wanted lands with
 * the voting phase; for now the host can deal whenever picking is running.)
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/deal">) {
  const calls = new CallLog();
  const { id } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);
    const user = await visitorUser();
    if (!user) return bad("Sign in first.", 401);

    const admin = supabaseAdmin();
    const { data: session } = await admin.from("sessions").select("*").eq("id", id).maybeSingle();
    if (!session) return bad("No such session.", 404);
    if (session.host_id !== user.id) return bad("Only the host can deal.", 403);
    if (session.status !== "swiping") return bad("Picking isn’t running.", 409);

    const hostLocation = await viewerLocation(admin, id, user.id);
    const result = await dealBatch(
      { store: adminDealStore(admin), places: googlePlaces(calls) },
      { session, hostLocation, start: false },
    );
    if (!result.ok) {
      switch (result.code) {
        case "nothing_to_deal":
          return bad(
            session.suggestions_on
              ? "No more places near here. Widen the distance to keep going."
              : "Every spot the group added has been dealt.",
            409,
            "exhausted",
          );
        case "conflict":
          return bad("That batch was already dealt.", 409);
        case "not_swiping":
        case "not_lobby":
          return bad("Picking isn’t running.", 409);
      }
    }
    return NextResponse.json({
      batch: result.batch,
      cards: result.adds.length + result.suggestions.length,
      exhausted: result.exhausted,
    });
  } catch (error) {
    console.error("deal batch failed", error);
    return bad("Couldn’t deal the next batch. Try again.", 500);
  } finally {
    calls.log(`POST /api/sessions/${id}/deal`);
  }
}
