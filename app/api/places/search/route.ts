import { NextResponse, type NextRequest } from "next/server";
import { bad, UUID } from "@/lib/api";
import { CallLog } from "@/lib/places/calls";
import { googlePlaces, type SearchTextBody } from "@/lib/places/google";
import { PRICE_LEVEL_ENUM, searchArea, toRestaurantData, type PlaceResult } from "@/lib/places/place";
import {
  DEFAULT_FILTERS,
  parseCuisineList,
  parseFilters,
  PRICE_LEVELS,
  type PriceLevel,
} from "@/lib/session-filters";
import { viewerLocation, visitorSession } from "@/lib/supabase/visitor";

const MAX_QUERY = 120;
const MIN_RADIUS_M = 100;
const MAX_RADIUS_M = 50_000;
const PAGE_SIZE = 20;
/** What "Search this area" looks for when the field is empty. */
const DEFAULT_QUERY = "restaurants";

function num(value: string | null): number | null | undefined {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "1,2" → [1, 2]; undefined when absent, null when malformed. */
function priceList(value: string | null): PriceLevel[] | null | undefined {
  if (value === null) return undefined;
  if (value === "") return [];
  const levels = value.split(",").map(Number);
  if (!levels.every((n) => (PRICE_LEVELS as readonly number[]).includes(n))) return null;
  return [...new Set(levels as PriceLevel[])];
}

function bool(value: string | null): boolean | null | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

/**
 * GET /api/places/search?session=&q=&lat=&lng=&radius=&prices=&openNow=&cuisines=
 *
 * The explore screen's search: one Text Search per request with the spec's
 * field mask, biased to the session's area unless the map sends its own
 * center and radius ("Search this area"). Price, open-now, and cuisines
 * default to the session's filters; the Filters sheet overrides them.
 * Cuisines have no Google filter, so they lead the text query ("Korean or
 * Thai dumplings"). An empty query browses for restaurants. Results carry
 * card data but no photo: photos are resolved (and billed) only when a spot
 * is added or dealt.
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
    const prices = priceList(params.get("prices"));
    const openNow = bool(params.get("openNow"));
    const cuisinesParam = params.get("cuisines");
    const cuisines = cuisinesParam === null ? undefined : parseCuisineList(cuisinesParam);
    if (
      lat === null ||
      lng === null ||
      radius === null ||
      prices === null ||
      openNow === null ||
      cuisines === null
    ) {
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

    const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;
    const viewer = await viewerLocation(supabase, sessionId, user.id);
    const area = searchArea(session, filters, viewer);
    const center = lat !== undefined && lng !== undefined ? { lat, lng } : area.center;
    const radiusM =
      radius === undefined ? area.radiusM : Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, radius));
    const priceLevels = prices ?? filters.prices;
    const cuisineList = cuisines ?? filters.cuisines;
    const textQuery = [cuisineList.join(" or "), query || DEFAULT_QUERY].filter(Boolean).join(" ");

    const body: SearchTextBody = {
      textQuery,
      includedType: "restaurant",
      pageSize: PAGE_SIZE,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } },
      languageCode: "en",
      regionCode: "us",
    };
    if (openNow ?? filters.openNow) body.openNow = true;
    if (priceLevels.length) body.priceLevels = priceLevels.map((level) => PRICE_LEVEL_ENUM[level]);

    const result = await googlePlaces(calls).searchText(body);
    const places: PlaceResult[] = (result.places ?? []).flatMap((place) =>
      place.id ? [{ placeId: place.id, data: toRestaurantData(place, null) }] : [],
    );
    return NextResponse.json({ places });
  } catch (error) {
    console.error("places search failed", error);
    return bad("Search isn’t working right now. Try again.", 502);
  } finally {
    calls.log("GET /api/places/search");
  }
}
