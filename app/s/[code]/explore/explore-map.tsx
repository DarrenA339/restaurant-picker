"use client";

import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useEffect, useEffectEvent, useRef } from "react";
import { CheckIcon, ForkKnifeIcon, RefreshIcon } from "@/components/icons";
import { initialsFor, personBgClass, toPersonColor } from "@/lib/people";
import { areaFromBounds, type SearchArea } from "@/lib/places/place";
import type { LatLng } from "@/lib/restaurants";

export type MapPin = { placeId: string; name: string; location: LatLng; added: boolean };
export type MapMember = { userId: string; name: string; color: number; location: LatLng };
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
      className="absolute top-[76px] left-1/2 flex h-10 -translate-x-1/2 items-center gap-2 rounded-full bg-surface px-4 text-sm font-extrabold whitespace-nowrap text-ink shadow-[0_2px_10px_rgba(23,24,26,0.18)] lg:top-5"
    >
      <RefreshIcon size={15} className={searching ? "animate-spin motion-reduce:animate-none" : ""} />
      {searching ? "Searching" : "Search this area"}
    </button>
  );
}

function MemberDot({ member, isViewer }: { member: MapMember; isViewer: boolean }) {
  const color = isViewer ? "bg-ink" : personBgClass[toPersonColor(member.color)];
  return (
    <AdvancedMarker
      position={member.location}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      clickable={false}
      zIndex={1}
      title={isViewer ? "You" : member.name}
    >
      <span
        className={`flex size-[30px] items-center justify-center rounded-full border-[2.5px] border-white text-[11px] font-extrabold text-white shadow-[0_2px_6px_rgba(23,24,26,0.22)] ${color}`}
        aria-hidden="true"
      >
        {isViewer ? "You" : initialsFor(member.name)}
      </span>
    </AdvancedMarker>
  );
}

function RestaurantPin({ pin, selected, onSelect }: { pin: MapPin; selected: boolean; onSelect: () => void }) {
  const size = selected ? "size-[38px]" : "size-[30px]";
  const shadow = selected
    ? "shadow-[0_0_0_6px_rgba(210,67,42,0.22),0_3px_8px_rgba(23,24,26,0.25)]"
    : "shadow-[0_3px_8px_rgba(23,24,26,0.25)]";
  return (
    <AdvancedMarker
      position={pin.location}
      anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
      zIndex={selected ? 5 : 2}
      title={`${pin.name}${pin.added ? ", added" : ""}${selected ? ", selected" : ""}`}
      onClick={onSelect}
    >
      <span className="relative flex items-center justify-center">
        {selected ? (
          <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 flex-col items-center">
            <span className="flex h-7 items-center rounded-[9px] bg-surface px-2.5 text-xs font-extrabold whitespace-nowrap text-ink shadow-[0_3px_10px_rgba(23,24,26,0.16)]">
              {pin.name}
            </span>
            <span className="size-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-surface" />
          </span>
        ) : null}
        <span
          className={`relative flex items-center justify-center rounded-full border-[2.5px] border-white bg-accent text-white transition-[width,height] duration-150 ${size} ${shadow}`}
        >
          <ForkKnifeIcon size={14} strokeWidth={2.6} />
          {pin.added ? (
            <span className="absolute -top-1.5 -right-1.5 flex size-[17px] items-center justify-center rounded-full border-2 border-white bg-ink text-white">
              <CheckIcon size={9} strokeWidth={4} />
            </span>
          ) : null}
        </span>
      </span>
    </AdvancedMarker>
  );
}
