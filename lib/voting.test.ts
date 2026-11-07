import { describe, expect, it } from "vitest";
import {
  MAX_FINALISTS,
  nextStep,
  pickWinner,
  score,
  tally,
  validateBallot,
  type Ballot,
  type Swipe,
  type Vote,
} from "./voting";

const yes = (userId: string, placeId: string): Swipe => ({ userId, placeId, value: "yes" });
const no = (userId: string, placeId: string): Swipe => ({ userId, placeId, value: "no" });
const veto = (userId: string, placeId: string): Swipe => ({ userId, placeId, value: "veto" });

/** Build swipes from a grid: grid[member][place] = vote or null (missing). */
function grid(members: string[], places: string[], rows: (Vote | null)[][]): Swipe[] {
  const out: Swipe[] = [];
  rows.forEach((row, m) =>
    row.forEach((v, p) => {
      if (v) out.push({ userId: members[m], placeId: places[p], value: v });
    }),
  );
  return out;
}

describe("tally", () => {
  const members = ["sam", "maya", "tyler", "nia"];

  it("counts yeses and treats missing swipes as no", () => {
    const t = tally(members, ["a", "b"], [yes("sam", "a"), yes("maya", "a"), no("tyler", "a"), yes("sam", "b")]);
    expect(t.yesCounts).toEqual({ a: 2, b: 1 });
  });

  it("needs yeses from at least half the members", () => {
    const places = ["a", "b", "c"];
    const swipes = grid(members, places, [
      ["yes", "yes", "yes"],
      ["yes", "yes", "no"],
      ["yes", null, "no"],
      ["no", null, null],
    ]);
    const t = tally(members, places, swipes);
    expect(t.yesCounts).toEqual({ a: 3, b: 2, c: 1 });
    expect(t.finalists).toEqual(["a", "b"]);
  });

  it("excludes any place with a veto, even with many yeses", () => {
    const places = ["a", "b", "c"];
    const swipes = grid(members, places, [
      ["yes", "yes", "yes"],
      ["yes", "yes", "yes"],
      ["yes", "yes", "yes"],
      ["veto", "yes", "no"],
    ]);
    const t = tally(members, places, swipes);
    expect(t.finalists).not.toContain("a");
    expect(t.unanimous).toEqual(["b"]);
  });

  it("orders finalists by yes count, keeping dealt order for ties", () => {
    const places = ["a", "b", "c", "d"];
    const swipes = grid(members, places, [
      ["yes", "yes", "yes", "yes"],
      ["yes", "yes", "no", "yes"],
      ["no", "yes", "yes", "no"],
      ["no", "no", "no", "yes"],
    ]);
    // a 2, b 3, c 2, d 3
    expect(tally(members, places, swipes).finalists).toEqual(["b", "d", "a", "c"]);
  });

  it(`keeps at most ${MAX_FINALISTS} finalists`, () => {
    const places = ["a", "b", "c", "d", "e", "f", "g"];
    const swipes = members.flatMap((m) => places.map((p) => yes(m, p)));
    expect(tally(members, places, swipes).finalists).toHaveLength(MAX_FINALISTS);
  });

  it("relaxes to at least one yes when fewer than 2 qualify", () => {
    const places = ["a", "b", "c", "d"];
    const swipes = grid(members, places, [
      ["yes", "yes", null, "no"],
      ["yes", null, "yes", "no"],
      [null, null, null, "no"],
      [null, null, null, "no"],
    ]);
    // only a reaches half (2 of 4), so the bar drops to one yes; d has none
    expect(tally(members, places, swipes).finalists).toEqual(["a", "b", "c"]);
  });

  it("relaxing never brings back a vetoed place", () => {
    const places = ["a", "b"];
    const swipes = [yes("sam", "a"), yes("sam", "b"), veto("maya", "b")];
    expect(tally(members, places, swipes).finalists).toEqual(["a"]);
  });

  it("counts automatic yeses on a member's own adds like any yes", () => {
    const places = ["added-by-sam"];
    const swipes = [yes("sam", "added-by-sam"), yes("maya", "added-by-sam")];
    expect(tally(members, places, swipes).yesCounts["added-by-sam"]).toBe(2);
  });

  it("finds unanimous places", () => {
    const places = ["a", "b"];
    const swipes = members.flatMap((m) => [yes(m, "a"), m === "nia" ? no(m, "b") : yes(m, "b")]);
    expect(tally(members, places, swipes).unanimous).toEqual(["a"]);
  });

  it("ignores swipes from non-members and on places not dealt", () => {
    const t = tally(["sam"], ["a"], [yes("sam", "a"), yes("stranger", "a"), yes("sam", "elsewhere")]);
    expect(t.yesCounts).toEqual({ a: 1 });
  });

  it("uses a member's latest swipe on a place", () => {
    const t = tally(["sam", "maya"], ["a"], [veto("sam", "a"), yes("sam", "a"), yes("maya", "a")]);
    expect(t.unanimous).toEqual(["a"]);
    expect(t.finalists).toEqual(["a"]);
  });

  it("handles an empty session without throwing", () => {
    expect(tally([], ["a"], [])).toEqual({ yesCounts: { a: 0 }, unanimous: [], finalists: [] });
  });
});

describe("nextStep", () => {
  const members = ["sam", "maya", "tyler"];

  it("declares a single unanimous place the winner", () => {
    const swipes = members.flatMap((m) => [yes(m, "a"), no(m, "b")]);
    expect(nextStep(tally(members, ["a", "b"], swipes))).toEqual({ kind: "winner", placeId: "a" });
  });

  it("sends several unanimous places straight to the final round", () => {
    const swipes = members.flatMap((m) => [yes(m, "a"), yes(m, "b"), no(m, "c")]);
    expect(nextStep(tally(members, ["a", "b", "c"], swipes))).toEqual({ kind: "final-round", finalists: ["a", "b"] });
  });

  it("gives the host a choice with two or more finalists", () => {
    const swipes = [yes("sam", "a"), yes("maya", "a"), yes("sam", "b"), yes("tyler", "b")];
    expect(nextStep(tally(members, ["a", "b"], swipes))).toEqual({ kind: "host-choice", finalists: ["a", "b"] });
  });

  it("asks the host to confirm a single finalist", () => {
    const swipes = [yes("sam", "a"), yes("maya", "a"), veto("tyler", "b")];
    expect(nextStep(tally(members, ["a", "b"], swipes))).toEqual({ kind: "confirm-one", placeId: "a" });
  });

  it("deals more when nothing qualifies", () => {
    const swipes = members.map((m) => no(m, "a"));
    expect(nextStep(tally(members, ["a"], swipes))).toEqual({ kind: "deal-more" });
  });

  it("covers the solo rule: one yes wins, several go to the final round", () => {
    expect(nextStep(tally(["sam"], ["a", "b"], [yes("sam", "a"), no("sam", "b")]))).toEqual({
      kind: "winner",
      placeId: "a",
    });
    expect(nextStep(tally(["sam"], ["a", "b"], [yes("sam", "a"), yes("sam", "b")]))).toEqual({
      kind: "final-round",
      finalists: ["a", "b"],
    });
  });
});

describe("validateBallot", () => {
  const finalists = ["a", "b", "c"];

  it("rejects a ballot for a different method", () => {
    expect(validateBallot({ method: "plurality", pick: "a" }, "borda", finalists)).not.toBeNull();
  });

  it("plurality: pick must be a finalist", () => {
    expect(validateBallot({ method: "plurality", pick: "a" }, "plurality", finalists)).toBeNull();
    expect(validateBallot({ method: "plurality", pick: "z" }, "plurality", finalists)).not.toBeNull();
  });

  it("borda: needs every finalist exactly once", () => {
    expect(validateBallot({ method: "borda", ordering: ["c", "a", "b"] }, "borda", finalists)).toBeNull();
    expect(validateBallot({ method: "borda", ordering: ["a", "b"] }, "borda", finalists)).not.toBeNull();
    expect(validateBallot({ method: "borda", ordering: ["a", "a", "b"] }, "borda", finalists)).not.toBeNull();
    expect(validateBallot({ method: "borda", ordering: ["a", "b", "z"] }, "borda", finalists)).not.toBeNull();
  });

  it("quadratic: accepts spending up to the budget", () => {
    expect(validateBallot({ method: "quadratic", votes: { a: 3 } }, "quadratic", finalists)).toBeNull();
    expect(validateBallot({ method: "quadratic", votes: { a: 2, b: 2, c: 1 } }, "quadratic", finalists)).toBeNull();
  });

  it("quadratic: rejects going over budget", () => {
    expect(validateBallot({ method: "quadratic", votes: { a: 3, b: 1 } }, "quadratic", finalists)).not.toBeNull();
  });

  it("quadratic: rejects fractional, negative, and non-number votes", () => {
    expect(validateBallot({ method: "quadratic", votes: { a: 1.5 } }, "quadratic", finalists)).not.toBeNull();
    expect(validateBallot({ method: "quadratic", votes: { a: -1, b: 2 } }, "quadratic", finalists)).not.toBeNull();
    const bad = { method: "quadratic", votes: { a: "2" } } as unknown as Ballot;
    expect(validateBallot(bad, "quadratic", finalists)).not.toBeNull();
  });

  it("quadratic: rejects votes for non-finalists and empty ballots", () => {
    expect(validateBallot({ method: "quadratic", votes: { z: 1 } }, "quadratic", finalists)).not.toBeNull();
    expect(validateBallot({ method: "quadratic", votes: { a: 0 } }, "quadratic", finalists)).not.toBeNull();
  });
});

describe("score", () => {
  const finalists = ["a", "b", "c"];

  it("starts every finalist at zero", () => {
    expect(score("plurality", [], finalists)).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("plurality: one point per pick", () => {
    const ballots: Ballot[] = [
      { method: "plurality", pick: "a" },
      { method: "plurality", pick: "b" },
      { method: "plurality", pick: "a" },
    ];
    expect(score("plurality", ballots, finalists)).toEqual({ a: 2, b: 1, c: 0 });
  });

  it("borda: k − 1 points for first place down to 0 for last", () => {
    const ballots: Ballot[] = [
      { method: "borda", ordering: ["a", "b", "c"] },
      { method: "borda", ordering: ["b", "c", "a"] },
    ];
    expect(score("borda", ballots, finalists)).toEqual({ a: 2, b: 3, c: 1 });
  });

  it("quadratic: each vote is one point", () => {
    const ballots: Ballot[] = [
      { method: "quadratic", votes: { a: 3 } },
      { method: "quadratic", votes: { b: 2, c: 2, a: 1 } },
    ];
    expect(score("quadratic", ballots, finalists)).toEqual({ a: 4, b: 2, c: 2 });
  });

  it("skips invalid ballots", () => {
    const ballots: Ballot[] = [
      { method: "quadratic", votes: { a: 3, b: 3 } },
      { method: "quadratic", votes: { b: 1 } },
      { method: "plurality", pick: "a" },
    ];
    expect(score("quadratic", ballots, finalists)).toEqual({ a: 0, b: 1, c: 0 });
  });
});

describe("pickWinner", () => {
  it("orders by score first", () => {
    expect(pickWinner({ a: 1, b: 5, c: 3 }, { a: 4, b: 0, c: 0 }, {}, "s1")).toEqual(["b", "c", "a"]);
  });

  it("breaks score ties by yes count, then rating", () => {
    const scores = { a: 4, b: 4, c: 4 };
    const yesCounts = { a: 2, b: 3, c: 2 };
    const ratings = { a: 4.2, b: 3.9, c: 4.8 };
    expect(pickWinner(scores, yesCounts, ratings, "s1")).toEqual(["b", "c", "a"]);
  });

  it("puts a missing rating below any rating", () => {
    const tied = { a: 1, b: 1 };
    expect(pickWinner(tied, { a: 1, b: 1 }, { a: null, b: 3.1 }, "s1")).toEqual(["b", "a"]);
  });

  it("settles a full tie with a coin flip that is the same every time for a session", () => {
    const tied = { a: 1, b: 1, c: 1, d: 1 };
    const yesCounts = { a: 2, b: 2, c: 2, d: 2 };
    const ratings = { a: 4.5, b: 4.5, c: 4.5, d: 4.5 };
    const first = pickWinner(tied, yesCounts, ratings, "session-123");
    expect(pickWinner(tied, yesCounts, ratings, "session-123")).toEqual(first);
    expect(first.slice().sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("can settle the same full tie differently in another session", () => {
    const tied = { a: 1, b: 1, c: 1, d: 1 };
    const yesCounts = { a: 0, b: 0, c: 0, d: 0 };
    const winners = new Set(
      Array.from({ length: 20 }, (_, i) => pickWinner(tied, yesCounts, {}, `session-${i}`)[0]),
    );
    expect(winners.size).toBeGreaterThan(1);
  });
});
