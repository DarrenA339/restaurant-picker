import type { Metadata, Viewport } from "next";
import { Caprasimo, Manrope } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-manrope",
});

// The display face: the wordmark and page headlines only (see .font-display).
const caprasimo = Caprasimo({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: { default: "Chews", template: "%s · Chews" },
  applicationName: "Chews",
  description: "Chews together. Pick a place with friends and skip the group chat debate.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBF6EE",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${caprasimo.variable}`}>
      <body className="font-sans antialiased">
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
