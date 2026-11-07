import { NextResponse, type NextRequest } from "next/server";
import { bad, PLACE_ID, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { AREA_FIELD_MASK } from "@/lib/places/fields";
import { googlePlaces } from "@/lib/places/google";
import type { AreaResult } from "@/lib/places/place";
import { MAX_AREA_LABEL } from "@/lib/session-filters";
import { visitorUser } from "@/lib/supabase/visitor";

/**
 * GET /api/places/area/[placeId]?token=
 *
 * Resolves a picked starting area to a point: one Place Details call asking
 * for only `location` and `formattedAddress` (Essentials tier), on the same
 * session token the predictions used, which ends that session. The point
 * becomes the session's center (Create) or the member's location (Join).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/places/area/[placeId]">) {
  const params = request.nextUrl.searchParams;
  const calls = new CallLog();
  const { placeId } = await ctx.params;
  try {
    if (!PLACE_ID.test(placeId)) return bad("No such place.", 404);
    const token = params.get("token") ?? "";
    const sessionToken = UUID.test(token) ? token : undefined;

    const user = await visitorUser();
    if (!user) return bad("Sign in first.", 401);

    const place = await googlePlaces(calls).details(placeId, sessionToken, AREA_FIELD_MASK);
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return bad("That place has no location. Try another.", 404);
    }
    const result: AreaResult = {
      placeId,
      address: (place.formattedAddress ?? "").slice(0, MAX_AREA_LABEL),
      location: { lat, lng },
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("area details failed", error);
    return bad("Couldn’t find that place. Try again.", 502);
  } finally {
    calls.log(`GET /api/places/area/${placeId}`);
  }
}
