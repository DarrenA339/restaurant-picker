import { connection } from "next/server";
import {
  CheckCircleIcon,
  LinkBrokenIcon,
  PeopleIcon,
} from "@/components/icons";
import { StateCard } from "@/components/ui/state-card";
import { normalizeJoinCode } from "@/lib/join-code";
import { isPersonColor, MAX_MEMBERS, type PersonColor } from "@/lib/people";
import { joinSummary, parseFilters } from "@/lib/session-filters";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";
import { LobbyPlaceholder, type LobbyMember } from "./lobby-placeholder";

type MemberRow = {
  user_id: string;
  display_name: string;
  color: number;
};

function toMember(row: MemberRow): LobbyMember {
  return {
    userId: row.user_id,
    name: row.display_name,
    color: (isPersonColor(row.color) ? row.color : 1) as PersonColor,
  };
}

/**
 * Decides which view the visitor gets:
 *   - a member (or the host) sees the session through RLS → lobby;
 *   - anyone else gets a preview read with the secret key → Join screen,
 *     or an edge state if the code is wrong, the dinner ended, or it's full.
 */
export async function SessionGate({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  // Everything below is per request: the Supabase client checks token expiry
  // with Date.now(), which Next refuses to prerender without this.
  await connection();
  const { code: rawCode } = await params;
  const code = normalizeJoinCode(rawCode);
  if (!code) return <InviteBroken />;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: session } = await supabase
      .from("sessions")
      .select("id, code, name, status, host_id")
      .eq("code", code)
      .maybeSingle();

    if (session) {
      const { data: members } = await supabase
        .from("members")
        .select("user_id, display_name, color")
        .eq("session_id", session.id)
        .order("joined_at", { ascending: true });

      return (
        <LobbyPlaceholder
          session={session}
          members={(members ?? []).map(toMember)}
          userId={user.id}
        />
      );
    }
  }

  // Not a member yet (or not signed in). RLS hides the session from them, so
  // the preview comes from the server's own client.
  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from("sessions")
    .select("id, name, status, host_id, filters")
    .eq("code", code)
    .maybeSingle();
  if (!session) return <InviteBroken />;
  if (session.status === "done") return <DinnerEnded name={session.name} />;

  const { data: memberRows } = await admin
    .from("members")
    .select("user_id, display_name, color")
    .eq("session_id", session.id)
    .order("joined_at", { ascending: true });
  const members = (memberRows ?? []).map(toMember);
  if (members.length >= MAX_MEMBERS) return <DinnerFull name={session.name} />;

  const host = members.find((member) => member.userId === session.host_id);
  const filters = parseFilters(session.filters);

  return (
    <JoinForm
      code={code}
      session={{
        name: session.name,
        hostName: host?.name ?? "A friend",
        summary: filters ? joinSummary(filters) : null,
      }}
      members={members.map(({ name, color }) => ({ name, color }))}
    />
  );
}

function InviteBroken() {
  return (
    <StateCard
      icon={<LinkBrokenIcon size={24} />}
      title="This invite doesn’t work"
      body="The link might be old or cut off. Ask for a fresh one, or type the code."
      primary={{ label: "Enter a code", href: "/#join" }}
      secondary={{ label: "Start your own dinner", href: "/new" }}
    />
  );
}

function DinnerEnded({ name }: { name: string }) {
  return (
    <StateCard
      icon={<CheckCircleIcon size={24} />}
      title="This dinner has ended"
      body={`${name} already picked a spot.`}
      primary={{ label: "Start a new dinner", href: "/new" }}
    />
  );
}

function DinnerFull({ name }: { name: string }) {
  return (
    <StateCard
      icon={<PeopleIcon size={24} />}
      title="This dinner is full"
      body={`${name} already has ${MAX_MEMBERS} people, which is the most a group can hold.`}
      primary={{ label: "Start a new dinner", href: "/new" }}
    />
  );
}
