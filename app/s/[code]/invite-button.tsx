"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

/** Copies the invite link and shows the "Invite link copied" toast for 2 s. */
export function InviteButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    const link = `${window.location.origin}/s/${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this invite link", link);
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="flex h-11 items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-bold text-ink shadow-[0_1px_3px_rgba(23,24,26,0.1)] lg:gap-2 lg:px-4"
      >
        <CopyIcon size={16} />
        <span className="lg:hidden">Invite</span>
        <span className="hidden lg:inline">Copy invite link</span>
      </button>
      {copied ? (
        <div
          role="status"
          className="fixed bottom-32 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-field bg-ink px-4 text-sm font-bold whitespace-nowrap text-white shadow-[0_8px_20px_rgba(23,24,26,0.2)]"
        >
          <CheckIcon size={16} />
          Invite link copied
        </div>
      ) : null}
    </>
  );
}
