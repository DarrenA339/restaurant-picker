"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { releasePoint } from "@/lib/snap-points";

export type Snap = "collapsed" | "half" | "full";

/** Handle, count and subtitle only. */
export const COLLAPSED_HEIGHT = 120;
export const HALF_HEIGHT = 344;
/** Kept clear above the full sheet: the search bar, and a strip of map with Google's logo and attribution. */
const FULL_TOP_GAP = 104;
/** Matches the sheet's height transition (duration-300), plus a frame. */
const SETTLE_MS = 320;
const DRAG_SLOP = 6;
const ORDER: Snap[] = ["collapsed", "half", "full"];

type Heights = Record<Snap, number>;
type Drag = { startY: number; startHeight: number; height: number; samples: { t: number; y: number }[] };

function heightsFor(viewport: number): Heights {
  const full = viewport ? Math.round(Math.min(viewport * 0.9, viewport - FULL_TOP_GAP)) : HALF_HEIGHT;
  return { collapsed: COLLAPSED_HEIGHT, half: HALF_HEIGHT, full: Math.max(full, HALF_HEIGHT) };
}

/**
 * The explore results sheet on phones: three snap points, dragged by its
 * header, cycled by its handle, and pulled down from the top of its list
 * when full. The sheet's height is the `--sheet-h` custom property on the
 * sheet element: written directly while a finger is down (no renders), and
 * animated by the element's own CSS transition on release. `settled` is the
 * point the sheet last came to rest at, which is what the map follows.
 */
export function useSnapSheet(enabled: boolean) {
  const [snap, setSnap] = useState<Snap>("half");
  const [settled, setSettled] = useState<Snap>("half");
  const [viewport, setViewport] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const heights = heightsFor(viewport);

  // What the handlers below read: the latest values without re-binding listeners.
  const state = useRef({ heights, snap, enabled });
  useEffect(() => {
    state.current = { heights, snap, enabled };
  });
  const drag = useRef<Drag | null>(null);
  const press = useRef<{ y: number } | null>(null);
  const dragged = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setViewport(root.clientHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function snapTo(next: Snap) {
    const el = sheetRef.current;
    if (!el) return;
    const target = state.current.heights[next];
    const from = el.getBoundingClientRect().height;
    el.style.transition = "";
    el.style.setProperty("--sheet-h", `${target}px`);
    setSnap(next);
    window.clearTimeout(settleTimer.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || Math.abs(from - target) < 1) setSettled(next);
    else settleTimer.current = window.setTimeout(() => setSettled(next), SETTLE_MS);
  }

  function beginDrag(y: number) {
    const el = sheetRef.current;
    if (!el) return;
    window.clearTimeout(settleTimer.current);
    const height = el.getBoundingClientRect().height;
    // Freeze a snap animation that is still running where it is.
    el.style.transition = "none";
    el.style.setProperty("--sheet-h", `${height}px`);
    drag.current = { startY: y, startHeight: height, height, samples: [{ t: performance.now(), y }] };
  }

  function moveDrag(y: number) {
    const el = sheetRef.current;
    const current = drag.current;
    if (!el || !current) return;
    const { collapsed, full } = state.current.heights;
    current.height = Math.min(full, Math.max(collapsed, current.startHeight + current.startY - y));
    el.style.setProperty("--sheet-h", `${current.height}px`);
    current.samples.push({ t: performance.now(), y });
    if (current.samples.length > 6) current.samples.shift();
  }

  function endDrag() {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    const last = current.samples[current.samples.length - 1];
    // Speed over the last ~100ms, so a drag that paused before release isn't a flick.
    const first = current.samples.find((s) => last.t - s.t <= 100) ?? last;
    const velocityUp = last.t > first.t ? (first.y - last.y) / (last.t - first.t) : 0;
    const { heights: h } = state.current;
    const target = releasePoint(current.height, velocityUp, ORDER.map((s) => h[s]));
    snapTo(ORDER.find((s) => h[s] === target) ?? "half");
  }

  // The list: at full height, pulling down from the top moves the sheet
  // instead of scrolling. Native listeners, because the move has to be
  // cancelable (React's touch listeners are passive).
  useEffect(() => {
    const list = listRef.current;
    if (!list || !enabled) return;
    let startY = 0;
    let eligible = false;
    const start = (event: TouchEvent) => {
      startY = event.touches[0].clientY;
      eligible = event.touches.length === 1 && state.current.snap === "full" && list.scrollTop <= 0;
    };
    const move = (event: TouchEvent) => {
      const y = event.touches[0].clientY;
      if (!drag.current) {
        if (!eligible) return;
        if (y < startY) eligible = false;
        if (y <= startY) return;
        beginDrag(startY);
      }
      if (event.cancelable) event.preventDefault();
      moveDrag(y);
    };
    const end = () => {
      eligible = false;
      endDrag();
    };
    list.addEventListener("touchstart", start, { passive: true });
    list.addEventListener("touchmove", move, { passive: false });
    list.addEventListener("touchend", end);
    list.addEventListener("touchcancel", end);
    return () => {
      list.removeEventListener("touchstart", start);
      list.removeEventListener("touchmove", move);
      list.removeEventListener("touchend", end);
      list.removeEventListener("touchcancel", end);
    };
    // The drag functions only touch refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  /** Spread on the sheet's header (handle, count and subtitle): dragging it moves the sheet. */
  const headerProps = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (!state.current.enabled || event.button !== 0) return;
      dragged.current = false;
      press.current = { y: event.clientY };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      if (!press.current) return;
      if (!drag.current) {
        if (Math.abs(event.clientY - press.current.y) < DRAG_SLOP) return;
        // Capture only once it is a drag, so a tap on the handle is still a click.
        event.currentTarget.setPointerCapture(event.pointerId);
        dragged.current = true;
        beginDrag(press.current.y);
      }
      moveDrag(event.clientY);
    },
    onPointerUp() {
      press.current = null;
      endDrag();
    },
    onPointerCancel() {
      press.current = null;
      endDrag();
    },
  };

  /** The handle's click: the next point up, and from full back to collapsed. */
  function cycle() {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    snapTo(ORDER[(ORDER.indexOf(state.current.snap) + 1) % ORDER.length]);
  }

  return { rootRef, sheetRef, listRef, headerProps, snap, settled, heights, snapTo, cycle };
}
