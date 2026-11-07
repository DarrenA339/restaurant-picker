import type { VotingMethod } from "@/lib/lobby-copy";
import type { AutocompleteResult, SearchResult } from "@/lib/places/place";
import type { RestaurantRow } from "@/lib/restaurants";

type SessionPatch = { voting_method?: VotingMethod; suggestions_on?: boolean };

/** A route's error, with the machine-readable `code` some responses carry (lib/api.ts). */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fail(response: Response, fallback: string): Promise<never> {
  const json = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
  throw new ApiError(json?.error ?? fallback, response.status, json?.code);
}

const json = { "Content-Type": "application/json" };

/** Host only, lobby only: change the voting method and/or suggestions toggle. */
export async function patchSession(id: string, patch: SessionPatch) {
  const response = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify(patch),
  });
  if (!response.ok) return fail(response, "Couldn’t save that.");
  return (await response.json()) as { voting_method: VotingMethod; suggestions_on: boolean };
}

export type BatchSummary = { batch: number; cards: number; exhausted: boolean };

/** Host only: lobby → swiping, dealing batch 1. */
export async function startSession(id: string) {
  const response = await fetch(`/api/sessions/${id}/start`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t start.");
  return (await response.json()) as BatchSummary & { status: string };
}

/** I finished the current batch. Safe to repeat: the server flips the flag once. */
export async function markDoneSwiping(id: string) {
  const response = await fetch(`/api/sessions/${id}/done-swiping`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t save that.");
  return (await response.json()) as { done: true; batch: number; everyoneDone: boolean };
}

/** Host only, while swiping: end the batch for everyone. */
export async function endSwiping(id: string) {
  const response = await fetch(`/api/sessions/${id}/end-swiping`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t end picking.");
  return (await response.json()) as { batch: number; everyoneDone: true };
}

/** Host only, from deciding: the finalists go to the final round. */
export async function goToFinalRound(id: string) {
  const response = await fetch(`/api/sessions/${id}/final-round`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t start the final round.");
  return (await response.json()) as { status: "ranking"; finalists: string[] };
}

/** Host only, from deciding with one finalist: it wins. */
export async function goWithIt(id: string) {
  const response = await fetch(`/api/sessions/${id}/go-with-it`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t finish.");
  return (await response.json()) as { status: "done"; winner: string };
}

/** Host only, from deciding with nothing left nearby: widen the distance one step and deal. */
export async function widenDistance(id: string) {
  const response = await fetch(`/api/sessions/${id}/widen`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t widen the search.");
  return (await response.json()) as { distanceMi: number; batch: number; cards: number };
}

export type BallotBody = { pick: string } | { ordering: string[] } | { votes: Record<string, number> };

/** My final-round ballot, in the session's method. */
export async function submitBallot(id: string, ballot: BallotBody) {
  const response = await fetch(`/api/sessions/${id}/ballot`, {
    method: "POST",
    headers: json,
    body: JSON.stringify(ballot),
  });
  if (!response.ok) return fail(response, "Couldn’t save your ballot.");
  return (await response.json()) as { saved: true; everyoneDone: boolean; status?: "done" };
}

/** Host only, while ranking: decide with the ballots in so far. */
export async function endRanking(id: string) {
  const response = await fetch(`/api/sessions/${id}/end-ranking`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t decide.");
  return (await response.json()) as { status: "done"; winner: string };
}

/** Host only, from deciding: deal the next batch instead of ranking. */
export async function dealNextBatch(id: string) {
  const response = await fetch(`/api/sessions/${id}/deal`, { method: "POST" });
  if (!response.ok) return fail(response, "Couldn’t deal the next batch.");
  return (await response.json()) as BatchSummary;
}

export type AddSpotResponse = { restaurant: RestaurantRow; joined: boolean };

/** Lobby only: add a spot. `sessionToken` is the autocomplete session it ends. */
export async function addSpot(id: string, body: { placeId: string; sessionToken?: string }) {
  const response = await fetch(`/api/sessions/${id}/add`, {
    method: "POST",
    headers: json,
    body: JSON.stringify(body),
  });
  if (!response.ok) return fail(response, "Couldn’t add that spot.");
  return (await response.json()) as AddSpotResponse;
}

/** Lobby only: remove one of the caller's own adds. */
export async function removeAdd(id: string, placeId: string) {
  const response = await fetch(`/api/sessions/${id}/add/${encodeURIComponent(placeId)}`, {
    method: "DELETE",
  });
  if (!response.ok) return fail(response, "Couldn’t remove that spot.");
  return (await response.json()) as { removed: true };
}

/** Name and dish predictions for what the member is typing. */
export async function autocompletePlaces(
  sessionId: string,
  q: string,
  token: string,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ session: sessionId, q, token });
  const response = await fetch(`/api/places/autocomplete?${params}`, { signal });
  if (!response.ok) return fail(response, "Search isn’t working right now.");
  return (await response.json()) as AutocompleteResult;
}

export type SearchOptions = {
  /** Empty browses for restaurants. */
  q?: string;
  /** "Search this area": the map's center and radius in meters. */
  lat?: number;
  lng?: number;
  radius?: number;
  prices?: readonly number[];
  openNow?: boolean;
  cuisines?: readonly string[];
};

/** One Text Search for the explore list. */
export async function searchPlaces(sessionId: string, options: SearchOptions, signal?: AbortSignal) {
  const params = new URLSearchParams({ session: sessionId });
  if (options.q) params.set("q", options.q);
  if (options.lat !== undefined && options.lng !== undefined) {
    params.set("lat", String(options.lat));
    params.set("lng", String(options.lng));
  }
  if (options.radius !== undefined) params.set("radius", String(Math.round(options.radius)));
  if (options.prices) params.set("prices", options.prices.join(","));
  if (options.openNow !== undefined) params.set("openNow", String(options.openNow));
  if (options.cuisines) params.set("cuisines", options.cuisines.join(","));
  const response = await fetch(`/api/places/search?${params}`, { signal });
  if (!response.ok) return fail(response, "Search isn’t working right now.");
  return (await response.json()) as SearchResult;
}
