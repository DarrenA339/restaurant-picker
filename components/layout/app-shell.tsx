import type { ReactNode } from "react";

/**
 * The page frame every screen renders inside (see app/layout.tsx).
 *
 * Below the `lg` breakpoint (1024px) the app is a phone-width column, even
 * on a tablet. From 1024px up each screen owns its width through the layout
 * pieces next to this file: FlowScreen (a centered 480px column), WideScreen
 * with TwoColumn (1040px of content in two columns), and Sheet (a dialog).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[430px] lg:max-w-none">{children}</div>;
}
