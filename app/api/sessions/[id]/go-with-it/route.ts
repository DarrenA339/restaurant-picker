import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/go-with-it: from deciding with exactly one
 * finalist, the host makes it the winner. The result row gets the winner
 * and the session ends, conditionally on the status.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/go-with-it">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("host_id, status").eq("id", id).maybeSingle();
  if (!session) return bad("No such session.", 404);
  if (session.host_id !== user.id) return bad("Only the host can decide.", 403);
  if (session.status !== "deciding") return bad("There’s nothing to decide right now.", 409);

  const { data: result } = await admin.from("results").select("finalists").eq("session_id", id).maybeSingle();
  if (!result || result.finalists.length !== 1) return bad("Go with it needs exactly one finalist.", 409);
  const winner = result.finalists[0];

  const { data: moved, error } = await admin
    .from("sessions")
    .update({ status: "done" })
    .eq("id", id)
    .eq("status", "deciding")
    .select("status");
  if (error) {
    console.error("go-with-it failed", error);
    return bad("Couldn’t finish. Try again.", 500);
  }
  if (moved.length === 0) return bad("There’s nothing to decide right now.", 409);

  const { error: resultError } = await admin
    .from("results")
    .update({ winner_place_id: winner, runner_up_place_id: null })
    .eq("session_id", id);
  if (resultError) console.error("go-with-it result failed", resultError);
  return NextResponse.json({ status: "done", winner });
}
