import type { ReactNode } from "react";

type WideScreenProps = {
  /** The screen's own header row; it carries its own padding (see Brand). */
  header?: ReactNode;
  /** The body's gaps and vertical padding. */
  className?: string;
  children: ReactNode;
};

/**
 * A screen that gets two columns on desktop (Welcome, Lobby, Swipe): the
 * phone layout below 1024px, and from there 1040px of content centered in
 * a 1104px frame with 32px side padding. Put a TwoColumn inside.
 */
export function WideScreen({ header, className = "", children }: WideScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col lg:mx-auto lg:w-full lg:max-w-[1104px]">
      {header}
      <main className={`flex flex-1 flex-col px-5 lg:px-8 ${className}`}>{children}</main>
    </div>
  );
}

type TwoColumnVariant = "hero" | "panel" | "swipe";

// On phones both columns dissolve (display: contents) so their children sit
// in the screen's single column, in source order, sharing its gap. From
// 1024px up they become the two columns from the desktop designs.
const variants: Record<TwoColumnVariant, { wrap: string; left: string; right: string }> = {
  // Welcome: photo and headline side by side, vertically centered, 64px apart.
  hero: {
    wrap: "lg:items-center lg:gap-16",
    left: "lg:flex-[1_1_420px]",
    right: "lg:flex-[1_1_400px]",
  },
  // Lobby: a wide main column and a 360px sticky side panel, 32px apart.
  panel: {
    wrap: "lg:items-start lg:gap-8",
    left: "lg:flex-[1_1_520px] lg:gap-[18px]",
    right: "lg:sticky lg:top-6 lg:min-w-[300px] lg:flex-[0_1_360px] lg:gap-3.5",
  },
  // Swipe: the map on the left, sticky, and a 440px column for the card, 28px apart.
  swipe: {
    wrap: "lg:items-start lg:gap-7",
    left: "lg:sticky lg:top-6 lg:min-w-0 lg:flex-[1_1_440px]",
    right: "lg:min-w-[340px] lg:flex-[0_1_440px] lg:gap-4",
  },
};

type TwoColumnProps = {
  variant: TwoColumnVariant;
  left: ReactNode;
  right: ReactNode;
  className?: string;
};

export function TwoColumn({ variant, left, right, className = "" }: TwoColumnProps) {
  const v = variants[variant];
  return (
    <div className={`contents lg:flex ${v.wrap} ${className}`}>
      <div className={`contents lg:flex lg:min-w-0 lg:flex-col ${v.left}`}>{left}</div>
      <div className={`contents lg:flex lg:min-w-0 lg:flex-col ${v.right}`}>{right}</div>
    </div>
  );
}
