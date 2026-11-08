"use client";

import { useState } from "react";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  CUISINES,
  PRICE_LEVELS,
  priceLabel,
  pricePillText,
  priceRange,
  pricesBetween,
  type Cuisine,
  type ExploreFilters,
  type PriceLevel,
} from "@/lib/session-filters";

type FiltersSheetProps = {
  open: boolean;
  filters: ExploreFilters;
  onClose: () => void;
  onApply: (next: ExploreFilters) => void;
};

const NONE: ExploreFilters = { openNow: false, prices: [], cuisines: [] };

function toggled<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/**
 * The explore map's Filters sheet (docs/design/06, source/06-explore.dc.html):
 * open now, price, and cuisine, edited as a draft until Apply. Reset clears
 * the draft; closing forgets it. A 520px dialog from 1024px up.
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

      <div className="flex flex-col gap-[22px] overflow-y-auto px-5 pt-3 pb-2">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-extrabold">Open now</span>
            <span className="text-[13px] font-medium text-quiet">Hide places that are closed</span>
          </span>
          <Switch
            checked={draft.openNow}
            onChange={(openNow) => setDraft({ ...draft, openNow })}
            label="Open now"
          />
        </div>

        <Slider<PriceLevel>
          label="Price"
          pill={pricePillText(draft.prices)}
          steps={PRICE_LEVELS}
          value={priceRange(draft.prices)}
          onChange={([lo, hi]) => setDraft({ ...draft, prices: pricesBetween(lo, hi) })}
          handleLabels={["Lowest price", "Highest price"]}
          valueText={priceLabel}
          stopText={priceLabel}
        />

        <div role="group" aria-labelledby="cuisine-label" className="flex flex-col gap-2.5">
          <span id="cuisine-label" className="text-base font-extrabold">
            Cuisine
          </span>
          <div className="flex flex-wrap gap-2">
            {CUISINES.map((cuisine: Cuisine) => (
              <Chip
                key={cuisine}
                size="sm"
                on={draft.cuisines.includes(cuisine)}
                onClick={() => setDraft({ ...draft, cuisines: toggled(draft.cuisines, cuisine) })}
              >
                {cuisine}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2.5 px-5 pt-3 pb-[calc(22px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--color-track)] lg:pb-5">
        <Button variant="secondary" onClick={() => setDraft(NONE)} className="h-[54px] flex-1">
          Reset
        </Button>
        <Button onClick={() => onApply(draft)} className="h-[54px] flex-[2]">
          Apply filters
        </Button>
      </div>
    </Sheet>
  );
}
