/**
 * Voting rules from docs/SPEC.md as pure functions. Server routes call these;
 * clients never decide an outcome.
 *
 * Swipes are approval ballots with a veto. After each batch, `tally` finds the
 * finalists and `nextStep` says what happens. The final round uses the
 * session's method: `validateBallot` checks each ballot, `score` totals them,
 * and `pickWinner` orders the finalists with the tie-break chain.
 */

export type Vote = "yes" | "no" | "veto";
export type Swipe = { userId: string; placeId: string; value: Vote };
export type Method = "plurality" | "borda" | "quadratic";
export type Ballot =
  | { method: "plurality"; pick: string }
  | { method: "borda"; ordering: string[] }
  | { method: "quadratic"; votes: Record<string, number> };

export const MAX_FINALISTS = 5;
export const QUADRATIC_BUDGET = 9;

export type Tally = {
  /** Yes count per place. A missing swipe counts as no. */
  yesCounts: Record<string, number>;
  /** Places every member said yes to, with no veto. */
  unanimous: string[];
  /** Up to 5 places, most yeses first. */
  finalists: string[];
};

/**
 * Tally a session's swipes.
 *
 * - Only swipes from current members on dealt places count, and a member's
 *   latest swipe on a place is the one that counts.
 * - Missing swipes count as no (someone stalled, or the host ended picking).
 * - Automatic yeses on a member's own adds are ordinary swipe rows, so they
 *   count here like any other yes.
 * - Any veto removes a place from both `unanimous` and `finalists`.
 * - Finalists need yeses from at least half the members. If fewer than 2
 *   qualify, the bar drops to at least one yes. Either way, the top 5 by yes
 *   count are kept, ties in the order the places were dealt.
 */
export function tally(memberIds: string[], placeIds: string[], swipes: Swipe[]): Tally {
  const members = new Set(memberIds);
  const places = unique(placeIds);
  const placeSet = new Set(places);

  const latest = new Map<string, Map<string, Vote>>();
  for (const s of swipes) {
    if (!members.has(s.userId) || !placeSet.has(s.placeId)) continue;
    let byMember = latest.get(s.placeId);
    if (!byMember) latest.set(s.placeId, (byMember = new Map()));
    byMember.set(s.userId, s.value);
  }

  const yesCounts: Record<string, number> = {};
  const vetoed = new Set<string>();
  for (const p of places) {
    const votes = latest.get(p);
    let yes = 0;
    for (const v of votes?.values() ?? []) {
      if (v === "yes") yes += 1;
      else if (v === "veto") vetoed.add(p);
    }
    yesCounts[p] = yes;
  }

  const n = members.size;
  const eligible = places.filter((p) => !vetoed.has(p));
  const unanimous = n === 0 ? [] : eligible.filter((p) => yesCounts[p] === n);

  const mostYesFirst = (list: string[]) => sortStable(list, (a, b) => yesCounts[b] - yesCounts[a]);
  let finalists = mostYesFirst(eligible.filter((p) => n > 0 && yesCounts[p] * 2 >= n));
  if (finalists.length < 2) finalists = mostYesFirst(eligible.filter((p) => yesCounts[p] >= 1));

  return { yesCounts, unanimous, finalists: finalists.slice(0, MAX_FINALISTS) };
}

export type NextStep =
  /** Exactly one unanimous place: it wins with no final round. */
  | { kind: "winner"; placeId: string }
  /** Several unanimous places: only those go straight to the final round. */
  | { kind: "final-round"; finalists: string[] }
  /** Two or more finalists: the host picks the final round or 20 more. */
  | { kind: "host-choice"; finalists: string[] }
  /** One finalist: the host picks "Go with it" or 20 more. */
  | { kind: "confirm-one"; placeId: string }
  /** No finalists: deal the next batch automatically. */
  | { kind: "deal-more" };

/**
 * What happens after everyone finishes a batch. With one member, this also
 * covers the spec's solo rule: one yes wins outright, several go to the final
 * round.
 */
export function nextStep(t: Tally): NextStep {
  if (t.unanimous.length === 1) return { kind: "winner", placeId: t.unanimous[0] };
  if (t.unanimous.length > 1) return { kind: "final-round", finalists: t.unanimous.slice(0, MAX_FINALISTS) };
  if (t.finalists.length >= 2) return { kind: "host-choice", finalists: t.finalists };
  if (t.finalists.length === 1) return { kind: "confirm-one", placeId: t.finalists[0] };
  return { kind: "deal-more" };
}

/**
 * Check a final-round ballot against the session's method and finalists.
 * Returns a message to show the member, or null when the ballot is valid.
 */
export function validateBallot(ballot: Ballot, method: Method, finalists: string[]): string | null {
  if (ballot.method !== method) return "This ballot doesn’t match the group’s voting method.";
  const allowed = new Set(finalists);

  switch (ballot.method) {
    case "plurality":
      return allowed.has(ballot.pick) ? null : "Pick one of the finalists.";

    case "borda": {
      const order = ballot.ordering;
      const isFullOrdering =
        Array.isArray(order) &&
        order.length === allowed.size &&
        new Set(order).size === order.length &&
        order.every((p) => allowed.has(p));
      return isFullOrdering ? null : "Rank every finalist exactly once.";
    }

    case "quadratic": {
      let spent = 0;
      let total = 0;
      for (const [placeId, votes] of Object.entries(ballot.votes ?? {})) {
        if (!allowed.has(placeId)) return "Votes can only go to finalists.";
        if (typeof votes !== "number" || !Number.isInteger(votes) || votes < 0) {
          return "Votes must be whole numbers, zero or more.";
        }
        spent += votes * votes;
        total += votes;
      }
      if (spent > QUADRATIC_BUDGET) {
        return `Those votes cost ${spent} credits, more than the ${QUADRATIC_BUDGET} you have.`;
      }
      if (total === 0) return "Add at least one vote.";
      return null;
    }
  }

  return "Unknown voting method.";
}

/**
 * Total the final-round ballots. Every finalist starts at 0, and invalid
 * ballots are skipped.
 *
 * - Plurality: one point for the pick.
 * - Borda: with k finalists, first place earns k − 1 points and last earns 0.
 * - Quadratic: each vote is one point; the credits only limit how many you get.
 */
export function score(method: Method, ballots: Ballot[], finalists: string[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const p of finalists) scores[p] = 0;
  const k = finalists.length;

  for (const ballot of ballots) {
    if (validateBallot(ballot, method, finalists) !== null) continue;
    if (ballot.method === "plurality") {
      scores[ballot.pick] += 1;
    } else if (ballot.method === "borda") {
      ballot.ordering.forEach((p, i) => (scores[p] += k - 1 - i));
    } else {
      for (const [p, votes] of Object.entries(ballot.votes)) scores[p] += votes;
    }
  }
  return scores;
}

/**
 * Order the finalists from winner to last. Ties break by, in order: more
 * yeses in the swipe round, higher Google rating (a missing rating loses),
 * then a coin flip seeded by the session id, so the same inputs always give
 * the same winner.
 */
export function pickWinner(
  scores: Record<string, number>,
  yesCounts: Record<string, number>,
  ratings: Record<string, number | null>,
  sessionId: string,
): string[] {
  const rows = Object.keys(scores).map((placeId) => ({
    placeId,
    score: scores[placeId],
    yes: yesCounts[placeId] ?? 0,
    rating: ratings[placeId] ?? Number.NEGATIVE_INFINITY,
    coin: seededCoin(sessionId, placeId),
  }));

  rows.sort(
    (a, b) =>
      compareDesc(a.score, b.score) ||
      compareDesc(a.yes, b.yes) ||
      compareDesc(a.rating, b.rating) ||
      a.coin - b.coin ||
      (a.placeId < b.placeId ? -1 : a.placeId > b.placeId ? 1 : 0),
  );
  return rows.map((r) => r.placeId);
}

// Helpers

function unique(list: string[]): string[] {
  return [...new Set(list)];
}

function sortStable<T>(list: T[], compare: (a: T, b: T) => number): T[] {
  return list
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map((x) => x.item);
}

/** Larger first. Works with -Infinity on either side. */
function compareDesc(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/** FNV-1a hash of the session and place: a fixed pseudo-random number per pair. */
function seededCoin(sessionId: string, placeId: string): number {
  const s = `${sessionId}:${placeId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
