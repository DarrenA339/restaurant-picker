import { NextResponse, type NextRequest } from "next/server";
import { bad, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { searchArea, type AutocompleteResult, type Prediction } from "@/lib/places/place";
import { parseFilters } from "@/lib/session-filters";
import { viewerLocation, visitorSession } from "@/lib/supabase/visitor";

const MAX_INPUT = 100;
/** Up to five Table A types: the add bar is for places to eat and drink. */
const FOOD_TYPES = ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"];

/**
 * GET /api/places/autocomplete?session=&q=&token=
 *
 * Name and dish predictions for the lobby's add bar, biased to the session's
 * area. The client makes one session token per typing session and sends it
 * with every keystroke and with the add that follows, so Google bills the
 * keystrokes as one session ended by that add's Place Details call. One
 * Google call per request.
 */
export async function GET(request: NextRequest) {
  // Read before the try: at build time this is where Next stops prerendering
  // the handler, and that signal must not be caught as a failed search.
  const params = request.nextUrl.searchParams;
  const calls = new CallLog();
  try {
    const sessionId = params.get("session") ?? "";
    const input = (params.get("q") ?? "").trim();
    const token = params.get("token") ?? "";
    if (!UUID.test(sessionId)) return bad("No such session.", 404);
    if (input.length < 1 || input.length > MAX_INPUT) return bad("Type a place or a dish to search.");
    if (!UUID.test(token)) return bad("Missing search session token.");

    const { supabase, user, session } = await visitorSession(sessionId);
    if (!user) return bad("Sign in first.", 401);
    if (!session) return bad("No such session.", 404);
    if (session.status !== "lobby") return bad("Picking has started, so adds are closed.", 409);

    const viewer = await viewerLocation(supabase, sessionId, user.id);
    const area = searchArea(session, parseFilters(session.filters), viewer);
    const center = { latitude: area.center.lat, longitude: area.center.lng };

    const result = await googlePlaces(calls).autocomplete({
      input,
      sessionToken: token,
      includeQueryPredictions: true,
      includedPrimaryTypes: FOOD_TYPES,
      locationBias: { circle: { center, radius: area.radiusM } },
      origin: center,
      languageCode: "en",
      // regionCode, not includedRegionCodes: the latter drops query predictions.
      regionCode: "us",
    });

    const places: Prediction[] = [];
    const queries: { text: string }[] = [];
    for (const suggestion of result.suggestions ?? []) {
      const place = suggestion.placePrediction;
      if (place?.placeId) {
        places.push({
          placeId: place.placeId,
          mainText: place.structuredFormat?.mainText?.text ?? place.text?.text ?? "",
          secondaryText: place.structuredFormat?.secondaryText?.text ?? "",
        });
        continue;
      }
      const text = suggestion.queryPrediction?.text?.text?.trim();
      if (text) queries.push({ text });
    }

    return NextResponse.json({ places, queries } satisfies AutocompleteResult);
  } catch (error) {
    console.error("autocomplete failed", error);
    return bad("Search isn’t working right now. Try again.", 502);
  } finally {
    calls.log("GET /api/places/autocomplete");
  }
}
