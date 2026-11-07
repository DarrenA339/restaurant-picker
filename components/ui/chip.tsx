import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  on: boolean;
  /** One-of-many (role radio) instead of a toggle (aria-pressed). */
  radio?: boolean;
  size?: "md" | "sm";
};

/** Selection chip: off (white), on (ink). */
export function Chip({
  on,
  radio = false,
  size = "md",
  className = "",
  children,
  ...rest
}: ChipProps) {
  const state = on
    ? "border-ink bg-ink text-white"
    : "border-line bg-surface text-ink";
  const sizing = size === "md" ? "px-4 text-[15px]" : "px-3.5 text-sm";
  const a11y = radio ? { role: "radio", "aria-checked": on } : { "aria-pressed": on };
  return (
    <button
      type="button"
      {...a11y}
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] font-bold ${sizing} ${state} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
