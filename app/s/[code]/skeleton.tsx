import { FlowScreen } from "@/components/layout/flow-screen";

/** Loading state while the session gate resolves: skeleton, no spinner. */
export function SessionSkeleton() {
  return (
    <FlowScreen role="status" aria-label="Loading" bodyClassName="gap-3 pt-6">
      <div className="h-[200px] rounded-sheet bg-track" />
      <div className="mt-3 h-3.5 w-4/5 rounded-full bg-track" />
      <div className="h-2.5 w-[55%] rounded-full bg-tint" />
      <div className="mt-3 h-[52px] rounded-field bg-track" />
    </FlowScreen>
  );
}
