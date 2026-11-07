import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { finishRanking } from "@/lib/finish-ranking";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { adminRankStore } from "@/lib/supabase/rank-store";
import { visitorUser } from "@/lib/supabase/visitor";
import { validateBallot, type Ballot, type Method } from "@/lib/voting";

/** The body is one of {pick}, {ordering}, or {votes}; the session's method says which. */
function readBallot(method: Method, body: Record<string, unknown>): Ballot | null {
  switch (method) {
    case "plurality":
      return typeof body.pick === "string" ? { method, pick: body.pick } : null;
    case "borda":
      return Array.isArray(body.ordering) && body.ordering.every((p) => typeof p === "string")
        ? { method, ordering: body.ordering as string[] }
        : null;
    case "quadratic": {
      if (typeof body.votes !== "object" || body.votes === null || Array.isArray(body.votes)) return null;
      const votes: Record<string, number> = {};
      for (const [placeId, n] of Object.entries(body.votes as Record<string, unknown>)) {
        votes[placeId] = typeof n === "number" ? n : Number.NaN;
      }
      return { method, votes };
    }
  }
}

/**
 * POST /api/sessions/[id]/ballot: a member's final-round ballot. Checked
 * against the session's method and finalists with lib/voting.ts, saved
 * (the server is the only writer of ballots), and the member marked done
 * ranking. Once everyone has voted the round ends (lib/finish-ranking.ts)
 * behind the conditional ranking → done update.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/ballot">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Send a JSON body.");
  const user = await visitorUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const { data: session } = await admin.from("sessions").select("id, status, voting_method").eq("id", id).maybeSingle();
  if (!session) return bad("No such session.", 404);
  const { data: member } = await admin
    .from("members")
    .select("user_id")
    .eq("session_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return bad("No such session.", 404);
  if (session.status !== "ranking") return bad("The final round isn’t open.", 409);

  const { data: result } = await admin.from("results").select("finalists").eq("session_id", id).maybeSingle();
  const finalists = result?.finalists ?? [];
  const ballot = readBallot(session.voting_method, body);
  if (!ballot) return bad("That ballot doesn’t match the group’s voting method.");
  const problem = validateBallot(ballot, session.voting_method, finalists);
  if (problem) return bad(problem);

  const payload =
    ballot.method === "plurality"
      ? { pick: ballot.pick }
      : ballot.method === "borda"
        ? { ordering: ballot.ordering }
        : { votes: ballot.votes };
  const { error } = await admin
    .from("ballots")
    .upsert({ session_id: id, user_id: user.id, payload }, { onConflict: "session_id,user_id" });
  if (error) {
    console.error("ballot save failed", error);
    return bad("Couldn’t save your ballot. Try again.", 500);
  }
  await admin.from("members").update({ done_ranking: true }).eq("session_id", id).eq("user_id", user.id);

  const { count } = await admin
    .from("members")
    .select("user_id", { count: "exact", head: true })
    .eq("session_id", id)
    .eq("done_ranking", false);
  const everyoneDone = (count ?? 0) === 0;
  if (!everyoneDone) return NextResponse.json({ saved: true, everyoneDone });

  try {
    const finished = await finishRanking(adminRankStore(admin), session);
    return NextResponse.json({ saved: true, everyoneDone, ...(finished.ok ? { status: "done" } : {}) });
  } catch (err) {
    console.error("finish ranking failed", err);
    return bad("Your ballot is in, but the result couldn’t be computed. Try again.", 500);
  }
}
