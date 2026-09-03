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
    PostgrestVersion: "14.5"
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
      agent_account_members: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          delegate_user_id: string | null
          display_name: string | null
          id: string
          invite_email: string
          invite_expires_at: string
          invite_token: string | null
          invited_at: string
          invited_by: string
          last_active_at: string | null
          owner_user_id: string
          revoked_at: string | null
          revoked_by: string | null
          role_label: string | null
          status: Database["public"]["Enums"]["agent_delegate_status"]
          superseded_invite_tokens: string[]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delegate_user_id?: string | null
          display_name?: string | null
          id?: string
          invite_email: string
          invite_expires_at?: string
          invite_token?: string | null
          invited_at?: string
          invited_by: string
          last_active_at?: string | null
          owner_user_id: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_label?: string | null
          status?: Database["public"]["Enums"]["agent_delegate_status"]
          superseded_invite_tokens?: string[]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          delegate_user_id?: string | null
          display_name?: string | null
          id?: string
          invite_email?: string
          invite_expires_at?: string
          invite_token?: string | null
          invited_at?: string
          invited_by?: string
          last_active_at?: string | null
          owner_user_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          role_label?: string | null
          status?: Database["public"]["Enums"]["agent_delegate_status"]
          superseded_invite_tokens?: string[]
          team_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_activation_resend_handles: {
        Row: {
          created_at: string
          expires_at: string
          handle_hash: string
          id: string
          token_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          handle_hash: string
          id?: string
          token_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          handle_hash?: string
          id?: string
          token_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_activation_resend_handles_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "agent_activation_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_activation_tokens: {
        Row: {
          allow_previously_deleted: boolean
          created_at: string
          email_job_id: string | null
          expires_at: string
          id: string
          issuance_key: string
          redeemed_at: string | null
          redeeming_at: string | null
          revoked_at: string | null
          status: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_previously_deleted?: boolean
          created_at?: string
          email_job_id?: string | null
          expires_at: string
          id: string
          issuance_key: string
          redeemed_at?: string | null
          redeeming_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_previously_deleted?: boolean
          created_at?: string
          email_job_id?: string | null
          expires_at?: string
          id?: string
          issuance_key?: string
          redeemed_at?: string | null
          redeeming_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_active_context: {
        Row: {
          active_owner_user_id: string
          expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_owner_user_id: string
          expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_owner_user_id?: string
          expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      agent_license_uploads: {
        Row: {
          admin_notes: string | null
          created_at: string
          file_name: string
          file_path: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          file_name: string
          file_path: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          file_name?: string
          file_path?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_login_tokens: {
        Row: {
          created_at: string
          email_job_id: string | null
          expires_at: string
          id: string
          issuance_key: string
          redeemed_at: string | null
          redeeming_at: string | null
          revoked_at: string | null
          status: string
          token_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_job_id?: string | null
          expires_at: string
          id: string
          issuance_key: string
          redeemed_at?: string | null
          redeeming_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_job_id?: string | null
          expires_at?: string
          id?: string
          issuance_key?: string
          redeemed_at?: string | null
          redeeming_at?: string | null
          revoked_at?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
          user_id?: string
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
          receive_listing_proposals: boolean
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
          receive_listing_proposals?: boolean
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
          receive_listing_proposals?: boolean
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
          {
            foreignKeyName: "agent_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_missing_opportunity_reminders: {
        Row: {
          agent_id: string
          email: string
          event_id: string
          event_type: string
          id: string
          sent_at: string
        }
        Insert: {
          agent_id: string
          email: string
          event_id: string
          event_type: string
          id?: string
          sent_at?: string
        }
        Update: {
          agent_id?: string
          email?: string
          event_id?: string
          event_type?: string
          id?: string
          sent_at?: string
        }
        Relationships: []
      }
      agent_notifications: {
        Row: {
          agent_id: string
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          agent_id: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          agent_id?: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
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
      agent_proposal_incentives: {
        Row: {
          agent_id: string
          buyer_fee_credit_type: string | null
          buyer_fee_credit_value: number | null
          created_at: string
          custom_incentive_notes: string | null
          flat_fee_amount: number | null
          flat_fee_option: boolean
          id: string
          listing_commission_type: string | null
          listing_commission_value: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          buyer_fee_credit_type?: string | null
          buyer_fee_credit_value?: number | null
          created_at?: string
          custom_incentive_notes?: string | null
          flat_fee_amount?: number | null
          flat_fee_option?: boolean
          id?: string
          listing_commission_type?: string | null
          listing_commission_value?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          buyer_fee_credit_type?: string | null
          buyer_fee_credit_value?: number | null
          created_at?: string
          custom_incentive_notes?: string | null
          flat_fee_amount?: number | null
          flat_fee_option?: boolean
          id?: string
          listing_commission_type?: string | null
          listing_commission_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_proposal_incentives_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sent_broadcasts: {
        Row: {
          agent_id: string
          broadcast_id: string
          id: string
          reason: string
          sent_at: string
        }
        Insert: {
          agent_id: string
          broadcast_id: string
          id?: string
          reason?: string
          sent_at?: string
        }
        Update: {
          agent_id?: string
          broadcast_id?: string
          id?: string
          reason?: string
          sent_at?: string
        }
        Relationships: []
      }
      agent_sent_client_needs: {
        Row: {
          agent_id: string
          client_need_id: string
          id: string
          reason: string
          sent_at: string
        }
        Insert: {
          agent_id: string
          client_need_id: string
          id?: string
          reason?: string
          sent_at?: string
        }
        Update: {
          agent_id?: string
          client_need_id?: string
          id?: string
          reason?: string
          sent_at?: string
        }
        Relationships: []
      }
      agent_sent_listings: {
        Row: {
          agent_id: string
          id: string
          listing_id: string
          sent_at: string
          status_at_send: string
        }
        Insert: {
          agent_id: string
          id?: string
          listing_id: string
          sent_at?: string
          status_at_send: string
        }
        Update: {
          agent_id?: string
          id?: string
          listing_id?: string
          sent_at?: string
          status_at_send?: string
        }
        Relationships: []
      }
      agent_settings: {
        Row: {
          account_activated_at: string | null
          agent_status: Database["public"]["Enums"]["agent_status"]
          approval_email_sent: boolean
          comms_onboarding_seen_at: string | null
          county: string | null
          created_at: string
          credentials_issued_at: string | null
          dismissed_announcement_ids: string[]
          early_access: boolean
          email_frequency: string
          hide_from_directory: boolean
          last_seen_at: string | null
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
          show_buyer_proposal: boolean
          show_seller_proposal: boolean
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
          account_activated_at?: string | null
          agent_status?: Database["public"]["Enums"]["agent_status"]
          approval_email_sent?: boolean
          comms_onboarding_seen_at?: string | null
          county?: string | null
          created_at?: string
          credentials_issued_at?: string | null
          dismissed_announcement_ids?: string[]
          early_access?: boolean
          email_frequency?: string
          hide_from_directory?: boolean
          last_seen_at?: string | null
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
          show_buyer_proposal?: boolean
          show_seller_proposal?: boolean
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
          account_activated_at?: string | null
          agent_status?: Database["public"]["Enums"]["agent_status"]
          approval_email_sent?: boolean
          comms_onboarding_seen_at?: string | null
          county?: string | null
          created_at?: string
          credentials_issued_at?: string | null
          dismissed_announcement_ids?: string[]
          early_access?: boolean
          email_frequency?: string
          hide_from_directory?: boolean
          last_seen_at?: string | null
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
          show_buyer_proposal?: boolean
          show_seller_proposal?: boolean
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
      agent_verification_audit: {
        Row: {
          action: string
          admin_user_id: string | null
          agent_user_id: string
          created_at: string
          id: string
          new_status: string | null
          notes: string | null
          previous_status: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          agent_user_id: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          agent_user_id?: string
          created_at?: string
          id?: string
          new_status?: string | null
          notes?: string | null
          previous_status?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          acting_as_user_id: string | null
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
          acting_as_user_id?: string | null
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
          acting_as_user_id?: string | null
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
      auth_user_deletion_queue: {
        Row: {
          attempts: number
          auth_user_id: string | null
          completed_at: string | null
          created_at: string
          email: string | null
          id: string
          last_error: string | null
          requested_by: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          auth_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_error?: string | null
          requested_by?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          auth_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_error?: string | null
          requested_by?: string | null
          source?: string
          status?: string
          updated_at?: string
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
      buyer_qualifications: {
        Row: {
          created_at: string
          documentation_agreed: boolean
          documentation_agreed_at: string | null
          id: string
          pre_approval_file_path: string | null
          pre_approval_uploaded: boolean
          proof_of_funds_file_path: string | null
          proof_of_funds_uploaded: boolean
          qualification_method: string | null
          receive_agent_proposals: boolean
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          documentation_agreed?: boolean
          documentation_agreed_at?: string | null
          id?: string
          pre_approval_file_path?: string | null
          pre_approval_uploaded?: boolean
          proof_of_funds_file_path?: string | null
          proof_of_funds_uploaded?: boolean
          qualification_method?: string | null
          receive_agent_proposals?: boolean
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          documentation_agreed?: boolean
          documentation_agreed_at?: string | null
          id?: string
          pre_approval_file_path?: string | null
          pre_approval_uploaded?: boolean
          proof_of_funds_file_path?: string | null
          proof_of_funds_uploaded?: boolean
          qualification_method?: string | null
          receive_agent_proposals?: boolean
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "buyer_qualifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          agent_id: string | null
          buyer_email: string
          buyer_first_name: string | null
          buyer_last_name: string | null
          buyer_user_id: string | null
          created_at: string
          created_by_user_id: string
          expires_at: string | null
          id: string
          last_resent_at: string | null
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          agent_id?: string | null
          buyer_email: string
          buyer_first_name?: string | null
          buyer_last_name?: string | null
          buyer_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          expires_at?: string | null
          id?: string
          last_resent_at?: string | null
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          agent_id?: string | null
          buyer_email?: string
          buyer_first_name?: string | null
          buyer_last_name?: string | null
          buyer_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          expires_at?: string | null
          id?: string
          last_resent_at?: string | null
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_workspace_invites_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "buyer_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_workspace_members: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "buyer_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer_workspaces: {
        Row: {
          created_at: string | null
          id: string
          owner_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          owner_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      client_agent_messages: {
        Row: {
          agent_id: string
          client_id: string
          created_at: string
          email_job_id: string | null
          id: string
          message: string
          sender_user_id: string
          subject: string
        }
        Insert: {
          agent_id: string
          client_id: string
          created_at?: string
          email_job_id?: string | null
          id?: string
          message: string
          sender_user_id: string
          subject: string
        }
        Update: {
          agent_id?: string
          client_id?: string
          created_at?: string
          email_job_id?: string | null
          id?: string
          message?: string
          sender_user_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_agent_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_agent_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_relationship_status"
            referencedColumns: ["id"]
          },
        ]
      }
      client_agent_relationships: {
        Row: {
          agent_id: string
          client_id: string | null
          created_at: string | null
          crm_client_id: string | null
          ended_at: string | null
          id: string
          invitation_token: string | null
          status: string
        }
        Insert: {
          agent_id: string
          client_id?: string | null
          created_at?: string | null
          crm_client_id?: string | null
          ended_at?: string | null
          id?: string
          invitation_token?: string | null
          status?: string
        }
        Update: {
          agent_id?: string
          client_id?: string | null
          created_at?: string | null
          crm_client_id?: string | null
          ended_at?: string | null
          id?: string
          invitation_token?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_agent_relationships_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_agent_relationships_crm_client_id_fkey"
            columns: ["crm_client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_relationship_status"
            referencedColumns: ["id"]
          },
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
          agent_user_id: string | null
          client_type: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          is_favorite: boolean
          last_name: string
          notes: string | null
          office_id: string | null
          phone: string | null
          source: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          agent_user_id?: string | null
          client_type?: string | null
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_favorite?: boolean
          last_name: string
          notes?: string | null
          office_id?: string | null
          phone?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          agent_user_id?: string | null
          client_type?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_favorite?: boolean
          last_name?: string
          notes?: string | null
          office_id?: string | null
          phone?: string | null
          source?: string
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
      comms_broadcast_attachments: {
        Row: {
          broadcast_id: string
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          path: string
          sender_id: string
          size_bytes: number
          sort_order: number
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          file_name?: string
          id?: string
          kind: string
          mime_type?: string
          path: string
          sender_id: string
          size_bytes?: number
          sort_order?: number
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          path?: string
          sender_id?: string
          size_bytes?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "comms_broadcast_attachments_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "comms_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_broadcast_resends: {
        Row: {
          broadcast_id: string
          created_at: string
          id: string
          recipient_count: number
          resend_number: number
          resend_token: string
          sent_by: string
          status: string
          updated_at: string
        }
        Insert: {
          broadcast_id: string
          created_at?: string
          id?: string
          recipient_count?: number
          resend_number: number
          resend_token: string
          sent_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          broadcast_id?: string
          created_at?: string
          id?: string
          recipient_count?: number
          resend_number?: number
          resend_token?: string
          sent_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_broadcast_resends_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "comms_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_broadcast_revisions: {
        Row: {
          attachments: Json
          broadcast_id: string
          created_at: string
          edited_by: string | null
          id: string
          message: string
          revision_number: number
          subject: string
        }
        Insert: {
          attachments?: Json
          broadcast_id: string
          created_at?: string
          edited_by?: string | null
          id?: string
          message: string
          revision_number: number
          subject: string
        }
        Update: {
          attachments?: Json
          broadcast_id?: string
          created_at?: string
          edited_by?: string | null
          id?: string
          message?: string
          revision_number?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_broadcast_revisions_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "comms_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_broadcasts: {
        Row: {
          category: string
          created_at: string
          criteria: Json | null
          edit_count: number
          edited_at: string | null
          edited_by: string | null
          id: string
          message: string
          recipient_count: number
          sender_id: string
          subject: string
        }
        Insert: {
          category: string
          created_at?: string
          criteria?: Json | null
          edit_count?: number
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          message: string
          recipient_count?: number
          sender_id: string
          subject: string
        }
        Update: {
          category?: string
          created_at?: string
          criteria?: Json | null
          edit_count?: number
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          message?: string
          recipient_count?: number
          sender_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_broadcasts_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "agent_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_digest_items: {
        Row: {
          action_url: string | null
          agent_id: string
          cadence: string
          category: string | null
          created_at: string
          digest_send_id: string | null
          id: string
          item_html: string
          source_id: string
          source_type: string
          summary: Json
          title: string
        }
        Insert: {
          action_url?: string | null
          agent_id: string
          cadence: string
          category?: string | null
          created_at?: string
          digest_send_id?: string | null
          id?: string
          item_html?: string
          source_id: string
          source_type: string
          summary?: Json
          title: string
        }
        Update: {
          action_url?: string | null
          agent_id?: string
          cadence?: string
          category?: string | null
          created_at?: string
          digest_send_id?: string | null
          id?: string
          item_html?: string
          source_id?: string
          source_type?: string
          summary?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_digest_items_digest_send_id_fkey"
            columns: ["digest_send_id"]
            isOneToOne: false
            referencedRelation: "comms_digest_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      comms_digest_sends: {
        Row: {
          agent_id: string
          attempts: number
          cadence: string
          created_at: string
          email_job_id: string | null
          id: string
          item_count: number
          last_error: string | null
          max_attempts: number
          period_key: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          attempts?: number
          cadence: string
          created_at?: string
          email_job_id?: string | null
          id?: string
          item_count?: number
          last_error?: string | null
          max_attempts?: number
          period_key: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          attempts?: number
          cadence?: string
          created_at?: string
          email_job_id?: string | null
          id?: string
          item_count?: number
          last_error?: string | null
          max_attempts?: number
          period_key?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comms_digest_sends_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comms_digest_sends_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs_delivery_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "comms_digest_sends_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "v_email_job_engagement"
            referencedColumns: ["job_id"]
          },
        ]
      }
      comms_reversal_missing_rows_20260802: {
        Row: {
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      comms_reversal_rollback_20260802: {
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
      comms_reversal_targets_20260802: {
        Row: {
          created_at: string
          email: string | null
          had_row: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          had_row: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          had_row?: boolean
          user_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          email_enqueued_at: string | null
          id: string
          read_at: string | null
          recipient_agent_id: string
          sender_agent_id: string
          subject: string | null
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          email_enqueued_at?: string | null
          id?: string
          read_at?: string | null
          recipient_agent_id: string
          sender_agent_id: string
          subject?: string | null
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          email_enqueued_at?: string | null
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
          is_archived: boolean
          is_muted: boolean
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          is_archived?: boolean
          is_muted?: boolean
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          is_archived?: boolean
          is_muted?: boolean
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
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
      developer_access_requests: {
        Row: {
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          market: string | null
          note: string | null
          phone: string | null
          project_name: string | null
          provisioned_account_id: string | null
          provisioned_user_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          market?: string | null
          note?: string | null
          phone?: string | null
          project_name?: string | null
          provisioned_account_id?: string | null
          provisioned_user_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          market?: string | null
          note?: string | null
          phone?: string | null
          project_name?: string | null
          provisioned_account_id?: string | null
          provisioned_user_id?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_access_requests_provisioned_account_id_fkey"
            columns: ["provisioned_account_id"]
            isOneToOne: false
            referencedRelation: "development_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      development_account_members: {
        Row: {
          accepted_at: string
          account_id: string
          created_at: string
          id: string
          invited_by: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          account_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          account_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "development_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      development_accounts: {
        Row: {
          billing_email: string | null
          created_at: string
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          slug: string
          stripe_customer_id: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          slug: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          slug?: string
          stripe_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      development_buildings_phases: {
        Row: {
          account_id: string
          created_at: string
          development_id: string
          id: string
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          development_id: string
          id?: string
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          development_id?: string
          id?: string
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_phases_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      development_documents: {
        Row: {
          access: string
          account_id: string
          byte_size: number | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          development_id: string
          floor_plan_id: string | null
          id: string
          is_featured_agent_resource: boolean
          mime_type: string | null
          sort_order: number
          storage_path: string
          title: string
          unit_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access?: string
          account_id: string
          byte_size?: number | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          development_id: string
          floor_plan_id?: string | null
          id?: string
          is_featured_agent_resource?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_path: string
          title: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access?: string
          account_id?: string
          byte_size?: number | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          development_id?: string
          floor_plan_id?: string | null
          id?: string
          is_featured_agent_resource?: boolean
          mime_type?: string | null
          sort_order?: number
          storage_path?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_documents_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "development_documents_floor_plan_fk"
            columns: ["floor_plan_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_floor_plans"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_documents_unit_fk"
            columns: ["unit_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_units"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_floor_plans: {
        Row: {
          account_id: string
          baths: number | null
          beds: number | null
          created_at: string
          description: string | null
          development_id: string
          features: Json
          id: string
          is_active: boolean
          name: string
          price_max: number | null
          price_min: number | null
          sort_order: number
          sqft_max: number | null
          sqft_min: number | null
          unit_features: string[]
          unit_type: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          baths?: number | null
          beds?: number | null
          created_at?: string
          description?: string | null
          development_id: string
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          sqft_max?: number | null
          sqft_min?: number | null
          unit_features?: string[]
          unit_type?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          baths?: number | null
          beds?: number | null
          created_at?: string
          description?: string | null
          development_id?: string
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          sqft_max?: number | null
          sqft_min?: number | null
          unit_features?: string[]
          unit_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_floor_plans_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      development_id_registry: {
        Row: {
          created_at: string
          id: string
        }
        Insert: {
          created_at?: string
          id: string
        }
        Update: {
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      development_leads: {
        Row: {
          account_id: string
          agent_user_id: string
          assigned_contact_id: string | null
          created_at: string
          development_id: string
          id: string
          message: string | null
          notified_at: string | null
          sender_email: string
          sender_name: string
          sender_phone: string | null
          source: string
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          agent_user_id: string
          assigned_contact_id?: string | null
          created_at?: string
          development_id: string
          id?: string
          message?: string | null
          notified_at?: string | null
          sender_email: string
          sender_name: string
          sender_phone?: string | null
          source: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          agent_user_id?: string
          assigned_contact_id?: string | null
          created_at?: string
          development_id?: string
          id?: string
          message?: string | null
          notified_at?: string | null
          sender_email?: string
          sender_name?: string
          sender_phone?: string | null
          source?: string
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_leads_contact_fk"
            columns: ["assigned_contact_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_sales_contacts"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_leads_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "development_leads_unit_fk"
            columns: ["unit_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_units"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_media: {
        Row: {
          account_id: string
          alt: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          development_id: string
          duration_seconds: number | null
          external_url: string | null
          floor_plan_id: string | null
          height: number | null
          id: string
          is_hero: boolean
          kind: string
          mime_type: string | null
          sort_order: number
          source_type: string
          storage_bucket: string | null
          storage_path: string | null
          unit_id: string | null
          update_id: string | null
          updated_at: string
          updated_by: string | null
          width: number | null
        }
        Insert: {
          account_id: string
          alt?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          development_id: string
          duration_seconds?: number | null
          external_url?: string | null
          floor_plan_id?: string | null
          height?: number | null
          id?: string
          is_hero?: boolean
          kind: string
          mime_type?: string | null
          sort_order?: number
          source_type: string
          storage_bucket?: string | null
          storage_path?: string | null
          unit_id?: string | null
          update_id?: string | null
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Update: {
          account_id?: string
          alt?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          development_id?: string
          duration_seconds?: number | null
          external_url?: string | null
          floor_plan_id?: string | null
          height?: number | null
          id?: string
          is_hero?: boolean
          kind?: string
          mime_type?: string | null
          sort_order?: number
          source_type?: string
          storage_bucket?: string | null
          storage_path?: string | null
          unit_id?: string | null
          update_id?: string | null
          updated_at?: string
          updated_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "development_media_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "development_media_floor_plan_fk"
            columns: ["floor_plan_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_floor_plans"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_media_unit_fk"
            columns: ["unit_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_units"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_media_update_fk"
            columns: ["update_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_updates"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_sales_contacts: {
        Row: {
          account_id: string
          bio: string | null
          created_at: string
          development_id: string
          email: string | null
          headshot_url: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          phone: string | null
          receives_leads: boolean
          receives_showing_requests: boolean
          role: string
          sort_order: number
          title: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          bio?: string | null
          created_at?: string
          development_id: string
          email?: string | null
          headshot_url?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name: string
          phone?: string | null
          receives_leads?: boolean
          receives_showing_requests?: boolean
          role?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          bio?: string | null
          created_at?: string
          development_id?: string
          email?: string | null
          headshot_url?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          phone?: string | null
          receives_leads?: boolean
          receives_showing_requests?: boolean
          role?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_sales_contacts_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      development_saves: {
        Row: {
          agent_user_id: string
          created_at: string
          development_id: string
          id: string
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          development_id: string
          id?: string
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          development_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_saves_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
        ]
      }
      development_shares: {
        Row: {
          agent_user_id: string
          created_at: string
          development_id: string
          id: string
          share_type: string
          unit_id: string | null
        }
        Insert: {
          agent_user_id: string
          created_at?: string
          development_id: string
          id?: string
          share_type: string
          unit_id?: string | null
        }
        Update: {
          agent_user_id?: string
          created_at?: string
          development_id?: string
          id?: string
          share_type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_shares_development_id_fkey"
            columns: ["development_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_shares_unit_id_development_id_fkey"
            columns: ["unit_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_units"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_showing_requests: {
        Row: {
          account_id: string
          agent_user_id: string
          assigned_contact_id: string | null
          created_at: string
          development_id: string
          id: string
          message: string | null
          notified_at: string | null
          preferred_date: string | null
          preferred_time: string | null
          requester_email: string
          requester_name: string
          requester_phone: string | null
          status: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          agent_user_id: string
          assigned_contact_id?: string | null
          created_at?: string
          development_id: string
          id?: string
          message?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          requester_email: string
          requester_name: string
          requester_phone?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          agent_user_id?: string
          assigned_contact_id?: string | null
          created_at?: string
          development_id?: string
          id?: string
          message?: string | null
          notified_at?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          requester_email?: string
          requester_name?: string
          requester_phone?: string | null
          status?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "development_showings_contact_fk"
            columns: ["assigned_contact_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_sales_contacts"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_showings_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "development_showings_unit_fk"
            columns: ["unit_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_units"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_units: {
        Row: {
          account_id: string
          baths: number | null
          beds: number | null
          building_phase_id: string
          created_at: string
          description: string | null
          development_id: string
          estimated_delivery: string | null
          floor: string | null
          floor_plan_id: string | null
          id: string
          incentives: string | null
          is_featured: boolean
          outdoor_space: string | null
          parking_notes: string | null
          parking_spaces: number | null
          price: number | null
          price_changed_at: string | null
          price_max: number | null
          price_min: number | null
          sort_order: number
          sqft: number | null
          status: string
          status_changed_at: string | null
          unit_features: string[]
          unit_number: string
          unit_type: string | null
          updated_at: string
          views_exposure: string | null
        }
        Insert: {
          account_id: string
          baths?: number | null
          beds?: number | null
          building_phase_id: string
          created_at?: string
          description?: string | null
          development_id: string
          estimated_delivery?: string | null
          floor?: string | null
          floor_plan_id?: string | null
          id?: string
          incentives?: string | null
          is_featured?: boolean
          outdoor_space?: string | null
          parking_notes?: string | null
          parking_spaces?: number | null
          price?: number | null
          price_changed_at?: string | null
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          sqft?: number | null
          status?: string
          status_changed_at?: string | null
          unit_features?: string[]
          unit_number: string
          unit_type?: string | null
          updated_at?: string
          views_exposure?: string | null
        }
        Update: {
          account_id?: string
          baths?: number | null
          beds?: number | null
          building_phase_id?: string
          created_at?: string
          description?: string | null
          development_id?: string
          estimated_delivery?: string | null
          floor?: string | null
          floor_plan_id?: string | null
          id?: string
          incentives?: string | null
          is_featured?: boolean
          outdoor_space?: string | null
          parking_notes?: string | null
          parking_spaces?: number | null
          price?: number | null
          price_changed_at?: string | null
          price_max?: number | null
          price_min?: number | null
          sort_order?: number
          sqft?: number | null
          status?: string
          status_changed_at?: string | null
          unit_features?: string[]
          unit_number?: string
          unit_type?: string | null
          updated_at?: string
          views_exposure?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_units_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
          {
            foreignKeyName: "development_units_floor_plan_fk"
            columns: ["floor_plan_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_floor_plans"
            referencedColumns: ["id", "development_id"]
          },
          {
            foreignKeyName: "development_units_phase_fk"
            columns: ["building_phase_id", "development_id"]
            isOneToOne: false
            referencedRelation: "development_buildings_phases"
            referencedColumns: ["id", "development_id"]
          },
        ]
      }
      development_updates: {
        Row: {
          account_id: string
          body_markdown: string
          created_at: string
          created_by: string | null
          development_id: string
          id: string
          is_pinned: boolean
          is_published: boolean
          kind: string
          posted_at: string
          published_at: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          body_markdown: string
          created_at?: string
          created_by?: string | null
          development_id: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          kind: string
          posted_at?: string
          published_at?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          body_markdown?: string
          created_at?: string
          created_by?: string | null
          development_id?: string
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          kind?: string
          posted_at?: string
          published_at?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_updates_development_fk"
            columns: ["development_id", "account_id"]
            isOneToOne: false
            referencedRelation: "developments"
            referencedColumns: ["id", "account_id"]
          },
        ]
      }
      developments: {
        Row: {
          account_id: string
          actual_completion_date: string | null
          address: string | null
          admin_notes: string | null
          amenities: Json
          amenities_notes: string | null
          architect_name: string | null
          archived_at: string | null
          building_amenities: string[]
          building_details: Json
          building_type: string | null
          buyer_agent_compensation: string | null
          buyer_agent_compensation_notes: string | null
          city: string | null
          construction_type: string | null
          created_at: string
          created_by: string | null
          delivery_from: string | null
          delivery_to: string | null
          deposit_structure: string | null
          description: string | null
          developer_name: string | null
          estimated_completion: string | null
          expected_completion_month: number | null
          expected_completion_quarter: number | null
          expected_completion_year: number | null
          highlights: Json
          hoa_fee_includes: string | null
          hoa_fee_max: number | null
          hoa_fee_min: number | null
          hoa_fees: string | null
          id: string
          incentives: string | null
          interior_designer_name: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          neighborhood: string | null
          neighborhood_description: string | null
          parking_description: string | null
          parking_included: boolean | null
          paused_at: string | null
          pet_policy: string | null
          postal_code: string | null
          publish_status: string
          published_at: string | null
          published_by: string | null
          sales_status: string
          slug: string
          slug_locked_at: string | null
          stage: string
          state: string | null
          stories: number | null
          submitted_at: string | null
          tier: string
          total_buildings: number | null
          total_units: number | null
          updated_at: string
          updated_by: string | null
          year_built: number | null
        }
        Insert: {
          account_id: string
          actual_completion_date?: string | null
          address?: string | null
          admin_notes?: string | null
          amenities?: Json
          amenities_notes?: string | null
          architect_name?: string | null
          archived_at?: string | null
          building_amenities?: string[]
          building_details?: Json
          building_type?: string | null
          buyer_agent_compensation?: string | null
          buyer_agent_compensation_notes?: string | null
          city?: string | null
          construction_type?: string | null
          created_at?: string
          created_by?: string | null
          delivery_from?: string | null
          delivery_to?: string | null
          deposit_structure?: string | null
          description?: string | null
          developer_name?: string | null
          estimated_completion?: string | null
          expected_completion_month?: number | null
          expected_completion_quarter?: number | null
          expected_completion_year?: number | null
          highlights?: Json
          hoa_fee_includes?: string | null
          hoa_fee_max?: number | null
          hoa_fee_min?: number | null
          hoa_fees?: string | null
          id?: string
          incentives?: string | null
          interior_designer_name?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          neighborhood_description?: string | null
          parking_description?: string | null
          parking_included?: boolean | null
          paused_at?: string | null
          pet_policy?: string | null
          postal_code?: string | null
          publish_status?: string
          published_at?: string | null
          published_by?: string | null
          sales_status?: string
          slug: string
          slug_locked_at?: string | null
          stage?: string
          state?: string | null
          stories?: number | null
          submitted_at?: string | null
          tier?: string
          total_buildings?: number | null
          total_units?: number | null
          updated_at?: string
          updated_by?: string | null
          year_built?: number | null
        }
        Update: {
          account_id?: string
          actual_completion_date?: string | null
          address?: string | null
          admin_notes?: string | null
          amenities?: Json
          amenities_notes?: string | null
          architect_name?: string | null
          archived_at?: string | null
          building_amenities?: string[]
          building_details?: Json
          building_type?: string | null
          buyer_agent_compensation?: string | null
          buyer_agent_compensation_notes?: string | null
          city?: string | null
          construction_type?: string | null
          created_at?: string
          created_by?: string | null
          delivery_from?: string | null
          delivery_to?: string | null
          deposit_structure?: string | null
          description?: string | null
          developer_name?: string | null
          estimated_completion?: string | null
          expected_completion_month?: number | null
          expected_completion_quarter?: number | null
          expected_completion_year?: number | null
          highlights?: Json
          hoa_fee_includes?: string | null
          hoa_fee_max?: number | null
          hoa_fee_min?: number | null
          hoa_fees?: string | null
          id?: string
          incentives?: string | null
          interior_designer_name?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          neighborhood_description?: string | null
          parking_description?: string | null
          parking_included?: boolean | null
          paused_at?: string | null
          pet_policy?: string | null
          postal_code?: string | null
          publish_status?: string
          published_at?: string | null
          published_by?: string | null
          sales_status?: string
          slug?: string
          slug_locked_at?: string | null
          stage?: string
          state?: string | null
          stories?: number | null
          submitted_at?: string | null
          tier?: string
          total_buildings?: number | null
          total_units?: number | null
          updated_at?: string
          updated_by?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "developments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "development_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          provider_event_at: string | null
          provider_message_id: string | null
          recipient_email: string | null
          source: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: number
          job_id: string
          provider_event_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          source?: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: number
          job_id?: string
          provider_event_at?: string | null
          provider_message_id?: string | null
          recipient_email?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs_delivery_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "email_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_email_job_engagement"
            referencedColumns: ["job_id"]
          },
        ]
      }
      email_job_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_address: string | null
          job_id: string
          recipient_email: string
          url: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          job_id: string
          recipient_email: string
          url: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string
          recipient_email?: string
          url?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_job_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_job_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs_delivery_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "email_job_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_email_job_engagement"
            referencedColumns: ["job_id"]
          },
        ]
      }
      email_job_opens: {
        Row: {
          id: string
          ip_address: string | null
          job_id: string
          opened_at: string
          recipient_email: string
          user_agent: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          job_id: string
          opened_at?: string
          recipient_email: string
          user_agent?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          job_id?: string
          opened_at?: string
          recipient_email?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_job_opens_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_job_opens_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs_delivery_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "email_job_opens_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "v_email_job_engagement"
            referencedColumns: ["job_id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          attempts: number
          created_at: string
          delivery_status: string | null
          delivery_status_at: string | null
          id: string
          idempotency_key: string | null
          last_error: string | null
          max_attempts: number
          payload: Json
          provider_message_id: string | null
          run_after: string
          status: string
          stream: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivery_status?: string | null
          delivery_status_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          payload: Json
          provider_message_id?: string | null
          run_after?: string
          status?: string
          stream?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          delivery_status?: string | null
          delivery_status_at?: string | null
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          provider_message_id?: string | null
          run_after?: string
          status?: string
          stream?: string | null
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
      email_unsubscribes: {
        Row: {
          category: string
          email: string
          email_lower: string
          source: string
          unsubscribed_at: string
        }
        Insert: {
          category: string
          email: string
          email_lower?: string
          source?: string
          unsubscribed_at?: string
        }
        Update: {
          category?: string
          email?: string
          email_lower?: string
          source?: string
          unsubscribed_at?: string
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
          {
            foreignKeyName: "favorite_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_users: {
        Row: {
          created_at: string
          created_by: string | null
          flag_name: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          flag_name: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          flag_name?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          flag_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          flag_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "hot_sheet_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_relationship_status"
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
          sender_id: string | null
          sender_role: string
          suppress_email_notification: boolean
          updated_at: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          hot_sheet_id: string
          id?: string
          listing_id: string
          sender_id?: string | null
          sender_role?: string
          suppress_email_notification?: boolean
          updated_at?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          sender_id?: string | null
          sender_role?: string
          suppress_email_notification?: boolean
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
          {
            foreignKeyName: "hot_sheet_comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_delivery_claims: {
        Row: {
          audience: string
          created_at: string
          email_job_id: string | null
          event_id: string
          hot_sheet_id: string
          id: string
          listing_id: string
          reason: string | null
          recipient_key: string
          state: string
          status_at_send: string
          updated_at: string
        }
        Insert: {
          audience: string
          created_at?: string
          email_job_id?: string | null
          event_id: string
          hot_sheet_id: string
          id?: string
          listing_id: string
          reason?: string | null
          recipient_key: string
          state: string
          status_at_send: string
          updated_at?: string
        }
        Update: {
          audience?: string
          created_at?: string
          email_job_id?: string | null
          event_id?: string
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          reason?: string | null
          recipient_key?: string
          state?: string
          status_at_send?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_delivery_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hot_sheet_listing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_delivery_claims_hot_sheet_id_fkey"
            columns: ["hot_sheet_id"]
            isOneToOne: false
            referencedRelation: "hot_sheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_delivery_claims_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_delivery_claims_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_event_stage_log: {
        Row: {
          created_at: string
          detail: Json
          event_id: string | null
          id: string
          listing_id: string | null
          outcome: string
          stage: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_id?: string | null
          id?: string
          listing_id?: string | null
          outcome: string
          stage: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event_id?: string | null
          id?: string
          listing_id?: string | null
          outcome?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_event_stage_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hot_sheet_listing_events"
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
          {
            foreignKeyName: "hot_sheet_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hot_sheet_listing_events: {
        Row: {
          attempts: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          listing_id: string
          new_status: string
          next_attempt_at: string | null
          old_status: string | null
          state: string
          trigger_op: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          listing_id: string
          new_status: string
          next_attempt_at?: string | null
          old_status?: string | null
          state?: string
          trigger_op: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          listing_id?: string
          new_status?: string
          next_attempt_at?: string | null
          old_status?: string | null
          state?: string
          trigger_op?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_listing_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hot_sheet_listing_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "hot_sheet_listing_status_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "hot_sheet_notifications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          status_at_send: string
        }
        Insert: {
          hot_sheet_id: string
          id?: string
          listing_id: string
          sent_at?: string | null
          status_at_send: string
        }
        Update: {
          hot_sheet_id?: string
          id?: string
          listing_id?: string
          sent_at?: string | null
          status_at_send?: string
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
          {
            foreignKeyName: "hot_sheet_sent_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
      hot_sheet_subscribers: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          hot_sheet_id: string
          id: string
          last_name: string | null
          preview_token: string
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          hot_sheet_id: string
          id?: string
          last_name?: string | null
          preview_token?: string
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          hot_sheet_id?: string
          id?: string
          last_name?: string | null
          preview_token?: string
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hot_sheet_subscribers_hot_sheet_id_fkey"
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
          {
            foreignKeyName: "hot_sheets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_with_relationship_status"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_events: {
        Row: {
          actor_user_id: string | null
          client_email: string | null
          client_id: string | null
          created_at: string
          email_job_id: string | null
          event_type: string
          hot_sheet_id: string | null
          id: string
          meta: Json
          token_id: string
        }
        Insert: {
          actor_user_id?: string | null
          client_email?: string | null
          client_id?: string | null
          created_at?: string
          email_job_id?: string | null
          event_type: string
          hot_sheet_id?: string | null
          id?: string
          meta?: Json
          token_id: string
        }
        Update: {
          actor_user_id?: string | null
          client_email?: string | null
          client_id?: string | null
          created_at?: string
          email_job_id?: string | null
          event_type?: string
          hot_sheet_id?: string | null
          id?: string
          meta?: Json
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invite_events_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_events_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs_delivery_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "invite_events_email_job_id_fkey"
            columns: ["email_job_id"]
            isOneToOne: false
            referencedRelation: "v_email_job_engagement"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "invite_events_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "share_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_audit_events: {
        Row: {
          acting_user_id: string | null
          address: string | null
          created_at: string
          created_via_function: string | null
          creation_source: string | null
          db_role: string | null
          details: Json | null
          event_type: string
          id: string
          listing_agent_id: string | null
          listing_id: string | null
          listing_number: string | null
          listing_status: string | null
          request_id: string | null
        }
        Insert: {
          acting_user_id?: string | null
          address?: string | null
          created_at?: string
          created_via_function?: string | null
          creation_source?: string | null
          db_role?: string | null
          details?: Json | null
          event_type: string
          id?: string
          listing_agent_id?: string | null
          listing_id?: string | null
          listing_number?: string | null
          listing_status?: string | null
          request_id?: string | null
        }
        Update: {
          acting_user_id?: string | null
          address?: string | null
          created_at?: string
          created_via_function?: string | null
          creation_source?: string | null
          db_role?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          listing_agent_id?: string | null
          listing_id?: string | null
          listing_number?: string | null
          listing_status?: string | null
          request_id?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "listing_price_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reminder_log: {
        Row: {
          created_at: string
          kind: string
          last_sent_at: string
          listing_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          kind?: string
          last_sent_at?: string
          listing_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          kind?: string
          last_sent_at?: string
          listing_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reminder_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_reminder_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "listing_shares_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "listing_stats_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "listing_status_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          address_normalized: string | null
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
          created_by_user_id: string | null
          created_via_function: string | null
          creation_request_id: string | null
          creation_source: string | null
          dcmls_error: string | null
          dcmls_last_updated_at: string | null
          dcmls_published_at: string | null
          dcmls_status: string
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
          hidden_from_market_activity: boolean
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
          parking_spaces: number | null
          pet_options: Json | null
          pets_comment: string | null
          photos: Json | null
          price: number
          price_range_max: number | null
          price_range_min: number | null
          property_features: Json | null
          property_styles: Json | null
          property_type: string | null
          property_website_url: string | null
          publish_to_dcmls: boolean
          rental_fee: number | null
          rental_fee_text: string | null
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
          address_normalized?: string | null
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
          created_by_user_id?: string | null
          created_via_function?: string | null
          creation_request_id?: string | null
          creation_source?: string | null
          dcmls_error?: string | null
          dcmls_last_updated_at?: string | null
          dcmls_published_at?: string | null
          dcmls_status?: string
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
          hidden_from_market_activity?: boolean
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
          parking_spaces?: number | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price: number
          price_range_max?: number | null
          price_range_min?: number | null
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          publish_to_dcmls?: boolean
          rental_fee?: number | null
          rental_fee_text?: string | null
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
          address_normalized?: string | null
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
          created_by_user_id?: string | null
          created_via_function?: string | null
          creation_request_id?: string | null
          creation_source?: string | null
          dcmls_error?: string | null
          dcmls_last_updated_at?: string | null
          dcmls_published_at?: string | null
          dcmls_status?: string
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
          hidden_from_market_activity?: boolean
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
          parking_spaces?: number | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price?: number
          price_range_max?: number | null
          price_range_min?: number | null
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          publish_to_dcmls?: boolean
          rental_fee?: number | null
          rental_fee_text?: string | null
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
          {
            foreignKeyName: "listings_original_listing_id_fkey"
            columns: ["original_listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
            foreignKeyName: "off_market_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
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
          company: string | null
          converted_user_id: string | null
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          license_last_name: string | null
          license_number: string | null
          license_state: string | null
          phone: string | null
          processed: boolean | null
          processed_at: string | null
          processed_by: string | null
          rejected_at: string | null
          rejected_reason: string | null
          status: string
          turnstile_verified_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          last_name: string
          license_last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          phone?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          status?: string
          turnstile_verified_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company?: string | null
          converted_user_id?: string | null
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          license_last_name?: string | null
          license_number?: string | null
          license_state?: string | null
          phone?: string | null
          processed?: boolean | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          status?: string
          turnstile_verified_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          deactivated_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deactivated_at?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deactivated_at?: string | null
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
      saved_searches: {
        Row: {
          buyer_workspace_id: string
          created_at: string | null
          created_by: string
          criteria: Json | null
          id: string
          name: string
          search_url: string
        }
        Insert: {
          buyer_workspace_id: string
          created_at?: string | null
          created_by: string
          criteria?: Json | null
          id?: string
          name: string
          search_url: string
        }
        Update: {
          buyer_workspace_id?: string
          created_at?: string | null
          created_by?: string
          criteria?: Json | null
          id?: string
          name?: string
          search_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_buyer_workspace_id_fkey"
            columns: ["buyer_workspace_id"]
            isOneToOne: false
            referencedRelation: "buyer_workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          revoked_at: string | null
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
          revoked_at?: string | null
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
          revoked_at?: string | null
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
          {
            foreignKeyName: "showing_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted_at: string | null
          agent_id: string
          display_order: number | null
          id: string
          invite_token: string | null
          invited_at: string | null
          invited_by: string | null
          joined_at: string
          role: string
          status: string
          team_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          agent_id: string
          display_order?: number | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          team_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string
          display_order?: number | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string
          role?: string
          status?: string
          team_id?: string
          updated_at?: string
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
          approved_at: string | null
          approved_by: string | null
          company: string | null
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
          rejection_reason: string | null
          requester_role: string | null
          slug: string
          social_links: Json | null
          status: string
          team_lead_user_id: string | null
          team_photo_url: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
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
          rejection_reason?: string | null
          requester_role?: string | null
          slug: string
          social_links?: Json | null
          status?: string
          team_lead_user_id?: string | null
          team_photo_url?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
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
          rejection_reason?: string | null
          requester_role?: string | null
          slug?: string
          social_links?: Json | null
          status?: string
          team_lead_user_id?: string | null
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
      clients_with_relationship_status: {
        Row: {
          agent_id: string | null
          client_type: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
          is_favorite: boolean | null
          last_name: string | null
          notes: string | null
          phone: string | null
          relationship_created_at: string | null
          relationship_ended_at: string | null
          relationship_status: string | null
          relationship_user_id: string | null
          updated_at: string | null
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
          unread_count: number | null
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
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs_delivery_status: {
        Row: {
          attempts: number | null
          created_at: string | null
          delivery_status: string | null
          delivery_status_at: string | null
          job_id: string | null
          last_error: string | null
          max_attempts: number | null
          provider_message_id: string | null
          queue_status: string | null
          recipient: string | null
          subject: string | null
          template: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          delivery_status?: string | null
          delivery_status_at?: string | null
          job_id?: string | null
          last_error?: string | null
          max_attempts?: number | null
          provider_message_id?: string | null
          queue_status?: string | null
          recipient?: never
          subject?: never
          template?: never
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          delivery_status?: string | null
          delivery_status_at?: string | null
          job_id?: string | null
          last_error?: string | null
          max_attempts?: number | null
          provider_message_id?: string | null
          queue_status?: string | null
          recipient?: never
          subject?: never
          template?: never
        }
        Relationships: []
      }
      listings_public: {
        Row: {
          activation_date: string | null
          active_date: string | null
          address: string | null
          agent_id: string | null
          amenities: Json | null
          annual_property_tax: number | null
          appointment_required: boolean | null
          area_amenities: string[] | null
          basement_features_list: Json | null
          basement_floor_types: Json | null
          basement_types: Json | null
          bathrooms: number | null
          beach_nearby: boolean | null
          bedrooms: number | null
          building_name: string | null
          city: string | null
          commercial_details: Json | null
          condo_details: Json | null
          construction_features: Json | null
          cooling_types: Json | null
          county: string | null
          created_at: string | null
          dcmls_status: string | null
          description: string | null
          entry_only: boolean | null
          exterior_features_list: Json | null
          floor_plans: Json | null
          floors: number | null
          foundation_types: Json | null
          garage_additional_features_list: Json | null
          garage_features_list: Json | null
          garage_spaces: number | null
          go_live_date: string | null
          green_features: Json | null
          handicap_access: string | null
          handicap_accessible: string | null
          has_basement: boolean | null
          has_storage: boolean | null
          heating_types: Json | null
          id: string | null
          latitude: number | null
          laundry_type: string | null
          lender_owned: boolean | null
          list_date: string | null
          listing_number: string | null
          listing_type: string | null
          longitude: number | null
          lot_size: number | null
          multi_family_details: Json | null
          neighborhood: string | null
          num_fireplaces: number | null
          open_houses: Json | null
          outdoor_space: Json | null
          parking_features_list: Json | null
          parking_spaces: number | null
          pet_options: Json | null
          pets_comment: string | null
          photos: Json | null
          price: number | null
          price_range_max: number | null
          price_range_min: number | null
          property_features: Json | null
          property_styles: Json | null
          property_type: string | null
          property_website_url: string | null
          publish_to_dcmls: boolean | null
          rental_fee: number | null
          rental_fee_text: string | null
          roof_materials: Json | null
          short_sale: boolean | null
          square_feet: number | null
          state: string | null
          status: string | null
          storage_options: Json | null
          tax_year: number | null
          total_parking_spaces: number | null
          town: string | null
          unit_number: string | null
          updated_at: string | null
          video_url: string | null
          virtual_tour_url: string | null
          water_view: boolean | null
          water_view_type: string | null
          waterfront: boolean | null
          year_built: number | null
          zip_code: string | null
        }
        Insert: {
          activation_date?: string | null
          active_date?: string | null
          address?: string | null
          agent_id?: string | null
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          area_amenities?: string[] | null
          basement_features_list?: Json | null
          basement_floor_types?: Json | null
          basement_types?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          building_name?: string | null
          city?: string | null
          commercial_details?: Json | null
          condo_details?: Json | null
          construction_features?: Json | null
          cooling_types?: Json | null
          county?: string | null
          created_at?: string | null
          dcmls_status?: string | null
          description?: string | null
          entry_only?: boolean | null
          exterior_features_list?: Json | null
          floor_plans?: Json | null
          floors?: number | null
          foundation_types?: Json | null
          garage_additional_features_list?: Json | null
          garage_features_list?: Json | null
          garage_spaces?: number | null
          go_live_date?: string | null
          green_features?: Json | null
          handicap_access?: string | null
          handicap_accessible?: string | null
          has_basement?: boolean | null
          has_storage?: boolean | null
          heating_types?: Json | null
          id?: string | null
          latitude?: number | null
          laundry_type?: string | null
          lender_owned?: boolean | null
          list_date?: string | null
          listing_number?: string | null
          listing_type?: string | null
          longitude?: number | null
          lot_size?: number | null
          multi_family_details?: Json | null
          neighborhood?: string | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          outdoor_space?: Json | null
          parking_features_list?: Json | null
          parking_spaces?: number | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price?: number | null
          price_range_max?: number | null
          price_range_min?: number | null
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          publish_to_dcmls?: boolean | null
          rental_fee?: number | null
          rental_fee_text?: string | null
          roof_materials?: Json | null
          short_sale?: boolean | null
          square_feet?: number | null
          state?: string | null
          status?: string | null
          storage_options?: Json | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          town?: string | null
          unit_number?: string | null
          updated_at?: string | null
          video_url?: string | null
          virtual_tour_url?: string | null
          water_view?: boolean | null
          water_view_type?: string | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code?: string | null
        }
        Update: {
          activation_date?: string | null
          active_date?: string | null
          address?: string | null
          agent_id?: string | null
          amenities?: Json | null
          annual_property_tax?: number | null
          appointment_required?: boolean | null
          area_amenities?: string[] | null
          basement_features_list?: Json | null
          basement_floor_types?: Json | null
          basement_types?: Json | null
          bathrooms?: number | null
          beach_nearby?: boolean | null
          bedrooms?: number | null
          building_name?: string | null
          city?: string | null
          commercial_details?: Json | null
          condo_details?: Json | null
          construction_features?: Json | null
          cooling_types?: Json | null
          county?: string | null
          created_at?: string | null
          dcmls_status?: string | null
          description?: string | null
          entry_only?: boolean | null
          exterior_features_list?: Json | null
          floor_plans?: Json | null
          floors?: number | null
          foundation_types?: Json | null
          garage_additional_features_list?: Json | null
          garage_features_list?: Json | null
          garage_spaces?: number | null
          go_live_date?: string | null
          green_features?: Json | null
          handicap_access?: string | null
          handicap_accessible?: string | null
          has_basement?: boolean | null
          has_storage?: boolean | null
          heating_types?: Json | null
          id?: string | null
          latitude?: number | null
          laundry_type?: string | null
          lender_owned?: boolean | null
          list_date?: string | null
          listing_number?: string | null
          listing_type?: string | null
          longitude?: number | null
          lot_size?: number | null
          multi_family_details?: Json | null
          neighborhood?: string | null
          num_fireplaces?: number | null
          open_houses?: Json | null
          outdoor_space?: Json | null
          parking_features_list?: Json | null
          parking_spaces?: number | null
          pet_options?: Json | null
          pets_comment?: string | null
          photos?: Json | null
          price?: number | null
          price_range_max?: number | null
          price_range_min?: number | null
          property_features?: Json | null
          property_styles?: Json | null
          property_type?: string | null
          property_website_url?: string | null
          publish_to_dcmls?: boolean | null
          rental_fee?: number | null
          rental_fee_text?: string | null
          roof_materials?: Json | null
          short_sale?: boolean | null
          square_feet?: number | null
          state?: string | null
          status?: string | null
          storage_options?: Json | null
          tax_year?: number | null
          total_parking_spaces?: number | null
          town?: string | null
          unit_number?: string | null
          updated_at?: string | null
          video_url?: string | null
          virtual_tour_url?: string | null
          water_view?: boolean | null
          water_view_type?: string | null
          waterfront?: boolean | null
          year_built?: number | null
          zip_code?: string | null
        }
        Relationships: []
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
      v_email_job_engagement: {
        Row: {
          category: string | null
          click_count: number | null
          created_at: string | null
          delivery_status: string | null
          first_clicked_at: string | null
          first_opened_at: string | null
          job_id: string | null
          open_count: number | null
          template: string | null
        }
        Insert: {
          category?: never
          click_count?: never
          created_at?: string | null
          delivery_status?: string | null
          first_clicked_at?: never
          first_opened_at?: never
          job_id?: string | null
          open_count?: never
          template?: never
        }
        Update: {
          category?: never
          click_count?: never
          created_at?: string | null
          delivery_status?: string | null
          first_clicked_at?: never
          first_opened_at?: never
          job_id?: string | null
          open_count?: never
          template?: never
        }
        Relationships: []
      }
      v_email_unsubscribes_status: {
        Row: {
          categories: string[] | null
          email: string | null
          first_unsubscribed_at: string | null
          last_unsubscribed_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _purge_expired_agent_active_context: { Args: never; Returns: undefined }
      accept_client_hot_sheet_invite: {
        Args: { _token: string }
        Returns: Json
      }
      activate_agent_relationship:
        | { Args: { _agent_id: string }; Returns: string }
        | {
            Args: { _agent_id: string; _crm_client_id?: string }
            Returns: string
          }
      activation_issue_core:
        | {
            Args: {
              p_agent_name: string
              p_allow_replace: boolean
              p_expires_at: string
              p_id: string
              p_issuance_key: string
              p_reply_to: string
              p_subject: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_agent_name: string
              p_allow_previously_deleted?: boolean
              p_allow_replace: boolean
              p_expires_at: string
              p_id: string
              p_issuance_key: string
              p_reply_to: string
              p_subject: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
      admin_approve_developer_access_request: {
        Args: {
          _account_name?: string
          _account_slug?: string
          _notes?: string
          _owner_user_id: string
          _request_id: string
        }
        Returns: string
      }
      admin_auth_user_signin_map: {
        Args: never
        Returns: {
          email: string
          last_sign_in_at: string
        }[]
      }
      admin_deactivate_buyer: { Args: { p_user_id: string }; Returns: Json }
      admin_decide_developer_access_request: {
        Args: { _decision: string; _notes?: string; _request_id: string }
        Returns: {
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          market: string | null
          note: string | null
          phone: string | null
          project_name: string | null
          provisioned_account_id: string | null
          provisioned_user_id: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          status: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "developer_access_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_delete_agent: { Args: { p_agent_id: string }; Returns: Json }
      admin_delete_client: { Args: { p_client_id: string }; Returns: undefined }
      admin_delete_consumer: { Args: { p_user_id: string }; Returns: undefined }
      admin_delete_early_access:
        | { Args: { p_id: string }; Returns: number }
        | { Args: { p_email?: string; p_id: string }; Returns: number }
      admin_delete_pending_verification: {
        Args: { p_email?: string; p_id: string }
        Returns: Json
      }
      admin_get_development_admin_notes: {
        Args: { _development_id: string }
        Returns: string
      }
      admin_list_developer_access_requests: {
        Args: { _status?: string }
        Returns: {
          activated_at: string
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          market: string
          note: string
          phone: string
          project_name: string
          provisioned_account_id: string
          provisioned_user_id: string
          review_notes: string
          reviewed_at: string
          status: string
          website: string
        }[]
      }
      admin_provision_developer_access: {
        Args: {
          _account_name?: string
          _account_slug?: string
          _notes?: string
          _owner_user_id: string
          _request_id: string
          _reviewer_id?: string
        }
        Returns: Json
      }
      admin_replace_development_owner: {
        Args: { _account_id: string; _new_owner_user_id: string }
        Returns: undefined
      }
      admin_set_developer_role: {
        Args: { _enabled?: boolean; _user_id: string }
        Returns: boolean
      }
      admin_set_development_account_active: {
        Args: { _account_id: string; _is_active: boolean }
        Returns: boolean
      }
      admin_set_development_admin_notes: {
        Args: { _development_id: string; _notes: string }
        Returns: string
      }
      agent_end_client_relationship: {
        Args: { p_client_id: string }
        Returns: number
      }
      agent_end_client_relationship_by_id: {
        Args: { p_relationship_id: string }
        Returns: number
      }
      agent_is_activation_eligible:
        | { Args: { _user_id: string }; Returns: boolean }
        | {
            Args: { _allow_previously_deleted: boolean; _user_id: string }
            Returns: boolean
          }
      agent_is_login_eligible: { Args: { _user_id: string }; Returns: boolean }
      agent_reactivate_buyer: {
        Args: { p_crm_client_id: string }
        Returns: Json
      }
      archive_conversations_between_users: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: undefined
      }
      assert_agent_context: {
        Args: { p_owner_user_id: string }
        Returns: boolean
      }
      assert_service_role: { Args: never; Returns: undefined }
      assign_self_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      auth_user_exists_by_email: { Args: { p_email: string }; Returns: boolean }
      auto_activate_listings: { Args: never; Returns: undefined }
      begin_comms_broadcast_resend: {
        Args: { _broadcast_id: string; _resend_token: string }
        Returns: Json
      }
      build_activation_email_payload: {
        Args: {
          p_agent_name: string
          p_reply_to: string
          p_subject: string
          p_to_email: string
          p_token_id: string
        }
        Returns: Json
      }
      build_login_link_email_payload: {
        Args: {
          p_agent_name: string
          p_reply_to: string
          p_subject: string
          p_to_email: string
          p_token_id: string
        }
        Returns: Json
      }
      build_message_email_payload: {
        Args: { p_message_id: string }
        Returns: Json
      }
      can_act_for_agent: { Args: { p_agent_user_id: string }; Returns: boolean }
      can_agent_view_development: {
        Args: { _development_id: string }
        Returns: boolean
      }
      can_authenticated_buyer_view_hot_sheet_client: {
        Args: { p_crm_client_id: string; p_hot_sheet_id: string }
        Returns: boolean
      }
      can_authenticated_user_delete_hot_sheet: {
        Args: { p_hot_sheet_id: string }
        Returns: boolean
      }
      can_member_read_development_object: {
        Args: { _name: string }
        Returns: boolean
      }
      can_write_development_object: {
        Args: { _name: string }
        Returns: boolean
      }
      can_write_listing_storage_folder: {
        Args: { _folder: string }
        Returns: boolean
      }
      check_client_has_other_agent: {
        Args: { p_client_email: string }
        Returns: boolean
      }
      check_hot_sheet_matches: {
        Args: { p_hot_sheet_id: string }
        Returns: {
          listing_id: string
        }[]
      }
      claim_agent_activation_token: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      claim_agent_login_token: { Args: { p_token_hash: string }; Returns: Json }
      claim_hot_sheet_events: {
        Args: {
          p_lease_seconds?: number
          p_limit?: number
          p_worker_id?: string
        }
        Returns: {
          attempts: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          lease_expires_at: string | null
          listing_id: string
          new_status: string
          next_attempt_at: string | null
          old_status: string | null
          state: string
          trigger_op: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "hot_sheet_listing_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_blocking_auth_identity: {
        Args: { _email: string }
        Returns: number
      }
      cleanup_expired_share_tokens: { Args: never; Returns: undefined }
      cleanup_orphan_auth_identity: {
        Args: { _email: string }
        Returns: number
      }
      clear_active_owner_context: { Args: never; Returns: undefined }
      complete_agent_activation_token: {
        Args: { p_token_id: string }
        Returns: boolean
      }
      complete_agent_login_token: {
        Args: { p_token_id: string }
        Returns: boolean
      }
      complete_hot_sheet_event: {
        Args: { p_event_id: string; p_state?: string; p_worker_id: string }
        Returns: boolean
      }
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
      create_buyer_hot_sheet: {
        Args: { p_criteria: Json; p_name: string }
        Returns: string
      }
      create_development_account: {
        Args: {
          _billing_email?: string
          _legal_name?: string
          _name: string
          _owner_user_id: string
          _slug: string
        }
        Returns: string
      }
      current_account_owner_id: { Args: never; Returns: string }
      current_is_eligible_agent: { Args: never; Returns: boolean }
      current_request_role: { Args: never; Returns: string }
      delete_draft_listing: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      delete_pending_buyer_hot_sheet: {
        Args: { p_crm_client_id: string; p_hot_sheet_id: string }
        Returns: Json
      }
      developer_is_activation_eligible:
        | { Args: { _user_id: string }; Returns: boolean }
        | {
            Args: { _allow_previously_deleted: boolean; _user_id: string }
            Returns: boolean
          }
      development_account_id: {
        Args: { _development_id: string }
        Returns: string
      }
      development_from_storage_path: {
        Args: { _name: string }
        Returns: string
      }
      dispatch_hot_sheet_listing: {
        Args: { p_listing_id: string }
        Returns: number
      }
      effective_agent_id: { Args: never; Returns: string }
      email_job_is_blocked: {
        Args: { p_idempotency_key: string; p_template: string }
        Returns: boolean
      }
      email_jobs_claim:
        | {
            Args: { p_limit: number }
            Returns: {
              attempts: number
              created_at: string
              delivery_status: string | null
              delivery_status_at: string | null
              id: string
              idempotency_key: string | null
              last_error: string | null
              max_attempts: number
              payload: Json
              provider_message_id: string | null
              run_after: string
              status: string
              stream: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "email_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { p_limit: number; p_streams: string[] }
            Returns: {
              attempts: number
              created_at: string
              delivery_status: string | null
              delivery_status_at: string | null
              id: string
              idempotency_key: string | null
              last_error: string | null
              max_attempts: number
              payload: Json
              provider_message_id: string | null
              run_after: string
              status: string
              stream: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "email_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      email_stream_for_template: {
        Args: { p_template: string }
        Returns: string
      }
      end_client_relationship: { Args: never; Returns: number }
      enqueue_hot_sheet_delivery: {
        Args: {
          p_audience: string
          p_event_id: string
          p_hot_sheet_id: string
          p_idempotency_key: string
          p_listing_id: string
          p_pause_reason?: string
          p_paused?: boolean
          p_payload: Json
          p_recipient_key: string
          p_status: string
        }
        Returns: Json
      }
      ensure_agent_role_for_user: {
        Args: { _user_id: string }
        Returns: undefined
      }
      ensure_conversation_participants_for_caller: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      fail_hot_sheet_event: {
        Args: { p_error: string; p_event_id: string; p_worker_id: string }
        Returns: boolean
      }
      find_current_agent_deletion: {
        Args: { p_email: string }
        Returns: {
          deleted_at: string
          deleted_by: string
          deletion_reason: string
          email: string
          first_name: string
          id: string
          last_name: string
          original_user_id: string
        }[]
      }
      generate_aac_id: { Args: never; Returns: string }
      generate_listing_number: { Args: never; Returns: string }
      get_agent_presence: {
        Args: { user_ids: string[] }
        Returns: {
          last_seen_at: string
          user_id: string
        }[]
      }
      get_client_favorites_for_agent: {
        Args: { p_buyer_user_id: string; p_crm_client_id?: string }
        Returns: {
          address: string
          bathrooms: number
          bedrooms: number
          city: string
          created_at: string
          id: string
          listing_id: string
          photos: Json
          price: number
          property_type: string
          square_feet: number
          state: string
          zip_code: string
        }[]
      }
      get_delegate_invite_preview: { Args: { p_token: string }; Returns: Json }
      get_development_engagement_summary: {
        Args: { _development_id: string }
        Returns: {
          leads_count: number
          saves_count: number
          shares_count: number
          showings_count: number
        }[]
      }
      get_development_sales_inventory: {
        Args: { _development_id: string }
        Returns: {
          baths: number
          beds: number
          floor: string
          floor_plan_name: string
          phase_name: string
          price: number
          sqft: number
          status: string
          unit_id: string
          unit_number: string
        }[]
      }
      get_hot_sheet_by_token: { Args: { _token: string }; Returns: Json }
      get_hot_sheet_for_member: {
        Args: { _hot_sheet_id: string }
        Returns: Json
      }
      get_listing_interest_signals: {
        Args: { p_agent_id: string; p_listing_ids: string[] }
        Returns: {
          comments_count: number
          hotsheet_match_count: number
          listing_id: string
          saves_count: number
        }[]
      }
      get_newest_verified_agents: {
        Args: { _limit?: number }
        Returns: {
          company: string
          first_name: string
          headshot_url: string
          id: string
          last_name: string
          office_city: string
          office_state: string
          verified_at: string
        }[]
      }
      get_public_listing: {
        Args: { p_listing_id: string }
        Returns: {
          activation_date: string
          active_date: string
          address: string
          amenities: Json
          annual_property_tax: number
          appointment_required: boolean
          area_amenities: string[]
          basement_features_list: Json
          basement_floor_types: Json
          basement_types: Json
          bathrooms: number
          beach_nearby: boolean
          bedrooms: number
          building_name: string
          city: string
          commercial_details: Json
          condo_details: Json
          construction_features: Json
          cooling_types: Json
          county: string
          created_at: string
          dcmls_status: string
          description: string
          entry_only: boolean
          exterior_features_list: Json
          floor_plans: Json
          floors: number
          foundation_types: Json
          garage_additional_features_list: Json
          garage_features_list: Json
          garage_spaces: number
          go_live_date: string
          green_features: Json
          handicap_access: string
          handicap_accessible: string
          has_basement: boolean
          has_storage: boolean
          heating_types: Json
          id: string
          latitude: number
          laundry_type: string
          lender_owned: boolean
          list_date: string
          listing_number: string
          listing_type: string
          longitude: number
          lot_size: number
          multi_family_details: Json
          neighborhood: string
          num_fireplaces: number
          open_houses: Json
          outdoor_space: Json
          parking_features_list: Json
          parking_spaces: number
          pet_options: Json
          pets_comment: string
          photos: Json
          price: number
          price_range_max: number
          price_range_min: number
          property_features: Json
          property_styles: Json
          property_type: string
          property_website_url: string
          publish_to_dcmls: boolean
          rental_fee: number
          rental_fee_text: string
          roof_materials: Json
          short_sale: boolean
          square_feet: number
          state: string
          status: string
          storage_options: Json
          tax_year: number
          total_parking_spaces: number
          town: string
          unit_number: string
          updated_at: string
          video_url: string
          virtual_tour_url: string
          water_view: boolean
          water_view_type: string
          waterfront: boolean
          year_built: number
          zip_code: string
        }[]
      }
      get_public_listing_agent: {
        Args: { p_listing_id: string }
        Returns: {
          aac_id: string
          agent_id: string
          cell_phone: string
          company: string
          email: string
          first_name: string
          headshot_url: string
          last_name: string
          logo_url: string
          office_city: string
          office_name: string
          office_phone: string
          office_state: string
          phone: string
          title: string
        }[]
      }
      get_system_health: { Args: never; Returns: Json }
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
      hot_sheet_has_shared_workspace_recipients: {
        Args: { p_hot_sheet_id: string }
        Returns: boolean
      }
      invoke_agent_activation_nudge_once: { Args: never; Returns: undefined }
      invoke_development_notification_retry: { Args: never; Returns: undefined }
      invoke_process_comms_digests: { Args: never; Returns: undefined }
      invoke_process_email_queue: { Args: never; Returns: undefined }
      invoke_process_hot_sheet_events: { Args: never; Returns: undefined }
      is_accepted_delegate_for: {
        Args: { p_owner_user_id: string }
        Returns: boolean
      }
      is_accepted_team_assistant: {
        Args: { p_team_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_account_owner: { Args: never; Returns: boolean }
      is_api_request: { Args: never; Returns: boolean }
      is_buyer_represented_by_other_agent: {
        Args: {
          p_email: string
          p_self_agent_id: string
          p_self_crm_client_id?: string
        }
        Returns: {
          agent_id: string
          client_id: string
          crm_client_id: string
          relationship_id: string
          status: string
        }[]
      }
      is_buyer_workspace_member: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_buyer_workspace_owner: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation_id: string }
        Returns: boolean
      }
      is_delegate: { Args: never; Returns: boolean }
      is_developer: { Args: { _user_id: string }; Returns: boolean }
      is_development_account_active: {
        Args: { _account_id: string }
        Returns: boolean
      }
      is_development_member: {
        Args: { _account_id: string; _roles?: string[] }
        Returns: boolean
      }
      is_eligible_agent: { Args: { _user_id: string }; Returns: boolean }
      is_email_registered_with_aac: {
        Args: { p_email: string }
        Returns: boolean
      }
      is_email_unsubscribed: {
        Args: { _category: string; _email: string }
        Returns: boolean
      }
      is_feature_enabled: { Args: { p_flag_name: string }; Returns: boolean }
      is_hot_sheet_participant: {
        Args: { p_hot_sheet_id: string }
        Returns: boolean
      }
      is_licensed_owner: { Args: never; Returns: boolean }
      is_public_listing_status: { Args: { p_status: string }; Returns: boolean }
      is_published_development: {
        Args: { _development_id: string }
        Returns: boolean
      }
      is_team_delegate: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_lead: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_manager: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member_visible: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_owner: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: boolean
      }
      is_verified_agent: { Args: never; Returns: boolean }
      is_verified_agent_for_context: {
        Args: { p_owner_user_id: string }
        Returns: boolean
      }
      issue_activation_resend_handle: {
        Args: {
          p_expires_at: string
          p_handle_hash: string
          p_token_id: string
        }
        Returns: boolean
      }
      issue_agent_activation_token:
        | {
            Args: {
              p_agent_name?: string
              p_expires_at: string
              p_id: string
              p_reply_to?: string
              p_subject?: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_agent_name?: string
              p_allow_previously_deleted?: boolean
              p_expires_at: string
              p_id: string
              p_reply_to?: string
              p_subject?: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
      issue_agent_login_token: {
        Args: {
          p_agent_name?: string
          p_expires_at: string
          p_id: string
          p_issuance_key: string
          p_reply_to?: string
          p_subject?: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: Json
      }
      jwt_role_text: { Args: never; Returns: string }
      list_account_delegates_for_owner: {
        Args: never
        Returns: {
          accepted_at: string
          delegate_user_id: string
          display_name: string
          invite_email: string
          invited_at: string
          is_online: boolean
          last_active_at: string
          member_id: string
          role_label: string
          status: Database["public"]["Enums"]["agent_delegate_status"]
        }[]
      }
      list_account_delegates_for_team: {
        Args: { p_team_id: string }
        Returns: {
          accepted_at: string
          delegate_user_id: string
          display_name: string
          invite_email: string
          invited_at: string
          is_online: boolean
          last_active_at: string
          member_id: string
          role_label: string
          status: Database["public"]["Enums"]["agent_delegate_status"]
        }[]
      }
      list_delegate_memberships: {
        Args: never
        Returns: {
          display_name: string
          last_active_at: string
          owner_first_name: string
          owner_last_name: string
          owner_user_id: string
          role_label: string
        }[]
      }
      list_development_submissions_awaiting_notification: {
        Args: { _kind: string; _limit?: number }
        Returns: {
          account_id: string
          created_at: string
          development_id: string
          id: string
        }[]
      }
      list_hot_sheets_for_member: {
        Args: { _hot_sheet_ids: string[] }
        Returns: {
          client_id: string
          created_at: string
          criteria: Json
          id: string
          is_active: boolean
          last_sent_at: string
          name: string
          notification_schedule: string
          notify_agent_email: boolean
          notify_client_email: boolean
          updated_at: string
          user_id: string
        }[]
      }
      list_my_accepted_hot_sheet_tokens: {
        Args: never
        Returns: {
          accepted_at: string
          accepted_by_user_id: string
          payload: Json
          token: string
        }[]
      }
      list_sent_listings_for_member: {
        Args: { _hot_sheet_ids: string[] }
        Returns: {
          hot_sheet_id: string
          listing_id: string
        }[]
      }
      listing_row_exists: { Args: { p_listing_id: string }; Returns: boolean }
      listings_within_radius: {
        Args: { origin_lat: number; origin_lng: number; radius_miles: number }
        Returns: {
          listing_id: string
        }[]
      }
      log_hot_sheet_event_stage: {
        Args: {
          p_detail?: Json
          p_event_id: string
          p_listing_id: string
          p_outcome: string
          p_stage: string
        }
        Returns: undefined
      }
      mark_agent_activated: { Args: { _user_id: string }; Returns: string }
      mark_agent_credentials_issued: {
        Args: { _user_id: string }
        Returns: string
      }
      matches_current_account: {
        Args: { p_agent_user_id: string }
        Returns: boolean
      }
      normalize_listing_address_text: {
        Args: { input: string }
        Returns: string
      }
      owns_submission: { Args: { p_submission_id: string }; Returns: boolean }
      process_auth_deletion_queue: { Args: never; Returns: undefined }
      process_pending_message_emails: {
        Args: { grace_minutes?: number }
        Returns: number
      }
      rate_limit_consume: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: Json
      }
      rate_limits_cleanup: { Args: never; Returns: undefined }
      redeem_resend_handle_and_issue: {
        Args: {
          p_agent_name?: string
          p_expires_at: string
          p_handle_hash: string
          p_new_token_hash: string
          p_new_token_id: string
          p_reply_to?: string
          p_subject?: string
        }
        Returns: Json
      }
      reissue_agent_activation_token:
        | {
            Args: {
              p_agent_name?: string
              p_expires_at: string
              p_id: string
              p_reply_to?: string
              p_subject?: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_agent_name?: string
              p_allow_previously_deleted?: boolean
              p_expires_at: string
              p_id: string
              p_reply_to?: string
              p_subject?: string
              p_token_hash: string
              p_user_id: string
            }
            Returns: Json
          }
      release_agent_activation_token: {
        Args: { p_token_id: string }
        Returns: boolean
      }
      release_agent_login_token: {
        Args: { p_token_id: string }
        Returns: boolean
      }
      remove_client_favorite_for_agent: {
        Args: {
          p_buyer_user_id: string
          p_crm_client_id?: string
          p_favorite_id: string
        }
        Returns: undefined
      }
      reserve_and_enqueue_missing_opportunity_reminder: {
        Args: {
          _agent_id: string
          _email: string
          _email_job: Json
          _event_id: string
          _event_type: string
        }
        Returns: Json
      }
      resolve_auth_user_for_deletion: {
        Args: { p_email?: string; p_user_id?: string }
        Returns: {
          auth_email: string
          auth_user_id: string
        }[]
      }
      resolve_share_token: { Args: { _token: string }; Returns: Json }
      resolve_user_role: { Args: { _user_id: string }; Returns: Json }
      set_active_owner_context: {
        Args: { p_owner_user_id: string }
        Returns: Json
      }
      set_development_unit_status_price: {
        Args: {
          _clear_price?: boolean
          _price?: number
          _status?: string
          _unit_id: string
        }
        Returns: Database["public"]["CompositeTypes"]["development_unit_write_result"]
        SetofOptions: {
          from: "*"
          to: "development_unit_write_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      slugify_text: { Args: { _txt: string }; Returns: string }
      storage_path_belongs_to_development: {
        Args: { _development_id: string; _name: string }
        Returns: boolean
      }
      update_comms_broadcast: {
        Args: {
          _attachments?: Json
          _broadcast_id: string
          _message: string
          _subject: string
        }
        Returns: string
      }
      verify_buyer_contact_row: {
        Args: { p_crm_client_id: string }
        Returns: Json
      }
    }
    Enums: {
      agent_delegate_status: "invited" | "accepted" | "revoked"
      agent_status:
        | "unverified"
        | "pending"
        | "verified"
        | "restricted"
        | "rejected"
        | "invited"
      app_role: "buyer" | "agent" | "admin" | "developer"
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
      development_unit_write_result: {
        unit_id: string | null
        status: string | null
        price: number | null
        status_changed_at: string | null
        price_changed_at: string | null
        updated_at: string | null
      }
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
      agent_delegate_status: ["invited", "accepted", "revoked"],
      agent_status: [
        "unverified",
        "pending",
        "verified",
        "restricted",
        "rejected",
        "invited",
      ],
      app_role: ["buyer", "agent", "admin", "developer"],
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
