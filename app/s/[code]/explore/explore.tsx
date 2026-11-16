"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  BackIcon,
  CheckIcon,
  CloseIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SlidersIcon,
  SpinnerIcon,
} from "@/components/icons";
import { useBottomBar } from "@/components/layout/bottom-bar";
import { useIsDesktop } from "@/components/layout/use-desktop";
import { useToast } from "@/components/ui/toast";
import { spotsLabel } from "@/lib/lobby-copy";
import {
  BOSTON,
  type AutocompleteResult,
  type PlaceResult,
  type SearchArea,
} from "@/lib/places/place";
import { readRestaurantData, type LatLng, type RestaurantRow } from "@/lib/restaurants";
import {
  activeFilterCount,
  DEFAULT_FILTERS,
  exploreFiltersFrom,
  parseFilters,
  type ExploreFilters,
} from "@/lib/session-filters";
import { addSpot, ApiError, autocompletePlaces, searchPlaces } from "../session-api";
import type { MemberView, SessionView } from "../session-types";
import { useSessionLive } from "../use-session-live";
import { DetailsSheet } from "./details-sheet";
import { ExploreMap, type FitRequest, type MapMember, type MapPin } from "./explore-map";
import { FiltersSheet } from "./filters-sheet";
import { ResultRow, rowId, type AddState } from "./result-row";

type ExploreProps = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  initialRestaurants: RestaurantRow[];
  initialMyAddIds: string[];
  userId: string;
};

type LastSearch = { text: string; area: SearchArea | null };

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Explore and add spots (docs/design/06): the map with result pins and the
 * group's dots, Done, the search field with autocomplete predictions, the
 * Filters button and sheet, the results list with Add / Adding / Added, and
 * the details sheet. A place prediction adds that spot straight away, which
 * is the Place Details call that ends the autocomplete session; a dish
 * prediction, Enter, or "Search this area" runs one Text Search. "Added"
 * means the spot is in the session, whoever added it.
 */
export function Explore({
  initialSession,
  initialMembers,
  initialRestaurants,
  initialMyAddIds,
  userId,
}: ExploreProps) {
  const live = useSessionLive({ initialSession, initialMembers, initialRestaurants, initialMyAddIds });
  const { session, members } = live;
  const me = members.find((m) => m.user_id === userId);
  const sessionCenter: LatLng | null =
    session.center_lat != null && session.center_lng != null
      ? { lat: session.center_lat, lng: session.center_lng }
      : null;
  const viewer: LatLng | null = me?.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null;
  /** Where the unlabelled list distances are measured from. */
  const origin: LatLng | null = viewer ?? sessionCenter;
  const mapCenter = sessionCenter ?? origin ?? BOSTON;
  const inSession = new Map(live.restaurants.map((row) => [row.place_id, row]));

  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<AutocompleteResult | null>(null);
  const [results, setResults] = useState<PlaceResult[]>([]);
  /** null until the first search; "" after an area browse with no words. */
  const [searched, setSearched] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [areaSearching, setAreaSearching] = useState(false);
  const [lastSearch, setLastSearch] = useState<LastSearch | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(() =>
    exploreFiltersFrom(parseFilters(initialSession.filters) ?? DEFAULT_FILTERS),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [moved, setMoved] = useState(false);
  const [fit, setFit] = useState<FitRequest | null>(null);
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const { show: showToast } = useToast();
  const desktop = useIsDesktop();
  const panelRef = useBottomBar(!desktop);

  // One autocomplete session token per typing session; it ends with the add
  // (Place Details) or is dropped after a Text Search.
  const tokenRef = useRef<string | null>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const predictAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const fitKeyRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(
    () => () => {
      window.clearTimeout(debounceRef.current);
      predictAbortRef.current?.abort();
      searchAbortRef.current?.abort();
    },
    [],
  );

  // A tapped pin brings its row into view.
  useEffect(() => {
    if (!selected) return;
    const row = document.getElementById(rowId(selected));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  function token(): string {
    tokenRef.current ??= crypto.randomUUID();
    return tokenRef.current;
  }

  function stopPredicting() {
    window.clearTimeout(debounceRef.current);
    predictAbortRef.current?.abort();
    predictAbortRef.current = null;
    setPredictions(null);
  }

  function requestFit(points: LatLng[]) {
    if (points.length === 0) return;
    fitKeyRef.current += 1;
    setFit({ key: fitKeyRef.current, points });
  }

  function onInput(value: string) {
    setQuery(value);
    window.clearTimeout(debounceRef.current);
    const input = value.trim();
    if (input.length < MIN_CHARS) {
      predictAbortRef.current?.abort();
      setPredictions(null);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      predictAbortRef.current?.abort();
      const controller = new AbortController();
      predictAbortRef.current = controller;
      try {
        const next = await autocompletePlaces(session.id, input, token(), controller.signal);
        if (!controller.signal.aborted) setPredictions(next);
      } catch (error) {
        if (isAbort(error)) return;
        setPredictions(null);
      }
    }, DEBOUNCE_MS);
  }

  /** One Text Search: for words, for an area, or both. Frames the results unless the area was the viewer's. */
  async function search(text: string, area: SearchArea | null, withFilters = filters) {
    const q = text.trim();
    if (searching) return;
    stopPredicting();
    setQuery(q);
    inputRef.current?.blur();
    // The typing session didn't end in Place Details; start fresh next time.
    tokenRef.current = null;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setAreaSearching(area !== null);
    try {
      const found = await searchPlaces(
        session.id,
        {
          q: q || undefined,
          lat: area?.center.lat,
          lng: area?.center.lng,
          radius: area?.radiusM,
          filters: withFilters,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setResults(found.places);
      setSearched(q);
      setLastSearch({ text: q, area });
      setSelected(found.places[0]?.placeId ?? null);
      setMoved(false);
      if (!area) requestFit(found.places.flatMap((p) => (p.data.location ? [p.data.location] : [])));
    } catch (error) {
      if (isAbort(error)) return;
      showToast({
        kind: "error",
        text: error instanceof Error ? error.message : "Search isn’t working right now.",
        retry: () => void search(q, area, withFilters),
      });
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
        setAreaSearching(false);
      }
    }
  }

  function applyFilters(next: ExploreFilters) {
    setFilters(next);
    setFiltersOpen(false);
    if (lastSearch) void search(lastSearch.text, lastSearch.area, next);
  }

  async function add(placeId: string, name: string) {
    if (adding.has(placeId) || inSession.has(placeId)) return;
    setAdding((current) => new Set(current).add(placeId));
    stopPredicting();
    const sessionToken = tokenRef.current ?? undefined;
    tokenRef.current = null;
    try {
      const { restaurant } = await addSpot(session.id, { placeId, sessionToken });
      await live.refetchRestaurants();
      const data = readRestaurantData(restaurant.data) ?? { name };
      const inResults = results.some((r) => r.placeId === placeId);
      if (!inResults) {
        setResults((current) => [...current, { placeId, data }]);
        if (data.location) requestFit([data.location]);
      }
      setSelected(placeId);
      showToast({ kind: "ok", text: `Added ${name}` });
    } catch (error) {
      if (error instanceof ApiError && error.code === "duplicate") {
        // Someone (maybe this member in another tab) got there first.
        await live.refetchRestaurants();
        showToast({ kind: "ok", text: `${name} is already in` });
        return;
      }
      const canRetry = !(error instanceof ApiError && (error.code === "cap" || error.code === "not_lobby"));
      showToast({
        kind: "error",
        text: error instanceof Error ? error.message : `Couldn’t add ${name}.`,
        retry: canRetry ? () => void add(placeId, name) : undefined,
      });
    } finally {
      setAdding((current) => {
        const next = new Set(current);
        next.delete(placeId);
        return next;
      });
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void search(query, null);
  }

  function clear() {
    stopPredicting();
    setQuery("");
    inputRef.current?.focus();
  }

  /** A pin: select its row, or open details for an added spot that isn't in the list. */
  function selectPin(placeId: string) {
    setSelected(placeId);
    if (!results.some((r) => r.placeId === placeId)) setDetailsId(placeId);
  }

  function stateOf(placeId: string): AddState {
    return adding.has(placeId) ? "adding" : inSession.has(placeId) ? "added" : "idle";
  }

  /** The list's data for a place, preferring the session's row (it has the photo). */
  function placeFor(placeId: string): PlaceResult | null {
    const row = inSession.get(placeId);
    const rowData = row ? readRestaurantData(row.data) : null;
    if (rowData) return { placeId, data: rowData };
    return results.find((r) => r.placeId === placeId) ?? null;
  }

  const pins: MapPin[] = [];
  const pinned = new Set<string>();
  for (const result of results) {
    const place = placeFor(result.placeId);
    if (!place?.data.location) continue;
    pins.push({ placeId: result.placeId, name: place.data.name, location: place.data.location, added: inSession.has(result.placeId) });
    pinned.add(result.placeId);
  }
  for (const row of live.restaurants) {
    if (pinned.has(row.place_id)) continue;
    const data = readRestaurantData(row.data);
    if (!data?.location) continue;
    pins.push({ placeId: row.place_id, name: data.name, location: data.location, added: true });
  }
  const mapMembers: MapMember[] = members.flatMap((m) =>
    m.lat != null && m.lng != null
      ? [{ userId: m.user_id, name: m.display_name, color: m.color, location: { lat: m.lat, lng: m.lng } }]
      : [],
  );

  const activeFilters = activeFilterCount(filters);
  const details = detailsId ? placeFor(detailsId) : null;
  const hasPredictions = Boolean(
    predictions && (predictions.places.length > 0 || predictions.queries.length > 0),
  );
  const label = searching
    ? "Searching…"
    : searched === null
      ? results.length > 0
        ? "Added just now"
        : "Add a place or a dish"
      : searched === ""
        ? `${spotsLabel(results.length)} nearby`
        : `${spotsLabel(results.length)} for “${searched}”`;

  return (
    <div className="relative h-dvh overflow-hidden bg-[#EEF0EB] lg:flex">
      {/* The map: above the results sheet on phones, beside the panel on desktop. */}
      <div className="absolute inset-x-0 top-0 bottom-[344px] lg:static lg:order-2 lg:h-full lg:min-w-0 lg:flex-1">
        <ExploreMap
          center={mapCenter}
          pins={pins}
          selected={selected}
          members={mapMembers}
          viewerId={userId}
          fit={fit}
          moved={moved}
          searching={areaSearching}
          onMoved={() => setMoved(true)}
          onSelect={selectPin}
          onSearchArea={(area) => void search(query, area)}
        />
      </div>

      {/* On phones the panel floats over the map: the bar on top, the sheet at the bottom, taps between them reach the map. */}
      <aside className="pointer-events-none absolute inset-0 z-10 flex flex-col lg:pointer-events-auto lg:static lg:order-1 lg:h-full lg:w-[400px] lg:flex-none lg:bg-surface lg:shadow-[4px_0_24px_rgba(23,24,26,0.08)]">
        {!live.connected ? (
          <div
            role="status"
            className="pointer-events-auto mx-4 mt-3 flex min-h-9 items-center gap-2 rounded-xl bg-ink px-3 py-1.5 text-[13px] font-bold text-white lg:mx-5 lg:mt-4"
          >
            Reconnecting. Added spots update again when you’re back online.
          </div>
        ) : null}

        <form
          role="search"
          onSubmit={onSubmit}
          className="pointer-events-auto relative z-20 flex shrink-0 items-center gap-2 px-4 pt-4 lg:px-5 lg:pt-5 lg:pb-3.5"
        >
          <Link
            href={`/s/${session.code}`}
            aria-label="Done, back to the session"
            className="flex h-12 shrink-0 items-center gap-1 rounded-2xl bg-surface px-3.5 text-[15px] font-extrabold text-ink shadow-[0_2px_8px_rgba(23,24,26,0.12)] lg:h-11 lg:rounded-[14px] lg:bg-tint lg:px-3 lg:shadow-none"
          >
            <BackIcon size={18} strokeWidth={2.6} />
            Done
          </Link>

          <div className="relative min-w-0 flex-1">
            <div className="flex h-12 items-center gap-1.5 rounded-2xl bg-surface pr-0.5 pl-3 shadow-[0_2px_8px_rgba(23,24,26,0.12)] lg:h-11 lg:rounded-[14px] lg:border-[1.5px] lg:border-line lg:shadow-none">
              <SearchIcon size={18} className="shrink-0 text-quiet" />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoFocus
                aria-label="Search a place or a dish"
                placeholder="Search a place or dish"
                value={query}
                onChange={(event) => onInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") stopPredicting();
                }}
                className="h-11 min-w-0 flex-1 bg-transparent text-base font-semibold text-ink placeholder:text-quiet/60 focus-visible:outline-none lg:h-10 lg:text-[15px]"
              />
              {query ? (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear search"
                  className="flex size-11 shrink-0 items-center justify-center bg-transparent p-0 text-quiet lg:size-10"
                >
                  <CloseIcon size={16} strokeWidth={2.4} />
                </button>
              ) : null}
            </div>

            {hasPredictions && predictions ? (
              <ul
                aria-label="Suggestions"
                className="absolute top-[calc(100%+6px)] right-0 left-0 z-20 flex flex-col gap-0.5 rounded-2xl bg-surface p-1.5 shadow-[0_12px_32px_rgba(23,24,26,0.16)]"
              >
                {predictions.queries.map((q) => (
                  <li key={`q-${q.text}`}>
                    <button
                      type="button"
                      onClick={() => void search(q.text, null)}
                      className="flex h-12 w-full items-center gap-3 rounded-xl bg-transparent px-3 text-left text-ink"
                    >
                      <SearchIcon size={16} className="shrink-0 text-quiet" />
                      <span className="truncate text-[15px] font-bold">{q.text}</span>
                    </button>
                  </li>
                ))}
                {predictions.places.map((p) => {
                  const state = stateOf(p.placeId);
                  return (
                    <li key={p.placeId}>
                      <button
                        type="button"
                        onClick={() => void add(p.placeId, p.mainText)}
                        disabled={state !== "idle"}
                        aria-busy={state === "adding" || undefined}
                        aria-label={
                          state === "added"
                            ? `${p.mainText}, already added`
                            : `Add ${p.mainText} to the deck`
                        }
                        className="flex min-h-12 w-full items-center gap-3 rounded-xl bg-transparent px-3 py-1.5 text-left text-ink disabled:text-quiet"
                      >
                        <PinIcon size={16} className="shrink-0 text-accent-text" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-bold">{p.mainText}</span>
                          {p.secondaryText ? (
                            <span className="truncate text-[13px] font-semibold text-quiet">
                              {p.secondaryText}
                            </span>
                          ) : null}
                        </span>
                        {state === "adding" ? (
                          <SpinnerIcon size={16} className="shrink-0 text-accent-text" />
                        ) : state === "added" ? (
                          <CheckIcon size={16} className="shrink-0 text-[#3D4047]" />
                        ) : (
                          <PlusIcon size={14} className="shrink-0 text-accent-text" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label={activeFilters > 0 ? `Filters, ${activeFilters} active` : "Filters"}
            className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface text-ink shadow-[0_2px_8px_rgba(23,24,26,0.12)] lg:size-11 lg:rounded-[14px] lg:border-[1.5px] lg:border-line lg:shadow-none"
          >
            <SlidersIcon size={20} className="lg:size-[19px]" />
            {activeFilters > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-[5px] -right-[5px] flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-accent px-[5px] text-[11px] font-extrabold text-white lg:-top-1.5 lg:-right-1.5"
              >
                {activeFilters}
              </span>
            ) : null}
          </button>
        </form>

        {/* Taps here reach the map. */}
        <div className="min-h-0 flex-1 lg:hidden" aria-hidden="true" />

        <section
          ref={panelRef}
          aria-labelledby="explore-title"
          className="pointer-events-auto flex h-[344px] shrink-0 flex-col rounded-t-[26px] bg-surface shadow-[0_-8px_24px_rgba(23,24,26,0.10)] lg:h-auto lg:min-h-0 lg:flex-1 lg:rounded-none lg:shadow-none"
        >
          <div className="flex h-[22px] shrink-0 items-center justify-center lg:hidden">
            <span className="h-[5px] w-10 rounded-full bg-[#D9D6CF]" aria-hidden="true" />
          </div>
          <div className="flex shrink-0 flex-col gap-[3px] px-5 pt-0.5 pb-2 lg:pt-0 lg:pb-3">
            <h1 id="explore-title" aria-live="polite" className="text-[19px] font-extrabold lg:text-xl">
              {label}
            </h1>
            <p className="text-sm font-medium text-quiet">Add spots for your group to vote on.</p>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-3 pt-1 pb-[calc(28px+env(safe-area-inset-bottom,0px))] lg:pb-6">
            {results.map((result) => {
              const place = placeFor(result.placeId) ?? result;
              return (
                <ResultRow
                  key={result.placeId}
                  placeId={result.placeId}
                  data={place.data}
                  origin={origin}
                  state={stateOf(result.placeId)}
                  selected={result.placeId === selected}
                  onOpen={() => {
                    setSelected(result.placeId);
                    setDetailsId(result.placeId);
                  }}
                  onAdd={() => void add(result.placeId, place.data.name)}
                />
              );
            })}
            {searched !== null && !searching && results.length === 0 ? (
              <li className="flex flex-col items-start gap-2 px-2 py-5">
                <span className="text-base font-extrabold">
                  {activeFilters > 0 ? "Nothing matches these filters" : "Nothing matches"}
                </span>
                {activeFilters > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="h-11 rounded-field border-[1.5px] border-line bg-surface px-4 text-sm font-bold text-ink"
                  >
                    Change filters
                  </button>
                ) : (
                  <span className="text-sm font-medium text-quiet">
                    Try another dish, or a place by name.
                  </span>
                )}
              </li>
            ) : null}
            {searched === null && results.length === 0 ? (
              <li className="px-2 py-5 text-sm leading-[1.45] font-medium text-quiet">
                Type a dish like “dumplings” or a place by name. Tap a place suggestion to add
                it straight away, or press Enter to see what’s nearby.
              </li>
            ) : null}
          </ul>
        </section>
      </aside>

      <FiltersSheet
        open={filtersOpen}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={applyFilters}
      />

      <DetailsSheet
        sessionId={session.id}
        place={details}
        viewer={viewer}
        meetingArea={sessionCenter}
        state={details ? stateOf(details.placeId) : "idle"}
        onAdd={() => {
          if (details) void add(details.placeId, details.data.name);
        }}
        onClose={() => setDetailsId(null)}
      />

    </div>
  );
}
