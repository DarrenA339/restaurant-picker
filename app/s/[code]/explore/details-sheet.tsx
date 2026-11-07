"use client";

import { useState } from "react";
import { CameraIcon, CheckIcon, ClockIcon, CloseIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { hoursLine, type PlaceResult } from "@/lib/places/place";
import { distanceMi, formatMiles, searchMeta, type LatLng } from "@/lib/restaurants";
import type { AddState } from "./result-row";

type DetailsSheetProps = {
  place: PlaceResult | null;
  origin: LatLng | null;
  state: AddState;
  onAdd: () => void;
  onClose: () => void;
};

const linkClass =
  "flex h-12 items-center justify-center rounded-field border-[1.5px] border-line text-sm font-bold text-ink lg:h-11 lg:px-4";

/**
 * A spot's details from docs/design/06 (phone sheet) and 08-details-desktop
 * (a 960px two-pane dialog): photo, name, meta, hours, links, and Add to the
 * deck. Only what the field mask holds; reviews and summaries are V2.
 */
export function DetailsSheet({ place, origin, state, onAdd, onClose }: DetailsSheetProps) {
  // Keep the last place while the close animation runs.
  const [shown, setShown] = useState(place);
  if (place && place !== shown) setShown(place);

  return (
    <Sheet open={place !== null} onClose={onClose} labelledBy="ex-details-title" size="wide" flush>
      {shown ? <Details place={shown} origin={origin} state={state} onAdd={onAdd} onClose={onClose} /> : null}
    </Sheet>
  );
}

type DetailsProps = Omit<DetailsSheetProps, "place"> & { place: PlaceResult };

function Details({ place, origin, state, onAdd, onClose }: DetailsProps) {
  const { data } = place;
  const hours = hoursLine(data);
  const attribution = data.photoAttributions?.[0];
  const distance =
    origin && data.location ? `${formatMiles(distanceMi(origin, data.location))} from you` : null;
  const reviews =
    data.userRatingCount !== undefined
      ? ` (${data.userRatingCount.toLocaleString("en-US")} reviews)`
      : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-2 pb-5 lg:flex-row lg:overflow-hidden lg:p-0">
        <div className="relative h-[200px] shrink-0 overflow-hidden rounded-[20px] bg-[#E9E4DA] lg:h-auto lg:min-h-[280px] lg:min-w-0 lg:flex-1 lg:rounded-none">
          {data.photoUri ? (
            // Google photo URIs come from the server; next/image would need a remote pattern per host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUri} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[13px] font-bold text-[#5E5A52]">
              <CameraIcon size={26} strokeWidth={1.8} />
              Restaurant photo
            </span>
          )}
          {attribution ? (
            <span className="absolute bottom-4 left-4 hidden h-7 items-center rounded-full bg-surface px-2.5 text-xs font-semibold text-[#3D4047] lg:flex">
              Photo by&nbsp;
              {attribution.uri ? (
                <a href={attribution.uri} target="_blank" rel="noreferrer" className="text-[#3D4047] underline">
                  {attribution.name}
                </a>
              ) : (
                attribution.name
              )}
              &nbsp;on Google Maps
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 pt-4 lg:min-w-0 lg:flex-1 lg:gap-5 lg:overflow-y-auto lg:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2
                id="ex-details-title"
                className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] lg:text-[34px] lg:leading-[1.08]"
              >
                {data.name}
              </h2>
              <p className="text-[15px] font-semibold text-quiet">
                {searchMeta(data, null)}
                {reviews}
              </p>
              {distance ? <p className="text-[15px] font-medium text-quiet">{distance}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-ink"
            >
              <CloseIcon size={16} />
            </button>
          </div>

          {hours ? (
            <p className="flex items-center gap-2 rounded-2xl bg-page px-4 py-3.5 text-[15px] font-bold">
              <ClockIcon size={17} />
              {hours}
            </p>
          ) : null}

          {data.servesVegetarianFood ? (
            <ul className="flex flex-wrap gap-2">
              <li className="flex h-8 items-center rounded-full bg-tint px-3 text-[13px] font-semibold">
                Vegetarian options
              </li>
            </ul>
          ) : null}

          {data.websiteUri || data.googleMapsUri ? (
            <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
              {data.websiteUri ? (
                <a href={data.websiteUri} target="_blank" rel="noreferrer" className={linkClass}>
                  Website
                </a>
              ) : null}
              {data.googleMapsUri ? (
                <a href={data.googleMapsUri} target="_blank" rel="noreferrer" className={linkClass}>
                  Directions
                </a>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs font-semibold text-quiet">
            Info and photos from <span className="font-extrabold text-ink">Google</span> Maps
            {attribution ? <span className="lg:hidden"> · Photo by {attribution.name}</span> : null}
          </p>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-[calc(22px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--color-track)] lg:flex lg:justify-end lg:px-5 lg:py-3.5">
        {state === "added" ? (
          <div
            role="status"
            className="flex h-14 items-center justify-center gap-2 rounded-button bg-tint text-base font-extrabold text-[#3D4047] lg:w-[260px]"
          >
            <CheckIcon size={18} strokeWidth={3} />
            Added to the group’s deck
          </div>
        ) : (
          <Button
            onClick={onAdd}
            loading={state === "adding"}
            loadingLabel="Adding"
            className="w-full shadow-[0_4px_12px_rgba(210,67,42,0.20)] lg:w-[180px]"
          >
            <PlusIcon size={18} />
            Add to the deck
          </Button>
        )}
      </div>
    </div>
  );
}
