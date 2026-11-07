import { NextResponse } from "next/server";
import { addSpot, MAX_ADDS } from "@/lib/adds";
import { bad, PLACE_ID, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { adminAddStore } from "@/lib/supabase/add-store";
import { visitorSession } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/add { placeId, sessionToken? }
 *
 * Adds one of the caller's spots while the session is in the lobby. The
 * rules (cap, duplicates, joining someone else's add) live in lib/adds.ts;
 * this route proves membership through RLS, then hands the secret-key store
 * and the Google client to them. Costs one Place Details call and one photo
 * for a new card, and nothing for a card already in the session.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/add">) {
  const calls = new CallLog();
  const { id } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return bad("Send a JSON body.");
    const placeId = typeof body.placeId === "string" ? body.placeId : "";
    if (!PLACE_ID.test(placeId)) return bad("That place doesn’t look right.");
    const sessionToken =
      typeof body.sessionToken === "string" && UUID.test(body.sessionToken)
        ? body.sessionToken
        : undefined;

    const { user, session } = await visitorSession(id);
    if (!user) return bad("Sign in first.", 401);
    if (!session) return bad("No such session.", 404);

    const result = await addSpot(
      { store: adminAddStore(), places: googlePlaces(calls) },
      { sessionId: id, userId: user.id, placeId, sessionToken, status: session.status },
    );
    if (!result.ok) {
      switch (result.code) {
        case "not_lobby":
          return bad("Picking has started, so adds are closed.", 409, "not_lobby");
        case "duplicate":
          return bad("You already added this spot.", 409, "duplicate");
        case "cap":
          return bad(
            `The group has ${MAX_ADDS} spots already, which is the most a deck can hold.`,
            409,
            "cap",
          );
        case "google":
          return bad("Couldn’t look that place up. Try again.", 502, "google");
      }
    }
    return NextResponse.json(
      { restaurant: result.restaurant, joined: result.joined },
      { status: result.joined ? 200 : 201 },
    );
  } catch (error) {
    console.error("add spot failed", error);
    return bad("Couldn’t add that spot. Try again.", 500);
  } finally {
    calls.log(`POST /api/sessions/${id}/add`);
  }
}
