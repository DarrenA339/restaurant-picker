import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { LatLng } from "@/lib/restaurants";
import { supabaseServer } from "./server";

/** What the Places and add routes need from a session row. */
export const ROUTE_SESSION_COLUMNS = "id, status, host_id, center_lat, center_lng, filters";

/**
 * The signed-in visitor and the session as they can see it. RLS hides a
 * session from anyone who isn't a member, so `session` doubles as the
 * membership check; the secret key is only reached for afterwards.
 */
export async function visitorSession(sessionId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, session: null };

  const { data: session } = await supabase
    .from("sessions")
    .select(ROUTE_SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();
  return { supabase, user, session: session ?? null };
}

/** The viewer's own rough location in this session, if they shared one. */
export async function viewerLocation(
  supabase: SupabaseClient<Database>,
  sessionId: string,
  userId: string,
): Promise<LatLng | null> {
  const { data } = await supabase
    .from("members")
    .select("lat, lng")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : null;
}
