import { NextResponse } from "next/server";
import { removeAdd } from "@/lib/adds";
import { bad, PLACE_ID, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { adminAddStore } from "@/lib/supabase/add-store";
import { visitorSession } from "@/lib/supabase/visitor";

/**
 * DELETE /api/sessions/[id]/add/[placeId]
 *
 * Removes one of the caller's own adds while the session is in the lobby.
 * The card goes too when nobody else added it (lib/adds.ts). Never calls
 * Google, and logs that it didn't.
 */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[id]/add/[placeId]">,
) {
  const calls = new CallLog();
  const { id, placeId } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);
    if (!PLACE_ID.test(placeId)) return bad("No such spot.", 404);

    const { user, session } = await visitorSession(id);
    if (!user) return bad("Sign in first.", 401);
    if (!session) return bad("No such session.", 404);

    const result = await removeAdd(
      { store: adminAddStore() },
      { sessionId: id, userId: user.id, placeId, status: session.status },
    );
    if (!result.ok) {
      return result.code === "not_lobby"
        ? bad("Picking has started, so adds are closed.", 409, "not_lobby")
        : bad("You didn’t add that spot.", 404, "not_found");
    }
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("remove add failed", error);
    return bad("Couldn’t remove that spot. Try again.", 500);
  } finally {
    calls.log(`DELETE /api/sessions/${id}/add/${placeId}`);
  }
}
