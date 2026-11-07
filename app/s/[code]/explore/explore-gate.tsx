import { redirect } from "next/navigation";
import { connection } from "next/server";
import { normalizeJoinCode } from "@/lib/join-code";
import { supabaseServer } from "@/lib/supabase/server";
import { loadLobbyData } from "../lobby-data";
import { MEMBER_VIEW_COLUMNS, SESSION_VIEW_COLUMNS } from "../session-types";
import { Explore } from "./explore";

/**
 * Explore is for members of a session still in the lobby. Anyone else goes
 * to the session page, whose own gate shows Join, the swipe screen, or an
 * edge state as appropriate.
 */
export async function ExploreGate({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code: rawCode } = await params;
  const code = normalizeJoinCode(rawCode);
  if (!code) redirect("/");
  const back = `/s/${code}`;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(back);

  const { data: session } = await supabase
    .from("sessions")
    .select(SESSION_VIEW_COLUMNS)
    .eq("code", code)
    .maybeSingle();
  if (!session || session.status !== "lobby") redirect(back);

  const [{ data: members }, lobby] = await Promise.all([
    supabase
      .from("members")
      .select(MEMBER_VIEW_COLUMNS)
      .eq("session_id", session.id)
      .order("joined_at", { ascending: true }),
    loadLobbyData(supabase, session.id),
  ]);

  return (
    <Explore
      initialSession={session}
      initialMembers={members ?? []}
      initialRestaurants={lobby.restaurants}
      initialMyAddIds={lobby.myAddIds}
      userId={user.id}
    />
  );
}
