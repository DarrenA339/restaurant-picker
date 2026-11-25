"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertIcon, BackIcon, CheckIcon, MapIcon, SearchIcon } from "@/components/icons";
import { MAX_ADDS } from "@/lib/adds";
import { Brand } from "@/components/layout/brand";
import { ScreenFooter } from "@/components/layout/flow-screen";
import { TwoColumn, WideScreen } from "@/components/layout/two-column";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import { BATCH_SIZES, DECK_MIXES, type DeckMix } from "@/lib/deck";
import {
  canStart,
  MIX_LABELS,
  mixText,
  peopleLabel,
  readyLabel,
  startLabel,
  startNote,
  startWithoutQuestion,
  votingMethodLabel,
  type VotingMethod,
} from "@/lib/lobby-copy";
import { toPersonColor } from "@/lib/people";
import type { LatLng, RestaurantRow } from "@/lib/restaurants";
import { DEFAULT_FILTERS, parseFilters } from "@/lib/session-filters";
import { supabaseBrowser } from "@/lib/supabase/browser";
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

type Busy = "method" | "start" | null;

const BATCH_OPTIONS = BATCH_SIZES.map((size) => ({ value: size, label: String(size) }));
const MIX_STEPS = DECK_MIXES.map((_, index) => index);
const mixAt = (index: number): DeckMix => DECK_MIXES[index] ?? "mostly_adds";

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function hereLabel(names: string[], ready: string[]): string {
  const here = names.length === 1 ? `1 person here: ${names[0]}` : `${names.length} people here: ${listNames(names)}`;
  return ready.length ? `${here}. Done adding: ${listNames(ready)}` : here;
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
  const { show: showToast } = useToast();

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

  // Batch size and mix save as the host moves them. Only the latest change's
  // reply is applied, so a quick drag across the slider can't land out of order.
  const settingsSave = useRef(0);
  async function saveSettings(patch: { batch_size?: number; deck_mix?: DeckMix }) {
    if (busy === "start") return;
    const save = (settingsSave.current += 1);
    const previous = { batch_size: session.batch_size, deck_mix: session.deck_mix };
    setError(null);
    live.applySession(patch);
    try {
      const saved = await patchSession(session.id, patch);
      if (save === settingsSave.current) live.applySession(saved);
    } catch (err) {
      if (save !== settingsSave.current) return;
      live.applySession(previous);
      setError(err instanceof Error ? err.message : "Couldn’t save that.");
    }
  }

  // Ready check: guests say when they're done adding; the host sees the count.
  const guests = members.filter((m) => m.user_id !== session.host_id);
  const readyGuests = guests.filter((m) => m.ready);
  const everyoneReady = guests.length > 0 && readyGuests.length === guests.length;
  const stillAdding = guests.filter((m) => !m.ready).map((m) => m.display_name);

  // The guest's own toggle is written straight to their members row (RLS and
  // the column grant allow exactly that), shown at once and confirmed by the refetch.
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [readyOverride, setReadyOverride] = useState<boolean | null>(null);
  const ready = readyOverride ?? me?.ready ?? false;
  async function setReady(next: boolean) {
    if (readyOverride !== null) return;
    setReadyOverride(next);
    setError(null);
    const { error: writeError } = await supabase
      .from("members")
      .update({ ready: next })
      .eq("session_id", session.id)
      .eq("user_id", userId);
    if (writeError) setError("Couldn’t save that. Try again.");
    else await live.refetchMembers();
    setReadyOverride(null);
  }

  // The host hears about it once, when the last guest becomes ready.
  const wasEveryoneReady = useRef(everyoneReady);
  useEffect(() => {
    if (isHost && everyoneReady && !wasEveryoneReady.current) {
      showToast({ kind: "ok", text: "Everyone’s ready" });
    }
    wasEveryoneReady.current = everyoneReady;
  }, [everyoneReady, isHost, showToast]);

  // Starting before everyone is ready asks first, in the page.
  const [confirmingStart, setConfirmingStart] = useState(false);
  const askFirst = guests.length > 0 && !everyoneReady;

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

  async function start(anyway = false) {
    if (busy) return;
    if (askFirst && !anyway) {
      setConfirmingStart(true);
      return;
    }
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
            people={members.map((m) => ({
              name: m.display_name,
              color: toPersonColor(m.color),
              ready: m.ready && m.user_id !== session.host_id,
            }))}
            max={8}
            size={28}
            ring="page"
            label={hereLabel(names, readyGuests.map((m) => m.display_name))}
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

            <section
              aria-labelledby="deck-settings"
              className="flex flex-col gap-3.5 rounded-card bg-surface px-[18px] py-4 shadow-[0_1px_3px_rgba(42,28,21,0.07)]"
            >
              <h2 id="deck-settings" className="sr-only">
                Batch size and mix
              </h2>
              {isHost ? (
                <>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] font-bold">Batch size</span>
                      <span className="text-[13px] font-semibold text-quiet">Cards before each tally</span>
                    </div>
                    <Segmented
                      label="Batch size"
                      options={BATCH_OPTIONS}
                      value={session.batch_size}
                      onChange={(size) => void saveSettings({ batch_size: size })}
                      disabled={busy === "start"}
                    />
                  </div>
                  <Slider
                    label="Mix"
                    pill={MIX_LABELS[session.deck_mix]}
                    steps={MIX_STEPS}
                    value={[DECK_MIXES.indexOf(session.deck_mix)]}
                    onChange={([index]) => void saveSettings({ deck_mix: mixAt(index) })}
                    handleLabels={["Mix of the group's adds and new places"]}
                    valueText={(index) => MIX_LABELS[mixAt(index)]}
                    stopText={(index) => MIX_LABELS[mixAt(index)]}
                    edgeLabels
                  />
                </>
              ) : (
                <dl className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[15px] font-bold">Batch size</dt>
                    <dd className="flex h-7 items-center rounded-full bg-tint px-2.5 text-[13px] font-bold">
                      {session.batch_size} cards
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-[15px] font-bold">Mix</dt>
                    <dd className="flex h-7 items-center rounded-full bg-tint px-2.5 text-[13px] font-bold">
                      {MIX_LABELS[session.deck_mix]}
                    </dd>
                  </div>
                </dl>
              )}
              <p className="text-sm leading-[1.45] font-medium text-quiet lg:text-[13px]">
                {mixText(session.deck_mix, filters)}
                {isHost ? "" : ` ${host?.display_name ?? "The host"} sets these.`}
              </p>
            </section>

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
                confirmingStart && askFirst ? (
                  <div
                    role="group"
                    aria-labelledby="start-early"
                    className="flex flex-col gap-3 rounded-button bg-surface p-4 shadow-[0_1px_3px_rgba(42,28,21,0.07)]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <p id="start-early" className="text-base font-extrabold">
                        {startWithoutQuestion(stillAdding)}
                      </p>
                      <p className="text-sm font-medium text-quiet">
                        Adding closes for everyone once picking starts.
                      </p>
                    </div>
                    <div className="flex gap-2.5">
                      <Button
                        autoFocus
                        onClick={() => void start(true)}
                        loading={busy === "start"}
                        loadingLabel="Starting…"
                        className="h-12 min-w-0 flex-1 text-base"
                      >
                        Start anyway
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirmingStart(false)}
                        disabled={busy === "start"}
                        className="h-12 min-w-0 flex-1"
                      >
                        Wait
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 lg:gap-2.5">
                    <Button
                      onClick={() => void start()}
                      loading={busy === "start"}
                      loadingLabel="Starting…"
                      disabled={!canStart(totalAdds, session.deck_mix)}
                      className="w-full shadow-[0_4px_12px_rgba(210,67,42,0.20)]"
                    >
                      {startLabel(everyoneReady)}
                    </Button>
                    <p className="text-center text-[13px] font-semibold text-quiet">
                      {askFirst ? (
                        <>
                          <span className="font-extrabold text-ink">
                            {readyLabel(readyGuests.length, guests.length)}
                          </span>
                          {" · "}
                        </>
                      ) : null}
                      {startNote(totalAdds, session.batch_size, session.deck_mix)}
                    </p>
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    aria-pressed={ready}
                    onClick={() => void setReady(!ready)}
                    className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-button border-[1.5px] text-base font-bold ${
                      ready ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink"
                    }`}
                  >
                    {ready ? <CheckIcon size={18} strokeWidth={3.2} /> : null}
                    I’m done adding
                  </button>
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
                        {ready ? "You can still add spots until then." : "Keep adding spots until then."}
                      </span>
                    </span>
                  </div>
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
              {isHost ? (
                <span className="text-[13px] font-semibold text-quiet">Host</span>
              ) : member.ready ? (
                <span className="flex items-center gap-[5px] text-[13px] font-bold text-[#2E6B57]">
                  <CheckIcon size={15} strokeWidth={3} />
                  Ready
                </span>
              ) : justJoined ? (
                <span className="text-[13px] font-bold text-accent-text">Just joined</span>
              ) : (
                <span className="text-[13px] font-semibold text-quiet">Adding spots</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
