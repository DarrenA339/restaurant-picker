"use client";

import { CameraIcon, CheckIcon, PlusIcon, SpinnerIcon } from "@/components/icons";
import { searchMeta, type LatLng, type RestaurantData } from "@/lib/restaurants";

export type AddState = "idle" | "adding" | "added";

export function rowId(placeId: string) {
  return `ex-row-${placeId}`;
}

type ResultRowProps = {
  placeId: string;
  data: RestaurantData;
  origin: LatLng | null;
  state: AddState;
  /** Highlighted: its pin was tapped, or it was tapped itself. */
  selected: boolean;
  onOpen: () => void;
  onAdd: () => void;
};

/** One result from docs/design/06: photo tile, name, meta, and the Add / Adding / Added slot. */
export function ResultRow({ placeId, data, origin, state, selected, onOpen, onAdd }: ResultRowProps) {
  const meta = searchMeta(data, origin);
  const slot = "flex h-11 w-[100px] items-center justify-center gap-1.5 text-sm lg:h-10 lg:w-24";
  return (
    <li
      id={rowId(placeId)}
      className={`flex scroll-m-2 items-center gap-2.5 rounded-2xl py-1 pr-2 pl-2.5 ${
        selected ? "bg-[#FDF3F0] shadow-[inset_3px_0_0_var(--color-accent)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Details for ${data.name}`}
        className="flex min-h-[66px] min-w-0 flex-1 items-center gap-3 bg-transparent p-0 text-left text-ink lg:min-h-[70px]"
      >
        <span
          className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EDE3D3] text-[#5E5A52] lg:size-[54px]"
          aria-hidden="true"
        >
          {data.photoUri ? (
            // Google photo URIs come from the server; next/image would need a remote pattern per host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.photoUri} alt="" className="block size-full object-cover" />
          ) : (
            <CameraIcon size={18} />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="text-base leading-[1.25] font-extrabold">{data.name}</span>
          {meta ? <span className="text-[13px] font-semibold text-quiet">{meta}</span> : null}
        </span>
      </button>
      <span className="flex w-[100px] shrink-0 justify-end lg:w-24">
        {state === "added" ? (
          <span className={`${slot} font-bold text-[#3D4047]`}>
            <CheckIcon size={15} strokeWidth={3} />
            Added
          </span>
        ) : state === "adding" ? (
          <button
            type="button"
            disabled
            aria-busy="true"
            aria-label={`Adding ${data.name}`}
            className={`${slot} rounded-full border-[1.5px] border-[#F1CFC7] bg-surface font-extrabold text-accent-text`}
          >
            <SpinnerIcon size={14} />
            Adding
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${data.name} to the deck`}
            className={`${slot} rounded-full border-[1.5px] border-[#F1CFC7] bg-accent-soft font-extrabold text-accent-text`}
          >
            <PlusIcon size={14} />
            Add
          </button>
        )}
      </span>
    </li>
  );
}
