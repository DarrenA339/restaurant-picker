"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { SearchIcon, StarIcon } from "@/components/icons";
import { Chip } from "@/components/ui/chip";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  CUISINE_TYPES,
  POPULAR_CUISINES,
  cuisineLabel,
  searchCuisines,
  type CuisineType,
} from "@/lib/places/cuisines";
import {
  AMENITIES,
  DISTANCES_MI,
  DRINKS,
  GOOD_FOR,
  MEALS,
  PRICE_LEVELS,
  RATINGS,
  amenityLabel,
  drinkLabel,
  formatDistance,
  goodForLabel,
  mealLabel,
  priceLabel,
  pricePillText,
  priceRange,
  pricesBetween,
  ratingLabel,
  type DistanceMi,
  type PriceLevel,
  type SearchFilters,
} from "@/lib/session-filters";

export type FilterSection =
  | "meal"
  | "cuisine"
  | "price"
  | "distance"
  | "rating"
  | "openNow"
  | "dietary"
  | "goodFor"
  | "amenities"
  | "drinks";

type FiltersFormProps = {
  value: SearchFilters;
  onChange: (changes: Partial<SearchFilters>) => void;
  /** Sections the screen renders elsewhere (Create keeps its own Price and Distance sliders). */
  omit?: readonly FilterSection[];
};

function toggled<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

type SectionProps = {
  id: string;
  title: string;
  hint?: string;
  role?: "group" | "radiogroup";
  children: ReactNode;
};

function Section({ id, title, hint, role = "group", children }: SectionProps) {
  return (
    <div role={role} aria-labelledby={id} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <span id={id} className="text-base font-extrabold">
          {title}
        </span>
        {hint ? <span className="text-[13px] font-medium text-quiet">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

type ChipListProps<T extends string> = {
  items: readonly T[];
  label: (item: T) => string;
  selected: readonly T[];
  onToggle: (item: T) => void;
};

function ChipList<T extends string>({ items, label, selected, onToggle }: ChipListProps<T>) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Chip key={item} size="sm" on={selected.includes(item)} onClick={() => onToggle(item)}>
          {label(item)}
        </Chip>
      ))}
    </div>
  );
}

/**
 * The filters, in sections, shared by Create's "More preferences" and the
 * explore map's Filters sheet (docs/design/06). Controlled: every change
 * comes back through `onChange` as a partial of the filters, so the sheet
 * can keep a draft until Apply and Create can patch its own state.
 */
export function FiltersForm({ value, onChange, omit = [] }: FiltersFormProps) {
  const ids = useId();
  const id = (section: FilterSection) => `${ids}-${section}`;
  const show = (section: FilterSection) => !omit.includes(section);

  return (
    <div className="flex flex-col gap-[22px]">
      {show("meal") ? (
        <Section id={id("meal")} title="Meal" hint="Any of these">
          <ChipList
            items={MEALS}
            label={(meal) => mealLabel[meal]}
            selected={value.meals}
            onToggle={(meal) => onChange({ meals: toggled(value.meals, meal) })}
          />
        </Section>
      ) : null}

      {show("cuisine") ? (
        <CuisineSection
          id={id("cuisine")}
          selected={value.cuisines}
          onChange={(cuisines) => onChange({ cuisines })}
        />
      ) : null}

      {show("price") ? (
        <Slider<PriceLevel>
          label="Price"
          pill={pricePillText(value.prices)}
          steps={PRICE_LEVELS}
          value={priceRange(value.prices)}
          onChange={([lo, hi]) => onChange({ prices: pricesBetween(lo, hi) })}
          handleLabels={["Lowest price", "Highest price"]}
          valueText={priceLabel}
          stopText={priceLabel}
        />
      ) : null}

      {show("distance") ? (
        <Slider<DistanceMi>
          label="Distance"
          pill={`Within ${formatDistance(value.distanceMi)}`}
          steps={DISTANCES_MI}
          value={[value.distanceMi]}
          onChange={([mi]) => onChange({ distanceMi: mi })}
          handleLabels={["Distance"]}
          valueText={formatDistance}
          stopText={(mi) => String(mi)}
        />
      ) : null}

      {show("rating") ? (
        <Section id={id("rating")} title="Rating" role="radiogroup">
          <div className="flex flex-wrap gap-2">
            {RATINGS.map((rating) => (
              <Chip
                key={rating}
                radio
                size="sm"
                on={value.minRating === rating}
                onClick={() => onChange({ minRating: rating })}
                aria-label={rating === 0 ? "Any rating" : `Rated ${rating} or higher`}
              >
                {rating > 0 ? <StarIcon size={14} className="text-[#C9A227]" /> : null}
                {ratingLabel[rating]}
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}

      {show("openNow") ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-extrabold">Open now</span>
            <span className="text-[13px] font-medium text-quiet">Hide places that are closed</span>
          </span>
          <Switch
            checked={value.openNow}
            onChange={(openNow) => onChange({ openNow })}
            label="Open now"
          />
        </div>
      ) : null}

      {show("dietary") ? (
        <Section id={id("dietary")} title="Dietary">
          <div className="flex flex-wrap gap-2">
            <Chip
              size="sm"
              on={value.vegetarian}
              onClick={() => onChange({ vegetarian: !value.vegetarian })}
            >
              Vegetarian options
            </Chip>
          </div>
        </Section>
      ) : null}

      {show("goodFor") ? (
        <Section id={id("goodFor")} title="Good for">
          <ChipList
            items={GOOD_FOR}
            label={(item) => goodForLabel[item]}
            selected={value.goodFor}
            onToggle={(item) => onChange({ goodFor: toggled(value.goodFor, item) })}
          />
        </Section>
      ) : null}

      {show("amenities") ? (
        <Section id={id("amenities")} title="Amenities">
          <ChipList
            items={AMENITIES}
            label={(item) => amenityLabel[item]}
            selected={value.amenities}
            onToggle={(item) => onChange({ amenities: toggled(value.amenities, item) })}
          />
        </Section>
      ) : null}

      {show("drinks") ? (
        <Section id={id("drinks")} title="Drinks">
          <ChipList
            items={DRINKS}
            label={(item) => drinkLabel[item]}
            selected={value.drinks}
            onToggle={(item) => onChange({ drinks: toggled(value.drinks, item) })}
          />
        </Section>
      ) : null}
    </div>
  );
}

type CuisineSectionProps = {
  id: string;
  selected: readonly CuisineType[];
  onChange: (cuisines: CuisineType[]) => void;
};

/**
 * A searchable multi-select over Google's restaurant types: the picked ones
 * always lead, then the popular dozen (or all of them), or whatever matches
 * the typed text. Enter picks a lone match, and never submits a form around it.
 */
function CuisineSection({ id, selected, onChange }: CuisineSectionProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const q = query.trim();
  const unpicked = (list: readonly CuisineType[]) => list.filter((type) => !selected.includes(type));
  const matches = q ? unpicked(searchCuisines(q)) : unpicked(showAll ? CUISINE_TYPES.map(([type]) => type) : POPULAR_CUISINES);
  const inputId = `${id}-search`;

  function toggle(type: CuisineType) {
    onChange(toggled(selected, type));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (q && matches.length === 1) {
      toggle(matches[0]);
      setQuery("");
    }
  }

  return (
    <Section id={id} title="Cuisine" hint="Any of these">
      <label htmlFor={inputId} className="relative block">
        <span className="sr-only">Search cuisines</span>
        <SearchIcon
          size={18}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-quiet"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search cuisines"
          autoComplete="off"
          enterKeyHint="done"
          className="h-11 w-full min-w-0 rounded-[14px] border-[1.5px] border-line bg-surface pr-4 pl-10 text-[15px] font-semibold text-ink placeholder:text-quiet/60 focus:border-ink focus-visible:outline-none"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {selected.map((type) => (
          <Chip key={type} size="sm" on onClick={() => toggle(type)}>
            {cuisineLabel(type)}
          </Chip>
        ))}
        {matches.map((type) => (
          <Chip key={type} size="sm" on={false} onClick={() => toggle(type)}>
            {cuisineLabel(type)}
          </Chip>
        ))}
        {q && matches.length === 0 ? (
          <span className="py-2.5 text-sm font-medium text-quiet">No cuisine matches “{q}”</span>
        ) : null}
      </div>
      {!q ? (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          className="self-start text-sm font-bold text-accent-text"
        >
          {showAll ? "Show fewer" : `Show all ${CUISINE_TYPES.length} cuisines`}
        </button>
      ) : null}
    </Section>
  );
}
