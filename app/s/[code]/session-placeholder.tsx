import Link from "next/link";
import { AvatarStack } from "@/components/ui/avatar";
import { toPersonColor } from "@/lib/people";
import type { MemberView, SessionView } from "./session-types";

const stage: Record<
  Exclude<SessionView["status"], "lobby">,
  { title: string; body: string; pill: string }
> = {
  swiping: {
    title: "Pick a spot",
    body: "Picking has started. The card deck, the map strip, and your yes / no / veto controls land in the next two phases; for now this is where they go.",
    pill: "Batch 1",
  },
  ranking: {
    title: "Final round",
    body: "The finalists and the voting screen for the session’s method come in the voting phase.",
    pill: "Final round",
  },
  done: {
    title: "Dinner decided",
    body: "The winner, runner-up, and directions arrive with the result screen.",
    pill: "Done",
  },
};

type SessionPlaceholderProps = {
  session: SessionView;
  members: MemberView[];
};

/** Where the swipe, final-round, and result screens will live. */
export function SessionPlaceholder({ session, members }: SessionPlaceholderProps) {
  const copy = stage[session.status === "lobby" ? "swiping" : session.status];
  return (
    <main className="flex min-h-dvh flex-col gap-[18px] px-5 pt-3 pb-5">
      <div className="flex flex-col gap-3 rounded-button bg-page px-[18px] py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-px">
            <span className="text-[13px] font-semibold text-quiet">{session.name}</span>
            <span className="text-[22px] font-extrabold">{copy.title}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <AvatarStack
              people={members.map((m) => ({ name: m.display_name, color: toPersonColor(m.color) }))}
              max={8}
              size={28}
              ring="page"
              label={`${members.length} in this session`}
            />
            <span className="flex h-8 items-center rounded-full bg-surface px-3 text-sm font-bold">
              {copy.pill}
            </span>
          </div>
        </div>
        <div className="h-1 rounded-full bg-track">
          <div className="h-full w-0 rounded-full bg-accent" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-6 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
        <h1 className="text-xl leading-[1.2] font-extrabold">{copy.title}</h1>
        <p className="text-sm leading-[1.5] font-medium text-quiet">{copy.body}</p>
        <Link
          href="/"
          className="mt-2 inline-flex h-11 items-center justify-center rounded-field border-[1.5px] border-line bg-surface text-sm font-bold text-ink"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
