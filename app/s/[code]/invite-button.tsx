"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState, useSyncExternalStore } from "react";
import { ChatIcon, CloseIcon, CopyIcon, MailIcon, ShareIcon } from "@/components/icons";
import { useIsDesktop } from "@/components/layout/use-desktop";
import { Button, buttonClass } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

const SHARE_TEXT = "Help pick where we eat";

const noop = () => () => undefined;
/** The page's origin, known only in the browser (the sheet never renders on the server). */
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");
/** Whether the Web Share API is here: phones, and Safari and Chrome on most desktops. */
const useCanShare = () =>
  useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

type InviteButtonProps = { code: string; name: string };

/** The lobby's Invite button: opens the invite sheet (a dialog from 1024px up). */
export function InviteButton({ code, name }: InviteButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-bold text-ink shadow-[0_1px_3px_rgba(42,28,21,0.1)] lg:gap-2 lg:px-4"
      >
        <ShareIcon size={16} />
        <span className="lg:hidden">Invite</span>
        <span className="hidden lg:inline">Invite friends</span>
      </button>
      <InviteSheet open={open} onClose={() => setOpen(false)} code={code} name={name} />
    </>
  );
}

type InviteSheetProps = InviteButtonProps & { open: boolean; onClose: () => void };

/**
 * The session name and join code in large type, a QR code of the link for
 * friends at the same table, Share invite (the phone's share menu, where
 * navigator.share exists), Copy link, and on desktop (or without Web Share)
 * Messages, WhatsApp, and Email links.
 */
function InviteSheet({ open, onClose, code, name }: InviteSheetProps) {
  const origin = useOrigin();
  const canShare = useCanShare();
  const desktop = useIsDesktop();
  const toast = useToast();
  const link = `${origin}/s/${code}`;
  const host = origin.replace(/^https?:\/\//, "");
  const message = `${SHARE_TEXT}: ${link}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.show({ kind: "ok", text: "Invite link copied" });
    } catch {
      toast.show({ kind: "error", text: "Couldn’t copy. Select the link below and copy it." });
    }
  }

  async function share() {
    try {
      await navigator.share({ title: name, text: SHARE_TEXT, url: link });
    } catch (error) {
      // Closing the share menu is not an error; anything else falls back to the clipboard.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  const fallbacks = [
    { label: "Messages", href: `sms:?&body=${encodeURIComponent(message)}`, Icon: ChatIcon },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(message)}`, Icon: ChatIcon },
    {
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(message)}`,
      Icon: MailIcon,
    },
  ];

  return (
    <Sheet open={open} onClose={onClose} labelledBy="invite-title">
      <div className="flex items-center justify-between pr-3 pl-5">
        <h2 id="invite-title" className="text-[22px] font-extrabold">
          Invite friends
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-ink"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-5 pt-3 pb-[calc(22px+env(safe-area-inset-bottom,0px))] lg:pb-6">
        <p className="text-[26px] leading-[1.15] font-extrabold tracking-[-0.02em]">{name}</p>

        <div className="flex flex-col gap-1 rounded-[18px] bg-tint px-4 py-3.5">
          <span className="text-[13px] font-bold text-quiet">Join code</span>
          <span className="text-[40px] leading-none font-extrabold tracking-[0.14em] tabular-nums">
            {code}
          </span>
          <span className="mt-1 text-[13px] font-medium text-quiet">
            Friends can type it at {host || "the app"}, or open your link.
          </span>
        </div>

        <div className="flex items-center gap-4 rounded-[18px] border-[1.5px] border-line bg-surface p-4">
          <div
            role="img"
            aria-label="QR code of the invite link"
            className="shrink-0 rounded-lg bg-white"
          >
            {origin ? (
              <QRCodeSVG value={link} size={120} level="M" marginSize={0} fgColor="#2A1C15" bgColor="#FFFFFF" />
            ) : (
              <div className="size-[120px]" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-base font-extrabold">At the same table?</span>
            <span className="text-[13px] font-medium text-quiet">
              Point a phone camera at the code to open the link.
            </span>
            <span className="mt-1 text-[13px] font-semibold break-all text-quiet select-all">{link}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {canShare ? (
            <Button onClick={() => void share()} className="w-full">
              <ShareIcon size={18} strokeWidth={2.6} />
              Share invite
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => void copy()} className="w-full">
            <CopyIcon size={18} />
            Copy link
          </Button>
          {desktop || !canShare ? (
            <div className="grid grid-cols-3 gap-2.5">
              {fallbacks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("https:") ? "_blank" : undefined}
                  rel={href.startsWith("https:") ? "noopener noreferrer" : undefined}
                  className={buttonClass("secondary", "h-12 gap-2 px-2 text-sm")}
                >
                  <Icon size={16} />
                  {label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
