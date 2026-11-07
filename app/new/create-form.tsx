"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  AlertIcon,
  BackIcon,
  ChevronDownIcon,
  PinIcon,
  SendIcon,
} from "@/components/icons";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, FieldLabel, inputClass } from "@/components/ui/field";
import {
  CUISINES,
  DEFAULT_FILTERS,
  DISTANCES_MI,
  MAX_AREA_LABEL,
  PRICE_LEVELS,
  formatDistance,
  moreSummary,
  priceLabel,
  priceName,
  type Cuisine,
  type PriceLevel,
  type SessionFilters,
} from "@/lib/session-filters";
import { ensureSignedIn } from "@/lib/supabase/browser";

type LatLng = { lat: number; lng: number };

type Errors = {
  name?: string;
  hostName?: string;
  area?: string;
  form?: string;
};

const YOUR_LOCATION = "Your location";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

export function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("Friday dinner");
  const [hostName, setHostName] = useState("");
  const [filters, setFilters] = useState<SessionFilters>(DEFAULT_FILTERS);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  // State alone can't stop a second tap that lands before React re-renders.
  const inFlight = useRef(false);

  function patch(changes: Partial<SessionFilters>) {
    setFilters((current) => ({ ...current, ...changes }));
  }

  function useMyLocation() {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      setErrors((e) => ({ ...e, area: "Location isn't available in this browser." }));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        patch({ areaLabel: YOUR_LOCATION });
        setErrors((e) => ({ ...e, area: undefined }));
        setLocating(false);
      },
      () => {
        setErrors((e) => ({
          ...e,
          area: "We can't see your location. Type a starting area instead.",
        }));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;

    const next: Errors = {};
    if (!name.trim()) {
      next.name = "Give it a name so friends know what they're joining.";
    }
    if (!hostName.trim()) next.hostName = "Friends need to know who's hosting.";
    if (!filters.areaLabel.trim()) {
      next.area = "Tell us roughly where to search.";
    }
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    inFlight.current = true;
    try {
      const body = JSON.stringify({
        name: name.trim(),
        hostName: hostName.trim(),
        filters,
        center,
      });
      const create = () =>
        fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

      await ensureSignedIn();
      let response = await create();
      if (response.status === 401) {
        // The server didn't accept our session: sign in again and retry once.
        await ensureSignedIn({ fresh: true });
        response = await create();
      }
      const json = (await response.json().catch(() => null)) as
        | { code?: string; error?: string }
        | null;
      if (!response.ok || !json?.code) {
        throw new Error(json?.error ?? "Couldn't create the session.");
      }
      router.push(`/s/${json.code}`);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong. Try again.",
      });
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col gap-[22px] px-5 pt-3 pb-6">
        <div className="flex flex-col gap-2.5">
          <Link
            href="/"
            aria-label="Back"
            className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink"
          >
            <BackIcon size={22} />
          </Link>
          <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
            Set up dinner
          </h1>
          <p className="text-[15px] font-medium text-quiet">
            Takes about 20 seconds. You can tweak it in the lobby.
          </p>
        </div>

        <Field
          id="session-name"
          label="Session name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          autoComplete="off"
          error={errors.name}
        />

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="host-name">Your name</FieldLabel>
          <div className="flex items-center gap-3">
            <Avatar name={hostName} color={1} size={52} />
            <input
              id="host-name"
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              maxLength={40}
              autoComplete="nickname"
              placeholder="What friends call you"
              aria-invalid={errors.hostName ? true : undefined}
              aria-describedby={errors.hostName ? "host-name-error" : undefined}
              className={inputClass(Boolean(errors.hostName))}
            />
          </div>
          {errors.hostName ? (
            <p
              id="host-name-error"
              className="flex items-center gap-1.5 text-[13px] font-bold text-[#A3271B]"
            >
              <AlertIcon size={15} className="shrink-0" />
              {errors.hostName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor="start-area">Starting area</FieldLabel>
          <div
            className={`flex h-[52px] items-center gap-2.5 rounded-field bg-surface pr-1.5 pl-3.5 ${
              errors.area
                ? "border-2 border-[#B4232F]"
                : "border-[1.5px] border-line focus-within:border-ink focus-within:shadow-[inset_0_0_0_0.5px_var(--color-ink)]"
            }`}
          >
            <PinIcon size={18} className="shrink-0 text-quiet" />
            <input
              id="start-area"
              value={filters.areaLabel}
              onChange={(event) => {
                patch({ areaLabel: event.target.value });
                if (center) setCenter(null);
              }}
              maxLength={MAX_AREA_LABEL}
              autoComplete="off"
              placeholder="A neighborhood or landmark"
              aria-invalid={errors.area ? true : undefined}
              aria-describedby={errors.area ? "start-area-error" : "start-area-hint"}
              className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-ink placeholder:text-quiet/60 focus-visible:outline-none"
            />
            <button
              type="button"
              onClick={useMyLocation}
              aria-busy={locating || undefined}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-tint px-3 text-[13px] font-bold whitespace-nowrap text-ink"
            >
              <SendIcon size={14} strokeWidth={2.4} />
              {locating ? "Finding…" : center ? "Using mine" : "Use mine"}
            </button>
          </div>
          {errors.area ? (
            <p
              id="start-area-error"
              className="flex items-center gap-1.5 text-[13px] font-bold text-[#A3271B]"
            >
              <AlertIcon size={15} className="shrink-0" />
              {errors.area}
            </p>
          ) : (
            <p id="start-area-hint" className="text-[13px] font-medium text-quiet">
              We search around here until friends join.
            </p>
          )}
        </div>

        <div
          role="radiogroup"
          aria-labelledby="distance-label"
          className="flex flex-col gap-2.5"
        >
          <span id="distance-label" className="text-sm font-bold">
            How far will you go?
          </span>
          <div className="flex flex-wrap gap-2">
            {DISTANCES_MI.map((mi) => (
              <Chip
                key={mi}
                radio
                on={filters.distanceMi === mi}
                onClick={() => patch({ distanceMi: mi })}
              >
                {formatDistance(mi)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="text-sm font-bold">
            Price{" "}
            <span className="font-medium text-quiet">Pick all that work</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {PRICE_LEVELS.map((level) => (
              <Chip
                key={level}
                on={filters.prices.includes(level)}
                aria-label={priceName[level]}
                className="min-w-16"
                onClick={() =>
                  patch({
                    prices: toggle<PriceLevel>(filters.prices, level).sort(
                      (a, b) => a - b,
                    ),
                  })
                }
              >
                {priceLabel(level)}
              </Chip>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] bg-surface shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="more-prefs"
            className="flex min-h-[60px] w-full items-center justify-between gap-3 px-4 text-left"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-bold text-ink">
                More preferences
              </span>
              <span className="text-[13px] font-medium text-quiet">
                {moreSummary(filters)}
              </span>
            </span>
            <ChevronDownIcon
              size={20}
              className={`shrink-0 text-ink transition-transform duration-200 ${
                moreOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {moreOpen ? (
            <div id="more-prefs" className="flex flex-col gap-4 px-4 pt-1 pb-[18px]">
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold">
                  Cuisine <span className="font-medium text-quiet">Optional</span>
                </span>
                <div className="flex flex-wrap gap-2">
                  {CUISINES.map((cuisine) => (
                    <Chip
                      key={cuisine}
                      size="sm"
                      on={filters.cuisines.includes(cuisine)}
                      onClick={() =>
                        patch({ cuisines: toggle<Cuisine>(filters.cuisines, cuisine) })
                      }
                    >
                      {cuisine}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold">Must have</span>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    size="sm"
                    on={filters.openNow}
                    onClick={() => patch({ openNow: !filters.openNow })}
                  >
                    Open now
                  </Chip>
                  <Chip
                    size="sm"
                    on={filters.vegetarian}
                    onClick={() => patch({ vegetarian: !filters.vegetarian })}
                  >
                    Vegetarian options
                  </Chip>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {errors.form ? (
          <div
            role="alert"
            className="flex min-h-11 items-center gap-3 rounded-field border-[1.5px] border-[#EBCFCA] bg-surface py-1 pr-1.5 pl-4 text-sm font-bold text-ink"
          >
            <AlertIcon size={16} className="shrink-0 text-[#A3271B]" />
            {errors.form}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 shrink-0 bg-page px-5 pt-3 pb-6 shadow-[0_-1px_0_#ECEAE5]">
        <Button
          type="submit"
          loading={submitting}
          loadingLabel="Creating…"
          className="w-full"
        >
          Create session
        </Button>
      </div>
    </form>
  );
}
