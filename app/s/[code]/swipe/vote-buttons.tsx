"use client";

import { CheckIcon, CloseIcon, VetoIcon } from "@/components/icons";
import type { SwipeValue } from "./swipes";

type VoteButtonsProps = {
  vetoesLeft: number;
  disabled?: boolean;
  onVote: (value: SwipeValue) => void;
  /** In the details dialog: fixed widths from 1024px up (docs/design/08-details-desktop). */
  sheet?: boolean;
};

/** No, Veto (with the vetoes left), Yes, from docs/design/07-swipe. */
export function VoteButtons({ vetoesLeft, disabled = false, onVote, sheet = false }: VoteButtonsProps) {
  const noVetoes = vetoesLeft <= 0;
  const plain = `flex h-[60px] flex-1 items-center justify-center gap-2 rounded-button border-[1.5px] border-line bg-surface text-ink disabled:cursor-default ${
    sheet ? "lg:h-14 lg:w-[140px] lg:flex-none" : ""
  }`;
  return (
    <div className="flex w-full gap-2.5 lg:w-auto">
      <button type="button" onClick={() => onVote("no")} disabled={disabled} className={`${plain} text-base font-bold`}>
        <CloseIcon size={20} strokeWidth={2.6} />
        No
      </button>
      <button
        type="button"
        onClick={() => onVote("veto")}
        disabled={disabled || noVetoes}
        aria-label={noVetoes ? "Veto, none left" : `Veto, ${vetoesLeft} left`}
        className={`${plain} ${noVetoes ? "text-quiet opacity-60" : ""}`}
      >
        <VetoIcon size={20} />
        <span className="flex flex-col items-start leading-[1.15]">
          <span className="text-base font-bold">Veto</span>
          <span className="text-xs font-semibold text-quiet">{vetoesLeft} left</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onVote("yes")}
        disabled={disabled}
        className={`flex h-[60px] flex-[1.35] items-center justify-center gap-2 rounded-button bg-accent text-[17px] font-extrabold text-white shadow-[0_6px_16px_rgba(210,67,42,0.24)] disabled:cursor-default ${
          sheet ? "lg:h-14 lg:w-[180px] lg:flex-none" : ""
        }`}
      >
        <CheckIcon size={21} strokeWidth={3} />
        Yes
      </button>
    </div>
  );
}
