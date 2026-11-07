import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";

export type SwipeValue = Tables<"swipes">["value"];

const UNIQUE_VIOLATION = "23505";
/** What the veto trigger raises once a member's vetoes are spent. */
const CHECK_VIOLATION = "23514";

export class SwipeWriteError extends Error {
  constructor(
    message: string,
    public readonly reason: "no_vetoes" | "other",
  ) {
    super(message);
    this.name = "SwipeWriteError";
  }
}

/**
 * Writes one swipe as the member (RLS: only their own row). Insert, then
 * update on conflict: a browser never upserts, since PostgREST would set
 * every payload column. The database's veto trigger rejects a third veto.
 */
export async function writeSwipe(
  supabase: SupabaseClient<Database>,
  row: { session_id: string; user_id: string; place_id: string; value: SwipeValue },
) {
  const { error } = await supabase.from("swipes").insert(row);
  if (!error) return;
  if (error.code === CHECK_VIOLATION) throw new SwipeWriteError("No vetoes left.", "no_vetoes");
  if (error.code !== UNIQUE_VIOLATION) throw new SwipeWriteError(error.message, "other");

  const { error: updateError } = await supabase
    .from("swipes")
    .update({ value: row.value })
    .eq("session_id", row.session_id)
    .eq("user_id", row.user_id)
    .eq("place_id", row.place_id);
  if (!updateError) return;
  if (updateError.code === CHECK_VIOLATION) throw new SwipeWriteError("No vetoes left.", "no_vetoes");
  throw new SwipeWriteError(updateError.message, "other");
}
