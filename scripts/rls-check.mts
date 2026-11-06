/**
 * Proves the row-level security on `swipes` (and the tables around it) with two
 * anonymous users: each writes their own swipe, and neither can read, write, or
 * change the other's. Also checks that the `anon` role has no table access and
 * that server-owned columns can't be written from a client.
 *
 *   npm run rls:check
 *   (= node --env-file=.env.local scripts/rls-check.mts)
 *
 * Needs "Allow anonymous sign-ins" enabled on the Supabase project. Creates two
 * throwaway auth users and one session, and deletes them all at the end.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secretKey = requireEnv("SUPABASE_SECRET_KEY");

const PLACE_1 = "rls-check-place-1";
const PLACE_2 = "rls-check-place-2";

let failures = 0;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `Missing ${name}. Run with: node --env-file=.env.local scripts/rls-check.mts`,
    );
    process.exit(1);
  }
  return value;
}

if (/\/rest\/v1\/?$/.test(url)) {
  console.error(
    `NEXT_PUBLIC_SUPABASE_URL must be the project base URL (https://<ref>.supabase.co), not ${url}`,
  );
  process.exit(1);
}

function makeClient(key: string): Client {
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}`);
  if (!ok) {
    failures += 1;
    if (detail !== undefined) console.log("        ", detail);
  }
}

function fatal(step: string, error: unknown): never {
  console.error(`Setup failed at "${step}":`, error);
  process.exit(1);
}

async function signInAnonymously(label: string) {
  const client = makeClient(publishableKey);
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user || !data.session) {
    console.error(
      `Anonymous sign-in failed for user ${label}: ${error?.message ?? "no user returned"}.`,
      'Is "Allow anonymous sign-ins" on under Authentication > Sign In / Providers?',
    );
    process.exit(1);
  }
  return { client, id: data.user.id, accessToken: data.session.access_token };
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function main() {
  const admin = makeClient(secretKey);
  const anonRole = makeClient(publishableKey); // never signs in: Postgres role `anon`

  console.log("Supabase RLS check");
  console.log(`  project: ${url}\n`);

  console.log("anon role (publishable key, no sign-in)");
  {
    const { error } = await anonRole.from("swipes").select("*").limit(1);
    check(
      "cannot read swipes at all (permission denied)",
      error?.code === "42501",
      error ?? "no error",
    );
    const { error: sessionsError } = await anonRole
      .from("sessions")
      .select("id")
      .limit(1);
    check(
      "cannot read sessions at all (permission denied)",
      sessionsError?.code === "42501",
      sessionsError ?? "no error",
    );
  }

  console.log("\nanonymous sign-in");
  const a = await signInAnonymously("A");
  const b = await signInAnonymously("B");
  check("two distinct anonymous users signed in", a.id !== b.id);

  let sessionId: string | undefined;

  try {
    // --- Setup with the secret key (what the server routes do) ---------------
    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .insert({ code: randomCode(), host_id: a.id, status: "swiping", batch: 1 })
      .select("id")
      .single();
    if (sessionError) fatal("create session", sessionError);
    sessionId = session.id;

    const { error: restaurantsError } = await admin.from("restaurants").insert([
      { session_id: sessionId, place_id: PLACE_1, batch: 1, data: { name: "Place One" } },
      { session_id: sessionId, place_id: PLACE_2, batch: 1, data: { name: "Place Two" } },
    ]);
    if (restaurantsError) fatal("create restaurants", restaurantsError);

    // --- sessions ------------------------------------------------------------
    console.log("\nsessions");
    {
      const { data } = await a.client.from("sessions").select("id").eq("id", sessionId);
      check("host A can read the session before joining", data?.length === 1, data);
    }
    {
      const { data } = await b.client.from("sessions").select("id").eq("id", sessionId);
      check("non-member B cannot see the session", data?.length === 0, data);
    }
    {
      const { error } = await a.client
        .from("sessions")
        .update({ status: "done" })
        .eq("id", sessionId);
      check(
        "host A cannot update the session (no grant)",
        error?.code === "42501",
        error ?? "no error",
      );
    }

    // --- members -------------------------------------------------------------
    console.log("\nmembers");
    {
      const { error } = await b.client
        .from("members")
        .insert({ session_id: sessionId, user_id: b.id, display_name: "B", vetoes_left: 99 });
      check(
        "B cannot join with extra vetoes (column privilege)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { data, error } = await b.client
        .from("members")
        .insert({ session_id: sessionId, user_id: b.id, display_name: "B" })
        .select("display_name, vetoes_left")
        .single();
      check(
        "B can insert their own member row (join) and read it back",
        !error && data?.display_name === "B" && data.vetoes_left === 2,
        error ?? data,
      );
    }
    {
      const { error } = await b.client
        .from("members")
        .insert({ session_id: sessionId, user_id: a.id, display_name: "Fake A" });
      check(
        "B cannot insert a member row for A (RLS violation)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { error } = await a.client
        .from("members")
        .insert({ session_id: sessionId, user_id: a.id, display_name: "A" });
      check("A can insert their own member row (join)", !error, error);
    }
    {
      const { data } = await b.client.from("sessions").select("id").eq("id", sessionId);
      check("B can read the session once a member", data?.length === 1, data);
    }
    {
      const { data } = await a.client
        .from("members")
        .select("user_id")
        .eq("session_id", sessionId);
      check("A sees both members of the session", data?.length === 2, data);
    }
    {
      const { data, error } = await b.client
        .from("members")
        .update({ display_name: "B (renamed)" })
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .select("display_name");
      check(
        "B can update their own display_name",
        !error && data?.[0]?.display_name === "B (renamed)",
        error ?? data,
      );
    }
    {
      const { error } = await b.client
        .from("members")
        .update({ vetoes_left: 99 })
        .eq("session_id", sessionId)
        .eq("user_id", b.id);
      check(
        "B cannot update their own vetoes_left (column privilege)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { error } = await b.client
        .from("members")
        .update({ done_swiping: true })
        .eq("session_id", sessionId)
        .eq("user_id", b.id);
      check(
        "B cannot mark themselves done_swiping (column privilege)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { data, error } = await b.client
        .from("members")
        .update({ display_name: "Hijacked" })
        .eq("session_id", sessionId)
        .eq("user_id", a.id)
        .select("display_name");
      check("B updating A's row changes nothing", !error && data?.length === 0, error ?? data);
    }

    // --- swipes --------------------------------------------------------------
    console.log("\nswipes");
    {
      const { error } = await a.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: a.id, place_id: PLACE_1, value: "yes" });
      check("A can insert their own swipe", !error, error);
    }
    {
      const { error } = await b.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_1, value: "no" });
      check("B can insert their own swipe", !error, error);
    }
    {
      const { data } = await a.client
        .from("swipes")
        .select("user_id, value")
        .eq("session_id", sessionId);
      check(
        "A reads exactly one swipe, and it is their own",
        data?.length === 1 && data[0]?.user_id === a.id,
        data,
      );
    }
    {
      const { data } = await b.client
        .from("swipes")
        .select("user_id, value")
        .eq("session_id", sessionId);
      check(
        "B reads exactly one swipe, and it is their own",
        data?.length === 1 && data[0]?.user_id === b.id,
        data,
      );
    }
    {
      const { data } = await a.client
        .from("swipes")
        .select("value")
        .eq("session_id", sessionId)
        .eq("user_id", b.id);
      check("A asking for B's swipes by user_id gets nothing", data?.length === 0, data);
    }
    {
      const { error } = await a.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_2, value: "veto" });
      check(
        "A cannot insert a swipe as B (RLS violation)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { data, error } = await a.client
        .from("swipes")
        .update({ value: "veto" })
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .select("value");
      check("A updating B's swipe changes nothing", !error && data?.length === 0, error ?? data);
      const { data: truth } = await admin
        .from("swipes")
        .select("value")
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .single();
      check("B's swipe is still 'no' (checked with the secret key)", truth?.value === "no", truth);
    }
    {
      const { data, error } = await a.client
        .from("swipes")
        .update({ value: "no" })
        .eq("session_id", sessionId)
        .eq("user_id", a.id)
        .eq("place_id", PLACE_1)
        .select("value");
      check(
        "A can change their own swipe",
        !error && data?.[0]?.value === "no",
        error ?? data,
      );
    }
    {
      const { data } = await admin
        .from("swipes")
        .select("user_id")
        .eq("session_id", sessionId);
      check("the secret key sees both swipes (server tally path)", data?.length === 2, data);
    }

    // --- restaurants, rankings, results --------------------------------------
    console.log("\nrestaurants, rankings, results");
    {
      const { data } = await a.client
        .from("restaurants")
        .select("place_id")
        .eq("session_id", sessionId);
      check("A reads the session's dealt cards", data?.length === 2, data);
      const { error } = await a.client
        .from("restaurants")
        .insert({ session_id: sessionId, place_id: "rls-check-place-3", batch: 1, data: {} });
      check(
        "A cannot deal cards (no grant)",
        error?.code === "42501",
        error ?? "no error",
      );
    }
    {
      const { error } = await a.client
        .from("rankings")
        .insert({ session_id: sessionId, user_id: a.id, ordering: [PLACE_1, PLACE_2] });
      check("A can insert their own ranking", !error, error);
      const { data } = await b.client
        .from("rankings")
        .select("ordering")
        .eq("session_id", sessionId);
      check("B cannot see A's ranking", data?.length === 0, data);
    }
    {
      const { error } = await admin.from("results").insert({
        session_id: sessionId,
        finalists: [PLACE_1, PLACE_2],
        scores: { [PLACE_1]: 1, [PLACE_2]: 0 },
        winner_place_id: PLACE_1,
        runner_up_place_id: PLACE_2,
      });
      if (error) fatal("create result", error);
      const { data } = await b.client
        .from("results")
        .select("winner_place_id")
        .eq("session_id", sessionId);
      check("B reads the session's result", data?.[0]?.winner_place_id === PLACE_1, data);
      const { error: writeError } = await b.client
        .from("results")
        .insert({ session_id: sessionId, finalists: [] });
      check(
        "B cannot write results (no grant)",
        writeError?.code === "42501",
        writeError ?? "no error",
      );
    }

    // --- the membership helper is not reachable over REST --------------------
    console.log("\nhelper function");
    {
      const response = await fetch(`${url}/rest/v1/rpc/is_session_member`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${a.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sid: sessionId }),
      });
      check(
        `is_session_member is not callable over REST (got ${response.status})`,
        response.status === 404,
        await response.text(),
      );
    }
  } finally {
    console.log("\ncleanup");
    if (sessionId) {
      const { error } = await admin.from("sessions").delete().eq("id", sessionId);
      console.log(error ? `  failed to delete session: ${error.message}` : "  session deleted");
    }
    for (const user of [a, b]) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      console.log(
        error ? `  failed to delete user ${user.id}: ${error.message}` : `  user ${user.id} deleted`,
      );
    }
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
