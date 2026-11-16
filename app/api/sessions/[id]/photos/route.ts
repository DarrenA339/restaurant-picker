import { NextResponse } from "next/server";
import { bad, PLACE_ID, UUID } from "@/lib/api";
import { loadGallery } from "@/lib/gallery";
import { CallLog } from "@/lib/places/calls";
import { PHOTOS_FIELD_MASK } from "@/lib/places/fields";
import { googlePlaces } from "@/lib/places/google";
import { toPlaceDetails, type GalleryResult } from "@/lib/places/place";
import { adminGalleryStore } from "@/lib/supabase/gallery-store";
import { visitorSession } from "@/lib/supabase/visitor";

/**
 * POST /api/sessions/[id]/photos { placeId }
 *
 * The details sheet's gallery, asked for when a sheet opens. The rules live
 * in lib/gallery.ts: the first open in a session resolves up to three more
 * photos for a card (four for an explore result that has none yet) and keeps
 * them, and every later open by any member costs no Google calls. This route
 * proves membership through RLS, then hands the rules the secret-key store
 * and the Google client. A POST because the first call spends photo
 * requests; nothing about it is cacheable by URL.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/photos">) {
  const calls = new CallLog();
  const { id } = await ctx.params;
  try {
    if (!UUID.test(id)) return bad("No such session.", 404);

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return bad("Send a JSON body.");
    const placeId = typeof body.placeId === "string" ? body.placeId : "";
    if (!PLACE_ID.test(placeId)) return bad("That place doesn’t look right.");

    const { user, session } = await visitorSession(id);
    if (!user) return bad("Sign in first.", 401);
    if (!session) return bad("No such session.", 404);

    const google = googlePlaces(calls);
    const photos = await loadGallery(
      {
        store: adminGalleryStore(),
        places: {
          // Only `id,photos`: Place Details bills that at the free IDs Only tier.
          photoRefs: async (place) =>
            toPlaceDetails(await google.details(place, undefined, PHOTOS_FIELD_MASK))?.photos ?? [],
          photoUri: google.photoUri,
        },
      },
      { sessionId: id, placeId, status: session.status },
    );
    return NextResponse.json({ photos } satisfies GalleryResult);
  } catch (error) {
    console.error("gallery failed", error);
    return bad("Couldn’t load the photos.", 502);
  } finally {
    calls.log(`POST /api/sessions/${id}/photos`);
  }
}
