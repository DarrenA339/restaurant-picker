import type { Json, Tables } from "@/lib/database.types";
import type { DealResult, DealSession } from "@/lib/deal";
import { nextStep, tally, type NextStep, type Swipe } from "@/lib/voting";

export type SessionStatus = Tables<"sessions">["status"];

export type ResultRow = {
  session_id: string;
  finalists: string[];
  scores: Json;
  winner_place_id: string | null;
  runner_up_place_id: string | null;
};

/** The database side of finishing a batch, small enough to fake in memory (lib/supabase/finish-store.ts is real). */
export type FinishStore = {
  listMemberIds(sessionId: string): Promise<string[]>;
  /** Every dealt place so far, in dealt order. */
  listDealtPlaceIds(sessionId: string): Promise<string[]>;
  listSwipes(sessionId: string): Promise<Swipe[]>;
  /** swiping → deciding, only while the session is still on this batch; false when someone else got there first. */
  claimFinish(sessionId: string, batch: number): Promise<boolean>;
  /** deciding → ranking or done. */
  setStatus(sessionId: string, status: SessionStatus): Promise<void>;
  saveResult(row: ResultRow): Promise<void>;
  clearResult(sessionId: string): Promise<void>;
};

export type FinishDeps = {
  store: FinishStore;
  /** Deals the next batch from deciding (lib/deal.ts dealBatch, or a fake). */
  deal: (session: DealSession) => Promise<DealResult>;
};

export type FinishResult =
  | { ok: true; step: NextStep["kind"]; finalists: string[]; status: SessionStatus; exhausted: boolean }
  | { ok: false; code: "not_swiping" | "conflict" };

/**
 * Everyone finished a batch (docs/SPEC.md "Voting design" and "Session
 * lifecycle"). Claims swiping → deciding with a conditional update, so the
 * last member to finish and the host ending picking can't both run it, then
 * tallies every dealt card so far and acts on the next step:
 *
 *   - winner: one unanimous yes; the result is written and the session is done;
 *   - final-round: several unanimous yeses; they are the finalists, and ranking starts;
 *   - host-choice / confirm-one: the finalists are stored and the host decides;
 *   - deal-more: nothing qualified; the next batch is dealt and swiping resumes.
 *     If the area is out of places the session stays in deciding with no
 *     finalists, which the screen shows as the "Nothing matches" edge state.
 */
export async function finishBatch(deps: FinishDeps, session: DealSession): Promise<FinishResult> {
  const { store, deal } = deps;
  if (session.status !== "swiping") return { ok: false, code: "not_swiping" };
  if (!(await store.claimFinish(session.id, session.batch))) return { ok: false, code: "conflict" };

  const [memberIds, placeIds, swipes] = await Promise.all([
    store.listMemberIds(session.id),
    store.listDealtPlaceIds(session.id),
    store.listSwipes(session.id),
  ]);
  const t = tally(memberIds, placeIds, swipes);
  const step = nextStep(t);
  const result = (finalists: string[], winner: string | null = null, runnerUp: string | null = null): ResultRow => ({
    session_id: session.id,
    finalists,
    scores: {},
    winner_place_id: winner,
    runner_up_place_id: runnerUp,
  });

  switch (step.kind) {
    case "winner": {
      // The runner-up is the best of the rest by yeses, if anything else qualified.
      const runnerUp = t.finalists.find((p) => p !== step.placeId) ?? null;
      await store.saveResult(result([step.placeId], step.placeId, runnerUp));
      await store.setStatus(session.id, "done");
      return { ok: true, step: step.kind, finalists: [step.placeId], status: "done", exhausted: false };
    }
    case "final-round":
      await store.saveResult(result(step.finalists));
      await store.setStatus(session.id, "ranking");
      return { ok: true, step: step.kind, finalists: step.finalists, status: "ranking", exhausted: false };
    case "host-choice":
      await store.saveResult(result(step.finalists));
      return { ok: true, step: step.kind, finalists: step.finalists, status: "deciding", exhausted: false };
    case "confirm-one":
      await store.saveResult(result([step.placeId]));
      return { ok: true, step: step.kind, finalists: [step.placeId], status: "deciding", exhausted: false };
    case "deal-more": {
      await store.clearResult(session.id);
      const dealt = await deal({ ...session, status: "deciding" });
      if (dealt.ok) {
        return { ok: true, step: step.kind, finalists: [], status: "swiping", exhausted: false };
      }
      // Out of places: stay in deciding with nothing to choose from.
      await store.saveResult(result([]));
      return { ok: true, step: step.kind, finalists: [], status: "deciding", exhausted: true };
    }
  }
}
