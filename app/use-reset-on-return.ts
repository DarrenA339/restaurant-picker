"use client";

import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Next keeps a page mounted but hidden after you navigate away from it, so
 * coming back shows the same component with whatever state it had. Its
 * effects are torn down while hidden and run again when it shows, so this
 * calls `reset` on every showing after the first: a form that finished a
 * submit comes back blank instead of stuck mid-submit.
 */
export function useResetOnReturn(reset: () => void) {
  const shownBefore = useRef(false);
  const onReturn = useEffectEvent(reset);
  useEffect(() => {
    if (shownBefore.current) onReturn();
    shownBefore.current = true;
  }, []);
}
