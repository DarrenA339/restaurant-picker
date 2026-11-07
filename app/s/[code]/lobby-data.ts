import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RestaurantRow } from "@/lib/restaurants";

export type LobbyData = { restaurants: RestaurantRow[]; myAddIds: string[] };

/**
 * The session's spots and which of them the viewer added, read as the
 * viewer so RLS applies (adds come back only for their own rows). Seeds the
 * lobby and explore screens so the list doesn't flash empty before the
 * Realtime subscription's first refetch.
 */
export async function loadLobbyData(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<LobbyData> {
  const [{ data: restaurants }, { data: adds }] = await Promise.all([
    supabase
      .from("restaurants")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true }),
    supabase.from("adds").select("place_id").eq("session_id", sessionId),
  ]);
  return {
    restaurants: restaurants ?? [],
    myAddIds: (adds ?? []).map((row) => row.place_id),
  };
}
