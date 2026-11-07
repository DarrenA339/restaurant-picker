import Link from "next/link";
import {
  CameraIcon,
  ForkKnifeIcon,
  ListIcon,
  PinIcon,
  SwipeIcon,
} from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import { JoinWithCode } from "./join-with-code";

const steps = [
  { label: "Swipe on spots", Icon: SwipeIcon },
  { label: "Rank favorites", Icon: ListIcon },
  { label: "Get your pick", Icon: PinIcon },
];

export default function WelcomePage() {
  return (
    <main className="flex min-h-dvh flex-col px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))]">
      <header className="flex h-8 shrink-0 items-center gap-2.5">
        <span
          className="flex size-8 items-center justify-center rounded-[10px] bg-accent text-white"
          aria-hidden="true"
        >
          <ForkKnifeIcon size={18} />
        </span>
        <span className="text-[17px] font-extrabold tracking-[-0.01em]">
          [APP NAME]
        </span>
      </header>

      {/* Hero. A real shared-meal photo replaces this placeholder later. */}
      <div
        role="img"
        aria-label="Photo placeholder: friends' hands reaching for dishes on a shared table"
        className="mt-4 flex h-[200px] shrink-0 flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl bg-[#EFE7DC] text-[#5E5A52] shadow-[0_8px_24px_rgba(23,24,26,0.07)]"
      >
        <CameraIcon size={30} />
        <span className="text-sm font-extrabold">Shared-meal photo</span>
        <span className="text-xs font-semibold">
          Hands reaching across a shared table
        </span>
      </div>

      <h1 className="mt-5 text-[40px] leading-[1.05] font-extrabold tracking-[-0.03em]">
        Where are we eating?
      </h1>
      <p className="mt-2 text-[17px] leading-[1.45] font-medium text-quiet">
        Pick a place together. Skip the group chat debate.
      </p>

      <ol aria-label="How it works" className="mt-5 grid grid-cols-3 gap-2">
        {steps.map(({ label, Icon }) => (
          <li
            key={label}
            className="flex flex-col items-center gap-2 text-center"
          >
            <span
              className="flex size-8 items-center justify-center rounded-[10px] bg-tint text-ink"
              aria-hidden="true"
            >
              <Icon size={16} />
            </span>
            <span className="text-[13px] leading-[1.3] font-semibold text-[#3D4047]">
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col gap-2.5">
        <Link
          href="/new"
          className={buttonClass(
            "primary",
            "shadow-[0_4px_12px_rgba(210,67,42,0.20)]",
          )}
        >
          Start a group
        </Link>
        <JoinWithCode />
        <p className="-mt-0.5 text-center text-[13px] font-medium text-quiet">
          No account needed. Invite friends by link.
        </p>
      </div>
    </main>
  );
}
