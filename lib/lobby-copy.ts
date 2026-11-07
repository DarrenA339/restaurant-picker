import type { Database } from "@/lib/database.types";
import {
  formatDistance,
  priceRangeText,
  shortArea,
  type SessionFilters,
} from "@/lib/session-filters";

export type VotingMethod = Database["public"]["Enums"]["voting_method"];

export const BATCH_SIZE = 20;

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

/** How many suggestions fill the first batch after the group's adds. */
export function fillCount(totalAdds: number, suggestionsOn: boolean): number {
  return suggestionsOn ? Math.max(0, BATCH_SIZE - totalAdds) : 0;
}

export function spotsLabel(total: number): string {
  return total === 1 ? "1 spot" : `${total} spots`;
}

/** "4 people" for the desktop lobby's "Who's here" card. */
export function peopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

/** The suggestions card's body text. */
export function suggestionsText(args: {
  suggestionsOn: boolean;
  isHost: boolean;
  hostName: string;
  filters: SessionFilters;
  totalAdds: number;
}): string {
  const { suggestionsOn, isHost, hostName, filters, totalAdds } = args;
  if (!suggestionsOn) {
    return isHost
      ? "Off. The deck is only what the group added."
      : `${hostName} turned these off. The deck is only what the group added.`;
  }
  const fill = fillCount(totalAdds, true);
  return `${fill} more spots near ${shortArea(filters.areaLabel)} that fit the plan, up to ${formatDistance(
    filters.distanceMi,
  )} and ${priceRangeText(filters.prices)}. They come after the group’s adds.`;
}

/** The line under the host's Start button. */
export function startNote(totalAdds: number, suggestionsOn: boolean): string {
  const fill = fillCount(totalAdds, suggestionsOn);
  if (fill > 0) {
    return `${totalAdds} added ${totalAdds === 1 ? "spot" : "spots"} first, then ${fill} ${
      fill === 1 ? "suggestion" : "suggestions"
    }`;
  }
  return `${spotsLabel(totalAdds)}, all added by the group`;
}
