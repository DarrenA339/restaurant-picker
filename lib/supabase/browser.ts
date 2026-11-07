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
 * Returns the signed-in user, signing in anonymously first if there is none.
 * Reusing an existing session matters: a fresh anonymous user would lose the
 * member rows the old one owns.
 */
export async function ensureSignedIn() {
  const supabase = supabaseBrowser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not sign in");
  }
  return data.user;
}
