import type { Json } from "@/lib/database.types";
import type { ResultRow } from "@/lib/finish-batch";
import { pickWinner, score, tally, type Ballot, type Method, type Swipe } from "@/lib/voting";

/** The database side of ending the final round, small enough to fake in memory (lib/supabase/rank-store.ts is real). */
export type RankStore = {
  listMemberIds(sessionId: string): Promise<string[]>;
  /** Every dealt place so far with its Google rating, in dealt order. */
  listDealtPlaces(sessionId: string): Promise<{ placeId: string; rating: number | null }[]>;
  listSwipes(sessionId: string): Promise<Swipe[]>;
  /** The ballots in so far, as stored: {pick}, {ordering}, or {votes}. */
  listBallots(sessionId: string): Promise<Json[]>;
  getFinalists(sessionId: string): Promise<string[] | null>;
  saveResult(row: ResultRow): Promise<void>;
  /** ranking → done, only while the session is still ranking; false when someone else got there first. */
  claimDone(sessionId: string): Promise<boolean>;
};

export type RankSession = { id: string; status: string; voting_method: Method };

export type RankResult =
  | { ok: true; order: string[]; scores: Record<string, number> }
  | { ok: false; code: "not_ranking" | "no_finalists" | "conflict" };

/** A stored ballot payload as the voting module's Ballot; shapes it can't read fail validation and are skipped by `score`. */
export function toBallot(method: Method, payload: Json): Ballot {
  const p = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : {};
  switch (method) {
    case "plurality":
      return { method, pick: typeof p.pick === "string" ? p.pick : "" };
    case "borda":
      return { method, ordering: Array.isArray(p.ordering) ? p.ordering.map(String) : [] };
    case "quadratic": {
      const votes: Record<string, number> = {};
      if (typeof p.votes === "object" && p.votes !== null && !Array.isArray(p.votes)) {
        for (const [placeId, n] of Object.entries(p.votes)) votes[placeId] = typeof n === "number" ? n : Number.NaN;
      }
      return { method, votes };
    }
  }
}

/**
 * Ends the final round (docs/SPEC.md "Voting design" steps 4 and 5): the
 * ballots in so far are scored in the session's method, ties break by the
 * swipe round's yeses, then rating, then the session-seeded coin flip, and
 * the result is written before the session moves to done behind the
 * conditional status update. Members without a ballot are simply left out,
 * which is what the host's "Decide without" relies on.
 */
export async function finishRanking(store: RankStore, session: RankSession): Promise<RankResult> {
  if (session.status !== "ranking") return { ok: false, code: "not_ranking" };
  const finalists = await store.getFinalists(session.id);
  if (!finalists || finalists.length === 0) return { ok: false, code: "no_finalists" };

  const [memberIds, places, swipes, payloads] = await Promise.all([
    store.listMemberIds(session.id),
    store.listDealtPlaces(session.id),
    store.listSwipes(session.id),
    store.listBallots(session.id),
  ]);
  const { yesCounts } = tally(memberIds, places.map((p) => p.placeId), swipes);
  const ratings: Record<string, number | null> = {};
  for (const place of places) ratings[place.placeId] = place.rating;
  const ballots = payloads.map((payload) => toBallot(session.voting_method, payload));
  const scores = score(session.voting_method, ballots, finalists);
  const order = pickWinner(scores, yesCounts, ratings, session.id);

  await store.saveResult({
    session_id: session.id,
    finalists: order,
    scores,
    winner_place_id: order[0] ?? null,
    runner_up_place_id: order[1] ?? null,
  });
  if (!(await store.claimDone(session.id))) return { ok: false, code: "conflict" };
  return { ok: true, order, scores };
}
