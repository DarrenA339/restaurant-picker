import Link from "next/link";
import { BackIcon } from "@/components/icons";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import type { PersonColor } from "@/lib/people";
import { InviteButton } from "./invite-button";

export type LobbyMember = {
  userId: string;
  name: string;
  color: PersonColor;
};

type LobbyPlaceholderProps = {
  session: { id: string; code: string; name: string; host_id: string };
  members: LobbyMember[];
  userId: string;
};

/**
 * Placeholder lobby: the header, the session name, the join code, and who is
 * here. The add bar, the live add list, the voting-method sheet, the
 * suggestions toggle, and Start come in the next part.
 */
export function LobbyPlaceholder({ session, members, userId }: LobbyPlaceholderProps) {
  const names = members.map((member) => member.name);
  const hereLabel =
    members.length === 1
      ? `1 person here: ${names[0]}`
      : `${members.length} people here: ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  return (
    <main className="flex min-h-dvh flex-col gap-[18px] px-5 pt-3 pb-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="Leave lobby"
          className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-ink"
        >
          <BackIcon size={22} />
        </Link>
        <div className="flex items-center gap-2.5">
          <AvatarStack
            people={members}
            max={8}
            size={28}
            ring="page"
            label={hereLabel}
          />
          <InviteButton code={session.code} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] leading-[1.08] font-extrabold tracking-[-0.02em]">
          {session.name}
        </h1>
        <p className="text-base font-medium text-quiet">
          Add the spots you want. Everyone’s adds go first.
        </p>
      </div>

      <section className="flex flex-col gap-1 rounded-card bg-surface px-[18px] py-4 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
        <h2 className="text-[13px] font-bold text-quiet">Join code</h2>
        <p className="text-[28px] font-extrabold tracking-[0.14em]">{session.code}</p>
        <p className="text-sm font-medium text-quiet">
          Friends can type it on the home screen or open the invite link.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-extrabold">Here now</h2>
        <ul className="rounded-card bg-surface px-3.5 py-1 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
          {members.map((member, i) => {
            const isHost = member.userId === session.host_id;
            const isYou = member.userId === userId;
            return (
              <li
                key={member.userId}
                className={`flex min-h-[52px] items-center gap-3 ${
                  i < members.length - 1 ? "border-b border-tint" : ""
                }`}
              >
                <Avatar name={member.name} color={member.color} size={36} />
                <span className="flex-1 text-base font-bold">
                  {member.name}
                  {isHost || isYou ? (
                    <span className="ml-1.5 text-[13px] font-semibold text-quiet">
                      {[isHost ? "Host" : null, isYou ? "You" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm font-medium text-quiet">
        Adding spots, suggestions, and Start are coming next.
      </p>
    </main>
  );
}
