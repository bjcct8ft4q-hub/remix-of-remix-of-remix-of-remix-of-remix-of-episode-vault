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
      admin_bootstrap: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          claimed_by: string | null
          id: boolean
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          id?: boolean
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          claimed_by?: string | null
          id?: boolean
        }
        Relationships: []
      }
      comments: {
        Row: {
          body: string
          created_at: string
          episode_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          episode_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          episode_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_catalog: {
        Row: {
          air_date: string | null
          created_at: string
          id: string
          import_locked: boolean
          number: number
          released: boolean
          series_id: string
          thumbnail_path: string | null
          title: string | null
          season_number: number | null
          season_episode_number: number | null
          description: string | null
          tmdb_episode_id: number | null
        }
        Insert: {
          air_date?: string | null
          created_at?: string
          id?: string
          import_locked?: boolean
          number: number
          released?: boolean
          series_id: string
          thumbnail_path?: string | null
          title?: string | null
          season_number?: number | null
          season_episode_number?: number | null
          description?: string | null
          tmdb_episode_id?: number | null
        }
        Update: {
          air_date?: string | null
          created_at?: string
          id?: string
          import_locked?: boolean
          number?: number
          released?: boolean
          series_id?: string
          thumbnail_path?: string | null
          title?: string | null
          season_number?: number | null
          season_episode_number?: number | null
          description?: string | null
          tmdb_episode_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_catalog_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          air_date: string | null
          created_at: string
          dub_video_path: string | null
          id: string
          number: number
          series_id: string
          thumbnail_path: string | null
          title: string | null
          video_path: string
        }
        Insert: {
          air_date?: string | null
          created_at?: string
          dub_video_path?: string | null
          id?: string
          number: number
          series_id: string
          thumbnail_path?: string | null
          title?: string | null
          video_path: string
        }
        Update: {
          air_date?: string | null
          created_at?: string
          dub_video_path?: string | null
          id?: string
          number?: number
          series_id?: string
          thumbnail_path?: string | null
          title?: string | null
          video_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      import_cache: {
        Row: {
          expires_at: string
          key: string
          response: Json
        }
        Insert: {
          expires_at: string
          key: string
          response: Json
        }
        Update: {
          expires_at?: string
          key?: string
          response?: Json
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          episodes_added: number
          error: string | null
          finished_at: string | null
          id: string
          selection: string
          series_added: number
          started_at: string
          status: string
        }
        Insert: {
          episodes_added?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          selection: string
          series_added?: number
          started_at?: string
          status?: string
        }
        Update: {
          episodes_added?: number
          error?: string | null
          finished_at?: string | null
          id?: string
          selection?: string
          series_added?: number
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      import_settings: {
        Row: {
          enabled: boolean
          id: boolean
          last_success_at: string | null
          lock_until: string | null
          retry_after: string | null
          selection: string
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          last_success_at?: string | null
          lock_until?: string | null
          retry_after?: string | null
          selection?: string
        }
        Update: {
          enabled?: boolean
          id?: boolean
          last_success_at?: string | null
          lock_until?: string | null
          retry_after?: string | null
          selection?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          username?: string | null
        }
        Relationships: []
      }
      series: {
        Row: {
          anilist_id: number | null
          tmdb_id: number | null
          banner_url: string | null
          country: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          genres: string[]
          id: string
          import_locked: boolean
          premiered: string | null
          score: number | null
          start_date: string | null
          status: string | null
          studios: string[]
          title: string
          title_english: string | null
          title_japanese: string | null
          total_episodes: number | null
          type: string | null
        }
        Insert: {
          anilist_id?: number | null
          tmdb_id?: number | null
          banner_url?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genres?: string[]
          id?: string
          import_locked?: boolean
          premiered?: string | null
          score?: number | null
          start_date?: string | null
          status?: string | null
          studios?: string[]
          title: string
          title_english?: string | null
          title_japanese?: string | null
          total_episodes?: number | null
          type?: string | null
        }
        Update: {
          anilist_id?: number | null
          banner_url?: string | null
          country?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          genres?: string[]
          id?: string
          import_locked?: boolean
          premiered?: string | null
          score?: number | null
          start_date?: string | null
          status?: string | null
          studios?: string[]
          title?: string
          title_english?: string | null
          title_japanese?: string | null
          total_episodes?: number | null
          type?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_import_run: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
