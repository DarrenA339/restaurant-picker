import { NextResponse, type NextRequest } from "next/server";
import { bad, UUID } from "@/lib/api";
import { textSearchBody } from "@/lib/deck";
import { rankByAttributes } from "@/lib/places/attributes";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces } from "@/lib/places/google";
import { searchArea, toRestaurantData, type PlaceResult } from "@/lib/places/place";
import { DEFAULT_FILTERS, parseFilters, searchFiltersFromParams } from "@/lib/session-filters";
import { viewerLocation, visitorSession } from "@/lib/supabase/visitor";

const MAX_QUERY = 120;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 50_000;
/** What "Search this area" looks for when the field is empty. */
const DEFAULT_QUERY = "restaurants";

function num(value: string | null): number | null | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/places/search?session=&q=&lat=&lng=&radius=&<filters>
 *
 * The explore screen's search: one Text Search per request with the spec's
 * field mask, biased to the session's area unless the map sends its own
 * center and radius ("Search this area"). The filters default to the
 * session's; the Filters sheet overrides any of them (the query-string form
 * in lib/session-filters.ts). Google applies one cuisine, price levels, the
 * rating floor, and open now itself; the rest are judged here, dropping only
 * confirmed misses and ranking confirmed matches first. Several cuisines
 * lead the words ("Korean or Thai dumplings"). An empty query browses for
 * restaurants. Results carry card data but no photo: photos are resolved
 * (and billed) only when a spot is added or dealt.
 */
export async function GET(request: NextRequest) {
  // Read before the try: at build time this is where Next stops prerendering
  // the handler, and that signal must not be caught as a failed search.
  const params = request.nextUrl.searchParams;
  const calls = new CallLog();
  try {
    const sessionId = params.get("session") ?? "";
    const query = (params.get("q") ?? "").trim();
    if (!UUID.test(sessionId)) return bad("No such session.", 404);
    if (query.length > MAX_QUERY) return bad("That search is too long.");

    const lat = num(params.get("lat"));
    const lng = num(params.get("lng"));
    const radius = num(params.get("radius"));
    if (lat === null || lng === null || radius === null) {
      return bad("Those search options don’t look right.");
    }
    if ((lat === undefined) !== (lng === undefined)) return bad("Send both lat and lng.");
    if (lat !== undefined && lng !== undefined && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      return bad("That location doesn’t look right.");
    }

    const { supabase, user, session } = await visitorSession(sessionId);
    if (!user) return bad("Sign in first.", 401);
    if (!session) return bad("No such session.", 404);
    if (session.status === "done") return bad("This dinner has ended.", 409);

    const filters = searchFiltersFromParams(
      parseFilters(session.filters) ?? DEFAULT_FILTERS,
      (key) => params.get(key),
    );
    if (!filters) return bad("Those filters don’t look right.");
    const viewer = await viewerLocation(supabase, sessionId, user.id);
    const area = searchArea(session, filters, viewer);
    const center = lat !== undefined && lng !== undefined ? { lat, lng } : area.center;
    const radiusM =
      radius === undefined ? area.radiusM : Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius));

    const body = textSearchBody(filters, { center, radiusM }, query || DEFAULT_QUERY);
    const result = await googlePlaces(calls).searchText(body);
    const found = (result.places ?? []).flatMap((place) => (place.id ? [{ ...place, id: place.id }] : []));
    const places: PlaceResult[] = rankByAttributes(found, filters).map((place) => ({
      placeId: place.id,
      data: toRestaurantData(place, null),
    }));
    return NextResponse.json({ places });
  } catch (error) {
    console.error("places search failed", error);
    return bad("Search isn’t working right now. Try again.", 502);
  } finally {
    calls.log("GET /api/places/search");
  }
}
