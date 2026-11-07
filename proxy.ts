import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublicEnv } from "@/lib/supabase/env";

/**
 * Refreshes the visitor's Supabase session on every page request and writes
 * the new tokens back to cookies. Server Components can't set cookies, so
 * without this an expired anonymous session would look signed-out to the
 * server and a member would be asked to join again as a brand-new user.
 */
export async function proxy(request: NextRequest) {
  const { url, publishableKey } = supabasePublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Loads the session from cookies and refreshes it if the token expired.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
