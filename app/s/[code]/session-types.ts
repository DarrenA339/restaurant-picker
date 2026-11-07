import type { Tables } from "@/lib/database.types";

/** The session columns the client views need. */
export type SessionView = Pick<
  Tables<"sessions">,
  | "id"
  | "code"
  | "name"
  | "status"
  | "host_id"
  | "voting_method"
  | "suggestions_on"
  | "filters"
  | "center_lat"
  | "center_lng"
  | "batch"
>;

export const SESSION_VIEW_COLUMNS =
  "id, code, name, status, host_id, voting_method, suggestions_on, filters, center_lat, center_lng, batch";

/** The member columns everyone in the session may see. */
export type MemberView = Pick<
  Tables<"members">,
  "user_id" | "display_name" | "color" | "lat" | "lng"
>;

export const MEMBER_VIEW_COLUMNS = "user_id, display_name, color, lat, lng";
