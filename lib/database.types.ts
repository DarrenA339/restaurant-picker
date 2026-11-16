// Generated from the Supabase dev project with the MCP `generate_typescript_types`
// tool. Do not edit by hand: regenerate after every migration (see CLAUDE.md).
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      adds: {
        Row: {
          created_at: string
          place_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          place_id: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          place_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adds_session_id_place_id_fkey"
            columns: ["session_id", "place_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["session_id", "place_id"]
          },
          {
            foreignKeyName: "adds_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["session_id", "user_id"]
          },
        ]
      }
      ballots: {
        Row: {
          created_at: string
          payload: Json
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          payload: Json
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          payload?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["session_id", "user_id"]
          },
        ]
      }
      members: {
        Row: {
          color: number
          display_name: string
          done_ranking: boolean
          done_swiping: boolean
          joined_at: string
          lat: number | null
          lng: number | null
          session_id: string
          user_id: string
          vetoes_left: number
        }
        Insert: {
          color: number
          display_name: string
          done_ranking?: boolean
          done_swiping?: boolean
          joined_at?: string
          lat?: number | null
          lng?: number | null
          session_id: string
          user_id: string
          vetoes_left?: number
        }
        Update: {
          color?: number
          display_name?: string
          done_ranking?: boolean
          done_swiping?: boolean
          joined_at?: string
          lat?: number | null
          lng?: number | null
          session_id?: string
          user_id?: string
          vetoes_left?: number
        }
        Relationships: [
          {
            foreignKeyName: "members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photos: {
        Row: {
          created_at: string
          photos: Json
          place_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          photos: Json
          place_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          photos?: Json
          place_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          batch: number | null
          created_at: string
          data: Json
          place_id: string
          session_id: string
          source: Database["public"]["Enums"]["restaurant_source"]
        }
        Insert: {
          batch?: number | null
          created_at?: string
          data: Json
          place_id: string
          session_id: string
          source: Database["public"]["Enums"]["restaurant_source"]
        }
        Update: {
          batch?: number | null
          created_at?: string
          data?: Json
          place_id?: string
          session_id?: string
          source?: Database["public"]["Enums"]["restaurant_source"]
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          created_at: string
          finalists: string[]
          runner_up_place_id: string | null
          scores: Json
          session_id: string
          winner_place_id: string | null
        }
        Insert: {
          created_at?: string
          finalists: string[]
          runner_up_place_id?: string | null
          scores?: Json
          session_id: string
          winner_place_id?: string | null
        }
        Update: {
          created_at?: string
          finalists?: string[]
          runner_up_place_id?: string | null
          scores?: Json
          session_id?: string
          winner_place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          batch: number
          center_lat: number | null
          center_lng: number | null
          code: string
          created_at: string
          filters: Json
          host_id: string
          id: string
          name: string
          page_token: string | null
          search_body: Json | null
          status: Database["public"]["Enums"]["session_status"]
          suggestions_on: boolean
          voting_method: Database["public"]["Enums"]["voting_method"]
        }
        Insert: {
          batch?: number
          center_lat?: number | null
          center_lng?: number | null
          code: string
          created_at?: string
          filters?: Json
          host_id: string
          id?: string
          name: string
          page_token?: string | null
          search_body?: Json | null
          status?: Database["public"]["Enums"]["session_status"]
          suggestions_on?: boolean
          voting_method?: Database["public"]["Enums"]["voting_method"]
        }
        Update: {
          batch?: number
          center_lat?: number | null
          center_lng?: number | null
          code?: string
          created_at?: string
          filters?: Json
          host_id?: string
          id?: string
          name?: string
          page_token?: string | null
          search_body?: Json | null
          status?: Database["public"]["Enums"]["session_status"]
          suggestions_on?: boolean
          voting_method?: Database["public"]["Enums"]["voting_method"]
        }
        Relationships: []
      }
      swipes: {
        Row: {
          created_at: string
          place_id: string
          session_id: string
          user_id: string
          value: Database["public"]["Enums"]["swipe_value"]
        }
        Insert: {
          created_at?: string
          place_id: string
          session_id: string
          user_id: string
          value: Database["public"]["Enums"]["swipe_value"]
        }
        Update: {
          created_at?: string
          place_id?: string
          session_id?: string
          user_id?: string
          value?: Database["public"]["Enums"]["swipe_value"]
        }
        Relationships: [
          {
            foreignKeyName: "swipes_session_id_place_id_fkey"
            columns: ["session_id", "place_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["session_id", "place_id"]
          },
          {
            foreignKeyName: "swipes_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["session_id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      join_session: {
        Args: {
          p_code: string
          p_color?: number
          p_display_name: string
          p_lat?: number
          p_lng?: number
        }
        Returns: {
          id: string
          status: Database["public"]["Enums"]["session_status"]
        }[]
      }
    }
    Enums: {
      restaurant_source: "member" | "suggested"
      session_status: "lobby" | "swiping" | "deciding" | "ranking" | "done"
      swipe_value: "yes" | "no" | "veto"
      voting_method: "plurality" | "borda" | "quadratic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      restaurant_source: ["member", "suggested"],
      session_status: ["lobby", "swiping", "deciding", "ranking", "done"],
      swipe_value: ["yes", "no", "veto"],
      voting_method: ["plurality", "borda", "quadratic"],
    },
  },
} as const
