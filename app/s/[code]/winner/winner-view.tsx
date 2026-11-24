"use client";

import Link from "next/link";
import { useState } from "react";
import { CameraIcon, CheckIcon, ClockIcon, PinIcon, SendIcon, StarIcon } from "@/components/icons";
import { BrandHeader } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";
import { hoursLine } from "@/lib/places/place";
import {
  distanceLabel,
  readRestaurantData,
  restaurantMeta,
  type LatLng,
  type RestaurantData,
  type RestaurantRow,
} from "@/lib/restaurants";
import { priceLabel } from "@/lib/session-filters";
import { DetailsSheet } from "../explore/details-sheet";
import type { MemberView, SessionView } from "../session-types";

type WinnerViewProps = {
  session: SessionView;
  members: MemberView[];
  restaurants: RestaurantRow[];
  /** The final order, winner first. */
  order: string[];
  winnerId: string | null;
  userId: string;
};

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  const last = n % 10;
  return `${n}${last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th"}`;
}

/** A Google Maps link to the place itself, by place id. */
function directionsUrl(name: string, placeId: string): string {
  const params = new URLSearchParams({ api: "1", query: name, query_place_id: placeId });
  return `https://www.google.com/maps/search/?${params}`;
}

/** Dinner decided (docs/design/11-winner): the winner, directions, details, the runners-up in order. */
export function WinnerView({ session, members, restaurants, order, winnerId, userId }: WinnerViewProps) {
  const me = members.find((m) => m.user_id === userId);
  const viewer: LatLng | null = me?.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null;
  const meetingArea: LatLng | null =
    session.center_lat != null && session.center_lng != null
      ? { lat: session.center_lat, lng: session.center_lng }
      : null;
  /** Where the runners-up's unlabelled distances are measured from. */
  const origin: LatLng | null = viewer ?? meetingArea;
  const byPlace = new Map(restaurants.map((row) => [row.place_id, row]));
  const dataFor = (placeId: string | null): RestaurantData | null => {
    const row = placeId ? byPlace.get(placeId) : null;
    return row ? readRestaurantData(row.data) : null;
  };
  const winner = dataFor(winnerId);
  const runnersUp = order
    .filter((placeId) => placeId !== winnerId)
    .flatMap((placeId) => {
      const data = dataFor(placeId);
      return data ? [{ placeId, data }] : [];
    });
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!winner || !winnerId) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5 text-center">
        <h1 className="font-display text-[28px] leading-[1.1] font-normal tracking-[-0.01em]">This dinner has ended</h1>
        <p className="text-[15px] font-medium text-quiet">{session.name} is over, but the result didn’t come through.</p>
        <Link href="/new" className="text-[15px] font-bold underline underline-offset-[3px]">
          Start a new dinner
        </Link>
      </main>
    );
  }

  const distance = distanceLabel(viewer, meetingArea, winner.location);
  const hours = hoursLine(winner);

  return (
    <>
      <BrandHeader />
      <main className="flex min-h-dvh flex-col lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[480px] lg:pt-10 lg:pb-14">
        <div className="relative h-[300px] shrink-0 bg-[#E9E4DA] lg:overflow-hidden lg:rounded-[28px]">
          {winner.photoUri ? (
            // Google photo URIs come from the server; next/image would need a remote pattern per host.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={winner.photoUri} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[13px] font-bold text-[#5E5A52]">
              <CameraIcon size={26} strokeWidth={1.8} />
              Photo unavailable
            </span>
          )}
        </div>

        {/* Positioned so its rounded top paints over the photo's bottom edge. */}
        <div className="relative -mt-7 flex flex-1 flex-col gap-3.5 rounded-t-[28px] bg-surface px-5 pt-[22px] pb-6 lg:rounded-[28px] lg:shadow-[0_12px_32px_rgba(42,28,21,0.07)]">
          <h1 className="font-display flex items-center gap-2.5 text-[32px] leading-[1.1] font-normal tracking-[-0.01em]">
            <CheckIcon size={24} strokeWidth={3.2} className="shrink-0 text-accent-text" />
            Dinner decided
          </h1>
          <div className="flex flex-col gap-1">
            <h2 className="text-[32px] leading-[1.06] font-extrabold tracking-[-0.025em] [overflow-wrap:anywhere]">
              {winner.name}
            </h2>
            <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold text-quiet">
              {winner.cuisine ? <span>{winner.cuisine}</span> : null}
              {winner.cuisine && winner.priceLevel ? <span aria-hidden="true">·</span> : null}
              {winner.priceLevel ? <span>{priceLabel(winner.priceLevel)}</span> : null}
              {winner.rating !== undefined ? (
                <>
                  {winner.cuisine || winner.priceLevel ? <span aria-hidden="true">·</span> : null}
                  <span className="flex items-center gap-1 text-ink">
                    <StarIcon size={15} />
                    {winner.rating.toFixed(1)}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          {distance || hours ? (
            <ul className="flex flex-col gap-2 text-[15px] font-semibold">
              {distance ? (
                <li className="flex items-center gap-2.5">
                  <PinIcon size={18} className="shrink-0 text-quiet" />
                  <span className="text-quiet">{distance}</span>
                </li>
              ) : null}
              {hours ? (
                <li className="flex items-center gap-2.5">
                  <ClockIcon size={18} className="shrink-0 text-quiet" />
                  {hours}
                </li>
              ) : null}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2.5 pt-1">
            <a
              href={directionsUrl(winner.name, winnerId)}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 items-center justify-center gap-2 rounded-button bg-accent text-[17px] font-extrabold text-white shadow-[0_6px_16px_rgba(210,67,42,0.24)]"
            >
              <SendIcon size={20} strokeWidth={2.4} />
              Get directions
            </a>
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-line bg-surface text-[15px] font-bold text-ink"
            >
              Hours, photos and reviews
            </button>
          </div>

          {runnersUp.length ? (
            <section aria-labelledby="runners-up" className="flex flex-col gap-2 border-t border-track pt-4">
              <h2 id="runners-up" className="text-sm font-bold text-quiet">
                Runners-up
              </h2>
              <ol className="flex flex-col gap-1">
                {runnersUp.map(({ placeId, data }, index) => (
                  <li key={placeId} className="flex min-h-[52px] items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EDE3D3] text-[#5E5A52]"
                      aria-hidden="true"
                    >
                      {data.photoUri ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.photoUri} alt="" className="block size-full object-cover" />
                      ) : (
                        <CameraIcon size={16} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[15px] font-bold">{data.name}</span>
                      <span className="text-[13px] font-semibold text-quiet">{restaurantMeta(data, origin)}</span>
                    </span>
                    <span className="text-[13px] font-bold text-quiet">{ordinal(index + 2)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <Link
            href="/new"
            className="mt-auto flex h-11 items-center justify-center self-center text-[15px] font-bold text-ink underline underline-offset-[3px]"
          >
            Start a new dinner
          </Link>
        </div>
      </main>

      <DetailsSheet
        sessionId={session.id}
        place={detailsOpen ? { placeId: winnerId, data: winner } : null}
        viewer={viewer}
        meetingArea={meetingArea}
        onClose={() => setDetailsOpen(false)}
        footer={
          <Button variant="secondary" onClick={() => setDetailsOpen(false)} className="w-full lg:w-[180px]">
            Close
          </Button>
        }
      />
    </>
  );
}
