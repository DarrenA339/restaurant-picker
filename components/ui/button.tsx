import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerIcon } from "@/components/icons";

export type ButtonVariant = "primary" | "secondary" | "text";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2.5 whitespace-nowrap aria-busy:cursor-progress";

const variants: Record<ButtonVariant, string> = {
  primary:
    "h-14 rounded-button bg-accent text-[17px] font-extrabold text-white shadow-[0_6px_16px_rgba(210,67,42,0.24)] disabled:bg-[#EDB4A8] disabled:shadow-none",
  secondary:
    "h-14 rounded-button border-[1.5px] border-line bg-surface text-base font-bold text-ink",
  text: "h-[52px] bg-transparent text-[15px] font-bold text-ink underline underline-offset-[3px]",
};

/** The classes alone, for a <Link> that should look like a button. */
export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Shows a spinner and `loadingLabel` (or the children) and sets aria-busy. */
  loading?: boolean;
  loadingLabel?: ReactNode;
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, className)}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <SpinnerIcon size={18} />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
