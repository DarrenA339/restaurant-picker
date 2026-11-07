"use client";

import { AdvancedMarker, AdvancedMarkerAnchorPoint } from "@vis.gl/react-google-maps";
import { CheckIcon, ForkKnifeIcon } from "@/components/icons";
import { initialsFor, personBgClass, toPersonColor } from "@/lib/people";
import type { LatLng } from "@/lib/restaurants";

export type MapPin = { placeId: string; name: string; location: LatLng; added: boolean };
export type MapMember = { userId: string; name: string; color: number; location: LatLng };

/** A member's dot: their initials in their person color, "You" for the viewer. */
export function MemberDot({ member, isViewer }: { member: MapMember; isViewer: boolean }) {
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

/** A restaurant pin on the explore map: coral circle, a check badge once added, bigger with a label when selected. */
export function RestaurantPin({
  pin,
  selected,
  onSelect,
}: {
  pin: MapPin;
  selected: boolean;
  onSelect: () => void;
}) {
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
        {selected ? <PinLabel name={pin.name} /> : null}
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

function PinLabel({ name }: { name: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 flex -translate-x-1/2 flex-col items-center">
      <span className="flex h-7 items-center rounded-[9px] bg-surface px-2.5 text-xs font-extrabold whitespace-nowrap text-ink shadow-[0_3px_10px_rgba(23,24,26,0.16)]">
        {name}
      </span>
      <span className="size-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-surface" />
    </span>
  );
}

/** The swipe strip's current card: the design's teardrop pin with its name above. */
export function CardPin({ name, location }: { name: string; location: LatLng }) {
  return (
    <AdvancedMarker
      position={location}
      anchorPoint={AdvancedMarkerAnchorPoint.BOTTOM_CENTER}
      clickable={false}
      zIndex={5}
      title={name}
    >
      <span className="flex flex-col items-center gap-1 drop-shadow-[0_3px_5px_rgba(23,24,26,0.25)]">
        <span className="flex h-[26px] items-center rounded-lg bg-surface px-2.5 text-xs font-extrabold whitespace-nowrap text-ink lg:h-[30px] lg:rounded-[9px] lg:px-3 lg:text-[13px]">
          {name}
        </span>
        <svg width="34" height="42" viewBox="0 0 34 42" aria-hidden="true" className="lg:size-[50px]">
          <path
            d="M17 41 C 17 41, 2 25.5, 2 15.5 A 15 15 0 0 1 32 15.5 C 32 25.5, 17 41, 17 41 Z"
            className="fill-accent"
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
          <path
            d="M13 9v6.5a2 2 0 0 0 2 2M15 9v14M11 9v6.5a2 2 0 0 0 2 2M21.5 23V9c-2 1-3 3.2-3 6v3h3"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </AdvancedMarker>
  );
}
