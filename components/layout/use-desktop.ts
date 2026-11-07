"use client";

import { useSyncExternalStore } from "react";

/** Tailwind's `lg` breakpoint: where screens take their desktop layout and sheets become dialogs. */
export const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(DESKTOP_QUERY);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True at 1024px and wider. False during server rendering and hydration. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}
