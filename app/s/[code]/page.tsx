import { Suspense } from "react";
import { SessionGate } from "./session-gate";
import { SessionSkeleton } from "./skeleton";

/**
 * /s/[code]: one URL for the whole session. Which view shows depends on
 * whether the visitor is a member and on the session's status, both
 * request-time reads, so the gate streams in behind Suspense.
 */
export default function SessionPage({ params }: PageProps<"/s/[code]">) {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionGate params={params} />
    </Suspense>
  );
}
