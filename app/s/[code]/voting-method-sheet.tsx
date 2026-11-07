"use client";

import { useState } from "react";
import { AlertIcon, CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useMethodLabel, VOTING_METHODS, type VotingMethod } from "@/lib/lobby-copy";

type VotingMethodSheetProps = {
  open: boolean;
  current: VotingMethod;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (method: VotingMethod) => void;
};

/** The host's "How should the group decide?" sheet from docs/design/05. */
export function VotingMethodSheet({
  open,
  current,
  saving,
  error,
  onClose,
  onSave,
}: VotingMethodSheetProps) {
  // What the host tapped this time; until then, whatever is saved. Closing
  // without saving forgets the tap so reopening starts from the saved method.
  const [picked, setPicked] = useState<VotingMethod | null>(null);
  const choice = picked ?? current;

  function close() {
    setPicked(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} labelledBy="vm-title">
      <div className="flex items-start justify-between gap-3 pr-3 pl-5">
        <div className="flex flex-col gap-1 pt-1">
          <h2
            id="vm-title"
            className="text-2xl leading-[1.15] font-extrabold tracking-[-0.01em]"
          >
            How should the group decide?
          </h2>
          <p className="text-sm leading-[1.4] font-medium text-quiet">
            This is for the final round. It locks when picking starts.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-ink"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="vm-title"
        className="flex flex-col gap-2.5 overflow-y-auto px-4 pt-[18px] pb-2"
      >
        {VOTING_METHODS.map((method) => {
          const on = method.id === choice;
          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(method.id)}
              className={`flex w-full items-start gap-3.5 rounded-[20px] border-2 p-4 text-left text-ink ${
                on ? "border-accent bg-[#FFF7F5]" : "border-track bg-surface"
              }`}
            >
              <span
                className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                  on ? "border-accent" : "border-[#B9BBC0]"
                }`}
                aria-hidden="true"
              >
                <span
                  className={`block size-2.5 rounded-full ${on ? "bg-accent" : "bg-transparent"}`}
                />
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[17px] font-extrabold">{method.name}</span>
                  <span className="text-xs font-bold whitespace-nowrap text-quiet">
                    {method.tech}
                  </span>
                </span>
                <span className="text-sm leading-[1.45] font-medium text-[#3D4047]">
                  {method.how}
                </span>
                <span className="text-[13px] font-bold text-quiet">{method.best}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 px-5 pt-3 pb-6 shadow-[0_-1px_0_#ECEAE5]">
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 text-[13px] font-bold text-[#A3271B]"
          >
            <AlertIcon size={15} className="shrink-0" />
            {error}
          </p>
        ) : null}
        <Button
          onClick={() => onSave(choice)}
          loading={saving}
          loadingLabel="Saving…"
          className="w-full shadow-[0_4px_12px_rgba(210,67,42,0.20)]"
        >
          {useMethodLabel(choice)}
        </Button>
        <p className="text-center text-[13px] font-medium text-quiet">
          Everyone sees the method in the lobby before picking starts.
        </p>
      </div>
    </Sheet>
  );
}
