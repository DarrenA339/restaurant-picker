import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * POST /api/sessions/[id]/start: the host starts picking. For now this only
 * moves the session from lobby to swiping, which Realtime pushes to every
 * phone. Phase 7 adds the rest of the spec's Start: build batch 1 from the
 * adds, fill with suggestions, resolve photos, record each adder's yes.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/start">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from("sessions")
    .select("host_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) return bad("No such session.", 404);
  if (session.host_id !== user.id) return bad("Only the host can start.", 403);
  if (session.status !== "lobby") return bad("Picking has already started.", 409);

  // Conditional so two taps (or two tabs) can't start it twice.
  const { data: updated, error } = await admin
    .from("sessions")
    .update({ status: "swiping" })
    .eq("id", id)
    .eq("status", "lobby")
    .select("status")
    .maybeSingle();
  if (error) {
    console.error("start session failed", error);
    return bad("Couldn’t start. Try again.", 500);
  }
  if (!updated) return bad("Picking has already started.", 409);

  return NextResponse.json(updated);
}
