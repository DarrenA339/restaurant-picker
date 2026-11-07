"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { dealNextBatch } from "./session-api";

/** The host's "Deal 20 more" on the placeholder swipe screen, so batches can be checked. */
export function DealButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deal() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await dealNextBatch(sessionId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t deal the next batch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={deal} loading={busy} loadingLabel="Dealing…" className="w-full">
        Deal 20 more
      </Button>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 text-[13px] font-bold text-[#A3271B]">
          <AlertIcon size={15} className="shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
