import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabasePublicEnv } from "./env";

/**
 * A per-request Supabase client that acts as the visitor (publishable key,
 * their cookie session, RLS applies). Reading cookies is a request-time read,
 * so anything that calls this must sit behind <Suspense> in a page.
 */
export async function supabaseServer() {
  const { url, publishableKey } = supabasePublicEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the
          // session on each request instead, so this is safe to ignore.
        }
      },
    },
  });
}
