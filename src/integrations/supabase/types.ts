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
      agent_messages: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          listing_id: string
          message: string
          sender_email: string
          sender_name: string
          sender_phone: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          listing_id: string
          message: string
          sender_email: string
          sender_name: string
          sender_phone?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          sender_email?: string
          sender_name?: string
          sender_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_profiles: {
        Row: {
          aac_id: string
          bio: string | null
          buyer_incentives: string | null
          cell_phone: string | null
          company: string | null
          created_at: string | null
          email: string
          first_name: string
          headshot_url: string | null
          id: string
          last_name: string
          logo_url: string | null
          office_address: string | null
          office_name: string | null
          office_phone: string | null
          phone: string | null
          receive_buyer_alerts: boolean | null
          seller_incentives: string | null
          social_links: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          aac_id?: string
          bio?: string | null
          buyer_incentives?: string | null
          cell_phone?: string | null
          company?: string | null
          created_at?: string | null
          email: string
          first_name: string
          headshot_url?: string | null
          id: string
          last_name: string
          logo_url?: string | null
          office_address?: string | null
          office_name?: string | null
          office_phone?: string | null
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          seller_incentives?: string | null
          social_links?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          aac_id?: string
          bio?: string | null
          buyer_incentives?: string | null
          cell_phone?: string | null
          company?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          headshot_url?: string | null
          id?: string
          last_name?: string
          logo_url?: string | null
          office_address?: string | null
          office_name?: string | null
          office_phone?: string | null
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          seller_incentives?: string | null
          social_links?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      buyer_needs: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          county_id: string | null
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
          county_id?: string | null
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
          county_id?: string | null
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
      clients: {
        Row: {
          agent_id: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
      favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_comments: {
        Row: {
          comment: string
          created_at: string | null
          hot_sheet_id: string
          id: string
          listing_id: string
          updated_at: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          hot_sheet_id: string
          id?: string
          listing_id: string
          updated_at?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_comments_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_favorites: {
        Row: {
          created_at: string | null
          hot_sheet_id: string
          id: string
          listing_id: string
        }
        Insert: {
          created_at?: string | null
          hot_sheet_id: string
          id?: string
          listing_id: string
        }
        Update: {
          created_at?: string | null
          hot_sheet_id?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_favorites_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_sent_listings: {
        Row: {
          hot_sheet_id: string
          id: string
          listing_id: string
          sent_at: string | null
        }
        Insert: {
          hot_sheet_id: string
          id?: string
          listing_id: string
          sent_at?: string | null
        }
        Update: {
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_sent_listings_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_sent_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_shares: {
        Row: {
          created_at: string
          hot_sheet_id: string
          id: string
          shared_by_user_id: string
          shared_with_email: string
        }
        Insert: {
          created_at?: string
          hot_sheet_id: string
          id?: string
          shared_by_user_id: string
          shared_with_email: string
        }
        Update: {
          created_at?: string
          hot_sheet_id?: string
          id?: string
          shared_by_user_id?: string
          shared_with_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_shares_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheets: {
        Row: {
          access_token: string | null
          client_id: string | null
          created_at: string
          criteria: Json
          id: string
          is_active: boolean
          last_sent_at: string | null
          name: string
          notification_schedule: string | null
          notify_agent_email: boolean | null
          notify_client_email: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name: string
          notification_schedule?: string | null
          notify_agent_email?: boolean | null
          notify_client_email?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          created_at?: string
          criteria?: Json
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          name?: string
          notification_schedule?: string | null
          notify_agent_email?: boolean | null
          notify_client_email?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          activation_date: string | null
          additional_notes: string | null
          address: string
          agent_id: string
          amenities: Json | null
          annual_property_tax: number | null
          appointment_required: boolean | null
          attom_data: Json | null
          bathrooms: number | null
          beach_nearby: boolean | null
          bedrooms: number | null
          city: string
          commission_notes: string | null
          commission_rate: number | null
          commission_type: string | null
          construction_features: Json | null
          cooling_types: Json | null
          created_at: string
          description: string | null
          disclosures: Json | null
          documents: Json | null
          entry_only: boolean | null
          exterior_features_list: Json | null
          facing_direction: Json | null
          floor_plans: Json | null
          garage_spaces: number | null
          green_features: Json | null
          has_basement: boolean | null
          heating_types: Json | null
          id: string
          latitude: number | null
          lender_owned: boolean | null
          listing_agreement_types: Json | null
          listing_number: string
          listing_type: string | null
          lockbox_code: string | null
          longitude: number | null
          lot_size: number | null
          num_fireplaces: number | null
          open_houses: Json | null
          photos: Json | null
          price: number
          property_features: Json | null
          property_styles: Json | null
          property_type: string | null
          roof_materials: Json | null
          schools_data: Json | null
          short_sale: boolean | null
          showing_contact_name: string | null
          showing_contact_phone: string | null
          showing_instructions: string | null
          square_feet: number | null
          state: string
          status: string
          tax_assessment_value: number | null
          tax_year: number | null
          total_parking_spaces: number | null
          updated_at: string
          value_estimate: Json | null
          walk_score_data: Json | null
          water_view: boolean | null
          waterfront: boolean | null
          year_built: number | null
          zip_code: string
        }
        Insert: {
          activation_date?: string | null
          additional_notes?: string | null
          address: string
          agent_id: string
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          attom_data?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          city: string
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          construction_features?: Json | null
          cooling_types?: Json | null
          created_at?: string
          description?: string | null
          disclosures?: Json | null
          documents?: Json | null
          entry_only?: boolean | null
          exterior_features_list?: Json | null
          facing_direction?: Json | null
          floor_plans?: Json | null
          garage_spaces?: number | null
          green_features?: Json | null
          has_basement?: boolean | null
          heating_types?: Json | null
          id?: string
          latitude?: number | null
          lender_owned?: boolean | null
          listing_agreement_types?: Json | null
          listing_number?: string
          listing_type?: string | null
          lockbox_code?: string | null
          longitude?: number | null
          lot_size?: number | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          photos?: Json | null
          price: number
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          roof_materials?: Json | null
          schools_data?: Json | null
          short_sale?: boolean | null
          showing_contact_name?: string | null
          showing_contact_phone?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state: string
          status?: string
          tax_assessment_value?: number | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          updated_at?: string
          value_estimate?: Json | null
          walk_score_data?: Json | null
          water_view?: boolean | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code: string
        }
        Update: {
          activation_date?: string | null
          additional_notes?: string | null
          address?: string
          agent_id?: string
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          attom_data?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          city?: string
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          construction_features?: Json | null
          cooling_types?: Json | null
          created_at?: string
          description?: string | null
          disclosures?: Json | null
          documents?: Json | null
          entry_only?: boolean | null
          exterior_features_list?: Json | null
          facing_direction?: Json | null
          floor_plans?: Json | null
          garage_spaces?: number | null
          green_features?: Json | null
          has_basement?: boolean | null
          heating_types?: Json | null
          id?: string
          latitude?: number | null
          lender_owned?: boolean | null
          listing_agreement_types?: Json | null
          listing_number?: string
          listing_type?: string | null
          lockbox_code?: string | null
          longitude?: number | null
          lot_size?: number | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          photos?: Json | null
          price?: number
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          roof_materials?: Json | null
          schools_data?: Json | null
          short_sale?: boolean | null
          showing_contact_name?: string | null
          showing_contact_phone?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state?: string
          status?: string
          tax_assessment_value?: number | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          updated_at?: string
          value_estimate?: Json | null
          walk_score_data?: Json | null
          water_view?: boolean | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      showing_requests: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string | null
          preferred_date: string
          preferred_time: string
          requester_email: string
          requester_name: string
          requester_phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          preferred_date: string
          preferred_time: string
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          preferred_date?: string
          preferred_time?: string
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "showing_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          agent_id: string
          display_order: number | null
          id: string
          joined_at: string
          role: string
          team_id: string
        }
        Insert: {
          agent_id: string
          display_order?: number | null
          id?: string
          joined_at?: string
          role?: string
          team_id: string
        }
        Update: {
          agent_id?: string
          display_order?: number | null
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          social_links: Json | null
          team_photo_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          social_links?: Json | null
          team_photo_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          social_links?: Json | null
          team_photo_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          agent_id: string
          client_name: string
          client_title: string | null
          created_at: string | null
          id: string
          rating: number | null
          testimonial_text: string
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          client_name: string
          client_title?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          testimonial_text: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          client_name?: string
          client_title?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          testimonial_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      auto_activate_listings: { Args: never; Returns: undefined }
      generate_aac_id: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "agent"
      property_type:
        | "single_family"
        | "condo"
        | "townhouse"
        | "multi_family"
        | "land"
        | "commercial"
        | "residential_rental"
        | "commercial_rental"
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
      app_role: ["buyer", "agent"],
      property_type: [
        "single_family",
        "condo",
        "townhouse",
        "multi_family",
        "land",
        "commercial",
        "residential_rental",
        "commercial_rental",
      ],
    },
  },
} as const
