import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { dealBatch } from "@/lib/deal";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminDealStore } from "@/lib/supabase/deal-store";
import { viewerLocation, visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/start: the host starts picking. Builds batch 1
 * (lib/deal.ts): the group's adds first, then, if suggestions are on, one
 * Text Search to fill to 20 with one photo per new card, each adder's
 * automatic yes, and the session moved to swiping with a conditional update.
 * Realtime pushes the status change to every phone.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/start">) {
  const calls = new CallLog();
  const { id } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);
    const user = await visitorUser();
    if (!user) return bad("Sign in first.", 401);

    const admin = supabaseAdmin();
    const { data: session } = await admin.from("sessions").select("*").eq("id", id).maybeSingle();
    if (!session) return bad("No such session.", 404);
    if (session.host_id !== user.id) return bad("Only the host can start.", 403);
    if (session.status !== "lobby") return bad("Picking has already started.", 409);

    const hostLocation = await viewerLocation(admin, id, user.id);
    const result = await dealBatch(
      { store: adminDealStore(admin), places: googlePlaces(calls) },
      { session, hostLocation, start: true },
    );
    if (!result.ok) {
      switch (result.code) {
        case "nothing_to_deal":
          return bad(
            session.suggestions_on
              ? "No places found near here. Add a spot or widen the distance."
              : "Add a spot or turn suggestions on first.",
            409,
            "nothing_to_deal",
          );
        case "not_lobby":
        case "conflict":
          return bad("Picking has already started.", 409);
        case "not_swiping":
          return bad("Picking isn’t running.", 409);
      }
    }
    return NextResponse.json({
      status: "swiping",
      batch: result.batch,
      cards: result.adds.length + result.suggestions.length,
      exhausted: result.exhausted,
    });
  } catch (error) {
    console.error("start session failed", error);
    return bad("Couldn’t start. Try again.", 500);
  } finally {
    calls.log(`POST /api/sessions/${id}/start`);
  }
}
