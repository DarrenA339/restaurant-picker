"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AlertIcon, CheckIcon, SendIcon } from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { AreaField } from "@/components/ui/area-field";
import { Avatar, AvatarStack, type StackPerson } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLabel, inputClass } from "@/components/ui/field";
import {
  freeColors,
  personBgClass,
  personColorName,
  whoIsIn,
  type PersonColor,
} from "@/lib/people";
import { ensureSignedIn, supabaseBrowser } from "@/lib/supabase/browser";

type LatLng = { lat: number; lng: number };

type JoinFormProps = {
  code: string;
  session: { name: string; hostName: string; summary: string | null };
  members: StackPerson[];
};

const SWATCHES_SHOWN = 4;

const joinErrors: Record<string, string> = {
  session_not_found: "This invite doesn’t work. Ask for a fresh link.",
  session_ended: "This dinner has ended.",
  session_full: "This dinner is full.",
  display_name_invalid: "Tell friends what to call you (up to 40 characters).",
  not_signed_in: "Couldn’t sign you in. Try again.",
};

/** Rounds to about 100 m before it leaves the phone. */
function rough(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function JoinForm({ code, session, members }: JoinFormProps) {
  const router = useRouter();
  const swatches = freeColors(members.map((m) => m.color)).slice(0, SWATCHES_SHOWN);

  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonColor>(swatches[0] ?? 1);
  const [location, setLocation] = useState<LatLng | null>(null);
  /** Where the location came from: the device, or a typed and picked area. */
  const [locationSource, setLocationSource] = useState<"device" | "area" | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [areaOpen, setAreaOpen] = useState(false);
  const [area, setArea] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // State alone can't stop a second tap that lands before React re-renders.
  const inFlight = useRef(false);

  const names = members.map((m) => m.name);
  const { text: inText, label: inLabel } = whoIsIn(names);

  function shareLocation() {
    if (locating) return;
    if (!("geolocation" in navigator)) {
      setLocationError("Location isn't available in this browser.");
      setAreaOpen(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: rough(position.coords.latitude),
          lng: rough(position.coords.longitude),
        });
        setLocationSource("device");
        setLocationError(null);
        setLocating(false);
      },
      () => {
        setLocationError(
          "Location is off for this site. Tell us where you’re starting and distances will use that.",
        );
        setAreaOpen(true);
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    if (!name.trim()) {
      setNameError("Tell friends what to call you.");
      return;
    }
    setNameError(null);
    setFormError(null);
    setSubmitting(true);
    inFlight.current = true;

    try {
      const join = () =>
        supabaseBrowser()
          .rpc("join_session", {
            p_code: code,
            p_display_name: name.trim(),
            p_color: color,
            p_lat: location?.lat,
            p_lng: location?.lng,
          })
          .single();

      await ensureSignedIn();
      let { error } = await join();
      if (error && (error.message === "not_signed_in" || error.code === "PGRST301")) {
        // The database didn't see a user behind our token: sign in again, retry once.
        await ensureSignedIn({ fresh: true });
        ({ error } = await join());
      }
      if (error) {
        throw new Error(joinErrors[error.message] ?? "Couldn’t join. Try again.");
      }
      // The server gate now sees a member and swaps in the lobby.
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "Something went wrong. Try again.",
      );
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <FlowScreen
      as="form"
      onSubmit={onSubmit}
      bodyClassName="gap-6 py-6"
      footerClassName="flex flex-col gap-2 lg:mt-1"
      footer={
        <>
          <Button
            type="submit"
            loading={submitting}
            loadingLabel="Joining…"
            className="w-full"
          >
            Join dinner
          </Button>
          <p className="text-center text-[13px] font-medium text-quiet">
            No account needed
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-3.5 rounded-sheet bg-surface px-5 py-[22px] shadow-[0_12px_32px_rgba(23,24,26,0.07)] lg:p-6">
        <div className="flex items-center gap-2.5">
          <AvatarStack people={members} label={inLabel} />
          <span className="min-w-0 flex-1 text-sm leading-[1.35] font-semibold text-quiet">
            {inText}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold text-quiet">
            {session.hostName} invited you to
          </p>
          <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em] lg:text-[38px] lg:leading-[1.06]">
            {session.name}
          </h1>
        </div>
        {session.summary ? (
          <p className="text-sm font-medium text-quiet">{session.summary}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <FieldLabel htmlFor="display-name">What should friends call you?</FieldLabel>
        <div className="flex items-center gap-3">
          <Avatar name={name} color={color} size={52} />
          <input
            id="display-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) setNameError(null);
            }}
            maxLength={40}
            autoComplete="nickname"
            placeholder="Your name"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "display-name-error" : undefined}
            className={inputClass(Boolean(nameError))}
          />
        </div>
        {nameError ? <FieldError id="display-name-error">{nameError}</FieldError> : null}
        <div
          role="radiogroup"
          aria-label="Avatar color"
          className="mt-0.5 flex items-center gap-1"
        >
          <span className="mr-1.5 text-[13px] font-semibold text-quiet">Color</span>
          {swatches.map((swatch) => {
            const selected = swatch === color;
            return (
              <button
                key={swatch}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={personColorName[swatch]}
                onClick={() => setColor(swatch)}
                className="flex size-11 items-center justify-center bg-transparent p-0"
              >
                <span
                  className={`block size-7 rounded-full ${personBgClass[swatch]} ${
                    selected
                      ? "shadow-[0_0_0_2.5px_var(--color-page),0_0_0_4.5px_var(--color-ink)]"
                      : ""
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-[20px] bg-surface p-[18px] shadow-[0_1px_3px_rgba(23,24,26,0.07)] lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-3.5 lg:gap-y-1">
        <div className="flex items-start gap-3 lg:items-center lg:gap-3.5">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-tint text-ink"
            aria-hidden="true"
          >
            <SendIcon size={20} />
          </span>
          <div className="flex flex-col gap-[3px]">
            <span className="text-[15px] font-bold">Show distances from you</span>
            <span className="text-sm leading-[1.4] font-medium text-quiet">
              Friends see your rough area on the map, never your exact address.
            </span>
          </div>
        </div>

        {location && locationSource === "device" ? (
          <div
            role="status"
            className="flex h-12 items-center justify-center gap-2 rounded-field bg-tint text-[15px] font-bold text-ink lg:h-11 lg:justify-self-end lg:px-4 lg:text-sm"
          >
            <CheckIcon size={16} className="text-[#2E6B57]" />
            Location shared
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={shareLocation}
            loading={locating}
            loadingLabel="Finding you…"
            className="h-12 rounded-field text-[15px] lg:h-11 lg:justify-self-end lg:px-4 lg:text-sm"
          >
            Share my location
          </Button>
        )}

        {locationError ? (
          <p className="flex items-start gap-1.5 text-[13px] font-bold text-[#A3271B] lg:col-span-2">
            <AlertIcon size={15} className="mt-0.5 shrink-0" />
            {locationError}
          </p>
        ) : null}

        {areaOpen ? (
          <div className="flex flex-col gap-2 lg:col-span-2">
            <FieldLabel htmlFor="start-area">Where are you starting from?</FieldLabel>
            <AreaField
              id="start-area"
              value={area}
              onChange={(text) => {
                setArea(text);
                if (locationSource === "area") {
                  setLocation(null);
                  setLocationSource(null);
                }
              }}
              onPick={(picked) => {
                setArea(picked.label);
                setLocation({ lat: rough(picked.location.lat), lng: rough(picked.location.lng) });
                setLocationSource("area");
                setLocationError(null);
              }}
              onError={setLocationError}
              maxLength={80}
              describedBy="start-area-hint"
              autoFocus
            />
            <p id="start-area-hint" className="text-[13px] font-medium text-quiet">
              {locationSource === "area"
                ? "Distances will count from here. Friends see the area, not an address."
                : "Pick a suggestion, or join without a location."}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAreaOpen(true)}
            className="h-11 bg-transparent text-sm font-bold text-accent-text underline underline-offset-[3px] lg:col-start-2 lg:h-9 lg:justify-self-end lg:px-0.5 lg:text-[13px]"
          >
            <span className="lg:hidden">Enter a starting area instead</span>
            <span className="hidden lg:inline">Enter an area instead</span>
          </button>
        )}
      </div>

      {formError ? (
        <div
          role="alert"
          className="flex min-h-11 items-center gap-3 rounded-field border-[1.5px] border-[#EBCFCA] bg-surface py-1 pr-1.5 pl-4 text-sm font-bold text-ink"
        >
          <AlertIcon size={16} className="shrink-0 text-[#A3271B]" />
          {formError}
        </div>
      ) : null}
    </FlowScreen>
  );
}
