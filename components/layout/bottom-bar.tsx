"use client";

import { useCallback, type ReactNode } from "react";
import { useIsDesktop } from "./use-desktop";

/**
 * The bar pinned to the bottom of a phone screen (a sticky footer, the
 * swipe screen's vote buttons, the explore results panel) reports its
 * height here, and toasts (components/ui/toast.tsx) sit just above it. The
 * tallest active bar wins, which is also what keeps a page that Next keeps
 * mounted but hidden from clobbering the visible one: a hidden page's
 * effects are cleaned up, so its bar is gone from the set.
 */
const bars = new Map<Element, number>();

function publish() {
  const style = document.documentElement.style;
  if (bars.size === 0) style.removeProperty("--bottom-bar");
  else style.setProperty("--bottom-bar", `${Math.max(...bars.values())}px`);
}

/**
 * A ref for the bar element; `active` is false when the bar isn't pinned
 * (desktop layouts). What is published is the distance from the bottom of
 * the viewport to the bar's top edge: its height when it is pinned, more
 * when a short page leaves a sticky footer sitting higher than the bottom.
 */
export function useBottomBar(active: boolean) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (!el || !active) return;
      const measure = () => {
        const top = el.getBoundingClientRect().top;
        bars.set(el, Math.max(0, Math.round(window.innerHeight - top)));
        publish();
      };
      const observer = new ResizeObserver(measure);
      observer.observe(el);
      observer.observe(document.body);
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, { passive: true });
      measure();
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure);
        bars.delete(el);
        publish();
      };
    },
    [active],
  );
}

type BottomBarProps = {
  /** Defaults to "below the desktop breakpoint", where bars are pinned. */
  active?: boolean;
  className?: string;
  children: ReactNode;
};

export function BottomBar({ active, className = "", children }: BottomBarProps) {
  const desktop = useIsDesktop();
  const ref = useBottomBar(active ?? !desktop);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
