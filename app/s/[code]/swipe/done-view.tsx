"use client";

import { useState } from "react";
import { AlertIcon, ArrowRightIcon, CheckIcon, LockIcon } from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toPersonColor } from "@/lib/people";
import type { MemberView, SessionView } from "../session-types";

type DoneViewProps = {
  session: SessionView;
  members: MemberView[];
  userId: string;
  /** Cards in this member's deck. */
  total: number;
  /** The host ends the batch for everyone. */
  onEndSwiping: () => Promise<void>;
};

/** The host's note: "Spots Nia hasn’t seen will count as a no from them." */
function pendingNote(names: string[]): string {
  if (names.length === 0) return "";
  const who =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Spots ${who} ${names.length === 1 ? "hasn’t" : "haven’t"} seen will count as a no from them.`;
}

/**
 * Done and waiting (docs/design/09-done): this member finished the batch,
 * the group's progress updates live (done or still picking, never votes),
 * and the host can end picking for everyone. Once everyone is done the
 * server tallies and the status moves on; "Everyone's done" shows for the
 * moment in between.
 */
export function DoneView({ session, members, userId, total, onEndSwiping }: DoneViewProps) {
  const isHost = session.host_id === userId;
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDone = (m: MemberView) => m.user_id === userId || m.done_swiping;
  const doneCount = members.filter(isDone).length;
  const everyoneDone = members.length > 0 && doneCount === members.length;
  const pending = members.filter((m) => !isDone(m)).map((m) => m.display_name);

  async function endPicking() {
    if (ending) return;
    setEnding(true);
    setError(null);
    try {
      await onEndSwiping();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t end picking.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <FlowScreen
      bodyClassName="gap-6 pt-4 pb-6"
      footerClassName="flex flex-col gap-2.5"
      footer={
        isHost && !everyoneDone ? (
          <>
            <span className="text-[13px] font-bold text-quiet">Host controls</span>
            <Button
              variant="secondary"
              onClick={endPicking}
              loading={ending}
              loadingLabel="Ending…"
              className="h-[52px] w-full text-base"
            >
              End picking for everyone
            </Button>
            {error ? (
              <p role="alert" className="flex items-center justify-center gap-1.5 text-[13px] font-bold text-[#A3271B]">
                <AlertIcon size={15} className="shrink-0" />
                {error}
              </p>
            ) : (
              <p className="text-center text-[13px] font-medium text-quiet">{pendingNote(pending)}</p>
            )}
          </>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-quiet">{session.name}</span>
        <span className="flex h-8 items-center rounded-full bg-surface px-3 text-[13px] font-bold shadow-[0_1px_2px_rgba(23,24,26,0.08)]">
          Picking
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <span
          className="flex size-16 items-center justify-center rounded-[22px] bg-accent-soft text-accent-text"
          aria-hidden="true"
        >
          <CheckIcon size={30} strokeWidth={3} />
        </span>
        {everyoneDone ? (
          <>
            <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em]">Everyone’s done</h1>
            <p className="text-base leading-[1.45] font-medium text-quiet">
              Tallying the group’s picks…
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em]">You’re done picking</h1>
            <p className="text-base leading-[1.45] font-medium text-quiet">
              You went through all {total} {total === 1 ? "spot" : "spots"}. Nice.
            </p>
          </>
        )}
      </div>

      <section
        aria-labelledby="group-title"
        className="flex flex-col gap-3 rounded-card bg-surface px-[18px] pt-4 pb-4 shadow-[0_1px_3px_rgba(23,24,26,0.07)]"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="group-title" className="text-[17px] font-extrabold">
            The group
          </h2>
          <span aria-live="polite" className="text-sm font-bold">
            {doneCount} of {members.length} done
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {members.map((m) => (
            <span
              key={m.user_id}
              className={`h-1.5 flex-1 rounded-full ${isDone(m) ? "bg-accent" : "bg-track"}`}
            />
          ))}
        </div>
        <ul>
          {members.map((m) => {
            const isMe = m.user_id === userId;
            return (
              <li key={m.user_id} className="flex min-h-[52px] items-center gap-3">
                <Avatar name={m.display_name} color={toPersonColor(m.color)} size={36} text={isMe ? "You" : undefined} />
                <span className="min-w-0 flex-1 truncate text-base font-bold">{isMe ? "You" : m.display_name}</span>
                {isDone(m) ? (
                  <span className="flex items-center gap-[5px] text-[13px] font-bold text-[#2E6B57]">
                    <CheckIcon size={16} strokeWidth={3} />
                    Done
                  </span>
                ) : (
                  <span className="text-[13px] font-bold text-quiet">Still picking</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-2 text-[13px] font-semibold text-quiet">
          <LockIcon size={15} />
          Nobody can see anyone’s votes.
        </p>
      </section>

      <p className="flex items-start gap-3 text-[15px] leading-[1.45] font-semibold">
        <ArrowRightIcon size={20} className="mt-0.5 shrink-0" />
        {everyoneDone
          ? "Next, the group ranks the finalists in the session’s voting method."
          : "Once everyone finishes, the spots the group liked become finalists, and you’ll rank them."}
      </p>
    </FlowScreen>
  );
}
