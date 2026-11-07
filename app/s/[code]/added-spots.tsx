"use client";

import { useState } from "react";
import { CameraIcon, CloseIcon } from "@/components/icons";
import { spotsLabel } from "@/lib/lobby-copy";
import {
  readRestaurantData,
  restaurantMeta,
  type LatLng,
  type RestaurantRow,
} from "@/lib/restaurants";

const ROWS_COLLAPSED = 5;

type AddedSpotsProps = {
  spots: RestaurantRow[];
  /** place_ids the viewer added; those rows get "You added this" and a remove button. */
  mine: ReadonlySet<string>;
  /** Where distances are measured from; null hides them. */
  origin: LatLng | null;
  onRemove: (placeId: string) => void;
};

/** "Added so far": the group's spots, from docs/design/04. */
export function AddedSpots({ spots, mine, origin, onRemove }: AddedSpotsProps) {
  const [expanded, setExpanded] = useState(false);
  const total = spots.length;
  const shown = expanded ? spots : spots.slice(0, ROWS_COLLAPSED);
  const canExpand = total > ROWS_COLLAPSED;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-extrabold">Added so far</h2>
        <span className="text-sm font-bold text-quiet">{spotsLabel(total)}</span>
      </div>
      <ul className="rounded-card bg-surface px-3.5 py-1 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
        {total === 0 ? (
          <li className="flex min-h-[68px] items-center text-sm font-medium text-quiet">
            Nothing added yet. Search a place or a dish to get started.
          </li>
        ) : null}
        {shown.map((spot) => {
          const data = readRestaurantData(spot.data);
          const isMine = mine.has(spot.place_id);
          const name = data?.name ?? "Unnamed spot";
          const meta = data ? restaurantMeta(data, origin) : "";
          return (
            <li
              key={spot.place_id}
              className="flex min-h-[68px] items-center gap-3 border-b border-tint"
            >
              <span
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EDE3D3] text-[#5E5A52]"
                aria-hidden="true"
              >
                {data?.photoUri ? (
                  // Google photo URIs come from the server; next/image would need a remote pattern per host.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.photoUri} alt="" className="block size-full object-cover" />
                ) : (
                  <CameraIcon size={18} />
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-base font-extrabold">{name}</span>
                {meta ? (
                  <span className="text-[13px] font-semibold text-quiet">{meta}</span>
                ) : null}
                {isMine ? (
                  <span className="text-xs font-extrabold text-accent-text">You added this</span>
                ) : null}
              </span>
              {isMine ? (
                <button
                  type="button"
                  onClick={() => onRemove(spot.place_id)}
                  aria-label={`Remove ${name}`}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint p-0 text-ink"
                >
                  <CloseIcon size={16} />
                </button>
              ) : null}
            </li>
          );
        })}
        {canExpand ? (
          <li className="flex min-h-[52px] items-center">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="h-11 bg-transparent p-0 text-sm font-extrabold text-ink underline underline-offset-[3px]"
            >
              {expanded ? "Show fewer" : `See all ${spotsLabel(total)}`}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
