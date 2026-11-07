"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AlertIcon, BackIcon, MapIcon, SearchIcon } from "@/components/icons";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FIXTURE_MY_ADDS, FIXTURE_ORIGIN, FIXTURE_RESTAURANTS, USE_FIXTURES } from "@/lib/fixtures";
import {
  startNote,
  suggestionsText,
  votingMethodLabel,
  type VotingMethod,
} from "@/lib/lobby-copy";
import { toPersonColor } from "@/lib/people";
import type { LatLng } from "@/lib/restaurants";
import { DEFAULT_FILTERS, parseFilters } from "@/lib/session-filters";
import { AddedSpots } from "./added-spots";
import { InviteButton } from "./invite-button";
import { patchSession, startSession } from "./session-api";
import type { MemberView, SessionView } from "./session-types";
import { useSessionLive } from "./use-session-live";
import { VotingMethodSheet } from "./voting-method-sheet";

type LobbyProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  userId: string;
};

type Busy = "method" | "suggestions" | "start" | null;

function hereLabel(names: string[]): string {
  if (names.length === 1) return `1 person here: ${names[0]}`;
  return `${names.length} people here: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The add-first lobby from docs/design/04, host and guest views. */
export function Lobby({ initialSession, initialMembers, userId }: LobbyProps) {
  const router = useRouter();
  const live = useSessionLive({ initialSession, initialMembers });
  const { session, members } = live;

  const isHost = session.host_id === userId;
  const host = members.find((m) => m.user_id === session.host_id);
  const me = members.find((m) => m.user_id === userId);
  const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;

  // Until phase 6 wires the add routes, the list is fixtures shaped like
  // restaurants rows. Removing one is local only.
  const spots = USE_FIXTURES ? FIXTURE_RESTAURANTS : live.restaurants;
  const myAdds: ReadonlySet<string> = USE_FIXTURES
    ? new Set(FIXTURE_MY_ADDS[isHost ? "host" : "guest"])
    : live.myAddIds;
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const visibleSpots = spots.filter((spot) => !removed.has(spot.place_id));

  let origin: LatLng | null =
    me?.lat != null && me.lng != null
      ? { lat: me.lat, lng: me.lng }
      : session.center_lat != null && session.center_lng != null
        ? { lat: session.center_lat, lng: session.center_lng }
        : null;
  if (!origin && USE_FIXTURES) origin = FIXTURE_ORIGIN;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setSheetError(null);
  }, []);

  async function saveMethod(method: VotingMethod) {
    if (busy) return;
    setBusy("method");
    setSheetError(null);
    try {
      const saved = await patchSession(session.id, { voting_method: method });
      live.applySession(saved);
      setSheetOpen(false);
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : "Couldn’t save that.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuggestions(next: boolean) {
    if (busy) return;
    setBusy("suggestions");
    setError(null);
    const previous = session.suggestions_on;
    live.applySession({ suggestions_on: next });
    try {
      const saved = await patchSession(session.id, { suggestions_on: next });
      live.applySession(saved);
    } catch (err) {
      live.applySession({ suggestions_on: previous });
      setError(err instanceof Error ? err.message : "Couldn’t save that.");
    } finally {
      setBusy(null);
    }
  }

  async function start() {
    if (busy) return;
    setBusy("start");
    setError(null);
    try {
      await startSession(session.id);
      // Realtime will also deliver the status change; refresh now so the
      // host doesn't wait on the socket.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t start.");
      setBusy(null);
    }
  }

  const names = members.map((m) => m.display_name);
  const totalAdds = visibleSpots.length;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col gap-[18px] px-5 pt-3 pb-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            aria-label="Leave lobby"
            className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink"
          >
            <BackIcon size={22} />
          </Link>
          <div className="flex items-center gap-2.5">
            <AvatarStack
              people={members.map((m) => ({ name: m.display_name, color: toPersonColor(m.color) }))}
              max={8}
              size={28}
              ring="page"
              label={hereLabel(names)}
            />
            <InviteButton code={session.code} />
          </div>
        </div>

        {!live.connected ? (
          <div
            role="status"
            className="flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-[13px] font-bold text-white"
          >
            Reconnecting. The list updates again when you’re back online.
          </div>
        ) : null}

        <div className="flex flex-col gap-1">
          <h1 className="text-[32px] leading-[1.08] font-extrabold tracking-[-0.02em]">
            {session.name}
          </h1>
          <p className="text-base font-medium text-quiet">
            Add the spots you want. Everyone’s adds go first.
          </p>
        </div>

        {/* The add bar. Search and the explore map arrive in phase 6. */}
        <div className="flex gap-2.5">
          <button
            type="button"
            aria-disabled="true"
            title="Adding spots comes next"
            className="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-button bg-surface px-4 text-left text-base font-semibold text-quiet shadow-[0_6px_18px_rgba(23,24,26,0.08),0_1px_3px_rgba(23,24,26,0.06)]"
          >
            <SearchIcon size={20} className="shrink-0 text-ink" />
            Add a place or a dish
          </button>
          <button
            type="button"
            aria-disabled="true"
            aria-label="Browse the map"
            title="The explore map comes next"
            className="flex size-14 shrink-0 items-center justify-center rounded-button bg-ink text-white"
          >
            <MapIcon size={22} />
          </button>
        </div>

        <AddedSpots
          spots={visibleSpots}
          mine={myAdds}
          origin={origin}
          onRemove={(placeId) => setRemoved((current) => new Set(current).add(placeId))}
        />

        <div className="flex items-center justify-between gap-3 rounded-card bg-surface py-3 pr-3 pl-[18px] shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-extrabold">How we pick the winner</span>
            <span className="text-sm font-semibold text-quiet">
              {votingMethodLabel(session.voting_method)}
            </span>
          </span>
          {isHost ? (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex h-11 shrink-0 items-center rounded-xl bg-tint px-3.5 text-sm font-bold text-ink"
            >
              Change
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 rounded-card bg-surface px-[18px] py-4 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold">Then we add suggestions</h2>
            {isHost ? (
              <Switch
                checked={session.suggestions_on}
                onChange={toggleSuggestions}
                disabled={busy === "suggestions"}
                label="Add suggestions after the group's spots"
              />
            ) : null}
          </div>
          <p className="text-sm leading-[1.45] font-medium text-quiet">
            {suggestionsText({
              suggestionsOn: session.suggestions_on,
              isHost,
              hostName: host?.display_name ?? "The host",
              filters,
              totalAdds,
            })}
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="flex min-h-11 items-center gap-3 rounded-field border-[1.5px] border-[#EBCFCA] bg-surface py-1 pr-1.5 pl-4 text-sm font-bold text-ink"
          >
            <AlertIcon size={16} className="shrink-0 text-[#A3271B]" />
            {error}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 shrink-0 bg-page px-5 pt-3.5 pb-6 shadow-[0_-1px_0_#ECEAE5]">
        {isHost ? (
          <div className="flex flex-col gap-2">
            <Button
              onClick={start}
              loading={busy === "start"}
              loadingLabel="Starting…"
              className="w-full shadow-[0_4px_12px_rgba(210,67,42,0.20)]"
            >
              Start picking
            </Button>
            <p className="text-center text-[13px] font-semibold text-quiet">
              {startNote(totalAdds, session.suggestions_on)}
            </p>
          </div>
        ) : (
          <div
            role="status"
            className="flex min-h-[84px] items-center gap-3.5 rounded-button bg-surface px-[18px] py-3.5 shadow-[0_1px_3px_rgba(23,24,26,0.07)]"
          >
            {host ? (
              <Avatar name={host.display_name} color={toPersonColor(host.color)} size={40} />
            ) : null}
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-extrabold">
                Waiting for {host?.display_name ?? "the host"} to start
              </span>
              <span className="text-sm font-medium text-quiet">
                Keep adding spots until then.
              </span>
            </span>
          </div>
        )}
      </div>

      {isHost ? (
        <VotingMethodSheet
          open={sheetOpen}
          current={session.voting_method}
          saving={busy === "method"}
          error={sheetError}
          onClose={closeSheet}
          onSave={saveMethod}
        />
      ) : null}
    </div>
  );
}
