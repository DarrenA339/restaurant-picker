/**
 * Proves the row-level security and grants from docs/SPEC.md ("Tables") with
 * two anonymous users:
 *
 *   - swipes: each writes their own, and neither can read, write, or change the
 *     other's (tallies stay hidden by the database).
 *   - adds and ballots: each reads only their own rows, and neither can write
 *     them at all (they are server-written).
 *   - vetoes: the trigger on swipes rejects a third veto per member per session,
 *     via insert or update, and refunds a veto that is changed back.
 *   - the `anon` role has no table access, and server-owned columns can't be
 *     written from a client.
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

// Dealt suggestions (batch 1) ...
const PLACE_1 = "rls-check-place-1";
const PLACE_2 = "rls-check-place-2";
const PLACE_3 = "rls-check-place-3";
const PLACE_4 = "rls-check-place-4";
// ... and two member adds still waiting in the lobby (no batch yet).
const ADD_A = "rls-check-add-a";
const ADD_B = "rls-check-add-b";

const PERMISSION_DENIED = "42501";
const CHECK_VIOLATION = "23514"; // what the veto trigger and the ballot shape check raise

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

async function vetoesLeft(client: Client, sessionId: string, userId: string) {
  const { data, error } = await client
    .from("members")
    .select("vetoes_left")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .single();
  return error ? error : data.vetoes_left;
}

async function main() {
  const admin = makeClient(secretKey);
  const anonRole = makeClient(publishableKey); // never signs in: Postgres role `anon`

  console.log("Supabase RLS check");
  console.log(`  project: ${url}\n`);

  console.log("anon role (publishable key, no sign-in)");
  for (const table of ["sessions", "swipes", "adds", "ballots"] as const) {
    const { error } = await anonRole.from(table).select("*").limit(1);
    check(
      `cannot read ${table} at all (permission denied)`,
      error?.code === PERMISSION_DENIED,
      error ?? "no error",
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
      .select("id, suggestions_on, voting_method")
      .single();
    if (sessionError) fatal("create session", sessionError);
    sessionId = session.id;
    check(
      "a new session defaults to suggestions on and Borda",
      session.suggestions_on === true && session.voting_method === "borda",
      session,
    );

    const { error: restaurantsError } = await admin.from("restaurants").insert([
      { session_id: sessionId, place_id: PLACE_1, source: "suggested", batch: 1, data: { name: "Place One" } },
      { session_id: sessionId, place_id: PLACE_2, source: "suggested", batch: 1, data: { name: "Place Two" } },
      { session_id: sessionId, place_id: PLACE_3, source: "suggested", batch: 1, data: { name: "Place Three" } },
      { session_id: sessionId, place_id: PLACE_4, source: "suggested", batch: 1, data: { name: "Place Four" } },
      { session_id: sessionId, place_id: ADD_A, source: "member", batch: null, data: { name: "A's add" } },
      { session_id: sessionId, place_id: ADD_B, source: "member", batch: null, data: { name: "B's add" } },
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
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }
    {
      const { error } = await a.client
        .from("sessions")
        .update({ voting_method: "plurality", suggestions_on: false })
        .eq("id", sessionId);
      check(
        "host A cannot change voting_method or suggestions_on directly (goes through PATCH)",
        error?.code === PERMISSION_DENIED,
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
        error?.code === PERMISSION_DENIED,
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
        error?.code === PERMISSION_DENIED,
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
        error?.code === PERMISSION_DENIED,
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
        error?.code === PERMISSION_DENIED,
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
        error?.code === PERMISSION_DENIED,
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

    // --- vetoes: the trigger on swipes --------------------------------------
    console.log("\nvetoes (trigger on swipes)");
    {
      check("B starts with 2 vetoes", (await vetoesLeft(b.client, sessionId, b.id)) === 2);
    }
    {
      const { error } = await b.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_2, value: "veto" });
      check("B's first veto is accepted", !error, error);
      const { error: error2 } = await b.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_3, value: "veto" });
      check("B's second veto is accepted", !error2, error2);
      const left = await vetoesLeft(b.client, sessionId, b.id);
      check("B now has 0 vetoes left (trigger decremented vetoes_left)", left === 0, left);
    }
    {
      const { error } = await b.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_4, value: "veto" });
      check(
        "B's third veto (insert) is rejected by the trigger",
        error?.code === CHECK_VIOLATION && /veto/i.test(error.message),
        error ?? "no error",
      );
    }
    {
      const { error } = await b.client
        .from("swipes")
        .update({ value: "veto" })
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .eq("place_id", PLACE_1);
      check(
        "B's third veto (changing a 'no' to veto) is rejected by the trigger",
        error?.code === CHECK_VIOLATION && /veto/i.test(error.message),
        error ?? "no error",
      );
      const { data: truth } = await admin
        .from("swipes")
        .select("value")
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .eq("place_id", PLACE_1)
        .single();
      check("that swipe is still 'no' (checked with the secret key)", truth?.value === "no", truth);
    }
    {
      const { data, error } = await b.client
        .from("swipes")
        .update({ value: "veto" })
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .eq("place_id", PLACE_2)
        .select("value");
      const left = await vetoesLeft(b.client, sessionId, b.id);
      check(
        "re-saving an existing veto as veto spends nothing",
        !error && data?.[0]?.value === "veto" && left === 0,
        error ?? { data, left },
      );
    }
    {
      const { error } = await b.client
        .from("swipes")
        .update({ value: "no" })
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .eq("place_id", PLACE_2);
      const left = await vetoesLeft(b.client, sessionId, b.id);
      check("changing a veto to 'no' refunds it (1 left)", !error && left === 1, error ?? left);
      const { error: error2 } = await b.client
        .from("swipes")
        .insert({ session_id: sessionId, user_id: b.id, place_id: PLACE_4, value: "veto" });
      const left2 = await vetoesLeft(b.client, sessionId, b.id);
      check("the refunded veto can be spent again (0 left)", !error2 && left2 === 0, error2 ?? left2);
    }
    {
      const { data } = await admin
        .from("swipes")
        .select("place_id")
        .eq("session_id", sessionId)
        .eq("user_id", b.id)
        .eq("value", "veto");
      check("the secret key sees exactly 2 vetoes from B", data?.length === 2, data);
      check(
        "A's vetoes are untouched by B's (per member)",
        (await vetoesLeft(a.client, sessionId, a.id)) === 2,
      );
    }

    // --- restaurants ---------------------------------------------------------
    console.log("\nrestaurants");
    {
      const { data } = await a.client
        .from("restaurants")
        .select("place_id, source, batch")
        .eq("session_id", sessionId);
      check("A reads every spot in the session (dealt and not)", data?.length === 6, data);
      const undealt = data?.filter((row) => row.batch === null) ?? [];
      check(
        "the two lobby adds have source 'member' and no batch yet",
        undealt.length === 2 && undealt.every((row) => row.source === "member"),
        undealt,
      );
    }
    {
      const { error } = await a.client
        .from("restaurants")
        .insert({ session_id: sessionId, place_id: "rls-check-place-x", source: "member", data: {} });
      check(
        "A cannot insert a restaurant row (no grant; adds go through the add route)",
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }

    // --- adds ----------------------------------------------------------------
    console.log("\nadds");
    {
      const { error } = await admin.from("adds").insert([
        { session_id: sessionId, user_id: a.id, place_id: ADD_A },
        { session_id: sessionId, user_id: b.id, place_id: ADD_B },
      ]);
      if (error) fatal("create adds", error);
    }
    {
      const { data } = await a.client
        .from("adds")
        .select("user_id, place_id")
        .eq("session_id", sessionId);
      check(
        "A reads exactly one add, and it is their own",
        data?.length === 1 && data[0]?.user_id === a.id && data[0]?.place_id === ADD_A,
        data,
      );
    }
    {
      const { data } = await b.client
        .from("adds")
        .select("user_id, place_id")
        .eq("session_id", sessionId);
      check(
        "B reads exactly one add, and it is their own",
        data?.length === 1 && data[0]?.user_id === b.id && data[0]?.place_id === ADD_B,
        data,
      );
    }
    {
      const { data } = await a.client
        .from("adds")
        .select("place_id")
        .eq("session_id", sessionId)
        .eq("place_id", ADD_B);
      check("A asking who added B's spot gets nothing", data?.length === 0, data);
    }
    {
      const { error } = await a.client
        .from("adds")
        .insert({ session_id: sessionId, user_id: a.id, place_id: PLACE_1 });
      check(
        "A cannot insert an add directly (no grant)",
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }
    {
      const { error } = await a.client
        .from("adds")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", a.id);
      check(
        "A cannot delete their own add directly (no grant; goes through the route)",
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }
    {
      const { data } = await admin.from("adds").select("user_id").eq("session_id", sessionId);
      check("the secret key sees both adds (server deal path)", data?.length === 2, data);
    }

    // --- ballots -------------------------------------------------------------
    console.log("\nballots");
    {
      const { error } = await admin
        .from("ballots")
        .insert({ session_id: sessionId, user_id: a.id, payload: { ordering: [PLACE_1, PLACE_2] } });
      if (error) fatal("create ballot", error);
    }
    {
      const { data } = await a.client
        .from("ballots")
        .select("user_id, payload")
        .eq("session_id", sessionId);
      check(
        "A reads exactly one ballot, and it is their own",
        data?.length === 1 && data[0]?.user_id === a.id,
        data,
      );
    }
    {
      const { data } = await b.client
        .from("ballots")
        .select("user_id")
        .eq("session_id", sessionId);
      check("B cannot see A's ballot", data?.length === 0, data);
    }
    {
      const { error } = await b.client
        .from("ballots")
        .insert({ session_id: sessionId, user_id: b.id, payload: { pick: PLACE_1 } });
      check(
        "B cannot insert their own ballot directly (no grant; goes through the ballot route)",
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }
    {
      const { error } = await a.client
        .from("ballots")
        .update({ payload: { pick: PLACE_2 } })
        .eq("session_id", sessionId)
        .eq("user_id", a.id);
      check(
        "A cannot update their own ballot directly (no grant)",
        error?.code === PERMISSION_DENIED,
        error ?? "no error",
      );
    }
    {
      const { error } = await admin
        .from("ballots")
        .insert({ session_id: sessionId, user_id: b.id, payload: { pick: PLACE_1, ordering: [] } });
      check(
        "even the secret key cannot store a ballot with two shapes (check constraint)",
        error?.code === CHECK_VIOLATION,
        error ?? "no error",
      );
    }

    // --- results -------------------------------------------------------------
    console.log("\nresults");
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
        writeError?.code === PERMISSION_DENIED,
        writeError ?? "no error",
      );
    }

    // --- the private helpers are not reachable over REST ---------------------
    console.log("\nhelper functions");
    for (const [fn, body] of [
      ["is_session_member", { sid: sessionId }],
      ["enforce_veto_limit", {}],
    ] as const) {
      const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${a.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      check(
        `${fn} is not callable over REST (got ${response.status})`,
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
