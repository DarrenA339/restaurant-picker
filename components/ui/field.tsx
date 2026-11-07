import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertIcon } from "@/components/icons";

/** Input styling from the design's "Fields" section, with the error state. */
export function inputClass(invalid = false, className = "") {
  const border = invalid
    ? "border-2 border-[#B4232F]"
    : "border-[1.5px] border-line focus:border-ink focus:shadow-[inset_0_0_0_0.5px_var(--color-ink)]";
  return `h-[52px] w-full min-w-0 rounded-field bg-surface px-4 text-base font-semibold text-ink placeholder:text-quiet/60 focus-visible:outline-none ${border} ${className}`.trim();
}

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
      {children}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className="flex items-center gap-1.5 text-[13px] font-bold text-[#A3271B]"
    >
      <AlertIcon size={15} className="shrink-0" />
      {children}
    </p>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: ReactNode;
  error?: string | null;
  hint?: ReactNode;
};

/** Label, input, and an optional error line or hint. */
export function Field({ id, label, error, hint, className = "", ...input }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClass(Boolean(error), className)}
        {...input}
      />
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
      {hint}
    </div>
  );
}
