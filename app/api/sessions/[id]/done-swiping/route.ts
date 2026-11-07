import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/done-swiping: the member finished the current
 * batch. The flip is conditional (`done_swiping = false`), so a second tap
 * or a second tab changes nothing. When the whole group is done, the
 * response says so; the tally that follows (instant match, finalists, the
 * host's rank-or-deal choice) lands with the voting phase and will run in
 * that branch behind `update sessions … where status = 'swiping'`, so two
 * members finishing at once can't run it twice.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/done-swiping">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("status, batch").eq("id", id).maybeSingle();
  if (!session) return bad("No such session.", 404);
  if (session.status !== "swiping") return bad("Picking isn’t running.", 409);

  const { data: flipped, error } = await admin
    .from("members")
    .update({ done_swiping: true })
    .eq("session_id", id)
    .eq("user_id", user.id)
    .eq("done_swiping", false)
    .select("user_id");
  if (error) {
    console.error("done-swiping failed", error);
    return bad("Couldn’t save that. Try again.", 500);
  }
  if (flipped.length === 0) {
    // Already done, or not a member at all.
    const { data: member } = await admin
      .from("members")
      .select("user_id")
      .eq("session_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return bad("No such session.", 404);
  }

  const { count } = await admin
    .from("members")
    .select("user_id", { count: "exact", head: true })
    .eq("session_id", id)
    .eq("done_swiping", false);
  const everyoneDone = (count ?? 0) === 0;

  return NextResponse.json({ done: true, batch: session.batch, everyoneDone });
}
