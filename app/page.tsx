import Link from "next/link";
import {
  ListIcon,
  PinIcon,
  SwipeIcon,
} from "@/components/icons";
import { BrandHeader } from "@/components/layout/brand";
import { TwoColumn, WideScreen } from "@/components/layout/two-column";
import { buttonClass } from "@/components/ui/button";
import { JoinWithCode } from "./join-with-code";
import { WelcomeHero } from "./welcome-hero";

const steps = [
  { label: "Swipe on spots", Icon: SwipeIcon },
  { label: "Rank favorites", Icon: ListIcon },
  { label: "Get your pick", Icon: PinIcon },
];

/** Welcome, from docs/design/01: one column on phones, the card stack beside the headline on desktop. */
export default function WelcomePage() {
  return (
    <WideScreen
      header={<BrandHeader mobile />}
      className="pt-4 pb-[calc(24px+env(safe-area-inset-bottom,0px))] lg:justify-center lg:pt-8 lg:pb-12"
    >
      <TwoColumn
        variant="hero"
        left={
          <WelcomeHero />
        }
        right={
          <>
            <h1 className="font-display mt-5 text-[38px] leading-[1.05] font-normal tracking-[-0.01em] lg:mt-0 lg:text-[64px] lg:leading-[1.02] lg:tracking-[-0.015em]">
              Where are we eating?
            </h1>
            <p className="mt-2 text-[17px] leading-[1.45] font-medium text-quiet lg:mt-[18px] lg:text-xl">
              Pick a place together. Skip the group chat debate.
            </p>

            <ol
              aria-label="How it works"
              className="mt-[18px] grid grid-cols-3 gap-2 lg:mt-8 lg:flex lg:flex-wrap lg:gap-x-7 lg:gap-y-3"
            >
              {steps.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex flex-col items-center gap-2 text-center lg:flex-row lg:gap-2.5 lg:text-left"
                >
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-tint text-ink lg:size-9 lg:rounded-[11px]"
                    aria-hidden="true"
                  >
                    <Icon size={16} className="lg:size-[18px]" />
                  </span>
                  <span className="text-[13px] leading-[1.3] font-semibold text-[#4A3D35] lg:text-[15px]">
                    {label}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mt-[22px] flex flex-col gap-2.5 lg:mt-10 lg:flex-row lg:flex-wrap lg:gap-3">
              <Link
                href="/new"
                className={buttonClass(
                  "primary",
                  "shadow-[0_4px_12px_rgba(210,67,42,0.22)] lg:px-8",
                )}
              >
                Start a group
              </Link>
              <JoinWithCode />
              <p className="-mt-0.5 text-center text-[13px] font-medium text-quiet lg:mt-0.5 lg:basis-full lg:text-left lg:text-sm">
                No account needed. Invite friends by link.
              </p>
            </div>
          </>
        }
      />
    </WideScreen>
  );
}
