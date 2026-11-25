import { NextResponse } from "next/server";
import { bad, UUID } from "@/lib/api";
import { Constants } from "@/lib/database.types";
import { BATCH_SIZES, DECK_MIXES, type DeckMix } from "@/lib/deck";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type VotingMethod = (typeof Constants.public.Enums.voting_method)[number];

function isVotingMethod(value: unknown): value is VotingMethod {
  return (
    typeof value === "string" &&
    (Constants.public.Enums.voting_method as readonly string[]).includes(value)
  );
}

function isDeckMix(value: unknown): value is DeckMix {
  return typeof value === "string" && (DECK_MIXES as readonly string[]).includes(value);
}

/**
 * PATCH /api/sessions/[id]: the host changes `voting_method`, `batch_size`
 * (5, 10, 15 or 20) and/or `deck_mix` while the session is still in the
 * lobby. All three lock at Start, so the update is conditional on
 * status = 'lobby'.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return bad("No such session.", 404);

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return bad("Send a JSON body.");

  const changes: { voting_method?: VotingMethod; batch_size?: number; deck_mix?: DeckMix } = {};
  if ("voting_method" in body) {
    if (!isVotingMethod(body.voting_method)) return bad("Unknown voting method.");
    changes.voting_method = body.voting_method;
  }
  if ("batch_size" in body) {
    if (!(BATCH_SIZES as readonly unknown[]).includes(body.batch_size)) {
      return bad(`Batch size must be ${BATCH_SIZES.slice(0, -1).join(", ")} or ${BATCH_SIZES[BATCH_SIZES.length - 1]}.`);
    }
    changes.batch_size = body.batch_size as number;
  }
  if ("deck_mix" in body) {
    if (!isDeckMix(body.deck_mix)) return bad("Unknown mix.");
    changes.deck_mix = body.deck_mix;
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
    .select("voting_method, batch_size, deck_mix")
    .maybeSingle();
  if (error) {
    console.error("patch session failed", error);
    return bad("Couldn’t save that. Try again.", 500);
  }
  if (!updated) return bad("Picking has started, so this is locked.", 409);

  return NextResponse.json(updated);
}
