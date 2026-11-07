import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { Constants } from "@/lib/database.types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type VotingMethod = (typeof Constants.public.Enums.voting_method)[number];

function isVotingMethod(value: unknown): value is VotingMethod {
  return (
    typeof value === "string" &&
    (Constants.public.Enums.voting_method as readonly string[]).includes(value)
  );
}

/**
 * PATCH /api/sessions/[id]: the host changes `voting_method` and/or
 * `suggestions_on` while the session is still in the lobby. Both lock at
 * Start, so the update is conditional on status = 'lobby'.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return bad("Send a JSON body.");

  const changes: { voting_method?: VotingMethod; suggestions_on?: boolean } = {};
  if ("voting_method" in body) {
    if (!isVotingMethod(body.voting_method)) return bad("Unknown voting method.");
    changes.voting_method = body.voting_method;
  }
  if ("suggestions_on" in body) {
    if (typeof body.suggestions_on !== "boolean") return bad("suggestions_on must be true or false.");
    changes.suggestions_on = body.suggestions_on;
  }
  if (Object.keys(changes).length === 0) return bad("Nothing to change.");

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
  if (session.host_id !== user.id) return bad("Only the host can change this.", 403);
  if (session.status !== "lobby") return bad("Picking has started, so this is locked.", 409);

  const { data: updated, error } = await admin
    .from("sessions")
    .update(changes)
    .eq("id", id)
    .eq("status", "lobby")
    .select("voting_method, suggestions_on")
    .maybeSingle();
  if (error) {
    console.error("patch session failed", error);
    return bad("Couldn’t save that. Try again.", 500);
  }
  if (!updated) return bad("Picking has started, so this is locked.", 409);

  return NextResponse.json(updated);
}
