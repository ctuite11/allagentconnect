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
          office_city: string | null
          office_name: string | null
          office_phone: string | null
          office_state: string | null
          office_zip: string | null
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
          office_city?: string | null
          office_name?: string | null
          office_phone?: string | null
          office_state?: string | null
          office_zip?: string | null
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
          office_city?: string | null
          office_name?: string | null
          office_phone?: string | null
          office_state?: string | null
          office_zip?: string | null
          phone?: string | null
          receive_buyer_alerts?: boolean | null
          seller_incentives?: string | null
          social_links?: Json | null
          title?: string | null
          updated_at?: string | null
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
      listing_stats: {
        Row: {
          contact_count: number
          created_at: string
          cumulative_active_days: number
          id: string
          listing_id: string
          save_count: number
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
          attom_data: Json | null
          bathrooms: number | null
          beach_nearby: boolean | null
          bedrooms: number | null
          cancelled_at: string | null
          city: string
          commercial_details: Json | null
          commission_notes: string | null
          commission_rate: number | null
          commission_type: string | null
          condo_details: Json | null
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
          is_relisting: boolean | null
          latitude: number | null
          lender_owned: boolean | null
          listing_agreement_types: Json | null
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
          virtual_tour_url: string | null
          walk_score_data: Json | null
          water_view: boolean | null
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
          attom_data?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          cancelled_at?: string | null
          city: string
          commercial_details?: Json | null
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          condo_details?: Json | null
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
          is_relisting?: boolean | null
          latitude?: number | null
          lender_owned?: boolean | null
          listing_agreement_types?: Json | null
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
          virtual_tour_url?: string | null
          walk_score_data?: Json | null
          water_view?: boolean | null
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
          attom_data?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          cancelled_at?: string | null
          city?: string
          commercial_details?: Json | null
          commission_notes?: string | null
          commission_rate?: number | null
          commission_type?: string | null
          condo_details?: Json | null
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
          is_relisting?: boolean | null
          latitude?: number | null
          lender_owned?: boolean | null
          listing_agreement_types?: Json | null
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
          virtual_tour_url?: string | null
          walk_score_data?: Json | null
          water_view?: boolean | null
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
      [_ in never]: never
    }
    Functions: {
      auto_activate_listings: { Args: never; Returns: undefined }
      check_hot_sheet_matches: {
        Args: { p_hot_sheet_id: string }
        Returns: {
          listing_id: string
        }[]
      }
      generate_aac_id: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
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
