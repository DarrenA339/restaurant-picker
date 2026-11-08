"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

type SliderProps<T extends number> = {
  /** The row's label ("How far will you go?"). */
  label: string;
  /** The current value as the label row's pill ("Within 2 mi", "$ to $$", "$$ only"). */
  pill: string;
  /** The snap points, in order; handles sit on these, evenly spaced. */
  steps: readonly T[];
  /** One handle, or two for a range (low, high). */
  value: readonly T[];
  onChange: (next: T[]) => void;
  /** Accessible name per handle. */
  handleLabels: readonly string[];
  /** A handle's value, for assistive tech and the bubble while dragging ("2 mi", "$$"). */
  valueText: (value: T) => string;
  /** The label under each stop ("0.25", "$$"). */
  stopText: (value: T) => string;
};

/** Half a handle: the track is inset by this so handles never overhang the field. */
const INSET = 14;
/** When both range handles sit on one stop they are nudged apart so both stay grabbable. */
const MERGED_OFFSETS = [-21, -7];

const restShadow = "shadow-[0_1px_3px_rgba(23,24,26,0.22),0_0_0_1px_rgba(23,24,26,0.06)]";
const dragShadow = "shadow-[0_0_0_6px_rgba(210,67,42,0.18),0_1px_3px_rgba(23,24,26,0.22)]";

/**
 * The distance and price sliders from docs/design/sliders.png: 28px white
 * handles in a 44px touch row on a 6px track, the accent fill up to the
 * handle (or between the two), tick dots only where there is no fill, a
 * label under every stop, and a soft ring plus value bubble while dragging.
 * Tapping the track moves the nearer handle; the handles can't cross. Each
 * handle is a keyboard slider (arrows, Home, End).
 */
export function Slider<T extends number>({
  label,
  pill,
  steps,
  value,
  onChange,
  handleLabels,
  valueText,
  stopText,
}: SliderProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const last = steps.length - 1;
  const indexes = value.map((v) => Math.max(0, steps.indexOf(v)));
  const range = indexes.length > 1;
  const lo = range ? indexes[0] : 0;
  const hi = indexes[indexes.length - 1];
  const merged = range && lo === hi;
  const pct = (index: number) => (last === 0 ? 0 : (index / last) * 100);

  function commit(handle: number, wanted: number) {
    const next = [...indexes];
    const clamped = Math.max(0, Math.min(last, wanted));
    // Handles keep their order: the low one never passes the high one.
    next[handle] = range
      ? handle === 0
        ? Math.min(clamped, next[1])
        : Math.max(clamped, next[0])
      : clamped;
    if (next[handle] === indexes[handle]) return;
    onChange(next.map((i) => steps[i]));
  }

  function indexAt(clientX: number) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * last);
  }

  /** The handle a press on the track moves: the nearer one, and on a tie the one on that side. */
  function nearestHandle(index: number) {
    if (!range) return 0;
    const toLo = Math.abs(index - lo);
    const toHi = Math.abs(index - hi);
    if (toLo !== toHi) return toLo < toHi ? 0 : 1;
    return index < lo ? 0 : 1;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const pressed = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]");
    const index = indexAt(event.clientX);
    const handle = pressed ? Number(pressed.dataset.handle) : nearestHandle(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(handle);
    commit(handle, index);
    event.currentTarget.querySelector<HTMLElement>(`[data-handle="${handle}"]`)?.focus({ preventScroll: true });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging === null) return;
    commit(dragging, indexAt(event.clientX));
  }

  function onPointerUp() {
    setDragging(null);
  }

  function onKeyDown(handle: number, event: KeyboardEvent<HTMLElement>) {
    const index = indexes[handle];
    const moves: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      Home: 0,
      End: last,
    };
    const wanted = moves[event.key];
    if (wanted === undefined) return;
    event.preventDefault();
    commit(handle, wanted);
  }

  const filled = (i: number) => (range ? i >= lo && i <= hi : i <= hi);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-bold">{label}</span>
        <output aria-live="polite" className="flex h-7 items-center rounded-full bg-tint px-2.5 text-[13px] font-bold whitespace-nowrap">
          {pill}
        </output>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        className="relative h-11 cursor-pointer touch-none select-none"
        style={{ paddingLeft: INSET, paddingRight: INSET }}
      >
        <div ref={trackRef} className="relative h-11">
          <div className="absolute inset-x-0 top-[19px] h-1.5 rounded-full bg-[#E7E4DE]" aria-hidden="true" />
          <div
            className="absolute top-[19px] h-1.5 rounded-full bg-accent"
            style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
            aria-hidden="true"
          />
          {steps.map((step, i) =>
            filled(i) ? null : (
              <span
                key={step}
                className="absolute top-5 -ml-0.5 size-1 rounded-full bg-[#D3D0C9]"
                style={{ left: `${pct(i)}%` }}
                aria-hidden="true"
              />
            ),
          )}
          {indexes.map((index, handle) => (
            <span key={handle} className="contents">
              {dragging === handle ? (
                <span
                  className="pointer-events-none absolute bottom-10 flex h-[26px] -translate-x-1/2 items-center rounded-lg bg-ink px-[9px] text-xs font-extrabold whitespace-nowrap text-white"
                  style={{ left: `${pct(index)}%` }}
                  aria-hidden="true"
                >
                  {valueText(steps[index])}
                </span>
              ) : null}
              <span
                role="slider"
                tabIndex={0}
                data-handle={handle}
                aria-label={handleLabels[handle]}
                aria-valuemin={0}
                aria-valuemax={last}
                aria-valuenow={index}
                aria-valuetext={valueText(steps[index])}
                onKeyDown={(event) => onKeyDown(handle, event)}
                className={`absolute top-2 box-border size-7 rounded-full bg-surface transition-shadow duration-[120ms] ease-out outline-ink focus-visible:outline-[3px] focus-visible:outline-offset-2 motion-reduce:transition-none ${
                  dragging === handle ? dragShadow : restShadow
                }`}
                style={{
                  left: `${pct(index)}%`,
                  marginLeft: merged ? MERGED_OFFSETS[handle] : -INSET,
                  zIndex: handle + 1,
                }}
              />
            </span>
          ))}
        </div>
      </div>

      <div className="relative h-4" style={{ marginLeft: INSET, marginRight: INSET }} aria-hidden="true">
        {steps.map((step, i) => {
          const on = range ? i >= lo && i <= hi : i === hi;
          return (
            <span
              key={step}
              className={`absolute -translate-x-1/2 text-xs whitespace-nowrap ${
                on ? "font-extrabold text-ink" : "font-semibold text-quiet"
              }`}
              style={{ left: `${pct(i)}%` }}
            >
              {stopText(step)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
