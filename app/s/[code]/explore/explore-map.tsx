"use client";

import { APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useEffectEvent, useRef } from "react";
import { RefreshIcon } from "@/components/icons";
import { areaFromBounds, type SearchArea } from "@/lib/places/place";
import type { LatLng } from "@/lib/restaurants";
import { MemberDot, RestaurantPin, type MapMember, type MapPin } from "../map-markers";

export type { MapMember, MapPin };
/** A new key asks the map to frame these points. */
export type FitRequest = { key: number; points: LatLng[] };

type ExploreMapProps = {
  center: LatLng;
  pins: MapPin[];
  selected: string | null;
  members: MapMember[];
  viewerId: string;
  fit: FitRequest | null;
  /** The map was panned or zoomed since the last search. */
  moved: boolean;
  searching: boolean;
  onMoved: () => void;
  onSelect: (placeId: string) => void;
  onSearchArea: (area: SearchArea) => void;
};

const DEFAULT_ZOOM = 14;
const SINGLE_PIN_ZOOM = 15;
const FIT_PADDING = { top: 96, right: 32, bottom: 32, left: 32 };

/**
 * The explore map (docs/design/06): result pins, the group's dots, and
 * "Search this area" once the map moves. One Google Map per screen; the
 * Maps JavaScript key is the only Google key the browser sees.
 */
export function ExploreMap(props: ExploreMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_MAPS_KEY;
  const mapId = process.env.NEXT_PUBLIC_MAP_ID;
  if (!apiKey || !mapId) {
    return <div className="size-full bg-[#EEF0EB]" role="img" aria-label="Map unavailable" />;
  }
  const { center, pins, selected, members, viewerId, fit, moved, searching, onMoved, onSelect, onSearchArea } = props;

  return (
    <div className="relative size-full">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId={mapId}
          defaultCenter={center}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          className="size-full"
        >
          <Camera fit={fit} onMoved={onMoved} />
          {members.map((member) => (
            <MemberDot key={member.userId} member={member} isViewer={member.userId === viewerId} />
          ))}
          {pins.map((pin) => (
            <RestaurantPin
              key={pin.placeId}
              pin={pin}
              selected={pin.placeId === selected}
              onSelect={() => onSelect(pin.placeId)}
            />
          ))}
        </Map>
        {moved || searching ? <SearchAreaButton searching={searching} onSearch={onSearchArea} /> : null}
      </APIProvider>
    </div>
  );
}

/** Frames fit requests and reports user gestures, ignoring the camera moves it caused itself. */
function Camera({ fit, onMoved }: { fit: FitRequest | null; onMoved: () => void }) {
  const map = useMap();
  const moved = useEffectEvent(onMoved);
  // Set until the map goes idle after a fit, so that fit's zoom change isn't a "move".
  const fitting = useRef(false);
  // The first idle: zoom events before it come from the map's own setup.
  const settled = useRef(false);

  useEffect(() => {
    if (!map) return;
    const gesture = () => {
      if (settled.current && !fitting.current) moved();
    };
    const listeners = [
      map.addListener("idle", () => {
        settled.current = true;
        fitting.current = false;
      }),
      map.addListener("dragend", gesture),
      map.addListener("zoom_changed", gesture),
    ];
    return () => listeners.forEach((listener) => listener.remove());
  }, [map]);

  useEffect(() => {
    if (!map || !fit || fit.points.length === 0) return;
    fitting.current = true;
    if (fit.points.length === 1) {
      map.panTo(fit.points[0]);
      map.setZoom(SINGLE_PIN_ZOOM);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const point of fit.points) bounds.extend(point);
    map.fitBounds(bounds, FIT_PADDING);
  }, [map, fit]);

  return null;
}

function SearchAreaButton({ searching, onSearch }: { searching: boolean; onSearch: (area: SearchArea) => void }) {
  const map = useMap();
  return (
    <button
      type="button"
      disabled={searching}
      aria-busy={searching || undefined}
      onClick={() => {
        const bounds = map?.getBounds();
        if (bounds) onSearch(areaFromBounds(bounds.toJSON()));
      }}
      className="absolute top-[76px] left-1/2 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 text-sm font-extrabold whitespace-nowrap text-ink shadow-[0_2px_10px_rgba(42,28,21,0.18)] lg:top-5"
    >
      <RefreshIcon size={15} className={searching ? "animate-spin motion-reduce:animate-none" : ""} />
      {searching ? "Searching" : "Search this area"}
    </button>
  );
}
