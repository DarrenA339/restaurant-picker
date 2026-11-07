import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { finishWithGoogle } from "@/lib/supabase/finish-store";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/done-swiping: the member finished the current
 * batch. The flip is conditional (`done_swiping = false`), so a second tap
 * or a second tab changes nothing. When the whole group is done, the tally
 * runs (lib/finish-batch.ts) behind the conditional swiping → deciding
 * claim, so two members finishing at once can't run it twice; the loser
 * just sees everyone done. A deal-more outcome may call Google.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/done-swiping">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("*").eq("id", id).maybeSingle();
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
  if (!everyoneDone) return NextResponse.json({ done: true, batch: session.batch, everyoneDone });

  const calls = new CallLog();
  try {
    const finished = await finishWithGoogle(admin, calls, session);
    return NextResponse.json({
      done: true,
      batch: session.batch,
      everyoneDone,
      ...(finished.ok ? { step: finished.step, status: finished.status } : {}),
    });
  } catch (error) {
    console.error("finish batch failed", error);
    return bad("Couldn’t tally the batch. Try again.", 500);
  } finally {
    calls.log(`POST /api/sessions/${id}/done-swiping`);
  }
}
