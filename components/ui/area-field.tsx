"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PinIcon, SpinnerIcon } from "@/components/icons";
import type { AreaResult, Prediction } from "@/lib/places/place";
import type { LatLng } from "@/lib/restaurants";
import { ensureSignedIn } from "@/lib/supabase/browser";

/** `label` is the prediction as shown ("Harvard Square, Cambridge, MA"); `address` is Google's formatted address. */
export type PickedArea = { label: string; address: string; location: LatLng };

type AreaFieldProps = {
  id: string;
  value: string;
  /** Typing. The parent drops any location it had, since the text no longer matches it. */
  onChange: (text: string) => void;
  /** A prediction was picked and resolved to a point. */
  onPick: (area: PickedArea) => void;
  onError?: (message: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  /** Rendered inside the field on the right (Create's "Use mine"). */
  trailing?: ReactNode;
};

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const json = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error ?? "Search isn’t working right now.");
  }
  return (await response.json()) as T;
}

/**
 * A starting-area field: Places Autocomplete predictions as the member
 * types (debounced, from two characters), and a pick resolves to a point
 * through a location-only Place Details call on the same session token.
 * The parent owns the text and the resolved location.
 */
export function AreaField({
  id,
  value,
  onChange,
  onPick,
  onError,
  invalid = false,
  describedBy,
  placeholder = "Search a place",
  maxLength,
  autoFocus,
  trailing,
}: AreaFieldProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const blurRef = useRef<number | undefined>(undefined);
  const signedInRef = useRef<Promise<unknown> | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(blurRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  function close() {
    window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    abortRef.current = null;
    setPredictions([]);
  }

  function onInput(text: string) {
    onChange(text);
    window.clearTimeout(debounceRef.current);
    const q = text.trim();
    if (q.length < MIN_CHARS) {
      abortRef.current?.abort();
      setPredictions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        // The routes want a signed-in visitor; the form signs in on submit anyway.
        signedInRef.current ??= ensureSignedIn();
        await signedInRef.current;
        tokenRef.current ??= crypto.randomUUID();
        const params = new URLSearchParams({ q, token: tokenRef.current });
        const result = await fetchJson<{ places: Prediction[] }>(
          `/api/places/area?${params}`,
          controller.signal,
        );
        if (!controller.signal.aborted) setPredictions(result.places);
      } catch (error) {
        if (isAbort(error)) return;
        signedInRef.current = null;
        setPredictions([]);
      }
    }, DEBOUNCE_MS);
  }

  async function pick(prediction: Prediction) {
    if (resolving) return;
    window.clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    // The pick's Place Details call ends the typing session's token.
    const token = tokenRef.current;
    tokenRef.current = null;
    setResolving(prediction.placeId);
    try {
      const params = new URLSearchParams(token ? { token } : {});
      const area = await fetchJson<AreaResult>(
        `/api/places/area/${encodeURIComponent(prediction.placeId)}?${params}`,
      );
      setPredictions([]);
      // The prediction's own words make the better label: the formatted
      // address of "Harvard Square" is a street address nobody typed.
      const label = [prediction.mainText, prediction.secondaryText].filter(Boolean).join(", ");
      onPick({ label, address: area.address, location: area.location });
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "Couldn’t find that place. Try again.");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="relative">
      <div
        className={`flex h-[52px] items-center gap-2.5 rounded-field bg-surface pr-1.5 pl-3.5 ${
          invalid
            ? "border-2 border-[#B4232F]"
            : "border-[1.5px] border-line focus-within:border-ink focus-within:shadow-[inset_0_0_0_0.5px_var(--color-ink)]"
        }`}
      >
        <PinIcon size={18} className="shrink-0 text-quiet" />
        <input
          id={id}
          value={value}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          onBlur={() => {
            // Let a tap on a prediction land before the list goes.
            blurRef.current = window.setTimeout(() => setPredictions([]), 150);
          }}
          onFocus={() => window.clearTimeout(blurRef.current)}
          maxLength={maxLength}
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-autocomplete="list"
          aria-controls={predictions.length ? `${id}-suggestions` : undefined}
          className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-ink placeholder:text-quiet/60 focus-visible:outline-none"
        />
        {trailing}
      </div>

      {predictions.length > 0 ? (
        <ul
          id={`${id}-suggestions`}
          aria-label="Suggestions"
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 flex flex-col gap-0.5 rounded-2xl bg-surface p-1.5 shadow-[0_12px_32px_rgba(23,24,26,0.16)]"
        >
          {predictions.map((prediction) => (
            <li key={prediction.placeId}>
              <button
                type="button"
                onClick={() => void pick(prediction)}
                disabled={resolving !== null}
                aria-busy={resolving === prediction.placeId || undefined}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-transparent px-3 py-1.5 text-left text-ink disabled:text-quiet"
              >
                <PinIcon size={16} className="shrink-0 text-quiet" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{prediction.mainText}</span>
                  {prediction.secondaryText ? (
                    <span className="truncate text-[13px] font-semibold text-quiet">
                      {prediction.secondaryText}
                    </span>
                  ) : null}
                </span>
                {resolving === prediction.placeId ? (
                  <SpinnerIcon size={16} className="shrink-0 text-quiet" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
