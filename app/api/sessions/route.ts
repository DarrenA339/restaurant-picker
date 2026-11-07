import { NextResponse } from "next/server";
import { randomJoinCode } from "@/lib/join-code";
import { parseFilters } from "@/lib/session-filters";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

const MAX_NAME = 60;
const MAX_HOST_NAME = 40;
const HOST_COLOR = 1;
const CODE_ATTEMPTS = 5;

type LatLng = { lat: number; lng: number };

function parseCenter(input: unknown): LatLng | null | undefined {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object") return undefined;
  const { lat, lng } = input as Record<string, unknown>;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return undefined;
  }
  return { lat, lng };
}

/** Rounds to about 100 m, the same as join_session does for members. */
function rough(value: number) {
  return Math.round(value * 1000) / 1000;
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

/**
 * POST /api/sessions: creates the session, its join code, and the host's
 * member row (person color 1). The caller must be signed in (anonymously is
 * fine); the cookie session identifies the host.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return bad("Send a JSON body.");

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME) {
    return bad("Give the session a name (up to 60 characters).");
  }

  const hostName = typeof body.hostName === "string" ? body.hostName.trim() : "";
  if (hostName.length < 1 || hostName.length > MAX_HOST_NAME) {
    return bad("Tell friends your name (up to 40 characters).");
  }

  const filters = parseFilters(body.filters);
  if (!filters) return bad("Those filters don't look right.");

  const center = parseCenter(body.center);
  if (center === undefined) return bad("That location doesn't look right.");

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Sign in first.", 401);

  const admin = supabaseAdmin();
  const lat = center ? rough(center.lat) : null;
  const lng = center ? rough(center.lng) : null;

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const { data: session, error } = await admin
      .from("sessions")
      .insert({
        code: randomJoinCode(),
        host_id: user.id,
        name,
        filters,
        center_lat: center?.lat ?? null,
        center_lng: center?.lng ?? null,
      })
      .select("id, code")
      .single();

    if (error?.code === "23505") continue; // code collision: try another
    if (error || !session) {
      console.error("create session failed", error);
      return bad("Couldn't create the session. Try again.", 500);
    }

    const { error: memberError } = await admin.from("members").insert({
      session_id: session.id,
      user_id: user.id,
      display_name: hostName,
      color: HOST_COLOR,
      lat,
      lng,
    });
    if (memberError) {
      console.error("create host member failed", memberError);
      await admin.from("sessions").delete().eq("id", session.id);
      return bad("Couldn't create the session. Try again.", 500);
    }

    return NextResponse.json({ id: session.id, code: session.code }, { status: 201 });
  }

  return bad("Couldn't find a free join code. Try again.", 500);
}
