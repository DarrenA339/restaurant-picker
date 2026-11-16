"use client";

import { useEffect, useState } from "react";
import type { GalleryPhoto, RestaurantData } from "@/lib/restaurants";
import { fetchGallery } from "../session-api";

// One gallery per place per session for as long as the tab lives, so opening
// a sheet again asks nobody. `pending` keeps two mounts of the same sheet
// (React's development double effect) from asking twice.
const loaded = new Map<string, GalleryPhoto[]>();
const pending = new Map<string, Promise<GalleryPhoto[]>>();

function load(sessionId: string, placeId: string, key: string): Promise<GalleryPhoto[]> {
  let request = pending.get(key);
  if (!request) {
    request = fetchGallery(sessionId, placeId)
      .then((photos) => {
        loaded.set(key, photos);
        return photos;
      })
      .finally(() => pending.delete(key));
    pending.set(key, request);
  }
  return request;
}

/** Whether the photos route could add anything to the card's own photo. */
function hasMore(data: RestaurantData): boolean {
  const names = data.details?.photos?.length ?? 0;
  // A card dealt before photo names were stored: the route can still look them up.
  if (names === 0) return Boolean(data.photoUri);
  return names > (data.photoUri ? 1 : 0);
}

/**
 * The photos for an open details sheet. Until the route answers (and when it
 * fails, or the place has only the one photo) this is the card's own photo.
 * Called only by the mounted sheet, so nothing is fetched for a place nobody
 * opened.
 */
export function useGallery(sessionId: string, placeId: string, data: RestaurantData): GalleryPhoto[] {
  const key = `${sessionId}:${placeId}`;
  const [arrived, setArrived] = useState<string | null>(null);
  const wanted = hasMore(data);

  useEffect(() => {
    if (!wanted || loaded.has(key)) return;
    let cancelled = false;
    load(sessionId, placeId, key).then(
      () => {
        if (!cancelled) setArrived(key);
      },
      // The card's photo stays; opening the sheet again retries.
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [sessionId, placeId, key, wanted]);

  const gallery = arrived === key || loaded.has(key) ? loaded.get(key) : undefined;
  if (gallery?.length) return gallery;
  if (!data.photoUri) return [];
  return [
    data.photoAttributions
      ? { uri: data.photoUri, attributions: data.photoAttributions }
      : { uri: data.photoUri },
  ];
}
