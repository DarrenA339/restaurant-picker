"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertIcon, CheckIcon } from "@/components/icons";

export type ToastInput = {
  /** "ok" is the ink pill with a check; "error" the white card with Try again. */
  kind: "ok" | "error";
  text: string;
  retry?: () => void;
  /** Milliseconds on screen; defaults per kind. */
  duration?: number;
};

type ToastApi = {
  show: (toast: ToastInput) => void;
  dismiss: () => void;
};

const OK_MS = 2200;
const ERROR_MS = 6000;

const ToastContext = createContext<ToastApi>({ show: () => undefined, dismiss: () => undefined });

const noop = () => () => undefined;

/**
 * One toast layer for the whole app, mounted in app/layout.tsx. Screens call
 * `useToast().show(...)`; the layer renders into document.body above sheets
 * and sticky footers, 16px over the tallest pinned bottom bar
 * (components/layout/bottom-bar.tsx) or, with none, over the safe area, so
 * nothing on any screen covers it.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastInput | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const dismiss = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((next: ToastInput) => {
    window.clearTimeout(timer.current);
    setToast(next);
    timer.current = window.setTimeout(
      () => setToast(null),
      next.duration ?? (next.kind === "ok" ? OK_MS : ERROR_MS),
    );
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext value={api}>
      {children}
      <ToastLayer toast={toast} />
    </ToastContext>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

function ToastLayer({ toast }: { toast: ToastInput | null }) {
  // The portal needs document; nothing shows during server rendering anyway.
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const reduceMotion = useReducedMotion();
  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(var(--bottom-bar, env(safe-area-inset-bottom, 0px)) + 16px)" }}
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={`${toast.kind}:${toast.text}`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-auto flex w-full justify-center"
          >
            {toast.kind === "ok" ? (
              <div
                role="status"
                className="flex h-11 max-w-full items-center gap-2 rounded-field bg-ink px-4 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_20px_rgba(23,24,26,0.2)]"
              >
                <CheckIcon size={16} strokeWidth={3} className="shrink-0" />
                <span className="truncate">{toast.text}</span>
              </div>
            ) : (
              <div
                role="alert"
                className="flex min-h-12 w-full max-w-[390px] items-center gap-2.5 rounded-field border-[1.5px] border-[#EBCFCA] bg-surface py-1 pr-1.5 pl-3.5 text-sm font-bold text-ink shadow-[0_8px_20px_rgba(23,24,26,0.12)]"
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
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
