import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { finishRanking } from "@/lib/finish-ranking";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminRankStore } from "@/lib/supabase/rank-store";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/end-ranking: the host's "Decide without": the
 * final round ends with the ballots in so far; missing ballots are left out.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/sessions/[id]/end-ranking">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("id, host_id, status, voting_method").eq("id", id).maybeSingle();
  if (!session) return bad("No such session.", 404);
  if (session.host_id !== user.id) return bad("Only the host can decide.", 403);
  if (session.status !== "ranking") return bad("The final round isn’t open.", 409);

  const { count } = await admin
    .from("ballots")
    .select("user_id", { count: "exact", head: true })
    .eq("session_id", id);
  if ((count ?? 0) === 0) return bad("Nobody has ranked yet. Wait for at least one ballot.", 409);

  try {
    const finished = await finishRanking(adminRankStore(admin), session);
    if (!finished.ok) {
      return finished.code === "conflict"
        ? bad("The result is already in.", 409)
        : bad("There are no finalists to decide between.", 409);
    }
    return NextResponse.json({ status: "done", winner: finished.order[0] });
  } catch (error) {
    console.error("end ranking failed", error);
    return bad("Couldn’t decide. Try again.", 500);
  }
}
