"use client";

import { Reorder } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertIcon,
  CameraIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  GripIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { Button } from "@/components/ui/button";
import { votingMethodInfo } from "@/lib/lobby-copy";
import { readRestaurantData, restaurantMeta, type LatLng, type RestaurantData, type RestaurantRow } from "@/lib/restaurants";
import { QUADRATIC_BUDGET } from "@/lib/voting";
import { endRanking, submitBallot, type BallotBody } from "../session-api";
import type { MemberView, SessionView } from "../session-types";
import { DoneView } from "../swipe/done-view";
import { useSessionLive } from "../use-session-live";

type RankingViewProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  initialRestaurants: RestaurantRow[];
  initialMyAddIds: string[];
  /** The finalists, most yeses first. */
  finalists: string[];
  /** This member already sent a ballot. */
  hasBallot: boolean;
  userId: string;
};

type Finalist = { placeId: string; data: RestaurantData; meta: string };

/**
 * The final round in the session's method (docs/design/10-final-*):
 * one vote each (pick one), ranked points (drag or arrow the finalists into
 * order), or quadratic votes (spend 9 credits with steppers). The ballot
 * goes to the server for validation; after that this is the done view in
 * ranking mode until the last ballot, or the host's "Decide without".
 */
export function RankingView({
  initialSession,
  initialMembers,
  initialRestaurants,
  initialMyAddIds,
  finalists,
  hasBallot,
  userId,
}: RankingViewProps) {
  const router = useRouter();
  const live = useSessionLive({ initialSession, initialMembers, initialRestaurants, initialMyAddIds });
  const { session, members } = live;
  const method = session.voting_method;
  const me = members.find((m) => m.user_id === userId);
  const origin: LatLng | null =
    me?.lat != null && me.lng != null
      ? { lat: me.lat, lng: me.lng }
      : session.center_lat != null && session.center_lng != null
        ? { lat: session.center_lat, lng: session.center_lng }
        : null;

  const byPlace = new Map(live.restaurants.map((row) => [row.place_id, row]));
  const rows: Finalist[] = finalists.flatMap((placeId) => {
    const row = byPlace.get(placeId);
    const data = row ? readRestaurantData(row.data) : null;
    return data ? [{ placeId, data, meta: restaurantMeta(data, origin) }] : [];
  });
  const byId = new Map(rows.map((r) => [r.placeId, r]));

  const [submitted, setSubmitted] = useState(hasBallot);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>(finalists);
  const [votes, setVotes] = useState<Record<string, number>>({});

  const spent = Object.values(votes).reduce((sum, v) => sum + v * v, 0);
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);

  const ballot: BallotBody | null =
    method === "plurality"
      ? pick
        ? { pick }
        : null
      : method === "borda"
        ? { ordering: order }
        : totalVotes > 0
          ? { votes }
          : null;
  const submitLabel =
    method === "plurality"
      ? pick
        ? "Submit vote"
        : "Pick one to vote"
      : method === "borda"
        ? "Submit ranking"
        : totalVotes > 0
          ? "Submit votes"
          : "Add at least one vote";

  async function submit() {
    if (!ballot || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await submitBallot(session.id, ballot);
      setSubmitted(true);
      await live.refetchMembers();
      if (saved.status === "done") router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save your ballot.");
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <DoneView
        mode="ranking"
        session={session}
        members={members}
        userId={userId}
        onEnd={async () => {
          await endRanking(session.id);
          router.refresh();
        }}
      />
    );
  }

  function move(placeId: string, by: -1 | 1) {
    setOrder((current) => {
      const index = current.indexOf(placeId);
      const target = index + by;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function setVote(placeId: string, next: number) {
    setVotes((current) => {
      const updated = { ...current };
      if (next <= 0) delete updated[placeId];
      else updated[placeId] = next;
      return updated;
    });
  }

  const count = `${rows.length} ${rows.length === 1 ? "finalist" : "finalists"}`;
  const copy =
    method === "plurality"
      ? { title: "Pick your favorite", sub: `${count}. Most votes wins.`, note: "If two spots tie, the one more people said yes to wins." }
      : method === "borda"
        ? { title: "Put your favorites first", sub: `${count}. Drag to reorder, or use the arrows.`, note: "Your first choice counts the most. If two spots tie, the one more people said yes to wins." }
        : {
            title: `Spend your ${QUADRATIC_BUDGET} credits`,
            sub: "Extra votes on one spot cost more. 1 vote costs 1 credit, 2 votes cost 4, 3 votes cost 9.",
            note: "Most total votes wins. If two spots tie, the one more people said yes to wins.",
          };

  return (
    <FlowScreen
      bodyClassName={`${method === "quadratic" ? "gap-[18px]" : "gap-5"} pt-4 pb-5`}
      footerClassName="flex flex-col gap-2"
      footer={
        <>
          <Button onClick={submit} loading={saving} loadingLabel="Saving…" disabled={!ballot} className="w-full">
            {submitLabel}
          </Button>
          {error ? (
            <p role="alert" className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#A3271B]">
              <AlertIcon size={15} className="shrink-0" />
              {error}
            </p>
          ) : null}
        </>
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-quiet">{session.name}</span>
        <span className="flex h-8 items-center rounded-full bg-surface px-3 text-[13px] font-bold shadow-[0_1px_2px_rgba(42,28,21,0.08)]">
          {votingMethodInfo(method).name}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 id="final-title" className="text-[32px] leading-[1.08] font-display font-normal tracking-[-0.01em]">
          {copy.title}
        </h1>
        <p className="text-[15px] leading-[1.45] font-medium text-quiet">{copy.sub}</p>
      </div>

      {method === "plurality" ? (
        <div role="radiogroup" aria-labelledby="final-title" className="flex flex-col gap-3">
          {rows.map((row) => {
            const checked = pick === row.placeId;
            return (
              <button
                key={row.placeId}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setPick(row.placeId)}
                className={`flex w-full items-center gap-3.5 rounded-[20px] bg-surface p-2.5 pr-4 text-left text-ink ${
                  checked
                    ? "shadow-[0_0_0_2px_var(--color-accent),0_1px_3px_rgba(42,28,21,0.08)]"
                    : "shadow-[0_1px_3px_rgba(42,28,21,0.08)]"
                }`}
              >
                <Tile data={row.data} size="size-[72px] rounded-2xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-lg leading-[1.2] font-extrabold">{row.data.name}</span>
                  <span className="text-[13px] font-semibold text-quiet">{row.meta}</span>
                </span>
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 ${
                    checked ? "border-accent" : "border-[#D9D6CF]"
                  }`}
                  aria-hidden="true"
                >
                  {checked ? <span className="size-3 rounded-full bg-accent" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {method === "borda" ? (
        <Reorder.Group axis="y" values={order} onReorder={setOrder} as="ol" className="flex flex-col gap-3">
          {order.map((placeId, index) => {
            const row = byId.get(placeId);
            if (!row) return null;
            const top = index === 0;
            return (
              <Reorder.Item
                key={placeId}
                value={placeId}
                as="li"
                className={`flex cursor-grab items-center gap-2.5 rounded-[20px] bg-surface py-2.5 pr-2.5 pl-2 active:cursor-grabbing ${
                  top
                    ? "shadow-[0_0_0_2px_var(--color-accent),0_1px_3px_rgba(42,28,21,0.08)]"
                    : "shadow-[0_1px_3px_rgba(42,28,21,0.08)]"
                }`}
              >
                <span className="flex h-11 w-6 shrink-0 items-center justify-center text-[#B9B6AE]" aria-hidden="true">
                  <GripIcon size={18} />
                </span>
                <span className="relative shrink-0">
                  <Tile data={row.data} size="size-[68px] rounded-2xl" />
                  <span
                    className={`absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full text-[13px] font-extrabold text-white ${
                      top ? "bg-accent" : "bg-ink"
                    }`}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  {top ? <span className="text-xs font-extrabold text-accent-text">Your top pick</span> : null}
                  <span className="text-[17px] leading-[1.2] font-extrabold">{row.data.name}</span>
                  <span className="text-[13px] font-semibold text-quiet">{row.meta}</span>
                </span>
                <span className="flex shrink-0 flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(placeId, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${row.data.name} up`}
                    className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-line bg-surface text-ink disabled:text-[#C9C6BF]"
                  >
                    <ChevronUpIcon size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(placeId, 1)}
                    disabled={index === order.length - 1}
                    aria-label={`Move ${row.data.name} down`}
                    className="flex size-11 items-center justify-center rounded-xl border-[1.5px] border-line bg-surface text-ink disabled:text-[#C9C6BF]"
                  >
                    <ChevronDownIcon size={18} />
                  </button>
                </span>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
      ) : null}

      {method === "quadratic" ? (
        <>
          <div className="flex flex-col gap-2.5 rounded-[18px] bg-surface px-4 py-3.5 shadow-[0_1px_3px_rgba(42,28,21,0.07)]">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-extrabold">
                {QUADRATIC_BUDGET - spent} {QUADRATIC_BUDGET - spent === 1 ? "credit" : "credits"} left
              </span>
              <span className="text-[13px] font-semibold text-quiet">
                {spent} of {QUADRATIC_BUDGET} spent
              </span>
            </div>
            <div
              role="meter"
              aria-label="Credits spent"
              aria-valuemin={0}
              aria-valuemax={QUADRATIC_BUDGET}
              aria-valuenow={spent}
              className="grid grid-cols-9 gap-1"
            >
              {Array.from({ length: QUADRATIC_BUDGET }, (_, i) => (
                <span key={i} className={`h-2.5 rounded ${i < spent ? "bg-accent" : "bg-track"}`} />
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-3">
            {rows.map((row) => {
              const v = votes[row.placeId] ?? 0;
              const nextCost = (v + 1) * (v + 1) - v * v;
              const canInc = spent + nextCost <= QUADRATIC_BUDGET;
              return (
                <li
                  key={row.placeId}
                  className={`flex items-center gap-3 rounded-[20px] border-2 bg-surface p-2.5 shadow-[0_1px_3px_rgba(42,28,21,0.08)] ${
                    v > 0 ? "border-[#F1CFC7]" : "border-transparent"
                  }`}
                >
                  <Tile data={row.data} size="size-[60px] rounded-[14px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="text-base leading-[1.2] font-extrabold">{row.data.name}</span>
                    <span className="text-[13px] font-semibold text-quiet">{row.meta}</span>
                    <span className={`text-[13px] font-bold ${canInc ? "text-quiet" : "text-accent-text"}`}>
                      {canInc
                        ? `Next vote costs ${nextCost} ${nextCost === 1 ? "credit" : "credits"}`
                        : `Not enough credits for another`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setVote(row.placeId, v - 1)}
                      disabled={v === 0}
                      aria-label={`One vote fewer for ${row.data.name}`}
                      className="flex h-11 w-10 items-center justify-center rounded-xl border-[1.5px] border-line bg-surface text-ink disabled:text-[#C9C6BF]"
                    >
                      <MinusIcon size={16} />
                    </button>
                    <span aria-live="polite" className="w-[30px] text-center text-[22px] font-extrabold">
                      {v}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVote(row.placeId, v + 1)}
                      disabled={!canInc}
                      aria-label={`One more vote for ${row.data.name}`}
                      className="flex h-11 w-10 items-center justify-center rounded-xl border-[1.5px] border-[#F1CFC7] bg-accent-soft text-accent-text disabled:opacity-50"
                    >
                      <PlusIcon size={16} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <p className="text-[13px] leading-[1.45] font-medium text-quiet">{copy.note}</p>
    </FlowScreen>
  );
}

function Tile({ data, size }: { data: RestaurantData; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-[#EDE3D3] text-[#5E5A52] ${size}`}
      aria-hidden="true"
    >
      {data.photoUri ? (
        // Google photo URIs come from the server; next/image would need a remote pattern per host.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.photoUri} alt="" className="block size-full object-cover" />
      ) : (
        <CameraIcon size={20} />
      )}
    </span>
  );
}
