"use client";

import { useState } from "react";
import { FiltersForm } from "@/components/filters/filters-form";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { clearedFilters, type ExploreFilters } from "@/lib/session-filters";

type FiltersSheetProps = {
  open: boolean;
  filters: ExploreFilters;
  onClose: () => void;
  onApply: (next: ExploreFilters) => void;
};

/**
 * The explore map's Filters sheet (docs/design/06, source/06-explore.dc.html):
 * every filter section, edited as a draft until Apply. Reset clears the
 * draft (the distance stays); closing forgets it. A 520px dialog from 1024px up.
 */
export function FiltersSheet({ open, filters, onClose, onApply }: FiltersSheetProps) {
  const [draft, setDraft] = useState<ExploreFilters>(filters);
  // Opening starts the draft from what's applied (state adjusted during render, not in an effect).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(filters);
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="filters-title">
      <div className="flex items-center justify-between pr-3 pl-5">
        <h2 id="filters-title" className="text-[22px] font-extrabold">
          Filters
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint text-ink"
        >
          <CloseIcon size={16} />
        </button>
      </div>

      <div className="overflow-y-auto px-5 pt-3 pb-2">
        <FiltersForm value={draft} onChange={(changes) => setDraft({ ...draft, ...changes })} />
      </div>

      <div className="flex shrink-0 gap-2.5 px-5 pt-3 pb-[calc(22px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--color-track)] lg:pb-5">
        <Button variant="secondary" onClick={() => setDraft(clearedFilters(draft))} className="h-[54px] flex-1">
          Reset
        </Button>
        <Button onClick={() => onApply(draft)} className="h-[54px] flex-[2]">
          Apply filters
        </Button>
      </div>
    </Sheet>
  );
}
