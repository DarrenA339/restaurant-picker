"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RestaurantRow } from "@/lib/restaurants";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  MEMBER_VIEW_COLUMNS,
  SESSION_VIEW_COLUMNS,
  type MemberView,
  type SessionView,
} from "./session-types";

type Args = {
  initialSession: SessionView;
  initialMembers: MemberView[];
  /** The session's spots as the server read them, so the list starts full. */
  initialRestaurants?: RestaurantRow[];
  /** place_ids of the viewer's own adds, likewise. */
  initialMyAddIds?: string[];
};

/**
 * Keeps the session, its members, and its restaurants fresh over Realtime.
 *
 * Every Postgres Changes event triggers a refetch of that table through RLS
 * rather than patching state from the payload: DELETE events aren't filtered
 * by RLS and carry only the old row's keys, and a refetch is also what keeps
 * two phones from drifting. The subscription's own SUBSCRIBED callback
 * refetches everything once, so nothing that happened between the server
 * render and the socket opening is missed.
 *
 * When the session leaves the lobby (or disappears), the server gate owns the
 * next view, so this calls router.refresh() and lets it decide.
 *
 * `adds` is not in the publication (and a member only reads their own rows),
 * so after the viewer's own add or remove the screen calls
 * refetchRestaurants() itself: joining a spot someone else already added
 * changes no restaurants row and would otherwise go unnoticed.
 */
export function useSessionLive({
  initialSession,
  initialMembers,
  initialRestaurants = [],
  initialMyAddIds = [],
}: Args) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const sessionId = initialSession.id;

  const [session, setSession] = useState<SessionView>(initialSession);
  const [members, setMembers] = useState<MemberView[]>(initialMembers);
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>(initialRestaurants);
  const [myAddIds, setMyAddIds] = useState<ReadonlySet<string>>(() => new Set(initialMyAddIds));
  const [connected, setConnected] = useState(true);
  const statusRef = useRef(initialSession.status);

  const refetchSession = useCallback(async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select(SESSION_VIEW_COLUMNS)
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return;
    if (!data || data.status !== statusRef.current) {
      // Gone, or moved on: the server picks the next view.
      router.refresh();
      return;
    }
    setSession(data);
  }, [router, sessionId, supabase]);

  const refetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from("members")
      .select(MEMBER_VIEW_COLUMNS)
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true });
    if (!error && data) setMembers(data);
  }, [sessionId, supabase]);

  const refetchRestaurants = useCallback(async () => {
    const [rows, adds] = await Promise.all([
      supabase
        .from("restaurants")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
      // RLS returns only the caller's own adds, which is all this needs.
      supabase.from("adds").select("place_id").eq("session_id", sessionId),
    ]);
    if (!rows.error && rows.data) setRestaurants(rows.data);
    if (!adds.error && adds.data) {
      setMyAddIds(new Set(adds.data.map((row) => row.place_id)));
    }
  }, [sessionId, supabase]);

  useEffect(() => {
    let cancelled = false;
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members", filter: `session_id=eq.${sessionId}` },
        () => void refetchMembers(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        () => void refetchSession(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "restaurants", filter: `session_id=eq.${sessionId}` },
        () => void refetchRestaurants(),
      );

    // Realtime applies RLS with the socket's token, so make sure the auth
    // session is loaded (and the token handed to Realtime) before joining.
    void supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          void refetchSession();
          void refetchMembers();
          void refetchRestaurants();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setConnected(false);
        }
      });
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [refetchMembers, refetchRestaurants, refetchSession, sessionId, supabase]);

  /** Optimistic local update for the host's own PATCH results. */
  const applySession = useCallback((changes: Partial<SessionView>) => {
    setSession((current) => ({ ...current, ...changes }));
  }, []);

  return {
    session,
    members,
    restaurants,
    myAddIds,
    connected,
    applySession,
    refetchSession,
    refetchMembers,
    refetchRestaurants,
  };
}
