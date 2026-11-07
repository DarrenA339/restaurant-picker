import type { VotingMethod } from "@/lib/lobby-copy";

type SessionPatch = { voting_method?: VotingMethod; suggestions_on?: boolean };

async function readError(response: Response, fallback: string): Promise<string> {
  const json = (await response.json().catch(() => null)) as { error?: string } | null;
  return json?.error ?? fallback;
}

/** Host only, lobby only: change the voting method and/or suggestions toggle. */
export async function patchSession(id: string, patch: SessionPatch) {
  const response = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await readError(response, "Couldn’t save that."));
  return (await response.json()) as { voting_method: VotingMethod; suggestions_on: boolean };
}

/** Host only: lobby → swiping. */
export async function startSession(id: string) {
  const response = await fetch(`/api/sessions/${id}/start`, { method: "POST" });
  if (!response.ok) throw new Error(await readError(response, "Couldn’t start."));
  return (await response.json()) as { status: string };
}
