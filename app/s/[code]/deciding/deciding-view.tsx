"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon, CameraIcon, CheckIcon, LockIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toPersonColor } from "@/lib/people";
import { readRestaurantData, restaurantMeta, type LatLng, type RestaurantRow } from "@/lib/restaurants";
import {
  DEFAULT_FILTERS,
  DISTANCES_MI,
  formatDistance,
  parseFilters,
  priceRangeText,
} from "@/lib/session-filters";
import { dealNextBatch, goToFinalRound, goWithIt, widenDistance } from "../session-api";
import type { MemberView, SessionView } from "../session-types";
import { useSessionLive } from "../use-session-live";

type DecidingViewProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  initialRestaurants: RestaurantRow[];
  initialMyAddIds: string[];
  /** The tally's finalists, most yeses first; empty when the area ran out of places. */
  finalists: string[];
  userId: string;
};

type Busy = "final" | "go" | "deal" | "widen" | null;

/**
 * Deciding (docs/SPEC.md "Session lifecycle", in the style of docs/design/09-done):
 * everyone finished and the tally found finalists. They are listed with no
 * vote counts; the host sends them to the final round (or goes with the one)
 * or deals 20 more, and guests wait. With no finalists at all, the area ran
 * out of places: the "Nothing matches these filters" edge state from
 * docs/design/states.png, with Widen for the host.
 */
export function DecidingView({
  initialSession,
  initialMembers,
  initialRestaurants,
  initialMyAddIds,
  finalists,
  userId,
}: DecidingViewProps) {
  const router = useRouter();
  const live = useSessionLive({ initialSession, initialMembers, initialRestaurants, initialMyAddIds });
  const { session, members } = live;
  const isHost = session.host_id === userId;
  const host = members.find((m) => m.user_id === session.host_id);
  const hostName = host?.display_name ?? "The host";
  const me = members.find((m) => m.user_id === userId);
  const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;
  const origin: LatLng | null =
    me?.lat != null && me.lng != null
      ? { lat: me.lat, lng: me.lng }
      : session.center_lat != null && session.center_lng != null
        ? { lat: session.center_lat, lng: session.center_lng }
        : null;

  const byPlace = new Map(live.restaurants.map((row) => [row.place_id, row]));
  const rows = finalists.flatMap((placeId) => {
    const row = byPlace.get(placeId);
    const data = row ? readRestaurantData(row.data) : null;
    return data ? [{ placeId, data }] : [];
  });
  const one = finalists.length === 1;
  const exhausted = finalists.length === 0;
  const wider = DISTANCES_MI.find((mi) => mi > filters.distanceMi);

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await action();
      // Realtime will also deliver the status change; refresh now so the host doesn't wait on the socket.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(null);
    }
  }

  const errorLine = error ? (
    <p role="alert" className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#A3271B]">
      <AlertIcon size={15} className="shrink-0" />
      {error}
    </p>
  ) : null;

  const footer = isHost ? (
    exhausted ? (
      <>
        <Button
          onClick={() => void run("widen", () => widenDistance(session.id))}
          loading={busy === "widen"}
          loadingLabel="Searching…"
          disabled={!wider}
          className="w-full"
        >
          {wider ? `Widen to ${formatDistance(wider)}` : `${formatDistance(filters.distanceMi)} is as wide as it goes`}
        </Button>
        {errorLine}
      </>
    ) : (
      <>
        <Button
          onClick={() => void run(one ? "go" : "final", () => (one ? goWithIt(session.id) : goToFinalRound(session.id)))}
          loading={busy === "final" || busy === "go"}
          loadingLabel={one ? "Finishing…" : "Starting…"}
          className="w-full"
        >
          {one ? "Go with it" : "Go to final round"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void run("deal", () => dealNextBatch(session.id))}
          loading={busy === "deal"}
          loadingLabel="Dealing…"
          className="w-full"
        >
          Deal 20 more
        </Button>
        {errorLine}
      </>
    )
  ) : (
    <div
      role="status"
      className="flex min-h-[84px] items-center gap-3.5 rounded-button bg-surface px-[18px] py-3.5 shadow-[0_1px_3px_rgba(42,28,21,0.07)]"
    >
      {host ? <Avatar name={host.display_name} color={toPersonColor(host.color)} size={40} /> : null}
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-extrabold">Waiting for {hostName} to decide</span>
        <span className="text-sm font-medium text-quiet">
          {exhausted
            ? "Nothing nearby made the cut, so the search needs widening."
            : one
              ? `${hostName} can go with it or deal 20 more.`
              : `${hostName} picks the final round or deals 20 more.`}
        </span>
      </span>
    </div>
  );

  return (
    <FlowScreen bodyClassName="gap-6 pt-4 pb-6" footerClassName="flex flex-col gap-2.5" footer={footer}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-quiet">{session.name}</span>
        <span className="flex h-8 items-center rounded-full bg-surface px-3 text-[13px] font-bold shadow-[0_1px_2px_rgba(42,28,21,0.08)]">
          Deciding
        </span>
      </div>

      {!live.connected ? (
        <div
          role="status"
          className="flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-[13px] font-bold text-white"
        >
          <RefreshIcon size={16} />
          Reconnecting. This updates again when you’re back online.
        </div>
      ) : null}

      {exhausted ? (
        <div className="flex flex-col gap-3">
          <span className="flex size-16 items-center justify-center rounded-[22px] bg-tint text-ink" aria-hidden="true">
            <SearchIcon size={26} />
          </span>
          <h1 className="text-[34px] leading-[1.08] font-display font-normal tracking-[-0.01em]">
            Nothing matches these filters
          </h1>
          <p className="text-base leading-[1.45] font-medium text-quiet">
            No {filters.openNow ? "open " : ""}spots within {formatDistance(filters.distanceMi)} at{" "}
            {priceRangeText(filters.prices)} right now.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <span
              className="flex size-16 items-center justify-center rounded-[22px] bg-accent-soft text-accent-text"
              aria-hidden="true"
            >
              <CheckIcon size={30} strokeWidth={3} />
            </span>
            <h1 className="text-[34px] leading-[1.08] font-display font-normal tracking-[-0.01em]">
              {one ? "1 spot made the cut" : `${finalists.length} spots made the cut`}
            </h1>
            <p className="text-base leading-[1.45] font-medium text-quiet">
              {isHost
                ? one
                  ? "Go with it, or deal 20 more to keep looking."
                  : "Send them to the final round, or deal 20 more to keep looking."
                : `${hostName} decides what’s next.`}
            </p>
          </div>

          <section
            aria-labelledby="finalists-title"
            className="flex flex-col gap-3 rounded-card bg-surface px-[18px] pt-4 pb-4 shadow-[0_1px_3px_rgba(42,28,21,0.07)]"
          >
            <h2 id="finalists-title" className="text-[17px] font-extrabold">
              {one ? "Finalist" : "Finalists"}
            </h2>
            <ol>
              {rows.map(({ placeId, data }) => {
                const meta = restaurantMeta(data, origin);
                return (
                  <li key={placeId} className="flex min-h-[60px] items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#EDE3D3] text-[#5E5A52]"
                      aria-hidden="true"
                    >
                      {data.photoUri ? (
                        // Google photo URIs come from the server; next/image would need a remote pattern per host.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={data.photoUri} alt="" className="block size-full object-cover" />
                      ) : (
                        <CameraIcon size={16} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-base font-extrabold">{data.name}</span>
                      {meta ? <span className="text-[13px] font-semibold text-quiet">{meta}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="flex items-start gap-2 text-[13px] leading-[1.4] font-semibold text-quiet">
              <LockIcon size={15} className="mt-0.5 shrink-0" />
              Vote counts stay hidden until the result, so they don’t sway anyone’s ranking.
            </p>
          </section>
        </>
      )}
    </FlowScreen>
  );
}
