"use client";

import { AnimatePresence, motion, useDragControls } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useIsDesktop } from "@/components/layout/use-desktop";

export type SheetSize = "narrow" | "wide";

// Dialog sizes from docs/SPEC.md: 520px for filters and the voting method,
// 960px (and a fixed height) for details, as in docs/design/08-details-desktop.
const dialogSizes: Record<SheetSize, string> = {
  narrow: "w-[min(520px,calc(100%-48px))] max-h-[min(700px,calc(100%-64px))]",
  wide: "w-[min(960px,calc(100%-48px))] h-[min(700px,calc(100%-64px))]",
};

type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** id of the heading inside the sheet, for aria-labelledby. */
  labelledBy: string;
  /** The dialog width from 1024px up. */
  size?: SheetSize;
  /** Drop the dialog's top padding (a photo pane that runs to the edge). */
  flush?: boolean;
  children: ReactNode;
};

/**
 * A bottom sheet on phones (docs/design/components): dimmed backdrop without
 * blur; the close button, a backdrop tap, Escape, and a downward drag on the
 * handle all dismiss it. From 1024px up the same content opens as a centered
 * dialog with no handle. Focus moves in on open and returns to the opener.
 */
export function Sheet({
  open,
  onClose,
  labelledBy,
  size = "narrow",
  flush = false,
  children,
}: SheetProps) {
  const desktop = useIsDesktop();
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Let the enter animation mount the node first.
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      openerRef.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            aria-hidden="true"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
          {desktop ? (
            <motion.div
              key="dialog"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              tabIndex={-1}
              className={`fixed top-1/2 left-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] bg-surface shadow-[0_24px_60px_rgba(42,28,21,0.25)] focus-visible:outline-none ${flush ? "" : "pt-5"} ${dialogSizes[size]}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              key="sheet"
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={labelledBy}
              tabIndex={-1}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[720px] w-full max-w-[430px] flex-col rounded-t-sheet bg-surface focus-visible:outline-none"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 600) onClose();
              }}
            >
              <div
                className="flex h-[22px] shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                onPointerDown={(event) => dragControls.start(event)}
              >
                <span className="h-[5px] w-10 rounded-full bg-[#D9D6CF]" aria-hidden="true" />
              </div>
              {children}
            </motion.div>
          )}
        </>
      ) : null}
    </AnimatePresence>
  );
}
