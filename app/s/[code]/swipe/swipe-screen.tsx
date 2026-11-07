"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AlertIcon, RefreshIcon } from "@/components/icons";
import { TwoColumn, WideScreen } from "@/components/layout/two-column";
import { AvatarStack } from "@/components/ui/avatar";
import { buildMemberDeck } from "@/lib/deck";
import { toPersonColor } from "@/lib/people";
import { BOSTON } from "@/lib/places/place";
import { readRestaurantData, type LatLng, type RestaurantRow } from "@/lib/restaurants";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { DetailsSheet } from "../explore/details-sheet";
import { endSwiping, markDoneSwiping } from "../session-api";
import type { MapMember } from "../map-markers";
import type { MemberView, SessionView } from "../session-types";
import { useSessionLive } from "../use-session-live";
import { DoneView } from "./done-view";
import { MapStrip } from "./map-strip";
import { SwipeCard } from "./swipe-card";
import { SwipeWriteError, writeSwipe, type SwipeValue } from "./swipes";
import { VoteButtons } from "./vote-buttons";

type SwipeScreenProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  initialRestaurants: RestaurantRow[];
  initialMyAddIds: string[];
  /** This member's swipes so far (RLS hands back only their own). */
  initialSwipes: { place_id: string; value: SwipeValue }[];
  userId: string;
};

type Leaving = { placeId: string; value: SwipeValue };
type Toast = { text: string; retry?: () => void };

const TOAST_MS = 6000;
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el && (TYPING_TAGS.has(el.tagName) || el.isContentEditable));
}

/**
 * The swipe screen (docs/design/07-swipe, docs/SPEC.md "Swipe deck"): this
 * member's deck for the current batch, the map strip, No / Veto / Yes, and
 * the details sheet. Votes are optimistic: the card leaves at once, the
 * swipe row is written behind it, and a failed write brings the card back
 * with a retry toast. The deck resumes at the first unswiped card.
 */
export function SwipeScreen({
  initialSession,
  initialMembers,
  initialRestaurants,
  initialMyAddIds,
  initialSwipes,
  userId,
}: SwipeScreenProps) {
  const live = useSessionLive({ initialSession, initialMembers, initialRestaurants, initialMyAddIds });
  const { session, members } = live;
  const supabase = useMemo(() => supabaseBrowser(), []);
  const reducedMotion = useReducedMotion() ?? false;

  const me = members.find((m) => m.user_id === userId);
  const sessionCenter: LatLng | null =
    session.center_lat != null && session.center_lng != null
      ? { lat: session.center_lat, lng: session.center_lng }
      : null;
  const origin: LatLng | null =
    me?.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : sessionCenter;

  const deck = useMemo(
    () => buildMemberDeck(live.restaurants, { userId, batch: session.batch, myAddIds: live.myAddIds }),
    [live.restaurants, live.myAddIds, userId, session.batch],
  );

  const [swiped, setSwiped] = useState<ReadonlyMap<string, SwipeValue>>(
    () => new Map(initialSwipes.map((s) => [s.place_id, s.value])),
  );
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Vetoes left: the member row's count, or an optimistic value until the server catches up.
  const [vetoOverride, setVetoOverride] = useState<{ base: number; value: number } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const serverVetoes = me?.vetoes_left ?? 0;
  const vetoesLeft =
    vetoOverride && vetoOverride.base === serverVetoes ? vetoOverride.value : serverVetoes;

  const unswiped = deck.filter((card) => !swiped.has(card.place_id));
  const current = unswiped[0] ?? null;
  const next = unswiped[1] ?? null;
  const leavingCard = leaving ? (deck.find((card) => card.place_id === leaving.placeId) ?? null) : null;
  const swipedCount = deck.length - unswiped.length;
  const position = Math.min(swipedCount + 1, deck.length);
  // Done: no cards left, or the server says so (the host ended picking for everyone).
  const done = (!current && !leaving) || Boolean(me?.done_swiping);

  const currentData = current ? readRestaurantData(current.data) : null;

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function showToast(next: Toast) {
    window.clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }

  async function vote(value: SwipeValue, card: RestaurantRow | null = current) {
    if (!card || leaving) return;
    if (value === "veto" && vetoesLeft <= 0) return;
    setDetailsOpen(false);
    setToast(null);
    setSwiped((map) => new Map(map).set(card.place_id, value));
    setLeaving({ placeId: card.place_id, value });
    if (value === "veto") setVetoOverride({ base: serverVetoes, value: vetoesLeft - 1 });
    try {
      await writeSwipe(supabase, {
        session_id: session.id,
        user_id: userId,
        place_id: card.place_id,
        value,
      });
      // The trigger spent the veto; the members row says how many are left now.
      if (value === "veto") void live.refetchMembers();
    } catch (error) {
      // Roll back: the card is unswiped again, so it is the deck's next card.
      setSwiped((map) => {
        const rolled = new Map(map);
        rolled.delete(card.place_id);
        return rolled;
      });
      if (value === "veto") {
        setVetoOverride(null);
        void live.refetchMembers();
      }
      if (error instanceof SwipeWriteError && error.reason === "no_vetoes") {
        showToast({ text: "No vetoes left. Say yes or no instead." });
      } else {
        showToast({ text: "Your vote didn’t save.", retry: () => void vote(value, card) });
      }
    }
  }

  // Desktop keys: Left for No, Right for Yes, V for Veto, Enter for Details; never while typing.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        void vote("no");
        break;
      case "ArrowRight":
        event.preventDefault();
        void vote("yes");
        break;
      case "v":
      case "V":
        void vote("veto");
        break;
      case "Enter":
        if (!detailsOpen && current) {
          event.preventDefault();
          setDetailsOpen(true);
        }
        break;
    }
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Finishing the deck tells the server once per batch; the members row then shows it to everyone.
  const markDone = useEffectEvent(() => {
    if (me?.done_swiping) return;
    markDoneSwiping(session.id)
      .then(() => live.refetchMembers())
      .catch((error) => console.warn("done-swiping failed", error));
  });
  useEffect(() => {
    if (done) markDone();
  }, [done, session.batch]);

  if (done) {
    return (
      <DoneView
        session={session}
        members={members}
        userId={userId}
        total={deck.length}
        onEnd={async () => {
          await endSwiping(session.id);
          await live.refetchMembers();
        }}
      />
    );
  }

  const mapMembers: MapMember[] = members.flatMap((m) =>
    m.lat != null && m.lng != null
      ? [{ userId: m.user_id, name: m.display_name, color: m.color, location: { lat: m.lat, lng: m.lng } }]
      : [],
  );
  const pin = currentData?.location ? { name: currentData.name, location: currentData.location } : null;
  const pct = deck.length ? Math.round((swipedCount / deck.length) * 100) : 0;
  const leavingData = leavingCard ? readRestaurantData(leavingCard.data) : null;
  const nextData = next ? readRestaurantData(next.data) : null;
  const details = detailsOpen && current && currentData ? { placeId: current.place_id, data: currentData } : null;

  return (
    <WideScreen className="max-h-dvh gap-0 overflow-hidden pt-4 pb-[22px] lg:max-h-none lg:overflow-visible lg:pt-6 lg:pb-8">
      <header className="flex shrink-0 items-center justify-between gap-3 lg:gap-4">
        <div className="flex flex-col gap-px lg:gap-0.5">
          <span className="text-[13px] font-semibold text-quiet lg:text-sm">{session.name}</span>
          <h1 className="text-[22px] leading-[1.2] font-extrabold tracking-[-0.01em] lg:text-[28px] lg:leading-[1.1]">
            Pick a spot
          </h1>
        </div>
        <div className="flex items-center gap-2.5 lg:gap-3">
          <AvatarStack
            people={members.map((m) => ({ name: m.display_name, color: toPersonColor(m.color) }))}
            max={8}
            size={28}
            ring="page"
            label={`${members.length} in this session`}
          />
          <span className="flex h-8 items-center rounded-full bg-surface px-3 text-sm font-bold whitespace-nowrap shadow-[0_1px_2px_rgba(23,24,26,0.08)] lg:h-9 lg:px-3.5 lg:text-[15px]">
            {position} of {deck.length}
          </span>
        </div>
      </header>
      <div
        role="progressbar"
        aria-label="Restaurants reviewed"
        aria-valuemin={0}
        aria-valuemax={deck.length}
        aria-valuenow={swipedCount}
        className="mt-3 h-1 shrink-0 overflow-hidden rounded-full bg-track lg:mt-3.5"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!live.connected ? (
        <div
          role="status"
          className="mt-2.5 flex min-h-9 shrink-0 items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-[13px] font-bold text-white"
        >
          <RefreshIcon size={16} />
          Reconnecting. Your votes are saved and will sync.
        </div>
      ) : null}

      <TwoColumn
        variant="swipe"
        className="lg:mt-6"
        left={
          <div className="relative mt-3.5 h-[188px] shrink-0 overflow-hidden rounded-card shadow-[0_1px_3px_rgba(23,24,26,0.08)] lg:mt-0 lg:h-[620px]">
            <MapStrip
              pin={pin}
              fallback={sessionCenter ?? origin ?? BOSTON}
              members={mapMembers}
              viewerId={userId}
              reducedMotion={reducedMotion}
            />
          </div>
        }
        right={
          <>
            <div className="relative mt-3.5 min-h-0 flex-1 lg:mt-0 lg:h-[500px] lg:flex-none">
              {nextData ? (
                <div
                  className="absolute inset-0 translate-y-2 scale-[0.97] overflow-hidden rounded-[26px] bg-surface shadow-[0_2px_6px_rgba(23,24,26,0.05)]"
                  aria-hidden="true"
                >
                  {nextData.photoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={nextData.photoUri} alt="" className="size-full object-cover opacity-60" />
                  ) : (
                    <div className="size-full bg-[#E9E4DA]" />
                  )}
                </div>
              ) : null}
              {current && currentData ? (
                <SwipeCard
                  key={current.place_id}
                  data={currentData}
                  origin={origin}
                  interactive={!leaving}
                  leaving={null}
                  reducedMotion={reducedMotion}
                  onLeft={() => undefined}
                  onSwipe={(value) => void vote(value)}
                  onOpen={() => setDetailsOpen(true)}
                />
              ) : null}
              {leaving && leavingCard && leavingData ? (
                <SwipeCard
                  key={`leaving-${leaving.placeId}`}
                  data={leavingData}
                  origin={origin}
                  interactive
                  leaving={leaving.value}
                  reducedMotion={reducedMotion}
                  onLeft={() => setLeaving(null)}
                  onSwipe={() => undefined}
                  onOpen={() => undefined}
                />
              ) : null}
            </div>

            <div className="shrink-0 pt-4 lg:pt-0">
              <VoteButtons vetoesLeft={vetoesLeft} disabled={!current} onVote={(value) => void vote(value)} />
            </div>

            <p className="hidden flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] font-semibold text-quiet lg:flex">
              <Key label="No">←</Key>
              <Key label="Veto">V</Key>
              <Key label="Yes">→</Key>
              <Key label="Details">Enter</Key>
            </p>
          </>
        }
      />

      <DetailsSheet
        place={details}
        origin={origin}
        onClose={() => setDetailsOpen(false)}
        footer={
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-end">
            <span className="hidden text-[13px] font-semibold text-quiet lg:mr-auto lg:block">
              Esc closes. Your place in the deck stays put.
            </span>
            <VoteButtons sheet vetoesLeft={vetoesLeft} disabled={!current} onVote={(value) => void vote(value)} />
          </div>
        }
      />

      {toast ? (
        <div
          role="alert"
          className="fixed right-5 bottom-[106px] left-5 z-30 mx-auto flex min-h-12 max-w-[390px] items-center gap-2.5 rounded-field border-[1.5px] border-[#EBCFCA] bg-surface py-1 pr-1.5 pl-3.5 text-sm font-bold text-ink shadow-[0_8px_20px_rgba(23,24,26,0.12)] lg:bottom-8"
        >
          <AlertIcon size={16} className="shrink-0 text-[#A3271B]" />
          <span className="flex-1">{toast.text}</span>
          {toast.retry ? (
            <button
              type="button"
              onClick={toast.retry}
              className="h-[38px] shrink-0 rounded-[10px] bg-ink px-3 text-[13px] font-extrabold text-white"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}
    </WideScreen>
  );
}

function Key({ label, children }: { label: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line bg-surface px-1.5 font-sans text-xs font-bold text-ink">
        {children}
      </kbd>
      {label}
    </span>
  );
}
