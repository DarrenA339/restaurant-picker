import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabasePublicEnv } from "./env";

/**
 * The browser's Supabase client (publishable key, RLS applies). Sessions are
 * stored in cookies so server components and route handlers can read them.
 */
export function supabaseBrowser() {
  const { url, publishableKey } = supabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}

/**
 * Returns a user the server will accept, signing in anonymously if needed.
 *
 * Reusing an existing session matters: a fresh anonymous user would lose the
 * member rows the old one owns. But a saved session can point at a user that
 * no longer exists (deleted from the project while the cookie lived on), and
 * the server rejects those with 401. So the saved session is checked with
 * the Auth server first; if it's dead, it's dropped locally and replaced.
 */
export async function ensureSignedIn(options: { fresh?: boolean } = {}) {
  const supabase = supabaseBrowser();

  if (!options.fresh) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (user && !error) return user;
    }
  }

  // Stale or missing: clear the local cookies (the server would refuse a
  // sign-out for a deleted user anyway) and start a new anonymous user.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not sign in");
  }
  return data.user;
}
