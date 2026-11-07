import { describe, expect, it } from "vitest";
import type { Json } from "./database.types";
import type { ResultRow } from "./finish-batch";
import { finishRanking, toBallot, type RankStore } from "./finish-ranking";
import type { Method, Swipe } from "./voting";

const SESSION = "11111111-1111-4111-8111-111111111111";
const A = "user-a";
const B = "user-b";
const C = "user-c";

function memory(seed: {
  finalists?: string[] | null;
  ballots?: Json[];
  swipes?: Swipe[];
  ratings?: Record<string, number | null>;
  status?: string;
}) {
  const db = { status: seed.status ?? "ranking", result: null as ResultRow | null, claims: 0 };
  const store: RankStore = {
    async listMemberIds() {
      return [A, B, C];
    },
    async listDealtPlaces() {
      const ratings = seed.ratings ?? {};
      return ["p1", "p2", "p3"].map((placeId) => ({ placeId, rating: ratings[placeId] ?? null }));
    },
    async listSwipes() {
      return seed.swipes ?? [];
    },
    async listBallots() {
      return seed.ballots ?? [];
    },
    async getFinalists() {
      return seed.finalists === undefined ? ["p1", "p2", "p3"] : seed.finalists;
    },
    async saveResult(row) {
      db.result = row;
    },
    async claimDone() {
      db.claims += 1;
      if (db.status !== "ranking") return false;
      db.status = "done";
      return true;
    },
  };
  return { db, store };
}

const session = (voting_method: Method, status = "ranking") => ({ id: SESSION, status, voting_method });

describe("finishRanking", () => {
  it("scores plurality picks, writes the order, and ends the session once", async () => {
    const { db, store } = memory({ ballots: [{ pick: "p2" }, { pick: "p2" }, { pick: "p1" }] });

    const result = await finishRanking(store, session("plurality"));

    expect(result).toEqual({ ok: true, order: ["p2", "p1", "p3"], scores: { p1: 1, p2: 2, p3: 0 } });
    expect(db.result).toMatchObject({ finalists: ["p2", "p1", "p3"], winner_place_id: "p2", runner_up_place_id: "p1" });
    expect(db.status).toBe("done");
  });

  it("leaves missing ballots out, so the host can decide without a straggler", async () => {
    const { db, store } = memory({ ballots: [{ ordering: ["p3", "p1", "p2"] }] });

    const result = await finishRanking(store, session("borda"));

    expect(result).toMatchObject({ ok: true, order: ["p3", "p1", "p2"], scores: { p3: 2, p1: 1, p2: 0 } });
    expect(db.result?.winner_place_id).toBe("p3");
  });

  it("breaks a score tie by the swipe round's yeses, then by rating", async () => {
    const swipes: Swipe[] = [
      { userId: A, placeId: "p1", value: "yes" },
      { userId: B, placeId: "p1", value: "yes" },
      { userId: A, placeId: "p2", value: "yes" },
    ];
    const { db, store } = memory({
      ballots: [{ votes: { p1: 2 } }, { votes: { p2: 2 } }, { votes: { p3: 2 } }],
      swipes,
      ratings: { p2: 4.9, p3: 4.1 },
    });

    const result = await finishRanking(store, session("quadratic"));

    // All tied at 2 votes: p1 has two yeses, p2 one, p3 none.
    expect(result).toMatchObject({ ok: true, order: ["p1", "p2", "p3"] });
    expect(db.result).toMatchObject({ winner_place_id: "p1", runner_up_place_id: "p2" });
  });

  it("skips ballots that don't fit the method", async () => {
    const { store } = memory({ ballots: [{ pick: "p1" }, { ordering: ["p2", "p1", "p3"] }, { pick: "nope" }] });

    const result = await finishRanking(store, session("plurality"));

    expect(result).toMatchObject({ ok: true, scores: { p1: 1, p2: 0, p3: 0 } });
  });

  it("gives way when the session already moved on", async () => {
    const { db, store } = memory({ ballots: [{ pick: "p1" }], status: "done" });
    expect(await finishRanking(store, session("plurality", "done"))).toEqual({ ok: false, code: "not_ranking" });
    expect(db.result).toBeNull();
  });

  it("reports a conflict when another finisher claimed done first", async () => {
    const { db, store } = memory({ ballots: [{ pick: "p1" }] });
    store.claimDone = async () => false;
    expect(await finishRanking(store, session("plurality"))).toEqual({ ok: false, code: "conflict" });
    expect(db.result).not.toBeNull();
  });

  it("refuses without finalists", async () => {
    const { store } = memory({ finalists: [] });
    expect(await finishRanking(store, session("plurality"))).toEqual({ ok: false, code: "no_finalists" });
  });
});

describe("toBallot", () => {
  it("reads each shape and leaves bad ones to fail validation", () => {
    expect(toBallot("plurality", { pick: "p1" })).toEqual({ method: "plurality", pick: "p1" });
    expect(toBallot("borda", { ordering: ["p2", "p1"] })).toEqual({ method: "borda", ordering: ["p2", "p1"] });
    expect(toBallot("quadratic", { votes: { p1: 2 } })).toEqual({ method: "quadratic", votes: { p1: 2 } });
    expect(toBallot("plurality", { ordering: ["p1"] })).toEqual({ method: "plurality", pick: "" });
    expect(toBallot("quadratic", { votes: { p1: "2" } })).toEqual({ method: "quadratic", votes: { p1: Number.NaN } });
  });
});
