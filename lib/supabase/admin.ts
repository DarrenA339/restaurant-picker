import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabasePublicEnv } from "./env";

/**
 * The server's Supabase client with the secret key. Bypasses RLS, so it is
 * only for route handlers and server components that decide an outcome or
 * need rows the visitor can't see (tallies, who added what, a session a
 * friend hasn't joined yet).
 */
export function supabaseAdmin() {
  const { url } = supabasePublicEnv();
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing SUPABASE_SECRET_KEY");
  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
