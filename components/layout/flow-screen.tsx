import type { HTMLAttributes, ReactNode } from "react";
import { BottomBar } from "./bottom-bar";
import { BrandHeader } from "./brand";

type FlowScreenProps = HTMLAttributes<HTMLElement> & {
  /** `form` when the screen is one form with its submit button in the footer. */
  as?: "div" | "form";
  /** Pinned to the bottom on phones; a regular block at the end of the column on desktop. */
  footer?: ReactNode;
  /** The body's gaps and vertical padding on phones (desktop padding comes from the column). */
  bodyClassName?: string;
  footerClassName?: string;
  children: ReactNode;
};

/**
 * A flow screen (Create, Join, Done, Final round, Winner, edge states): the
 * phone layout as designed, and from 1024px up the same content in a
 * centered 480px column under the brand header, per docs/SPEC.md.
 */
export function FlowScreen({
  as: Tag = "div",
  footer,
  bodyClassName = "gap-6 py-6",
  footerClassName = "",
  className = "",
  children,
  ...rest
}: FlowScreenProps) {
  return (
    <>
      <BrandHeader />
      <main className="flex min-h-dvh flex-col px-5 lg:mx-auto lg:min-h-0 lg:w-full lg:max-w-[480px] lg:px-0 lg:pt-10 lg:pb-14">
        <Tag className={`flex flex-1 flex-col lg:gap-6 ${className}`} {...rest}>
          <div className={`flex flex-1 flex-col lg:py-0 ${bodyClassName}`}>{children}</div>
          {footer ? <ScreenFooter className={footerClassName}>{footer}</ScreenFooter> : null}
        </Tag>
      </main>
    </>
  );
}

type ScreenFooterProps = {
  className?: string;
  children: ReactNode;
};

/**
 * The bottom bar that holds a screen's main action: sticky over the content
 * on phones (full-bleed inside a column with 20px side padding), inline at
 * the end of the column on desktop. On phones it reports its height so
 * toasts sit above it (components/layout/bottom-bar.tsx).
 */
export function ScreenFooter({ className = "", children }: ScreenFooterProps) {
  return (
    <BottomBar
      className={`sticky bottom-0 -mx-5 shrink-0 bg-page px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--color-track)] lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:pt-0 lg:pb-0 lg:shadow-none ${className}`}
    >
      {children}
    </BottomBar>
  );
}
