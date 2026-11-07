import Link from "next/link";
import { CameraIcon } from "@/components/icons";
import { FlowScreen } from "@/components/layout/flow-screen";
import { AvatarStack } from "@/components/ui/avatar";
import { toPersonColor } from "@/lib/people";
import { readRestaurantData, restaurantMeta, type RestaurantRow } from "@/lib/restaurants";
import { DealButton } from "./deal-button";
import type { MemberView, SessionView } from "./session-types";

const stage: Record<
  Exclude<SessionView["status"], "lobby">,
  { title: string; body: string; pill: (batch: number) => string }
> = {
  swiping: {
    title: "Pick a spot",
    body: "Picking has started. The card deck, the map strip, and your yes / no / veto controls land in the next phase; until then this lists the batch as it was dealt.",
    pill: (batch) => `Batch ${batch}`,
  },
  ranking: {
    title: "Final round",
    body: "The finalists and the voting screen for the session’s method come in the voting phase.",
    pill: () => "Final round",
  },
  done: {
    title: "Dinner decided",
    body: "The winner, runner-up, and directions arrive with the result screen.",
    pill: () => "Done",
  },
};

type SessionPlaceholderProps = {
  session: SessionView;
  members: MemberView[];
  restaurants: RestaurantRow[];
  userId: string;
};

/** Where the swipe, final-round, and result screens will live. Lists the dealt batch so the deck can be checked. */
export function SessionPlaceholder({ session, members, restaurants, userId }: SessionPlaceholderProps) {
  const copy = stage[session.status === "lobby" ? "swiping" : session.status];
  const isHost = session.host_id === userId;
  // The batch as dealt: the group's adds first, then suggestions, each in insertion order.
  const cards = restaurants
    .filter((row) => row.batch === session.batch)
    .sort((a, b) =>
      a.source !== b.source
        ? a.source === "member"
          ? -1
          : 1
        : a.created_at.localeCompare(b.created_at),
    );
  const dealtSoFar = restaurants.filter((row) => row.batch !== null).length;

  return (
    <FlowScreen bodyClassName="gap-[18px] pt-3 pb-5">
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
              {copy.pill(session.batch)}
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
      </div>

      {session.status === "swiping" ? (
        <section aria-labelledby="batch-title" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 id="batch-title" className="text-lg font-extrabold">
              Batch {session.batch}
            </h2>
            <span className="text-sm font-bold text-quiet">
              {cards.length} {cards.length === 1 ? "card" : "cards"} · {dealtSoFar} dealt so far
            </span>
          </div>
          <ol className="rounded-card bg-surface px-3.5 py-1 shadow-[0_1px_3px_rgba(23,24,26,0.07)]">
            {cards.length === 0 ? (
              <li className="flex min-h-[68px] items-center text-sm font-medium text-quiet">
                Nothing in this batch.
              </li>
            ) : null}
            {cards.map((card, index) => {
              const data = readRestaurantData(card.data);
              const name = data?.name ?? "Unnamed spot";
              const meta = data ? restaurantMeta(data, null) : "";
              return (
                <li key={card.place_id} className="flex min-h-[68px] items-center gap-3 border-b border-tint last:border-b-0">
                  <span className="w-5 text-right text-[13px] font-bold text-quiet">{index + 1}</span>
                  <span
                    className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#EDE3D3] text-[#5E5A52]"
                    aria-hidden="true"
                  >
                    {data?.photoUri ? (
                      // Google photo URIs come from the server; next/image would need a remote pattern per host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.photoUri} alt="" className="block size-full object-cover" />
                    ) : (
                      <CameraIcon size={18} />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-base font-extrabold">{name}</span>
                    {meta ? <span className="text-[13px] font-semibold text-quiet">{meta}</span> : null}
                  </span>
                  <span className="shrink-0 rounded-full bg-tint px-2.5 py-1 text-xs font-bold text-quiet">
                    {card.source === "member" ? "added" : "suggested"}
                  </span>
                </li>
              );
            })}
          </ol>
          {isHost ? <DealButton sessionId={session.id} /> : null}
        </section>
      ) : null}

      <Link
        href="/"
        className="inline-flex h-11 items-center justify-center rounded-field border-[1.5px] border-line bg-surface text-sm font-bold text-ink"
      >
        Back to home
      </Link>
    </FlowScreen>
  );
}
