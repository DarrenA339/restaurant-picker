import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/final-round: from deciding, the host sends the
 * stored finalists to the final round. Conditional on the status, so a
 * double tap moves the session once.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/final-round">) {
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
  if (!result || result.finalists.length === 0) return bad("There are no finalists to rank.", 409);

  const { data: moved, error } = await admin
    .from("sessions")
    .update({ status: "ranking" })
    .eq("id", id)
    .eq("status", "deciding")
    .select("status");
  if (error) {
    console.error("final-round failed", error);
    return bad("Couldn’t start the final round. Try again.", 500);
  }
  if (moved.length === 0) return bad("There’s nothing to decide right now.", 409);
  return NextResponse.json({ status: "ranking", finalists: result.finalists });
}
