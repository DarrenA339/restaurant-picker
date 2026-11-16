"use client";

import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import { useRef } from "react";
import { CameraIcon, CheckIcon, ChevronRightIcon, ClockIcon, CloseIcon, PinIcon, StarIcon, VetoIcon } from "@/components/icons";
import { hoursLine } from "@/lib/places/place";
import { distanceLabel, type LatLng, type RestaurantData } from "@/lib/restaurants";
import { priceLabel } from "@/lib/session-filters";
import type { SwipeValue } from "./swipes";

type SwipeCardProps = {
  data: RestaurantData;
  /** The viewer's own location, if they shared one. */
  viewer: LatLng | null;
  /** The session's starting area, which distances fall back to. */
  meetingArea: LatLng | null;
  /** The top card takes drags; the one underneath only peeks. */
  interactive: boolean;
  /** Set once voted: the card flies off this way, then calls onLeft. */
  leaving: SwipeValue | null;
  reducedMotion: boolean;
  onLeft: () => void;
  onSwipe: (value: "yes" | "no") => void;
  onOpen: () => void;
};

/** A drag past this (or a flick) is a vote; under TAP_PX of movement is a tap. */
const SWIPE_PX = 110;
const FLICK_VELOCITY = 600;
const TAP_PX = 8;

const exits: Record<SwipeValue, Record<string, number>> = {
  yes: { x: 520, rotate: 12, opacity: 0 },
  no: { x: -520, rotate: -12, opacity: 0 },
  veto: { y: -24, scale: 0.96, opacity: 0 },
};

/** The restaurant card from docs/design/07-swipe: photo, name, meta, and the drag that votes. */
export function SwipeCard({ data, viewer, meetingArea, interactive, leaving, reducedMotion, onLeft, onSwipe, onOpen }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const yesOpacity = useTransform(x, [20, SWIPE_PX], [0, 1]);
  const noOpacity = useTransform(x, [-SWIPE_PX, -20], [1, 0]);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  const meta = [data.cuisine, data.priceLevel ? priceLabel(data.priceLevel) : null].filter(Boolean) as string[];
  const distance = distanceLabel(viewer, meetingArea, data.location);
  const hours = hoursLine(data);
  const credit = data.photoAttributions?.[0];

  function onDragEnd(_event: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_PX || info.velocity.x > FLICK_VELOCITY) onSwipe("yes");
    else if (info.offset.x < -SWIPE_PX || info.velocity.x < -FLICK_VELOCITY) onSwipe("no");
  }

  const exit = leaving ? (reducedMotion ? { opacity: 0 } : exits[leaving]) : undefined;

  return (
    <motion.article
      aria-label={`${data.name}. Swipe right for yes, left for no, or use the buttons below.`}
      drag={interactive && !leaving ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.9}
      dragMomentum={false}
      style={{ x, rotate }}
      animate={exit}
      transition={reducedMotion ? { duration: 0.14 } : { duration: 0.26, ease: [0.4, 0, 1, 1] }}
      onAnimationComplete={() => {
        if (leaving) onLeft();
      }}
      onDragEnd={onDragEnd}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) return;
        downAt.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const down = downAt.current;
        downAt.current = null;
        if (!down || !interactive || leaving) return;
        if (Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_PX) onOpen();
      }}
      className="absolute inset-0 flex touch-pan-y flex-col overflow-hidden rounded-[26px] bg-surface shadow-[0_12px_32px_rgba(23,24,26,0.08),0_2px_6px_rgba(23,24,26,0.05)] select-none"
    >
      <div className="relative min-h-[160px] flex-1 bg-[#E9E4DA] lg:h-[340px] lg:flex-none">
        {data.photoUri ? (
          // Google photo URIs come from the server; next/image would need a remote pattern per host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.photoUri}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-[13px] font-bold text-[#5E5A52]">
            <CameraIcon size={26} strokeWidth={1.8} />
            Photo unavailable
          </span>
        )}
        {credit ? (
          <span className="absolute bottom-2.5 left-3 flex h-6 items-center rounded-full bg-white/85 px-2 text-[11px] font-semibold text-[#3D4047]">
            Photo by {credit.name}
          </span>
        ) : null}
        {interactive ? (
          <>
            <motion.span
              style={{ opacity: leaving === "yes" ? 1 : yesOpacity }}
              className="absolute top-3.5 left-3.5 flex h-[34px] items-center gap-1.5 rounded-full bg-accent px-3.5 text-[15px] font-extrabold text-white shadow-[0_4px_12px_rgba(23,24,26,0.2)]"
              aria-hidden="true"
            >
              <CheckIcon size={16} strokeWidth={3} />
              Yes
            </motion.span>
            <motion.span
              style={{ opacity: leaving === "no" ? 1 : noOpacity }}
              className="absolute top-3.5 right-3.5 flex h-[34px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-[15px] font-extrabold text-white shadow-[0_4px_12px_rgba(23,24,26,0.2)]"
              aria-hidden="true"
            >
              <CloseIcon size={16} strokeWidth={3} />
              No
            </motion.span>
            {leaving === "veto" ? (
              <span
                className="absolute top-3.5 left-1/2 flex h-[34px] -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-3.5 text-[15px] font-extrabold text-ink shadow-[0_4px_12px_rgba(23,24,26,0.2)]"
                aria-hidden="true"
              >
                <VetoIcon size={16} strokeWidth={2.6} />
                Veto
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 px-5 pt-4 pb-[18px] lg:px-[22px] lg:pt-[18px] lg:pb-5">
        <div className="flex items-start justify-between gap-2.5">
          <h2 className="min-w-0 flex-1 text-[32px] leading-[1.1] font-extrabold tracking-[-0.02em] [overflow-wrap:anywhere] lg:text-[34px] lg:leading-[1.08]">
            {data.name}
          </h2>
          <button
            type="button"
            onClick={onOpen}
            className="-mt-1 -mr-2 flex h-11 shrink-0 items-center gap-0.5 rounded-xl bg-transparent px-2 text-sm font-bold text-ink"
          >
            Details
            <ChevronRightIcon size={18} />
          </button>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold text-quiet">
          {meta.map((part, i) => (
            <span key={part} className="contents">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              <span>{part}</span>
            </span>
          ))}
          {data.rating !== undefined ? (
            <>
              {meta.length ? <span aria-hidden="true">·</span> : null}
              <span className="flex items-center gap-1 text-ink">
                <StarIcon size={15} />
                {data.rating.toFixed(1)}
              </span>
            </>
          ) : null}
        </p>
        {distance || hours ? (
          <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-medium text-quiet">
            {distance ? (
              <span className="flex items-center gap-[5px]">
                <PinIcon size={15} />
                {distance}
              </span>
            ) : null}
            {distance && hours ? <span aria-hidden="true">·</span> : null}
            {hours ? (
              <span className="flex items-center gap-[5px]">
                <ClockIcon size={15} />
                {hours}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
