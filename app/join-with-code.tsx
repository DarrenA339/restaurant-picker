"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FieldError, inputClass } from "@/components/ui/field";
import { JOIN_CODE_LENGTH, normalizeJoinCode } from "@/lib/join-code";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * "Join with a code" on the Welcome screen. Tapping it swaps the button for
 * a code field; a valid code goes to /s/[code], where the Join screen lives.
 * Opening the page at /#join starts with the field showing.
 */
export function JoinWithCode() {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const hashWantsJoin = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash === "#join",
    () => false,
  );
  const open = opened || hashWantsJoin;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The navigation to the session: busy until it shows, then clear again, so
  // a cached copy of the home page isn't stuck mid-join when you come back.
  const [going, startGoing] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="h-[50px] border-line lg:h-14 lg:px-7"
        onClick={() => setOpened(true)}
      >
        Join with a code
      </Button>
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (going) return;
    const normalized = normalizeJoinCode(code);
    if (!normalized) {
      setError("Codes are 6 letters and numbers, like K7PQ2M.");
      return;
    }
    setError(null);
    startGoing(() => router.push(`/s/${normalized}`));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 lg:basis-full">
      <label htmlFor="join-code" className="text-sm font-bold">
        Enter the code from your friend
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          id="join-code"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            if (error) setError(null);
          }}
          maxLength={JOIN_CODE_LENGTH}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="K7PQ2M"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "join-code-error" : undefined}
          className={inputClass(Boolean(error), "tracking-[0.2em] uppercase")}
        />
        <Button
          type="submit"
          loading={going}
          loadingLabel="Opening…"
          className="h-[52px] w-auto min-w-[72px] rounded-field px-4 text-sm font-extrabold shadow-none"
        >
          Go
        </Button>
      </div>
      {error ? <FieldError id="join-code-error">{error}</FieldError> : null}
    </form>
  );
}
