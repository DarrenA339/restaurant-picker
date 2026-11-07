import { describe, expect, it, vi } from "vitest";
import type { DealResult, DealSession } from "./deal";
import { finishBatch, type FinishStore, type ResultRow } from "./finish-batch";
import { DEFAULT_FILTERS } from "./session-filters";
import type { Swipe } from "./voting";

const SESSION = "11111111-1111-4111-8111-111111111111";
const A = "user-a";
const B = "user-b";

function session(overrides: Partial<DealSession> = {}): DealSession {
  return {
    id: SESSION,
    status: "swiping",
    batch: 1,
    filters: DEFAULT_FILTERS,
    center_lat: 42.37,
    center_lng: -71.12,
    suggestions_on: true,
    search_body: null,
    page_token: null,
    ...overrides,
  };
}

function memory(seed: { members?: string[]; places?: string[]; swipes?: Swipe[]; claimed?: boolean } = {}) {
  const db = {
    status: "swiping" as string,
    result: null as ResultRow | null,
    cleared: 0,
    claims: [] as number[],
  };
  const store: FinishStore = {
    async listMemberIds() {
      return seed.members ?? [A, B];
    },
    async listDealtPlaceIds() {
      return seed.places ?? ["p1", "p2", "p3"];
    },
    async listSwipes() {
      return seed.swipes ?? [];
    },
    async claimFinish(_id, batch) {
      db.claims.push(batch);
      if (seed.claimed || db.status !== "swiping") return false;
      db.status = "deciding";
      return true;
    },
    async setStatus(_id, status) {
      db.status = status;
    },
    async saveResult(row) {
      db.result = row;
    },
    async clearResult() {
      db.cleared += 1;
      db.result = null;
    },
  };
  return { db, store };
}

const yes = (userId: string, placeId: string): Swipe => ({ userId, placeId, value: "yes" });
const no = (userId: string, placeId: string): Swipe => ({ userId, placeId, value: "no" });

describe("finishBatch", () => {
  it("claims the transition once: a second caller gets a conflict and nothing runs", async () => {
    const { db, store } = memory({ claimed: true });
    const deal = vi.fn<(s: DealSession) => Promise<DealResult>>();

    expect(await finishBatch({ store, deal }, session())).toEqual({ ok: false, code: "conflict" });
    expect(db.result).toBeNull();
    expect(deal).not.toHaveBeenCalled();
  });

  it("refuses unless the session is swiping", async () => {
    const { db, store } = memory();
    const deal = vi.fn<(s: DealSession) => Promise<DealResult>>();
    expect(await finishBatch({ store, deal }, session({ status: "deciding" }))).toEqual({ ok: false, code: "not_swiping" });
    expect(db.claims).toHaveLength(0);
  });

  it("writes the result and ends the session on one unanimous yes", async () => {
    const { db, store } = memory({ swipes: [yes(A, "p1"), yes(B, "p1"), yes(A, "p2"), no(B, "p2")] });
    const deal = vi.fn<(s: DealSession) => Promise<DealResult>>();

    const result = await finishBatch({ store, deal }, session());

    expect(result).toEqual({ ok: true, step: "winner", finalists: ["p1"], status: "done", exhausted: false });
    expect(db.status).toBe("done");
    expect(db.result).toMatchObject({ finalists: ["p1"], winner_place_id: "p1", runner_up_place_id: "p2" });
  });

  it("sends several unanimous yeses straight to ranking", async () => {
    const { db, store } = memory({ swipes: [yes(A, "p1"), yes(B, "p1"), yes(A, "p3"), yes(B, "p3")] });

    const result = await finishBatch({ store, deal: vi.fn() }, session());

    expect(result).toMatchObject({ ok: true, step: "final-round", finalists: ["p1", "p3"], status: "ranking" });
    expect(db.status).toBe("ranking");
    expect(db.result).toMatchObject({ finalists: ["p1", "p3"], winner_place_id: null });
  });

  it("stores the finalists and waits for the host with two or more", async () => {
    const { db, store } = memory({ swipes: [yes(A, "p1"), no(B, "p1"), yes(B, "p2"), no(A, "p2")] });

    const result = await finishBatch({ store, deal: vi.fn() }, session());

    expect(result).toMatchObject({ ok: true, step: "host-choice", finalists: ["p1", "p2"], status: "deciding" });
    expect(db.status).toBe("deciding");
    expect(db.result).toMatchObject({ finalists: ["p1", "p2"], winner_place_id: null });
  });

  it("asks the host to confirm a single finalist", async () => {
    const { db, store } = memory({ swipes: [yes(A, "p2"), no(B, "p2"), no(A, "p1"), no(B, "p1")] });

    const result = await finishBatch({ store, deal: vi.fn() }, session());

    expect(result).toMatchObject({ ok: true, step: "confirm-one", finalists: ["p2"], status: "deciding" });
    expect(db.result).toMatchObject({ finalists: ["p2"] });
  });

  it("deals the next batch from deciding when nothing qualifies", async () => {
    const { db, store } = memory({ swipes: [no(A, "p1"), no(B, "p1")] });
    const deal = vi.fn<(s: DealSession) => Promise<DealResult>>(async () => ({
      ok: true,
      batch: 2,
      adds: [],
      suggestions: ["s1"],
      exhausted: false,
    }));

    const result = await finishBatch({ store, deal }, session());

    expect(result).toMatchObject({ ok: true, step: "deal-more", status: "swiping", exhausted: false });
    expect(deal).toHaveBeenCalledTimes(1);
    expect(deal.mock.calls[0][0].status).toBe("deciding");
    expect(db.cleared).toBe(1);
    expect(db.result).toBeNull();
  });

  it("stays in deciding with no finalists when the area is out of places", async () => {
    const { db, store } = memory({ swipes: [] });
    const deal = vi.fn<(s: DealSession) => Promise<DealResult>>(async () => ({ ok: false, code: "nothing_to_deal" }));

    const result = await finishBatch({ store, deal }, session());

    expect(result).toEqual({ ok: true, step: "deal-more", finalists: [], status: "deciding", exhausted: true });
    expect(db.status).toBe("deciding");
    expect(db.result).toMatchObject({ finalists: [], winner_place_id: null });
  });
});
