"use client";

import { useRef, type KeyboardEvent } from "react";

type SegmentedProps<T extends string | number> = {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * A single-select segmented control: equal-width segments in a 44px track.
 * It is a radio group, so Tab reaches the selected segment and the arrow
 * keys (plus Home and End) move the selection, wrapping at the ends.
 */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: SegmentedProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const selected = Math.max(0, options.findIndex((option) => option.value === value));

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowRight: selected === last ? 0 : selected + 1,
      ArrowDown: selected === last ? 0 : selected + 1,
      ArrowLeft: selected === 0 ? last : selected - 1,
      ArrowUp: selected === 0 ? last : selected - 1,
      Home: 0,
      End: last,
    };
    const next = moves[event.key];
    if (next === undefined || disabled) return;
    event.preventDefault();
    if (next !== selected) onChange(options[next].value);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className={`grid h-11 auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-tint p-1 ${className}`}
    >
      {options.map((option, index) => {
        const checked = index === selected;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              if (!checked) onChange(option.value);
            }}
            className={`flex min-w-0 items-center justify-center rounded-[10px] text-[15px] focus-visible:outline-offset-1 disabled:opacity-100 ${
              checked
                ? "bg-surface font-extrabold text-ink shadow-[0_1px_3px_rgba(42,28,21,0.14)]"
                : "bg-transparent font-bold text-quiet"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
