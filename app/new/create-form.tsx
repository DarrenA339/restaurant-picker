"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import {
  AlertIcon,
  BackIcon,
  ChevronDownIcon,
  SendIcon,
} from "@/components/icons";
import { FiltersForm } from "@/components/filters/filters-form";
import { FlowScreen } from "@/components/layout/flow-screen";
import { AreaField } from "@/components/ui/area-field";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, inputClass } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_FILTERS,
  DISTANCES_MI,
  MAX_AREA_LABEL,
  PRICE_LEVELS,
  formatDistance,
  moreSummary,
  priceLabel,
  pricePillText,
  priceRange,
  pricesBetween,
  type DistanceMi,
  type PriceLevel,
  type SessionFilters,
} from "@/lib/session-filters";
import { ensureSignedIn } from "@/lib/supabase/browser";
import { useResetOnReturn } from "../use-reset-on-return";

type LatLng = { lat: number; lng: number };

type Errors = {
  name?: string;
  hostName?: string;
  area?: string;
  form?: string;
};

const YOUR_LOCATION = "Your location";
/** Price and distance have their own sliders above "More preferences". */
const ON_THE_FORM = ["price", "distance"] as const;

export function CreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [hostName, setHostName] = useState("");
  // The area starts empty: it is typed (and picked from the predictions) or "Use mine".
  const [filters, setFilters] = useState<SessionFilters>({ ...DEFAULT_FILTERS, areaLabel: "" });
  const [center, setCenter] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  // The navigation after a create: the button stays busy until the lobby
  // shows, and clears on its own, so a cached copy of this page is never
  // stuck on "Creating…".
  const [navigating, startNavigation] = useTransition();
  // State alone can't stop a second tap that lands before React re-renders.
  const inFlight = useRef(false);

  // Coming back here after a create starts a fresh form.
  useResetOnReturn(() => {
    setName("");
    setHostName("");
    setFilters({ ...DEFAULT_FILTERS, areaLabel: "" });
    setCenter(null);
    setMoreOpen(false);
    setErrors({});
  });

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
      next.name = "Give it a name so friends know what they’re joining.";
    }
    if (!hostName.trim()) next.hostName = "Friends need to know who’s hosting.";
    if (!filters.areaLabel.trim()) {
      next.area = "Tell us roughly where to search.";
    } else if (!center) {
      next.area = "Pick a suggestion so we know where that is, or use your location.";
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
      startNavigation(() => router.push(`/s/${json.code}`));
    } catch (error) {
      setErrors({
        form:
          error instanceof Error && error.message
            ? error.message
            : "Something went wrong. Try again.",
      });
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <FlowScreen
      as="form"
      onSubmit={onSubmit}
      bodyClassName="gap-[22px] pt-3 pb-6"
      footer={
        <Button
          type="submit"
          loading={submitting || navigating}
          loadingLabel="Creating…"
          className="w-full"
        >
          Create session
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <Link
          href="/"
          aria-label="Back"
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink"
        >
          <BackIcon size={22} />
        </Link>
        <h1 className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em]">
          Set up a meal
        </h1>
        <p className="text-[15px] font-medium text-quiet">
          Choose an area and your preferences, then invite your friends
        </p>
      </div>

      <Field
        id="session-name"
        label="Session name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        autoComplete="off"
        placeholder="e.g. Friday dinner"
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
        <FieldLabel htmlFor="start-area">Where are you starting from?</FieldLabel>
        <AreaField
          id="start-area"
          value={filters.areaLabel}
          onChange={(text) => {
            patch({ areaLabel: text });
            if (center) setCenter(null);
            if (errors.area) setErrors((e) => ({ ...e, area: undefined }));
          }}
          onPick={(area) => {
            patch({ areaLabel: area.label.slice(0, MAX_AREA_LABEL) });
            setCenter(area.location);
            setErrors((e) => ({ ...e, area: undefined }));
          }}
          onError={(message) => setErrors((e) => ({ ...e, area: message }))}
          maxLength={MAX_AREA_LABEL}
          placeholder="Search a place"
          invalid={Boolean(errors.area)}
          describedBy={errors.area ? "start-area-error" : "start-area-hint"}
          trailing={
            <button
              type="button"
              onClick={useMyLocation}
              aria-busy={locating || undefined}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-[10px] bg-tint px-2.5 text-[13px] font-bold whitespace-nowrap text-ink"
            >
              <SendIcon size={14} strokeWidth={2.4} />
              {locating
                ? "Finding…"
                : filters.areaLabel === YOUR_LOCATION && center
                  ? "Using my location"
                  : "Use my location"}
            </button>
          }
        />
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
            We’ll find spots around here.
          </p>
        )}
      </div>

      <Slider<DistanceMi>
        label="How far will you go?"
        pill={`Within ${formatDistance(filters.distanceMi)}`}
        steps={DISTANCES_MI}
        value={[filters.distanceMi]}
        onChange={([mi]) => patch({ distanceMi: mi })}
        handleLabels={["How far will you go"]}
        valueText={formatDistance}
        stopText={(mi) => String(mi)}
      />

      <Slider<PriceLevel>
        label="Price"
        pill={pricePillText(filters.prices)}
        steps={PRICE_LEVELS}
        value={priceRange(filters.prices)}
        onChange={([lo, hi]) => patch({ prices: pricesBetween(lo, hi) })}
        handleLabels={["Lowest price", "Highest price"]}
        valueText={priceLabel}
        stopText={priceLabel}
      />

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
          <div id="more-prefs" className="px-4 pt-1 pb-[18px]">
            <FiltersForm value={filters} onChange={patch} omit={ON_THE_FORM} />
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
    </FlowScreen>
  );
}
