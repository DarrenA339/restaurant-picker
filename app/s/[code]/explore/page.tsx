import { Suspense } from "react";
import { SessionSkeleton } from "../skeleton";
import { ExploreGate } from "./explore-gate";

/**
 * /s/[code]/explore: search and add spots (the map joins in part 2). Who
 * the visitor is and whether the session is still in the lobby are
 * request-time reads, so the gate streams in behind Suspense.
 */
export default function ExplorePage({ params }: PageProps<"/s/[code]/explore">) {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <ExploreGate params={params} />
    </Suspense>
  );
}
