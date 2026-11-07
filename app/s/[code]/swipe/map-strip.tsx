"use client";

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
import type { LatLng } from "@/lib/restaurants";
import { CardPin, MemberDot, type MapMember } from "../map-markers";

type MapStripProps = {
  /** The current card's pin; the map pans to it. */
  pin: { name: string; location: LatLng } | null;
  /** Where the map starts when the first card has no location. */
  fallback: LatLng;
  members: MapMember[];
  viewerId: string;
  reducedMotion: boolean;
};

const ZOOM = 14;

/**
 * The map strip above the deck (docs/SPEC.md "Map strip"): one Google Map
 * per session that pans to each card and shows every member's dot. No
 * gestures, so sideways drags reach the card.
 */
export function MapStrip({ pin, fallback, members, viewerId, reducedMotion }: MapStripProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPS_KEY;
  const mapId = process.env.NEXT_PUBLIC_MAP_ID;
  const center = pin?.location ?? fallback;
  if (!apiKey || !mapId) {
    return <div className="size-full bg-[#EEF0EB]" role="img" aria-label="Map unavailable" />;
  }
  return (
    <APIProvider apiKey={apiKey}>
      <Map
        mapId={mapId}
        defaultCenter={center}
        defaultZoom={ZOOM}
        gestureHandling="none"
        disableDefaultUI
        clickableIcons={false}
        keyboardShortcuts={false}
        className="size-full"
      >
        <Pan to={center} reducedMotion={reducedMotion} />
        {members.map((member) => (
          <MemberDot key={member.userId} member={member} isViewer={member.userId === viewerId} />
        ))}
        {pin ? <CardPin name={pin.name} location={pin.location} /> : null}
      </Map>
    </APIProvider>
  );
}

/** Re-centers on each card: a pan, or a jump when motion is reduced. */
function Pan({ to, reducedMotion }: { to: LatLng; reducedMotion: boolean }) {
  const map = useMap();
  const { lat, lng } = to;
  useEffect(() => {
    if (!map) return;
    if (reducedMotion) map.setCenter({ lat, lng });
    else map.panTo({ lat, lng });
  }, [map, lat, lng, reducedMotion]);
  return null;
}
