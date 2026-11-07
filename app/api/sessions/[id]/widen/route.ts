import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { dealBatch } from "@/lib/deal";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { DISTANCES_MI, parseFilters } from "@/lib/session-filters";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminDealStore } from "@/lib/supabase/deal-store";
import { adminFinishStore } from "@/lib/supabase/finish-store";
import { viewerLocation, visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/widen: the "Nothing matches these filters" edge
 * state's way out. From deciding, the host widens the max distance one
 * step, the suggestions search starts over at the new radius (everything
 * already dealt stays excluded), and the next batch is dealt.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/widen">) {
  const calls = new CallLog();
  const { id } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);
    const user = await visitorUser();
    if (!user) return bad("Sign in first.", 401);

    const admin = supabaseAdmin();
    const { data: session } = await admin.from("sessions").select("*").eq("id", id).maybeSingle();
    if (!session) return bad("No such session.", 404);
    if (session.host_id !== user.id) return bad("Only the host can decide.", 403);
    if (session.status !== "deciding") return bad("There’s nothing to decide right now.", 409);

    const filters = parseFilters(session.filters);
    if (!filters) return bad("Those filters don't look right.", 500);
    const next = DISTANCES_MI.find((mi) => mi > filters.distanceMi);
    if (!next) return bad(`${filters.distanceMi} mi is as wide as it goes.`, 409, "widest");

    const widened = { ...filters, distanceMi: next };
    const { error } = await admin
      .from("sessions")
      .update({ filters: widened, search_body: null, page_token: null })
      .eq("id", id)
      .eq("status", "deciding");
    if (error) {
      console.error("widen failed", error);
      return bad("Couldn’t widen the search. Try again.", 500);
    }

    const hostLocation = await viewerLocation(admin, id, user.id);
    const result = await dealBatch(
      { store: adminDealStore(admin), places: googlePlaces(calls) },
      {
        session: { ...session, filters: widened, search_body: null, page_token: null },
        hostLocation,
        start: false,
      },
    );
    if (result.ok) await adminFinishStore(admin).clearResult(id);
    if (!result.ok) {
      return result.code === "nothing_to_deal"
        ? bad(`Still nothing within ${next} mi. Widen again or try later.`, 409, "exhausted")
        : bad("There’s nothing to deal right now.", 409);
    }
    return NextResponse.json({
      distanceMi: next,
      batch: result.batch,
      cards: result.adds.length + result.suggestions.length,
    });
  } catch (error) {
    console.error("widen failed", error);
    return bad("Couldn’t widen the search. Try again.", 500);
  } finally {
    calls.log(`POST /api/sessions/${id}/widen`);
  }
}
