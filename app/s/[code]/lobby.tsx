"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { AlertIcon, BackIcon, MapIcon, SearchIcon } from "@/components/icons";
import { MAX_ADDS } from "@/lib/adds";
import { Brand } from "@/components/layout/brand";
import { ScreenFooter } from "@/components/layout/flow-screen";
import { TwoColumn, WideScreen } from "@/components/layout/two-column";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  canStart,
  peopleLabel,
  startNote,
  suggestionsText,
  votingMethodLabel,
  type VotingMethod,
} from "@/lib/lobby-copy";
import { toPersonColor } from "@/lib/people";
import type { LatLng, RestaurantRow } from "@/lib/restaurants";
import { DEFAULT_FILTERS, parseFilters } from "@/lib/session-filters";
import { AddedSpots } from "./added-spots";
import { InviteButton } from "./invite-button";
import { ApiError, patchSession, removeAdd, startSession } from "./session-api";
import type { MemberView, SessionView } from "./session-types";
import { useSessionLive } from "./use-session-live";
import { VotingMethodSheet } from "./voting-method-sheet";

type LobbyProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  initialRestaurants: RestaurantRow[];
  initialMyAddIds: string[];
  userId: string;
};

type Busy = "method" | "suggestions" | "start" | null;

function hereLabel(names: string[]): string {
  if (names.length === 1) return `1 person here: ${names[0]}`;
  return `${names.length} people here: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The add-first lobby from docs/design/04, host and guest views, phone and desktop. */
export function Lobby({
  initialSession,
  initialMembers,
  initialRestaurants,
  initialMyAddIds,
  userId,
}: LobbyProps) {
  const router = useRouter();
  const live = useSessionLive({ initialSession, initialMembers, initialRestaurants, initialMyAddIds });
  const { session, members } = live;

  const isHost = session.host_id === userId;
  const host = members.find((m) => m.user_id === session.host_id);
  const me = members.find((m) => m.user_id === userId);
  const filters = parseFilters(session.filters) ?? DEFAULT_FILTERS;

  // Whoever was here when this page loaded; anyone else arrived live.
  const alreadyHere = useRef(new Set(initialMembers.map((m) => m.user_id)));

  // A row being removed disappears right away; it comes back with the error
  // if the route refuses.
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const visibleSpots = live.restaurants.filter((spot) => !removing.has(spot.place_id));

  const origin: LatLng | null =
    me?.lat != null && me.lng != null
      ? { lat: me.lat, lng: me.lng }
      : session.center_lat != null && session.center_lng != null
        ? { lat: session.center_lat, lng: session.center_lng }
        : null;

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

  async function remove(placeId: string) {
    if (removing.has(placeId)) return;
    setRemoving((current) => new Set(current).add(placeId));
    setError(null);
    try {
      await removeAdd(session.id, placeId);
    } catch (err) {
      // Already gone (removed from another tab, say) is not an error worth showing.
      if (!(err instanceof ApiError && err.code === "not_found")) {
        setError(err instanceof Error ? err.message : "Couldn’t remove that spot.");
      }
    } finally {
      await live.refetchRestaurants();
      setRemoving((current) => {
        const next = new Set(current);
        next.delete(placeId);
        return next;
      });
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
  const explorePath = `/s/${session.code}/explore`;

  const header = (
    <header className="flex items-center justify-between gap-3 px-5 pt-3 lg:gap-4 lg:px-8 lg:pt-6">
      <div className="flex items-center gap-2.5">
        <Link
          href="/"
          aria-label="Leave lobby"
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink"
        >
          <BackIcon size={22} />
        </Link>
        <Brand size="md" className="hidden lg:flex" />
      </div>
      <div className="flex items-center gap-2.5">
        <div className="lg:hidden">
          <AvatarStack
            people={members.map((m) => ({ name: m.display_name, color: toPersonColor(m.color) }))}
            max={8}
            size={28}
            ring="page"
            label={hereLabel(names)}
          />
        </div>
        <InviteButton code={session.code} name={session.name} />
      </div>
    </header>
  );

  return (
    <WideScreen header={header} className="gap-[18px] pt-[18px] lg:pt-6 lg:pb-12">
      {!live.connected ? (
        <div
          role="status"
          className="flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-[13px] font-bold text-white"
        >
          Reconnecting. The list updates again when you’re back online.
        </div>
      ) : null}

      <div className="flex flex-col gap-1 lg:gap-1.5">
        <h1 className="text-[32px] leading-[1.08] font-extrabold tracking-[-0.02em] lg:text-[44px] lg:leading-[1.05] lg:tracking-[-0.025em]">
          {session.name}
        </h1>
        <p className="text-base font-medium text-quiet lg:text-[17px]">
          Add the spots you want. Everyone’s adds go first.
        </p>
      </div>

      <TwoColumn
        variant="panel"
        className="lg:mt-2.5"
        left={
          <>
            {/* The add bar: both open the explore screen (the map itself lands in part 2). */}
            <div className="flex gap-2.5">
              <Link
                href={explorePath}
                className="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-button bg-surface px-4 text-left text-base font-semibold text-quiet shadow-[0_6px_18px_rgba(42,28,21,0.08),0_1px_3px_rgba(42,28,21,0.06)] lg:px-[18px]"
              >
                <SearchIcon size={20} className="shrink-0 text-ink" />
                Add a place or a dish
              </Link>
              <Link
                href={explorePath}
                aria-label="Browse the map"
                className="flex h-14 w-14 shrink-0 items-center justify-center gap-2 rounded-button bg-ink text-[15px] font-bold text-white lg:w-auto lg:px-5"
              >
                <MapIcon size={22} className="lg:size-5" />
                <span className="hidden lg:inline">Browse map</span>
              </Link>
            </div>

            <AddedSpots
              spots={visibleSpots}
              mine={live.myAddIds}
              origin={origin}
              onRemove={remove}
              note={
                totalAdds >= MAX_ADDS
                  ? `${MAX_ADDS} spots is the most a deck can hold.`
                  : undefined
              }
            />
          </>
        }
        right={
          <>
            <WhosHere
              members={members}
              hostId={session.host_id}
              userId={userId}
              arrivedLive={(id) => !alreadyHere.current.has(id)}
            />

            <div className="flex items-center justify-between gap-3 rounded-card bg-surface py-3 pr-3 pl-[18px] shadow-[0_1px_3px_rgba(42,28,21,0.07)]">
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-extrabold lg:text-[15px]">How we pick the winner</span>
                <span className="text-sm font-semibold text-quiet lg:text-[13px]">
                  {votingMethodLabel(session.voting_method)}
                </span>
              </span>
              {isHost ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="flex h-11 shrink-0 items-center rounded-xl bg-tint px-3.5 text-sm font-bold text-ink lg:h-10"
                >
                  Change
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 rounded-card bg-surface px-[18px] py-4 shadow-[0_1px_3px_rgba(42,28,21,0.07)] lg:gap-1.5 lg:py-3.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-extrabold lg:text-[15px]">Then we add suggestions</h2>
                {isHost ? (
                  <Switch
                    checked={session.suggestions_on}
                    onChange={toggleSuggestions}
                    disabled={busy === "suggestions"}
                    label="Add suggestions after the group's spots"
                  />
                ) : null}
              </div>
              <p className="text-sm leading-[1.45] font-medium text-quiet lg:text-[13px]">
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

            <ScreenFooter className="pt-3.5">
              {isHost ? (
                <div className="flex flex-col gap-2 lg:gap-2.5">
                  <Button
                    onClick={start}
                    loading={busy === "start"}
                    loadingLabel="Starting…"
                    disabled={!canStart(totalAdds, session.suggestions_on)}
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
                  className="flex min-h-[84px] items-center gap-3.5 rounded-button bg-surface px-[18px] py-3.5 shadow-[0_1px_3px_rgba(42,28,21,0.07)]"
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
            </ScreenFooter>
          </>
        }
      />

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
    </WideScreen>
  );
}

type WhosHereProps = {
  members: MemberView[];
  hostId: string;
  userId: string;
  arrivedLive: (userId: string) => boolean;
};

/** The desktop lobby's people list (phones show the avatar stack in the header instead). */
function WhosHere({ members, hostId, userId, arrivedLive }: WhosHereProps) {
  return (
    <section
      aria-labelledby="whos-here"
      className="hidden flex-col rounded-card bg-surface px-[18px] pt-4 pb-2 shadow-[0_1px_3px_rgba(42,28,21,0.07)] lg:flex"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="whos-here" className="text-base font-extrabold">
          Who’s here
        </h2>
        <span className="text-[13px] font-bold text-quiet">{peopleLabel(members.length)}</span>
      </div>
      <ul className="mt-2">
        {members.map((member) => {
          const isMe = member.user_id === userId;
          const isHost = member.user_id === hostId;
          const justJoined = !isMe && arrivedLive(member.user_id);
          return (
            <li key={member.user_id} className="flex min-h-12 items-center gap-3">
              <Avatar
                name={member.display_name}
                color={toPersonColor(member.color)}
                size={32}
                text={isMe ? "You" : undefined}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                {isMe ? "You" : member.display_name}
              </span>
              {justJoined ? (
                <span className="text-[13px] font-bold text-accent-text">Just joined</span>
              ) : (
                <span className="text-[13px] font-semibold text-quiet">
                  {isHost ? "Host" : "Joined"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
