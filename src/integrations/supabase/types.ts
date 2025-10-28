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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_county_preferences: {
        Row: {
          agent_id: string
          county_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          agent_id: string
          county_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          agent_id?: string
          county_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_county_preferences_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_county_preferences_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          receive_buyer_alerts: boolean | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      buyer_needs: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          county_id: string
          created_at: string | null
          description: string | null
          id: string
          max_price: number
          property_type: Database["public"]["Enums"]["property_type"]
          submitted_by: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          county_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_price: number
          property_type: Database["public"]["Enums"]["property_type"]
          submitted_by: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          county_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_needs_county_id_fkey"
            columns: ["county_id"]
            isOneToOne: false
            referencedRelation: "counties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_needs_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      counties: {
        Row: {
          created_at: string | null
          id: string
          name: string
          state: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          state?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          state?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string
          agent_id: string
          attom_data: Json | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          lot_size: number | null
          price: number
          property_type: string | null
          schools_data: Json | null
          square_feet: number | null
          state: string
          status: string
          updated_at: string
          value_estimate: Json | null
          walk_score_data: Json | null
          year_built: number | null
          zip_code: string
        }
        Insert: {
          address: string
          agent_id: string
          attom_data?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lot_size?: number | null
          price: number
          property_type?: string | null
          schools_data?: Json | null
          square_feet?: number | null
          state: string
          status?: string
          updated_at?: string
          value_estimate?: Json | null
          walk_score_data?: Json | null
          year_built?: number | null
          zip_code: string
        }
        Update: {
          address?: string
          agent_id?: string
          attom_data?: Json | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          lot_size?: number | null
          price?: number
          property_type?: string | null
          schools_data?: Json | null
          square_feet?: number | null
          state?: string
          status?: string
          updated_at?: string
          value_estimate?: Json | null
          walk_score_data?: Json | null
          year_built?: number | null
          zip_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      property_type:
        | "single_family"
        | "condo"
        | "townhouse"
        | "multi_family"
        | "land"
        | "commercial"
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
      property_type: [
        "single_family",
        "condo",
        "townhouse",
        "multi_family",
        "land",
        "commercial",
      ],
    },
  },
} as const
