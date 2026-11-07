"use client";

import { ArrowRightIcon, CheckIcon, LockIcon } from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { Avatar } from "@/components/ui/avatar";
import { toPersonColor } from "@/lib/people";
import { DealButton } from "../deal-button";
import type { MemberView, SessionView } from "../session-types";

type DoneViewProps = {
  session: SessionView;
  members: MemberView[];
  userId: string;
  /** Cards in this member's deck. */
  total: number;
};

/**
 * Placeholder for the done-and-waiting screen (docs/design/09-done): the
 * member finished the batch. The server doesn't know yet (the done-swiping
 * route comes with the voting phase), so "Done" here is this member plus
 * whoever the database already marks done; the host's real controls come
 * then too, and the deal button stands in so batches can be checked.
 */
export function DoneView({ session, members, userId, total }: DoneViewProps) {
  const isHost = session.host_id === userId;
  const doneCount = members.filter((m) => m.user_id === userId || m.done_swiping).length;
  return (
    <FlowScreen
      bodyClassName="gap-6 pt-4 pb-6"
      footer={
        isHost ? (
          <div className="flex flex-col gap-2.5">
            <span className="text-[15px] font-bold text-quiet">Host controls</span>
            <DealButton sessionId={session.id} />
          </div>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-base font-semibold text-quiet">{session.name}</span>
        <span className="flex h-9 items-center rounded-full bg-surface px-3.5 text-[15px] font-bold">Picking</span>
      </div>

      <div className="flex flex-col gap-3">
        <span
          className="flex size-16 items-center justify-center rounded-[22px] bg-accent-soft text-accent-text"
          aria-hidden="true"
        >
          <CheckIcon size={30} strokeWidth={3} />
        </span>
        <h1 className="text-[34px] leading-[1.08] font-extrabold tracking-[-0.02em]">You’re done picking</h1>
        <p className="text-[17px] font-medium text-quiet">
          You went through all {total} {total === 1 ? "spot" : "spots"}. Nice.
        </p>
      </div>

      <section
        aria-labelledby="group-title"
        className="flex flex-col gap-3 rounded-card bg-surface px-[18px] pt-4 pb-4 shadow-[0_1px_3px_rgba(23,24,26,0.07)]"
      >
        <div className="flex items-baseline justify-between">
          <h2 id="group-title" className="text-lg font-extrabold">
            The group
          </h2>
          <span className="text-[15px] font-bold">
            {doneCount} of {members.length} done
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          {members.map((m) => (
            <span
              key={m.user_id}
              className={`h-1.5 flex-1 rounded-full ${m.user_id === userId || m.done_swiping ? "bg-accent" : "bg-track"}`}
            />
          ))}
        </div>
        <ul>
          {members.map((m) => {
            const isMe = m.user_id === userId;
            const done = isMe || m.done_swiping;
            return (
              <li key={m.user_id} className="flex min-h-[52px] items-center gap-3">
                <Avatar name={m.display_name} color={toPersonColor(m.color)} size={36} text={isMe ? "You" : undefined} />
                <span className="min-w-0 flex-1 truncate text-base font-bold">{isMe ? "You" : m.display_name}</span>
                {done ? (
                  <span className="flex items-center gap-1.5 text-[15px] font-bold text-[#2E6B57]">
                    <CheckIcon size={16} strokeWidth={3} />
                    Done
                  </span>
                ) : (
                  <span className="text-[15px] font-semibold text-quiet">Still picking</span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="flex items-center gap-2 text-sm font-medium text-quiet">
          <LockIcon size={16} />
          Nobody can see anyone’s votes.
        </p>
      </section>

      <p className="flex items-start gap-3 text-[17px] leading-[1.4] font-semibold">
        <ArrowRightIcon size={20} className="mt-1 shrink-0" />
        Once everyone finishes, the spots the group liked become finalists, and you’ll rank them.
      </p>
    </FlowScreen>
  );
}
