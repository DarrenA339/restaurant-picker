import type { Tables, TablesInsert } from "@/lib/database.types";
import { toRestaurantData, type GooglePlace, type PlacesPort } from "@/lib/places/place";
import type { RestaurantRow } from "@/lib/restaurants";

/**
 * The quiet cap on member adds per session (docs/SPEC.md "Open decisions").
 * Counted as member-source restaurant rows, i.e. cards in the deck: joining
 * a spot someone else already added makes no new card and is always allowed.
 */
export const MAX_ADDS = 40;

export type SessionStatus = Tables<"sessions">["status"];
export type RestaurantInsert = TablesInsert<"restaurants">;
export type AddInsert = TablesInsert<"adds">;

/**
 * The database side of adding and removing, small enough to fake in memory.
 * lib/supabase/add-store.ts implements it with the secret key.
 */
export type AddStore = {
  /** Member-source restaurant rows in the session (dealt or not). */
  countMemberSpots(sessionId: string): Promise<number>;
  findRestaurant(sessionId: string, placeId: string): Promise<RestaurantRow | null>;
  /** The inserted row, or null when the place was already in the session. */
  insertRestaurant(row: RestaurantInsert): Promise<RestaurantRow | null>;
  /** True when inserted, false when this member already added this place. */
  insertAdd(add: AddInsert): Promise<boolean>;
  /** Rows deleted (0 or 1). */
  deleteAdd(sessionId: string, userId: string, placeId: string): Promise<number>;
  /** Adds rows left for this place, from every member. */
  countAdds(sessionId: string, placeId: string): Promise<number>;
  /** Deletes the row only while it is an undealt member add; rows deleted. */
  deleteRestaurant(sessionId: string, placeId: string): Promise<number>;
};

export type AddDeps = { store: AddStore; places: PlacesPort };

export type AddInput = {
  sessionId: string;
  userId: string;
  placeId: string;
  /** The autocomplete session token, so Place Details ends that session. */
  sessionToken?: string;
  /** Read by the route through RLS, which also proves membership. */
  status: SessionStatus;
};

export type AddResult =
  | { ok: true; restaurant: RestaurantRow; joined: boolean }
  | { ok: false; code: "not_lobby" | "duplicate" | "cap" | "google" };

/**
 * Adds a spot for a member (docs/SPEC.md "Add spots"):
 *
 *   1. lobby only: adds close when the host starts picking;
 *   2. a place already in the session gets only an adds row, no Google call
 *      ("two members add the same spot: one card, a yes from both"), and the
 *      same member twice is a duplicate;
 *   3. the cap applies to new cards only;
 *   4. one Place Details call (with the session token), one photo if there
 *      is one, then the restaurant row and the adds row.
 *
 * Known races, accepted for a quiet cap: two adds at 39 can land 41, and an
 * add that passes the lobby check as the host taps Start lands with
 * batch = null, which the deal route's "remaining adds first" picks up.
 */
export async function addSpot(deps: AddDeps, input: AddInput): Promise<AddResult> {
  const { store, places } = deps;
  const { sessionId, userId, placeId, sessionToken, status } = input;
  const add: AddInsert = { session_id: sessionId, user_id: userId, place_id: placeId };

  if (status !== "lobby") return { ok: false, code: "not_lobby" };

  const existing = await store.findRestaurant(sessionId, placeId);
  if (existing) {
    if (!(await store.insertAdd(add))) return { ok: false, code: "duplicate" };
    return { ok: true, restaurant: existing, joined: true };
  }

  if ((await store.countMemberSpots(sessionId)) >= MAX_ADDS) return { ok: false, code: "cap" };

  let place: GooglePlace;
  try {
    place = await places.details(placeId, sessionToken);
  } catch (error) {
    console.error("place details failed", placeId, error);
    return { ok: false, code: "google" };
  }

  // A missing photo is a blank tile, never a failed add.
  let photoUri: string | null = null;
  const photoName = place.photos?.[0]?.name;
  if (photoName) {
    try {
      photoUri = await places.photoUri(photoName);
    } catch (error) {
      console.warn("place photo failed", placeId, error);
    }
  }

  const inserted = await store.insertRestaurant({
    session_id: sessionId,
    place_id: placeId,
    source: "member",
    batch: null,
    data: toRestaurantData(place, photoUri),
  });
  // null: another member added it between our lookup and now; join theirs.
  const restaurant = inserted ?? (await store.findRestaurant(sessionId, placeId));
  if (!restaurant) throw new Error(`restaurant ${placeId} vanished during add`);

  if (!(await store.insertAdd(add))) return { ok: false, code: "duplicate" };
  return { ok: true, restaurant, joined: inserted === null };
}

export type RemoveInput = {
  sessionId: string;
  userId: string;
  placeId: string;
  status: SessionStatus;
};

export type RemoveResult = { ok: true } | { ok: false; code: "not_lobby" | "not_found" };

/**
 * Removes one of the member's own adds. The card goes too when nobody else
 * added it. (Race, accepted: someone adding the same place in the same
 * instant can lose their fresh add to the cascade and just adds again.)
 */
export async function removeAdd(deps: Pick<AddDeps, "store">, input: RemoveInput): Promise<RemoveResult> {
  const { store } = deps;
  const { sessionId, userId, placeId, status } = input;

  if (status !== "lobby") return { ok: false, code: "not_lobby" };
  if ((await store.deleteAdd(sessionId, userId, placeId)) === 0) {
    return { ok: false, code: "not_found" };
  }
  if ((await store.countAdds(sessionId, placeId)) === 0) {
    await store.deleteRestaurant(sessionId, placeId);
  }
  return { ok: true };
}
