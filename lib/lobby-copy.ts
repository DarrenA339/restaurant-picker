import type { Database } from "@/lib/database.types";
import { addPercent, splitBatch, type DeckMix } from "@/lib/deck";
import {
  formatDistance,
  priceRangeText,
  shortArea,
  type SessionFilters,
} from "@/lib/session-filters";

export type VotingMethod = Database["public"]["Enums"]["voting_method"];

export type VotingMethodInfo = {
  id: VotingMethod;
  name: string;
  tech: string;
  how: string;
  best: string;
};

/** The three methods from docs/design/05, in display order. */
export const VOTING_METHODS: VotingMethodInfo[] = [
  {
    id: "plurality",
    name: "One vote each",
    tech: "Plurality",
    how: "Everyone picks one favorite. Most votes wins.",
    best: "Fastest. Best when you just need an answer.",
  },
  {
    id: "borda",
    name: "Ranked points",
    tech: "Borda count",
    how: "Everyone ranks the finalists. First place gets the most points.",
    best: "Rewards spots most people like. The default.",
  },
  {
    id: "quadratic",
    name: "Quadratic votes",
    tech: "Quadratic voting",
    how: "Everyone spreads 9 credits. 1 vote costs 1, 2 votes cost 4, 3 cost 9.",
    best: "Lets strong favorites show without anyone taking over.",
  },
];

export function votingMethodInfo(id: VotingMethod): VotingMethodInfo {
  return VOTING_METHODS.find((m) => m.id === id) ?? VOTING_METHODS[1];
}

/** "Ranked points (Borda count)" for the lobby card. */
export function votingMethodLabel(id: VotingMethod): string {
  const info = votingMethodInfo(id);
  return `${info.name} (${info.tech})`;
}

/** "Use ranked points" for the sheet's save button. */
export function useMethodLabel(id: VotingMethod): string {
  return `Use ${votingMethodInfo(id).name.toLowerCase()}`;
}

export function spotsLabel(total: number): string {
  return total === 1 ? "1 spot" : `${total} spots`;
}

/** "4 people" for the desktop lobby's "Who's here" card. */
export function peopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

/** The Mix slider's stops, in order. */
export const MIX_LABELS: Record<DeckMix, string> = {
  adds_only: "Only our adds",
  mostly_adds: "Mostly adds",
  half: "Half and half",
  mostly_new: "Mostly new",
};

/** What a batch is made of, under the Mix slider. */
export function mixText(mix: DeckMix, filters: SessionFilters): string {
  if (mix === "adds_only") return "Every card is a spot the group added. No new places.";
  return `About ${addPercent(mix)}% of each batch is the group’s adds. The rest are new places near ${shortArea(
    filters.areaLabel,
  )}, up to ${formatDistance(filters.distanceMi)} and ${priceRangeText(filters.prices)}.`;
}

/** The first batch for this many adds, assuming the area has places to suggest. */
export function firstBatch(totalAdds: number, batchSize: number, mix: DeckMix) {
  return splitBatch(batchSize, mix, totalAdds, Infinity);
}

/** Start needs something to deal: an add, or a mix that brings in new places. */
export function canStart(totalAdds: number, mix: DeckMix): boolean {
  return totalAdds > 0 || mix !== "adds_only";
}

/** The line under the host's Start button: what the first batch holds. */
export function startNote(totalAdds: number, batchSize: number, mix: DeckMix): string {
  if (!canStart(totalAdds, mix)) return "Add a spot, or move the mix toward new places, to start.";
  const { adds, suggestions } = firstBatch(totalAdds, batchSize, mix);
  const cards = adds + suggestions;
  const first = cards === 1 ? "First card" : `First ${cards} cards`;
  if (suggestions === 0) return `${first}: all added by the group`;
  if (adds === 0) return `${first}: all new places`;
  return `${first}: ${adds} added, ${suggestions} new`;
}

/** "2 of 3 ready": the guests who tapped "I'm done adding". */
export function readyLabel(ready: number, guests: number): string {
  return `${ready} of ${guests} ready`;
}

/** The host's Start button. */
export function startLabel(everyoneReady: boolean): string {
  return everyoneReady ? "Everyone’s ready. Start picking" : "Start picking";
}

/** "Start without Nia?" when the host starts before everyone is ready. */
export function startWithoutQuestion(names: readonly string[]): string {
  if (names.length === 0) return "Start now?";
  if (names.length === 1) return `Start without ${names[0]}?`;
  if (names.length === 2) return `Start without ${names[0]} and ${names[1]}?`;
  return `Start without ${names[0]}, ${names[1]} and ${names.length - 2} more?`;
}
