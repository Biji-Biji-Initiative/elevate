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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          code: string
          default_points: number
          name: string
        }
        Insert: {
          code: string
          default_points: number
          name: string
        }
        Update: {
          code?: string
          default_points?: number
          name?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          meta: Json | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id: string
          meta?: Json | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          code: string
          criteria: Json
          description: string
          icon_url: string | null
          name: string
        }
        Insert: {
          code: string
          criteria: Json
          description: string
          icon_url?: string | null
          name: string
        }
        Update: {
          code?: string
          criteria?: Json
          description?: string
          icon_url?: string | null
          name?: string
        }
        Relationships: []
      }
      earned_badges: {
        Row: {
          badge_code: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          id: string
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earned_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "earned_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_30d"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earned_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earned_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      kajabi_events: {
        Row: {
          id: string
          payload: Json
          processed_at: string | null
          received_at: string
          user_match: string | null
        }
        Insert: {
          id: string
          payload: Json
          processed_at?: string | null
          received_at?: string
          user_match?: string | null
        }
        Update: {
          id?: string
          payload?: Json
          processed_at?: string | null
          received_at?: string
          user_match?: string | null
        }
        Relationships: []
      }
      points_ledger: {
        Row: {
          activity_code: string
          created_at: string
          delta_points: number
          external_event_id: string | null
          external_source: string | null
          id: string
          source: Database["public"]["Enums"]["LedgerSource"]
          user_id: string
        }
        Insert: {
          activity_code: string
          created_at?: string
          delta_points: number
          external_event_id?: string | null
          external_source?: string | null
          id: string
          source: Database["public"]["Enums"]["LedgerSource"]
          user_id: string
        }
        Update: {
          activity_code?: string
          created_at?: string
          delta_points?: number
          external_event_id?: string | null
          external_source?: string | null
          id?: string
          source?: Database["public"]["Enums"]["LedgerSource"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_activity_code_fkey"
            columns: ["activity_code"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "points_ledger_activity_code_fkey"
            columns: ["activity_code"]
            isOneToOne: false
            referencedRelation: "metric_counts"
            referencedColumns: ["activity_code"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_30d"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          activity_code: string
          created_at: string
          id: string
          payload: Json
          review_note: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["SubmissionStatus"]
          updated_at: string
          user_id: string
          visibility: Database["public"]["Enums"]["Visibility"]
        }
        Insert: {
          activity_code: string
          created_at?: string
          id: string
          payload: Json
          review_note?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["SubmissionStatus"]
          updated_at: string
          user_id: string
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Update: {
          activity_code?: string
          created_at?: string
          id?: string
          payload?: Json
          review_note?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["SubmissionStatus"]
          updated_at?: string
          user_id?: string
          visibility?: Database["public"]["Enums"]["Visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "submissions_activity_code_fkey"
            columns: ["activity_code"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "submissions_activity_code_fkey"
            columns: ["activity_code"]
            isOneToOne: false
            referencedRelation: "metric_counts"
            referencedColumns: ["activity_code"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_30d"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_totals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          cohort: string | null
          created_at: string
          email: string
          handle: string
          id: string
          kajabi_contact_id: string | null
          name: string
          role: Database["public"]["Enums"]["Role"]
          school: string | null
        }
        Insert: {
          avatar_url?: string | null
          cohort?: string | null
          created_at?: string
          email: string
          handle: string
          id: string
          kajabi_contact_id?: string | null
          name: string
          role?: Database["public"]["Enums"]["Role"]
          school?: string | null
        }
        Update: {
          avatar_url?: string | null
          cohort?: string | null
          created_at?: string
          email?: string
          handle?: string
          id?: string
          kajabi_contact_id?: string | null
          name?: string
          role?: Database["public"]["Enums"]["Role"]
          school?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_30d: {
        Row: {
          activities_completed: number | null
          avatar_url: string | null
          handle: string | null
          id: string | null
          last_activity_date: string | null
          name: string | null
          school: string | null
          total_points: number | null
        }
        Relationships: []
      }
      leaderboard_totals: {
        Row: {
          activities_completed: number | null
          avatar_url: string | null
          handle: string | null
          id: string | null
          last_activity_date: string | null
          name: string | null
          school: string | null
          total_points: number | null
        }
        Relationships: []
      }
      metric_counts: {
        Row: {
          activity_code: string | null
          activity_name: string | null
          approved_count: number | null
          pending_count: number | null
          rejected_count: number | null
          total_submissions: number | null
          unique_participants: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_evidence_url: {
        Args: { file_path: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["Role"]
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_actor_id: string
          p_meta?: Json
          p_target_id?: string
        }
        Returns: undefined
      }
      refresh_leaderboards: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_leaderboards_concurrent: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      LedgerSource: "MANUAL" | "WEBHOOK" | "FORM"
      Role: "PARTICIPANT" | "REVIEWER" | "ADMIN" | "SUPERADMIN"
      SubmissionStatus: "PENDING" | "APPROVED" | "REJECTED"
      Visibility: "PUBLIC" | "PRIVATE"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      LedgerSource: ["MANUAL", "WEBHOOK", "FORM"],
      Role: ["PARTICIPANT", "REVIEWER", "ADMIN", "SUPERADMIN"],
      SubmissionStatus: ["PENDING", "APPROVED", "REJECTED"],
      Visibility: ["PUBLIC", "PRIVATE"],
    },
  },
} as const