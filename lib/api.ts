import { NextResponse } from "next/server";

/** Session ids and autocomplete session tokens are UUIDs. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Google place ids: URL-safe characters (in practice 20 to 300 long). */
export const PLACE_ID = /^[A-Za-z0-9_-]{1,300}$/;

/**
 * A JSON error response. `code` is for the few errors a client reacts to
 * differently (a duplicate add is "already added", not a failure).
 */
export function bad(error: string, status = 400, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status });
}
