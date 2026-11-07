import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/end-swiping: the host ends the batch for everyone
 * while someone stalls. Every member is marked done; the cards they never
 * swiped count as no when the tally treats missing swipes as no (voting
 * phase), so nothing is written for them here.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/end-swiping">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("host_id, status, batch").eq("id", id).maybeSingle();
  if (!session) return bad("No such session.", 404);
  if (session.host_id !== user.id) return bad("Only the host can end picking.", 403);
  if (session.status !== "swiping") return bad("Picking isn’t running.", 409);

  const { error } = await admin
    .from("members")
    .update({ done_swiping: true })
    .eq("session_id", id)
    .eq("done_swiping", false);
  if (error) {
    console.error("end-swiping failed", error);
    return bad("Couldn’t end picking. Try again.", 500);
  }
  return NextResponse.json({ batch: session.batch, everyoneDone: true });
}
