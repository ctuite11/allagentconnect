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
      ad_clicks: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          impression_id: string | null
          page_url: string | null
          viewer_id: string | null
          viewer_ip: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          impression_id?: string | null
          page_url?: string | null
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          impression_id?: string | null
          page_url?: string | null
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_clicks_impression_id_fkey"
            columns: ["impression_id"]
            isOneToOne: false
            referencedRelation: "ad_impressions"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          page_url: string | null
          viewer_id: string | null
          viewer_ip: string | null
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          page_url?: string | null
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          page_url?: string | null
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_packages: {
        Row: {
          ad_type: string
          created_at: string
          description: string | null
          display_order: number | null
          duration_days: number
          features: Json | null
          id: string
          is_active: boolean | null
          max_impressions: number | null
          name: string
          price: number
        }
        Insert: {
          ad_type: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_days: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_impressions?: number | null
          name: string
          price: number
        }
        Update: {
          ad_type?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          duration_days?: number
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_impressions?: number | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      advertisements: {
        Row: {
          ad_type: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string
          placement_zone: string | null
          priority: number | null
          subscription_id: string
          target_locations: Json | null
          title: string
          updated_at: string
          vendor_id: string
        }
        Insert: {
          ad_type: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url: string
          placement_zone?: string | null
          priority?: number | null
          subscription_id: string
          target_locations?: Json | null
          title: string
          updated_at?: string
          vendor_id: string
        }
        Update: {
          ad_type?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string
          placement_zone?: string | null
          priority?: number | null
          subscription_id?: string
          target_locations?: Json | null
          title?: string
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "vendor_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisements_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_buyer_coverage_areas: {
        Row: {
          agent_id: string
          city: string | null
          county: string | null
          created_at: string | null
          id: string
          neighborhood: string | null
          source: string
          state: string | null
          zip_code: string
        }
        Insert: {
          agent_id: string
          city?: string | null
          county?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          source?: string
          state?: string | null
          zip_code: string
        }
        Update: {
          agent_id?: string
          city?: string | null
          county?: string | null
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          source?: string
          state?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_buyer_coverage_areas_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      agent_early_access: {
        Row: {
          brokerage: string
          created_at: string
          email: string
          first_name: string
          founding_partner: boolean
          id: string
          last_name: string
          license_number: string
          listing_id: string | null
          markets: string | null
          notes: string | null
          phone: string | null
          registered_from_listing: boolean
          source: string | null
          specialties: string[] | null
          state: string
          status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          brokerage: string
          created_at?: string
          email: string
          first_name: string
          founding_partner?: boolean
          id?: string
          last_name: string
          license_number: string
          listing_id?: string | null
          markets?: string | null
          notes?: string | null
          phone?: string | null
          registered_from_listing?: boolean
          source?: string | null
          specialties?: string[] | null
          state: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          brokerage?: string
          created_at?: string
          email?: string
          first_name?: string
          founding_partner?: boolean
          id?: string
          last_name?: string
          license_number?: string
          listing_id?: string | null
          markets?: string | null
          notes?: string | null
          phone?: string | null
          registered_from_listing?: boolean
          source?: string | null
          specialties?: string[] | null
          state?: string
          status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      agent_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          id: string
          invitee_email: string
          inviter_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          id?: string
          invitee_email: string
          inviter_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          id?: string
          invitee_email?: string
          inviter_user_id?: string
          status?: string
        }
        Relationships: []
      }
      agent_match_deliveries: {
        Row: {
          agent_id: string
          created_at: string
          hot_sheet_id: string | null
          id: string
          notified_agent_at: string | null
          responded_at: string | null
          submission_id: string
          viewed_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          hot_sheet_id?: string | null
          id?: string
          notified_agent_at?: string | null
          responded_at?: string | null
          submission_id: string
          viewed_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          hot_sheet_id?: string | null
          id?: string
          notified_agent_at?: string | null
          responded_at?: string | null
          submission_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_match_deliveries_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_match_deliveries_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "agent_match_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_match_submissions: {
        Row: {
          address: string
          asking_price: number
          bathrooms: number
          bedrooms: number
          buyer_agent_commission: string | null
          city: string
          confirmed_not_under_contract: boolean
          confirmed_owner_or_authorized: boolean
          created_at: string
          delivered_at: string | null
          delivery_fee_cents: number | null
          description: string | null
          expires_at: string
          floor_plan_urls: string[] | null
          id: string
          lot_size: number | null
          match_count: number | null
          matched_at: string | null
          neighborhood: string | null
          payment_completed_at: string | null
          photos: string[] | null
          preferred_contact_method: string
          property_type: string
          property_website_url: string | null
          seller_email: string
          seller_name: string | null
          seller_phone: string | null
          seller_verification_consent: boolean
          square_feet: number
          state: string
          status: string
          unit_number: string | null
          updated_at: string
          user_id: string | null
          video_url: string | null
          year_built: number | null
          zip_code: string | null
        }
        Insert: {
          address: string
          asking_price: number
          bathrooms: number
          bedrooms: number
          buyer_agent_commission?: string | null
          city: string
          confirmed_not_under_contract?: boolean
          confirmed_owner_or_authorized?: boolean
          created_at?: string
          delivered_at?: string | null
          delivery_fee_cents?: number | null
          description?: string | null
          expires_at?: string
          floor_plan_urls?: string[] | null
          id?: string
          lot_size?: number | null
          match_count?: number | null
          matched_at?: string | null
          neighborhood?: string | null
          payment_completed_at?: string | null
          photos?: string[] | null
          preferred_contact_method?: string
          property_type: string
          property_website_url?: string | null
          seller_email: string
          seller_name?: string | null
          seller_phone?: string | null
          seller_verification_consent?: boolean
          square_feet: number
          state: string
          status?: string
          unit_number?: string | null
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
          year_built?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string
          asking_price?: number
          bathrooms?: number
          bedrooms?: number
          buyer_agent_commission?: string | null
          city?: string
          confirmed_not_under_contract?: boolean
          confirmed_owner_or_authorized?: boolean
          created_at?: string
          delivered_at?: string | null
          delivery_fee_cents?: number | null
          description?: string | null
          expires_at?: string
          floor_plan_urls?: string[] | null
          id?: string
          lot_size?: number | null
          match_count?: number | null
          matched_at?: string | null
          neighborhood?: string | null
          payment_completed_at?: string | null
          photos?: string[] | null
          preferred_contact_method?: string
          property_type?: string
          property_website_url?: string | null
          seller_email?: string
          seller_name?: string | null
          seller_phone?: string | null
          seller_verification_consent?: boolean
          square_feet?: number
          state?: string
          status?: string
          unit_number?: string | null
          updated_at?: string
          user_id?: string | null
          video_url?: string | null
          year_built?: number | null
          zip_code?: string | null
        }
        Relationships: []
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
          header_background_type: string | null
          header_background_value: string | null
          header_image_url: string | null
          headshot_url: string | null
          id: string
          last_name: string
          logo_url: string | null
          office_address: string | null
          office_city: string | null
          office_name: string | null
          office_phone: string | null
          office_state: string | null
          office_zip: string | null
          phone: string | null
          receive_buyer_alerts: boolean | null
          seller_incentives: string | null
          social_links: Json | null
          team_name: string | null
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
          header_background_type?: string | null
          header_background_value?: string | null
          header_image_url?: string | null
          headshot_url?: string | null
          id: string
          last_name: string
          logo_url?: string | null
          office_address?: string | null
          office_city?: string | null
          office_name?: string | null
          office_phone?: string | null
          office_state?: string | null
          office_zip?: string | null
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          seller_incentives?: string | null
          social_links?: Json | null
          team_name?: string | null
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
          header_background_type?: string | null
          header_background_value?: string | null
          header_image_url?: string | null
          headshot_url?: string | null
          id?: string
          last_name?: string
          logo_url?: string | null
          office_address?: string | null
          office_city?: string | null
          office_name?: string | null
          office_phone?: string | null
          office_state?: string | null
          office_zip?: string | null
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          seller_incentives?: string | null
          social_links?: Json | null
          team_name?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          agent_status: Database["public"]["Enums"]["agent_status"]
          approval_email_sent: boolean
          county: string | null
          created_at: string
          early_access: boolean
          email_frequency: string
          hide_from_directory: boolean
          last_verification_attempt_at: string | null
          license_last_name: string | null
          license_number: string | null
          license_state: string | null
          muted_all: boolean
          notifications_enabled: boolean
          notifications_set: boolean
          onboarding_completed: boolean
          onboarding_started: boolean
          preferences_set: boolean
          price_max: number | null
          price_min: number | null
          price_no_max: boolean
          price_no_min: boolean
          property_types: string[]
          state: string | null
          tour_completed: boolean
          towns: string[]
          updated_at: string
          user_id: string
          verification_attempt_count: number
          verification_method: string | null
          verification_payload: Json
          verified_at: string | null
          welcome_modal_dismissed: boolean
        }
        Insert: {
          agent_status?: Database["public"]["Enums"]["agent_status"]
          approval_email_sent?: boolean
          county?: string | null
          created_at?: string
          early_access?: boolean
          email_frequency?: string
          hide_from_directory?: boolean
          last_verification_attempt_at?: string | null
          license_last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          muted_all?: boolean
          notifications_enabled?: boolean
          notifications_set?: boolean
          onboarding_completed?: boolean
          onboarding_started?: boolean
          preferences_set?: boolean
          price_max?: number | null
          price_min?: number | null
          price_no_max?: boolean
          price_no_min?: boolean
          property_types?: string[]
          state?: string | null
          tour_completed?: boolean
          towns?: string[]
          updated_at?: string
          user_id: string
          verification_attempt_count?: number
          verification_method?: string | null
          verification_payload?: Json
          verified_at?: string | null
          welcome_modal_dismissed?: boolean
        }
        Update: {
          agent_status?: Database["public"]["Enums"]["agent_status"]
          approval_email_sent?: boolean
          county?: string | null
          created_at?: string
          early_access?: boolean
          email_frequency?: string
          hide_from_directory?: boolean
          last_verification_attempt_at?: string | null
          license_last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          muted_all?: boolean
          notifications_enabled?: boolean
          notifications_set?: boolean
          onboarding_completed?: boolean
          onboarding_started?: boolean
          preferences_set?: boolean
          price_max?: number | null
          price_min?: number | null
          price_no_max?: boolean
          price_no_min?: boolean
          property_types?: string[]
          state?: string | null
          tour_completed?: boolean
          towns?: string[]
          updated_at?: string
          user_id?: string
          verification_attempt_count?: number
          verification_method?: string | null
          verification_payload?: Json
          verified_at?: string | null
          welcome_modal_dismissed?: boolean
        }
        Relationships: []
      }
      agent_state_preferences: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          state: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          state: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          state?: string
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
      buyer_credentials: {
        Row: {
          approval_amount: number | null
          created_at: string
          credential_type: string
          document_url: string
          expires_at: string | null
          id: string
          lender_name: string | null
          notes: string | null
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          approval_amount?: number | null
          created_at?: string
          credential_type: string
          document_url: string
          expires_at?: string | null
          id?: string
          lender_name?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          approval_amount?: number | null
          created_at?: string
          credential_type?: string
          document_url?: string
          expires_at?: string | null
          id?: string
          lender_name?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      client_agent_relationships: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string | null
          ended_at: string | null
          id: string
          invitation_token: string | null
          status: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          invitation_token?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string | null
          ended_at?: string | null
          id?: string
          invitation_token?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_agent_relationships_invitation_token_fkey"
            columns: ["invitation_token"]
            isOneToOne: false
            referencedRelation: "share_tokens"
            referencedColumns: ["token"]
          },
        ]
      }
      client_needs: {
        Row: {
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          county_id: string | null
          created_at: string | null
          description: string | null
          id: string
          max_price: number
          property_type: Database["public"]["Enums"]["property_type"]
          property_types: Database["public"]["Enums"]["property_type"][] | null
          state: string | null
          submitted_by: string
        }
        Insert: {
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          county_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_price: number
          property_type: Database["public"]["Enums"]["property_type"]
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          state?: string | null
          submitted_by: string
        }
        Update: {
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          county_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          max_price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          property_types?: Database["public"]["Enums"]["property_type"][] | null
          state?: string | null
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
          client_type: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_favorite: boolean
          last_name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          client_type?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_favorite?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          client_type?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_favorite?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coming_soon_signups: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          recipient_agent_id: string
          sender_agent_id: string
          subject: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_agent_id: string
          sender_agent_id: string
          subject?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_agent_id?: string
          sender_agent_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_inbox"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_inbox"
            referencedColumns: ["conversation_id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_a_id: string
          agent_b_id: string
          buyer_need_id: string | null
          created_at: string
          id: string
          last_message_at: string
          listing_id: string | null
          updated_at: string
        }
        Insert: {
          agent_a_id: string
          agent_b_id: string
          buyer_need_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_a_id?: string
          agent_b_id?: string
          buyer_need_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          listing_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_need_id_fkey"
            columns: ["buyer_need_id"]
            isOneToOne: false
            referencedRelation: "client_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
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
      deleted_users: {
        Row: {
          company: string | null
          deleted_at: string
          deleted_by: string | null
          deletion_reason: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          original_data: Json | null
          original_user_id: string
          phone: string | null
        }
        Insert: {
          company?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deletion_reason?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          original_data?: Json | null
          original_user_id: string
          phone?: string | null
        }
        Update: {
          company?: string | null
          deleted_at?: string
          deleted_by?: string | null
          deletion_reason?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          original_data?: Json | null
          original_user_id?: string
          phone?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          agent_id: string
          created_at: string | null
          id: string
          message: string
          recipient_count: number | null
          sent_at: string | null
          subject: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          id?: string
          message: string
          recipient_count?: number | null
          sent_at?: string | null
          subject: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          id?: string
          message?: string
          recipient_count?: number | null
          sent_at?: string | null
          subject?: string
        }
        Relationships: []
      }
      email_clicks: {
        Row: {
          clicked_at: string | null
          created_at: string | null
          email_send_id: string
          id: string
          ip_address: string | null
          url: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string | null
          created_at?: string | null
          email_send_id: string
          id?: string
          ip_address?: string | null
          url: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string | null
          created_at?: string | null
          email_send_id?: string
          id?: string
          ip_address?: string | null
          url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_clicks_email_send_id_fkey"
            columns: ["email_send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: number
          job_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: number
          job_id: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: number
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload: Json
          run_after?: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          run_after?: string
          status?: string
        }
        Relationships: []
      }
      email_opens: {
        Row: {
          created_at: string | null
          email_send_id: string
          id: string
          ip_address: string | null
          opened_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email_send_id: string
          id?: string
          ip_address?: string | null
          opened_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email_send_id?: string
          id?: string
          ip_address?: string | null
          opened_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_opens_email_send_id_fkey"
            columns: ["email_send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          recipient_email: string
          recipient_name: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          recipient_email: string
          recipient_name: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          recipient_email?: string
          recipient_name?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          agent_id: string
          body: string
          category: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorite_price_history: {
        Row: {
          changed_at: string
          favorite_id: string
          id: string
          listing_id: string
          new_price: number
          notification_sent: boolean | null
          notification_sent_at: string | null
          old_price: number
        }
        Insert: {
          changed_at?: string
          favorite_id: string
          id?: string
          listing_id: string
          new_price: number
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          old_price: number
        }
        Update: {
          changed_at?: string
          favorite_id?: string
          id?: string
          listing_id?: string
          new_price?: number
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          old_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "favorite_price_history_favorite_id_fkey"
            columns: ["favorite_id"]
            isOneToOne: false
            referencedRelation: "favorites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorite_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
      hot_sheet_clients: {
        Row: {
          client_id: string
          created_at: string
          hot_sheet_id: string
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          hot_sheet_id: string
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          hot_sheet_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_clients_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
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
      hot_sheet_listing_status: {
        Row: {
          created_at: string
          hot_sheet_id: string
          id: string
          listing_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hot_sheet_id: string
          id?: string
          listing_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_listing_status_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_listing_status_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_notifications: {
        Row: {
          created_at: string
          hot_sheet_id: string
          id: string
          listing_id: string
          notification_sent: boolean | null
          notification_sent_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          hot_sheet_id: string
          id?: string
          listing_id: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_notifications_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_notifications_listing_id_fkey"
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
      listing_drafts: {
        Row: {
          created_at: string
          draft_data: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          draft_data: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          draft_data?: Json
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          listing_id: string
          new_price: number
          note: string | null
          old_price: number | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          listing_id: string
          new_price: number
          note?: string | null
          old_price?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          listing_id?: string
          new_price?: number
          note?: string | null
          old_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_shares: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          recipient_email: string | null
          share_type: string
          shared_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          recipient_email?: string | null
          share_type: string
          shared_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          recipient_email?: string | null
          share_type?: string
          shared_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_stats: {
        Row: {
          contact_count: number
          created_at: string
          cumulative_active_days: number
          id: string
          listing_id: string
          save_count: number
          share_count: number
          showing_request_count: number
          updated_at: string
          view_count: number
        }
        Insert: {
          contact_count?: number
          created_at?: string
          cumulative_active_days?: number
          id?: string
          listing_id: string
          save_count?: number
          share_count?: number
          showing_request_count?: number
          updated_at?: string
          view_count?: number
        }
        Update: {
          contact_count?: number
          created_at?: string
          cumulative_active_days?: number
          id?: string
          listing_id?: string
          save_count?: number
          share_count?: number
          showing_request_count?: number
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          listing_id: string
          new_status: string
          notes: string | null
          old_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          listing_id: string
          new_status: string
          notes?: string | null
          old_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          listing_id?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_status_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          viewer_id: string | null
          viewer_ip: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          viewer_id?: string | null
          viewer_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          activation_date: string | null
          active_date: string | null
          additional_notes: string | null
          address: string
          agent_id: string
          amenities: Json | null
          annual_property_tax: number | null
          appointment_required: boolean | null
          area_amenities: string[] | null
          assessed_value: number | null
          attom_data: Json | null
          attom_id: string | null
          auto_activate_days: number | null
          auto_activate_on: string | null
          basement_features_list: Json | null
          basement_floor_types: Json | null
          basement_types: Json | null
          bathrooms: number | null
          beach_nearby: boolean | null
          bedrooms: number | null
          broker_comments: string | null
          building_name: string | null
          cancelled_at: string | null
          city: string
          commercial_details: Json | null
          commission_notes: string | null
          commission_rate: number | null
          commission_type: string | null
          condo_details: Json | null
          construction_features: Json | null
          cooling_types: Json | null
          county: string | null
          created_at: string
          deposit_requirements: Json | null
          description: string | null
          disclosures: Json | null
          disclosures_other: string | null
          documents: Json | null
          entry_only: boolean | null
          expiration_date: string | null
          exterior_features_list: Json | null
          facing_direction: Json | null
          fiscal_year: number | null
          floor_plans: Json | null
          floors: number | null
          foundation_types: Json | null
          garage_additional_features_list: Json | null
          garage_comments: string | null
          garage_features_list: Json | null
          garage_spaces: number | null
          go_live_date: string | null
          green_features: Json | null
          handicap_access: string | null
          handicap_accessible: string | null
          has_basement: boolean | null
          has_storage: boolean | null
          heating_types: Json | null
          id: string
          is_relisting: boolean | null
          latitude: number | null
          laundry_type: string | null
          lead_paint: string | null
          lender_owned: boolean | null
          list_date: string | null
          listing_agreement_types: Json | null
          listing_exclusions: string | null
          listing_number: string
          listing_type: string | null
          lockbox_code: string | null
          longitude: number | null
          lot_size: number | null
          multi_family_details: Json | null
          neighborhood: string | null
          num_fireplaces: number | null
          open_houses: Json | null
          original_listing_id: string | null
          outdoor_space: Json | null
          parking_comments: string | null
          parking_features_list: Json | null
          pet_options: Json | null
          pets_comment: string | null
          photos: Json | null
          price: number
          property_features: Json | null
          property_styles: Json | null
          property_type: string | null
          property_website_url: string | null
          rental_fee: number | null
          residential_exemption: string | null
          roof_materials: Json | null
          schools_data: Json | null
          short_sale: boolean | null
          showing_contact_name: string | null
          showing_contact_phone: string | null
          showing_instructions: string | null
          square_feet: number | null
          state: string
          status: string
          storage_options: Json | null
          tax_assessment_value: number | null
          tax_year: number | null
          total_parking_spaces: number | null
          town: string | null
          unit_number: string | null
          updated_at: string
          value_estimate: Json | null
          video_url: string | null
          virtual_tour_url: string | null
          walk_score_data: Json | null
          water_view: boolean | null
          water_view_type: string | null
          waterfront: boolean | null
          year_built: number | null
          zip_code: string
        }
        Insert: {
          activation_date?: string | null
          active_date?: string | null
          additional_notes?: string | null
          address: string
          agent_id: string
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          area_amenities?: string[] | null
          assessed_value?: number | null
          attom_data?: Json | null
          attom_id?: string | null
          auto_activate_days?: number | null
          auto_activate_on?: string | null
          basement_features_list?: Json | null
          basement_floor_types?: Json | null
          basement_types?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          broker_comments?: string | null
          building_name?: string | null
          cancelled_at?: string | null
          city: string
          commercial_details?: Json | null
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          condo_details?: Json | null
          construction_features?: Json | null
          cooling_types?: Json | null
          county?: string | null
          created_at?: string
          deposit_requirements?: Json | null
          description?: string | null
          disclosures?: Json | null
          disclosures_other?: string | null
          documents?: Json | null
          entry_only?: boolean | null
          expiration_date?: string | null
          exterior_features_list?: Json | null
          facing_direction?: Json | null
          fiscal_year?: number | null
          floor_plans?: Json | null
          floors?: number | null
          foundation_types?: Json | null
          garage_additional_features_list?: Json | null
          garage_comments?: string | null
          garage_features_list?: Json | null
          garage_spaces?: number | null
          go_live_date?: string | null
          green_features?: Json | null
          handicap_access?: string | null
          handicap_accessible?: string | null
          has_basement?: boolean | null
          has_storage?: boolean | null
          heating_types?: Json | null
          id?: string
          is_relisting?: boolean | null
          latitude?: number | null
          laundry_type?: string | null
          lead_paint?: string | null
          lender_owned?: boolean | null
          list_date?: string | null
          listing_agreement_types?: Json | null
          listing_exclusions?: string | null
          listing_number?: string
          listing_type?: string | null
          lockbox_code?: string | null
          longitude?: number | null
          lot_size?: number | null
          multi_family_details?: Json | null
          neighborhood?: string | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          original_listing_id?: string | null
          outdoor_space?: Json | null
          parking_comments?: string | null
          parking_features_list?: Json | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price: number
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          rental_fee?: number | null
          residential_exemption?: string | null
          roof_materials?: Json | null
          schools_data?: Json | null
          short_sale?: boolean | null
          showing_contact_name?: string | null
          showing_contact_phone?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state: string
          status?: string
          storage_options?: Json | null
          tax_assessment_value?: number | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          town?: string | null
          unit_number?: string | null
          updated_at?: string
          value_estimate?: Json | null
          video_url?: string | null
          virtual_tour_url?: string | null
          walk_score_data?: Json | null
          water_view?: boolean | null
          water_view_type?: string | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code: string
        }
        Update: {
          activation_date?: string | null
          active_date?: string | null
          additional_notes?: string | null
          address?: string
          agent_id?: string
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          area_amenities?: string[] | null
          assessed_value?: number | null
          attom_data?: Json | null
          attom_id?: string | null
          auto_activate_days?: number | null
          auto_activate_on?: string | null
          basement_features_list?: Json | null
          basement_floor_types?: Json | null
          basement_types?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          broker_comments?: string | null
          building_name?: string | null
          cancelled_at?: string | null
          city?: string
          commercial_details?: Json | null
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          condo_details?: Json | null
          construction_features?: Json | null
          cooling_types?: Json | null
          county?: string | null
          created_at?: string
          deposit_requirements?: Json | null
          description?: string | null
          disclosures?: Json | null
          disclosures_other?: string | null
          documents?: Json | null
          entry_only?: boolean | null
          expiration_date?: string | null
          exterior_features_list?: Json | null
          facing_direction?: Json | null
          fiscal_year?: number | null
          floor_plans?: Json | null
          floors?: number | null
          foundation_types?: Json | null
          garage_additional_features_list?: Json | null
          garage_comments?: string | null
          garage_features_list?: Json | null
          garage_spaces?: number | null
          go_live_date?: string | null
          green_features?: Json | null
          handicap_access?: string | null
          handicap_accessible?: string | null
          has_basement?: boolean | null
          has_storage?: boolean | null
          heating_types?: Json | null
          id?: string
          is_relisting?: boolean | null
          latitude?: number | null
          laundry_type?: string | null
          lead_paint?: string | null
          lender_owned?: boolean | null
          list_date?: string | null
          listing_agreement_types?: Json | null
          listing_exclusions?: string | null
          listing_number?: string
          listing_type?: string | null
          lockbox_code?: string | null
          longitude?: number | null
          lot_size?: number | null
          multi_family_details?: Json | null
          neighborhood?: string | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          original_listing_id?: string | null
          outdoor_space?: Json | null
          parking_comments?: string | null
          parking_features_list?: Json | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price?: number
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          rental_fee?: number | null
          residential_exemption?: string | null
          roof_materials?: Json | null
          schools_data?: Json | null
          short_sale?: boolean | null
          showing_contact_name?: string | null
          showing_contact_phone?: string | null
          showing_instructions?: string | null
          square_feet?: number | null
          state?: string
          status?: string
          storage_options?: Json | null
          tax_assessment_value?: number | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          town?: string | null
          unit_number?: string | null
          updated_at?: string
          value_estimate?: Json | null
          video_url?: string | null
          virtual_tour_url?: string | null
          walk_score_data?: Json | null
          water_view?: boolean | null
          water_view_type?: string | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_original_listing_id_fkey"
            columns: ["original_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          buyer_need: boolean
          client_needs_enabled: boolean | null
          client_needs_schedule: string | null
          created_at: string
          frequency: string
          general_discussion: boolean
          has_no_max: boolean | null
          has_no_min: boolean | null
          id: string
          max_price: number | null
          min_price: number | null
          new_matches_enabled: boolean | null
          price_changes_enabled: boolean | null
          property_types: Json | null
          renter_need: boolean
          sales_intel: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_need?: boolean
          client_needs_enabled?: boolean | null
          client_needs_schedule?: string | null
          created_at?: string
          frequency?: string
          general_discussion?: boolean
          has_no_max?: boolean | null
          has_no_min?: boolean | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          new_matches_enabled?: boolean | null
          price_changes_enabled?: boolean | null
          property_types?: Json | null
          renter_need?: boolean
          sales_intel?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_need?: boolean
          client_needs_enabled?: boolean | null
          client_needs_schedule?: string | null
          created_at?: string
          frequency?: string
          general_discussion?: boolean
          has_no_max?: boolean | null
          has_no_min?: boolean | null
          id?: string
          max_price?: number | null
          min_price?: number | null
          new_matches_enabled?: boolean | null
          price_changes_enabled?: boolean | null
          property_types?: Json | null
          renter_need?: boolean
          sales_intel?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      off_market_views: {
        Row: {
          id: string
          listing_id: string
          source: string | null
          viewed_at: string
          viewer_agent_id: string
        }
        Insert: {
          id?: string
          listing_id: string
          source?: string | null
          viewed_at?: string
          viewer_agent_id: string
        }
        Update: {
          id?: string
          listing_id?: string
          source?: string | null
          viewed_at?: string
          viewer_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "off_market_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "off_market_views_viewer_agent_id_fkey"
            columns: ["viewer_agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_verifications: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          license_number: string | null
          license_state: string | null
          processed: boolean | null
          processed_at: string | null
          processed_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          license_number?: string | null
          license_state?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          license_number?: string | null
          license_state?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          user_id?: string
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
      public_records_cache: {
        Row: {
          attom_id: string
          created_at: string
          raw: Json
        }
        Insert: {
          attom_id: string
          created_at?: string
          raw: Json
        }
        Update: {
          attom_id?: string
          created_at?: string
          raw?: Json
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      seller_match_outcomes: {
        Row: {
          created_at: string
          id: string
          match_id: string
          next_followup_at: string | null
          notes: string | null
          outcome: Database["public"]["Enums"]["seller_match_outcome"]
          outcome_at: string | null
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          next_followup_at?: string | null
          notes?: string | null
          outcome: Database["public"]["Enums"]["seller_match_outcome"]
          outcome_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          next_followup_at?: string | null
          notes?: string | null
          outcome?: Database["public"]["Enums"]["seller_match_outcome"]
          outcome_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_match_outcomes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "seller_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_match_outcomes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "seller_matches_public"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_matches: {
        Row: {
          agent_id: string
          archived_at: string | null
          archived_reason: string | null
          contact_attempts: number
          created_at: string
          delivery_id: string | null
          first_contacted_at: string | null
          followup_reason: string | null
          hot_sheet_id: string | null
          id: string
          last_contact_note: string | null
          last_contacted_at: string | null
          latest_outcome: Database["public"]["Enums"]["seller_match_outcome"]
          latest_outcome_at: string | null
          latest_outcome_id: string | null
          latest_outcome_notes: string | null
          next_followup_at: string | null
          submission_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          archived_at?: string | null
          archived_reason?: string | null
          contact_attempts?: number
          created_at?: string
          delivery_id?: string | null
          first_contacted_at?: string | null
          followup_reason?: string | null
          hot_sheet_id?: string | null
          id?: string
          last_contact_note?: string | null
          last_contacted_at?: string | null
          latest_outcome?: Database["public"]["Enums"]["seller_match_outcome"]
          latest_outcome_at?: string | null
          latest_outcome_id?: string | null
          latest_outcome_notes?: string | null
          next_followup_at?: string | null
          submission_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          archived_at?: string | null
          archived_reason?: string | null
          contact_attempts?: number
          created_at?: string
          delivery_id?: string | null
          first_contacted_at?: string | null
          followup_reason?: string | null
          hot_sheet_id?: string | null
          id?: string
          last_contact_note?: string | null
          last_contacted_at?: string | null
          latest_outcome?: Database["public"]["Enums"]["seller_match_outcome"]
          latest_outcome_at?: string | null
          latest_outcome_id?: string | null
          latest_outcome_notes?: string | null
          next_followup_at?: string | null
          submission_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_matches_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "agent_match_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_matches_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_matches_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "agent_match_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      share_tokens: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          agent_id: string
          created_at: string
          expires_at: string | null
          id: string
          payload: Json | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          agent_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          agent_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          payload?: Json | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_tokens_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "team_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
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
          office_address: string | null
          office_name: string | null
          office_phone: string | null
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
          office_address?: string | null
          office_name?: string | null
          office_phone?: string | null
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
          office_address?: string | null
          office_name?: string | null
          office_phone?: string | null
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
      vendor_profiles: {
        Row: {
          business_type: string
          company_name: string
          contact_name: string
          created_at: string
          description: string | null
          email: string
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          logo_url: string | null
          phone: string | null
          service_areas: Json | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          business_type: string
          company_name: string
          contact_name: string
          created_at?: string
          description?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          logo_url?: string | null
          phone?: string | null
          service_areas?: Json | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          business_type?: string
          company_name?: string
          contact_name?: string
          created_at?: string
          description?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          logo_url?: string | null
          phone?: string | null
          service_areas?: Json | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      vendor_subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string
          end_date: string
          id: string
          package_id: string
          start_date: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string
          end_date: string
          id?: string
          package_id: string
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string
          end_date?: string
          id?: string
          package_id?: string
          start_date?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ad_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_subscriptions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_directory_status: {
        Row: {
          agent_status: Database["public"]["Enums"]["agent_status"] | null
          user_id: string | null
        }
        Insert: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null
          user_id?: string | null
        }
        Update: {
          agent_status?: Database["public"]["Enums"]["agent_status"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversation_inbox: {
        Row: {
          buyer_need_id: string | null
          conversation_id: string | null
          is_unread: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          last_message_sender_id: string | null
          last_read_at: string | null
          listing_id: string | null
          other_user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_need_id_fkey"
            columns: ["buyer_need_id"]
            isOneToOne: false
            referencedRelation: "client_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_matches_public: {
        Row: {
          archived_at: string | null
          created_at: string | null
          id: string | null
          latest_outcome:
            | Database["public"]["Enums"]["seller_match_outcome"]
            | null
          latest_outcome_at: string | null
          next_followup_at: string | null
          submission_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          id?: string | null
          latest_outcome?:
            | Database["public"]["Enums"]["seller_match_outcome"]
            | null
          latest_outcome_at?: string | null
          next_followup_at?: string | null
          submission_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          id?: string | null
          latest_outcome?:
            | Database["public"]["Enums"]["seller_match_outcome"]
            | null
          latest_outcome_at?: string | null
          next_followup_at?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_matches_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "agent_match_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auto_activate_listings: { Args: never; Returns: undefined }
      check_hot_sheet_matches: {
        Args: { p_hot_sheet_id: string }
        Returns: {
          listing_id: string
        }[]
      }
      cleanup_expired_share_tokens: { Args: never; Returns: undefined }
      count_matching_agents: {
        Args: {
          p_bathrooms: number
          p_bedrooms: number
          p_city: string
          p_price: number
          p_property_type: string
          p_state: string
        }
        Returns: number
      }
      delete_draft_listing: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      email_jobs_claim: {
        Args: { p_limit: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          run_after: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      generate_aac_id: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
      get_verified_agent_ids: {
        Args: never
        Returns: {
          user_id: string
        }[]
      }
      get_verified_early_access_count: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_owner: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_verified_agent: { Args: never; Returns: boolean }
      owns_submission: { Args: { p_submission_id: string }; Returns: boolean }
      rate_limit_consume: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: Json
      }
      rate_limits_cleanup: { Args: never; Returns: undefined }
    }
    Enums: {
      agent_status:
        | "unverified"
        | "pending"
        | "verified"
        | "restricted"
        | "rejected"
      app_role: "buyer" | "agent" | "admin"
      property_type:
        | "single_family"
        | "condo"
        | "townhouse"
        | "multi_family"
        | "land"
        | "commercial"
        | "residential_rental"
        | "commercial_rental"
      seller_match_outcome:
        | "pending"
        | "no_response"
        | "not_a_fit"
        | "connected"
        | "showing_scheduled"
        | "offer_submitted"
        | "offer_accepted"
        | "closed_won"
        | "closed_lost"
        | "duplicate"
        | "invalid"
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
      agent_status: [
        "unverified",
        "pending",
        "verified",
        "restricted",
        "rejected",
      ],
      app_role: ["buyer", "agent", "admin"],
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
      seller_match_outcome: [
        "pending",
        "no_response",
        "not_a_fit",
        "connected",
        "showing_scheduled",
        "offer_submitted",
        "offer_accepted",
        "closed_won",
        "closed_lost",
        "duplicate",
        "invalid",
      ],
    },
  },
} as const
