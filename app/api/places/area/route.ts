import { NextResponse, type NextRequest } from "next/server";
import { bad, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces, placePredictions } from "@/lib/places/google";
import { US_BOUNDS, type Prediction } from "@/lib/places/place";
import { visitorUser } from "@/lib/supabase/visitor";

const MAX_INPUT = 100;
const MIN_INPUT = 2;

/**
 * GET /api/places/area?q=&token=
 *
 * Starting-area predictions for the Create and Join screens: a neighborhood,
 * landmark, or address, biased to the US. Needs no session; the signed-in
 * visitor is the only gate. The client keeps one session token per typing
 * session and ends it with the Place Details call in the sibling route, so
 * the keystrokes bill as one session. One Google call per request.
 */
export async function GET(request: NextRequest) {
  // Read before the try: at build time this is where Next stops prerendering
  // the handler, and that signal must not be caught as a failed search.
  const params = request.nextUrl.searchParams;
  const calls = new CallLog();
  try {
    const input = (params.get("q") ?? "").trim();
    const token = params.get("token") ?? "";
    if (input.length < MIN_INPUT || input.length > MAX_INPUT) return bad("Type a few letters of a place.");
    if (!UUID.test(token)) return bad("Missing search session token.");

    const user = await visitorUser();
    if (!user) return bad("Sign in first.", 401);

    const result = await googlePlaces(calls).autocomplete({
      input,
      sessionToken: token,
      locationBias: { rectangle: US_BOUNDS },
      languageCode: "en",
      regionCode: "us",
    });
    const places: Prediction[] = placePredictions(result);
    return NextResponse.json({ places });
  } catch (error) {
    console.error("area autocomplete failed", error);
    return bad("Search isn’t working right now. Try again.", 502);
  } finally {
    calls.log("GET /api/places/area");
  }
}
