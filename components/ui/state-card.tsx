import Link from "next/link";
import type { ReactNode } from "react";

type Action = { label: string; href: string };

type StateCardProps = {
  icon: ReactNode;
  title: string;
  body: string;
  primary?: Action;
  secondary?: Action;
};

/** A full-screen edge state from docs/design/states.png: one card, one clear next step. */
export function StateCard({ icon, title, body, primary, secondary }: StateCardProps) {
  return (
    <main className="flex min-h-dvh flex-col px-5 py-6">
      <div className="my-auto flex flex-col gap-3 rounded-3xl bg-surface p-6 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
        <span
          className="flex size-12 items-center justify-center rounded-2xl bg-tint text-ink"
          aria-hidden="true"
        >
          {icon}
        </span>
        <h1 className="text-xl leading-[1.2] font-extrabold">{title}</h1>
        <p className="text-sm leading-[1.5] font-medium text-quiet">{body}</p>
        {primary || secondary ? (
          <div className="mt-2 flex flex-col gap-2">
            {primary ? (
              <Link
                href={primary.href}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-accent text-[15px] font-extrabold text-white"
              >
                {primary.label}
              </Link>
            ) : null}
            {secondary ? (
              <Link
                href={secondary.href}
                className="inline-flex h-11 items-center justify-center rounded-field border-[1.5px] border-line bg-surface text-sm font-bold text-ink"
              >
                {secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
