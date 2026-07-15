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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      admin_email_campaigns: {
        Row: {
          created_at: string
          emails_failed: number
          emails_sent: number
          id: string
          segment: string
          sent_at: string
          sent_by: string
          subject: string
        }
        Insert: {
          created_at?: string
          emails_failed?: number
          emails_sent?: number
          id?: string
          segment: string
          sent_at?: string
          sent_by: string
          subject: string
        }
        Update: {
          created_at?: string
          emails_failed?: number
          emails_sent?: number
          id?: string
          segment?: string
          sent_at?: string
          sent_by?: string
          subject?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          admin_email: string
          created_at: string | null
          expires_at: string
          id: string
          ip_address: unknown
          session_token_hash: string
        }
        Insert: {
          admin_email: string
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: unknown
          session_token_hash: string
        }
        Update: {
          admin_email?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          session_token_hash?: string
        }
        Relationships: []
      }
      admin_tier_overrides: {
        Row: {
          admin_email: string
          created_at: string | null
          expires_at: string | null
          id: string
          reason: string
          tier: string
          user_id: string
        }
        Insert: {
          admin_email: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason: string
          tier: string
          user_id: string
        }
        Update: {
          admin_email?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string
          tier?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_tier_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          additional_notes: string | null
          address: Json
          business_type: string | null
          client_countries: string[] | null
          country: string | null
          created_at: string | null
          default_currency: string | null
          default_payment_instructions: string | null
          default_payment_terms: string | null
          email: string | null
          id: string
          logo_data_url: string | null
          logo_url: string | null
          name: string
          owner_name: string | null
          payment_methods: Json | null
          phone: string | null
          primary_signatory: Json | null
          saved_signature_url: string | null
          signature_url: string | null
          state_province: string | null
          tax_ids: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_notes?: string | null
          address?: Json
          business_type?: string | null
          client_countries?: string[] | null
          country?: string | null
          created_at?: string | null
          default_currency?: string | null
          default_payment_instructions?: string | null
          default_payment_terms?: string | null
          email?: string | null
          id?: string
          logo_data_url?: string | null
          logo_url?: string | null
          name: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_signatory?: Json | null
          saved_signature_url?: string | null
          signature_url?: string | null
          state_province?: string | null
          tax_ids?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_notes?: string | null
          address?: Json
          business_type?: string | null
          client_countries?: string[] | null
          country?: string | null
          created_at?: string | null
          default_currency?: string | null
          default_payment_instructions?: string | null
          default_payment_terms?: string | null
          email?: string | null
          id?: string
          logo_data_url?: string | null
          logo_url?: string | null
          name?: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_signatory?: Json | null
          saved_signature_url?: string | null
          signature_url?: string | null
          state_province?: string | null
          tax_ids?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      csrf_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      document_emails: {
        Row: {
          bounced_at: string | null
          created_at: string
          delivered_at: string | null
          document_type: string
          id: string
          mailtrap_message_id: string | null
          opened_at: string | null
          personal_message: string | null
          recipient_email: string
          session_id: string
          status: string
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bounced_at?: string | null
          created_at?: string
          delivered_at?: string | null
          document_type: string
          id?: string
          mailtrap_message_id?: string | null
          opened_at?: string | null
          personal_message?: string | null
          recipient_email: string
          session_id: string
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bounced_at?: string | null
          created_at?: string
          delivered_at?: string | null
          document_type?: string
          id?: string
          mailtrap_message_id?: string | null
          opened_at?: string | null
          personal_message?: string | null
          recipient_email?: string
          session_id?: string
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_emails_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_links: {
        Row: {
          child_session_id: string
          created_at: string | null
          id: string
          parent_session_id: string
          relationship: string
        }
        Insert: {
          child_session_id: string
          created_at?: string | null
          id?: string
          parent_session_id: string
          relationship?: string
        }
        Update: {
          child_session_id?: string
          created_at?: string | null
          id?: string
          parent_session_id?: string
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_links_child_session_id_fkey"
            columns: ["child_session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_links_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sessions: {
        Row: {
          active_signature_cohort_id: string | null
          auto_invoice_on_sign: boolean
          business_context: Json | null
          chain_id: string | null
          client_name: string | null
          completed_at: string | null
          context: Json | null
          created_at: string | null
          document_id: string | null
          document_type: string
          finalized_at: string | null
          id: string
          invoice_recipient_email: string | null
          last_message_at: string | null
          quota_counted_at: string | null
          quota_counted_month: string | null
          public_id: string
          sent_at: string | null
          status: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_signature_cohort_id?: string | null
          auto_invoice_on_sign?: boolean
          business_context?: Json | null
          chain_id?: string | null
          client_name?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          document_id?: string | null
          document_type?: string
          finalized_at?: string | null
          id?: string
          invoice_recipient_email?: string | null
          last_message_at?: string | null
          quota_counted_at?: string | null
          quota_counted_month?: string | null
          public_id?: string
          sent_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_signature_cohort_id?: string | null
          auto_invoice_on_sign?: boolean
          business_context?: Json | null
          chain_id?: string | null
          client_name?: string | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          document_id?: string | null
          document_type?: string
          finalized_at?: string | null
          id?: string
          invoice_recipient_email?: string | null
          last_message_at?: string | null
          quota_counted_at?: string | null
          quota_counted_month?: string | null
          public_id?: string
          sent_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sessions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json
          document_id: string | null
          id: string
          version: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data: Json
          document_id?: string | null
          id?: string
          version: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json
          document_id?: string | null
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_model_used: string | null
          business_id: string | null
          compliance_version: string | null
          confidence_score: number | null
          created_at: string | null
          data: Json
          document_number: string | null
          edit_history: Json[] | null
          export_formats: string[] | null
          id: string
          needs_human_review: boolean | null
          status: string | null
          type: string
          updated_at: string | null
          user_edited: boolean | null
          validation_results: Json | null
          version: number | null
        }
        Insert: {
          ai_model_used?: string | null
          business_id?: string | null
          compliance_version?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data?: Json
          document_number?: string | null
          edit_history?: Json[] | null
          export_formats?: string[] | null
          id?: string
          needs_human_review?: boolean | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_edited?: boolean | null
          validation_results?: Json | null
          version?: number | null
        }
        Update: {
          ai_model_used?: string | null
          business_id?: string | null
          compliance_version?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data?: Json
          document_number?: string | null
          edit_history?: Json[] | null
          export_formats?: string[] | null
          id?: string
          needs_human_review?: boolean | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_edited?: boolean | null
          validation_results?: Json | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_schedules: {
        Row: {
          cancelled_reason: string | null
          created_at: string
          document_type: string
          id: string
          recipient_email: string
          scheduled_for: string
          sent_at: string | null
          sequence_step: number
          sequence_type: string
          session_id: string
          status: string
          subject: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancelled_reason?: string | null
          created_at?: string
          document_type: string
          id?: string
          recipient_email: string
          scheduled_for: string
          sent_at?: string | null
          sequence_step?: number
          sequence_type?: string
          session_id: string
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancelled_reason?: string | null
          created_at?: string
          document_type?: string
          id?: string
          recipient_email?: string
          scheduled_for?: string
          sent_at?: string | null
          sequence_step?: number
          sequence_type?: string
          session_id?: string
          status?: string
          subject?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_schedules_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          created_at: string
          error_context: string
          error_message: string
          id: string
          metadata: Json | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_context: string
          error_message: string
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_context?: string
          error_message?: string
          id?: string
          metadata?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      generation_history: {
        Row: {
          ai_model: string | null
          business_context: Json | null
          created_at: string | null
          document_type: string
          error_message: string | null
          generated_data: Json
          generation_time_ms: number | null
          id: string
          prompt: string
          session_id: string
          success: boolean | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          business_context?: Json | null
          created_at?: string | null
          document_type: string
          error_message?: string | null
          generated_data: Json
          generation_time_ms?: number | null
          id?: string
          prompt: string
          session_id: string
          success?: boolean | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          ai_model?: string | null
          business_context?: Json | null
          created_at?: string | null
          document_type?: string
          error_message?: string | null
          generated_data?: Json
          generation_time_ms?: number | null
          id?: string
          prompt?: string
          session_id?: string
          success?: boolean | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_history_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          amount_paid: number | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          expires_at: string | null
          gateway: string
          id: string
          is_manual: boolean
          is_test_mode: boolean
          link_viewed_at: string | null
          manual_payment_method: string | null
          manual_payment_note: string | null
          manually_marked_at: string | null
          paid_at: string | null
          provider_link_id: string
          razorpay_payment_id: string | null
          razorpay_payment_link_id: string
          reference_id: string | null
          sent_at: string | null
          session_id: string | null
          short_url: string
          status: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          gateway?: string
          id?: string
          is_manual?: boolean
          is_test_mode?: boolean
          link_viewed_at?: string | null
          manual_payment_method?: string | null
          manual_payment_note?: string | null
          manually_marked_at?: string | null
          paid_at?: string | null
          provider_link_id: string
          razorpay_payment_id?: string | null
          razorpay_payment_link_id: string
          reference_id?: string | null
          sent_at?: string | null
          session_id?: string | null
          short_url: string
          status?: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          expires_at?: string | null
          gateway?: string
          id?: string
          is_manual?: boolean
          is_test_mode?: boolean
          link_viewed_at?: string | null
          manual_payment_method?: string | null
          manual_payment_note?: string | null
          manually_marked_at?: string | null
          paid_at?: string | null
          provider_link_id?: string
          razorpay_payment_id?: string | null
          razorpay_payment_link_id?: string
          reference_id?: string | null
          sent_at?: string | null
          session_id?: string | null
          short_url?: string
          status?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_blocklist: {
        Row: {
          blocked_by: string
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: unknown
          reason: string | null
        }
        Insert: {
          blocked_by: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address: unknown
          reason?: string | null
        }
        Update: {
          blocked_by?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: unknown
          reason?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_history: {
        Row: {
          amount: number
          billing_cycle: string | null
          created_at: string | null
          currency: string | null
          id: string
          metadata: Json | null
          plan: string | null
          razorpay_invoice_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string
          razorpay_signature: string | null
          razorpay_subscription_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          plan?: string | null
          razorpay_invoice_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id: string
          razorpay_signature?: string | null
          razorpay_subscription_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          metadata?: Json | null
          plan?: string | null
          razorpay_invoice_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string
          razorpay_signature?: string | null
          razorpay_subscription_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_active_at: string | null
          last_login_at: string | null
          last_login_device: string | null
          last_login_ip: string | null
          last_login_location: string | null
          onboarding_complete: boolean | null
          plan_selected: boolean | null
          saved_signature_url: string | null
          suspended_at: string | null
          tier: string | null
          tier_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_active_at?: string | null
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          last_login_location?: string | null
          onboarding_complete?: boolean | null
          plan_selected?: boolean | null
          saved_signature_url?: string | null
          suspended_at?: string | null
          tier?: string | null
          tier_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_active_at?: string | null
          last_login_at?: string | null
          last_login_device?: string | null
          last_login_ip?: string | null
          last_login_location?: string | null
          onboarding_complete?: boolean | null
          plan_selected?: boolean | null
          saved_signature_url?: string | null
          suspended_at?: string | null
          tier?: string | null
          tier_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quotation_responses: {
        Row: {
          client_email: string
          client_name: string
          created_at: string
          id: string
          ip_address: string | null
          reason: string | null
          responded_at: string
          response_type: string
          session_id: string
          user_agent: string | null
        }
        Insert: {
          client_email: string
          client_name: string
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          responded_at?: string
          response_type: string
          session_id: string
          user_agent?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          reason?: string | null
          responded_at?: string
          response_type?: string
          session_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotation_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_log: {
        Row: {
          category: string
          created_at: string
          id: string
          ip_address: unknown
          request_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          request_count?: number
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      recurring_invoices: {
        Row: {
          auto_send: boolean
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          last_run_at: string | null
          next_run_at: string
          recipient_email: string | null
          run_count: number
          source_session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_send?: boolean
          created_at?: string
          frequency: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at: string
          recipient_email?: string | null
          run_count?: number
          source_session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_send?: boolean
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          next_run_at?: string
          recipient_email?: string | null
          run_count?: number
          source_session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: true
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_audit_events: {
        Row: {
          action: string
          actor_email: string | null
          created_at: string
          document_id: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          session_id: string | null
          signature_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_id?: string | null
          signature_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          created_at?: string
          document_id?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          session_id?: string | null
          signature_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_audit_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_audit_events_signature_id_fkey"
            columns: ["signature_id"]
            isOneToOne: false
            referencedRelation: "signatures"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          attempt_count: number
          created_at: string | null
          document_hash: string | null
          document_id: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          party: string
          session_id: string | null
          signature_image_url: string | null
          signed_at: string | null
          signer_action: string | null
          signer_email: string
          signer_name: string | null
          signer_reason: string | null
          signing_cohort_id: string
          token: string | null
          token_hash: string | null
          user_agent: string | null
          verification_url: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string | null
          document_hash?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          party: string
          session_id?: string | null
          signature_image_url?: string | null
          signed_at?: string | null
          signer_action?: string | null
          signer_email: string
          signer_name?: string | null
          signer_reason?: string | null
          signing_cohort_id: string
          token?: string | null
          token_hash?: string | null
          user_agent?: string | null
          verification_url?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string | null
          document_hash?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          party?: string
          session_id?: string | null
          signature_image_url?: string | null
          signed_at?: string | null
          signer_action?: string | null
          signer_email?: string
          signer_name?: string | null
          signer_reason?: string | null
          signing_cohort_id?: string
          token?: string | null
          token_hash?: string | null
          user_agent?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "document_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount_paid: number | null
          billing_cycle: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          entitlement_payment_id: string | null
          entitlement_source: string
          entitlement_verified_at: string | null
          id: string
          pending_billing_cycle: string | null
          pending_change_type: string | null
          pending_effective_at: string | null
          pending_plan: string | null
          pending_previous_subscription_id: string | null
          pending_razorpay_subscription_id: string | null
          plan: string
          provider_event_created_at: string | null
          provider_event_type: string | null
          provider_sync_required: boolean
          razorpay_customer_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_plan_id: string | null
          razorpay_subscription_id: string | null
          scheduled_downgrade: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement_payment_id?: string | null
          entitlement_source?: string
          entitlement_verified_at?: string | null
          id?: string
          pending_billing_cycle?: string | null
          pending_change_type?: string | null
          pending_effective_at?: string | null
          pending_plan?: string | null
          pending_previous_subscription_id?: string | null
          pending_razorpay_subscription_id?: string | null
          plan?: string
          provider_event_created_at?: string | null
          provider_event_type?: string | null
          provider_sync_required?: boolean
          razorpay_customer_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          scheduled_downgrade?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          entitlement_payment_id?: string | null
          entitlement_source?: string
          entitlement_verified_at?: string | null
          id?: string
          pending_billing_cycle?: string | null
          pending_change_type?: string | null
          pending_effective_at?: string | null
          pending_plan?: string | null
          pending_previous_subscription_id?: string | null
          pending_razorpay_subscription_id?: string | null
          plan?: string
          provider_event_created_at?: string | null
          provider_event_type?: string | null
          provider_sync_required?: boolean
          razorpay_customer_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_plan_id?: string | null
          razorpay_subscription_id?: string | null
          scheduled_downgrade?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_subscriptions_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_progress: {
        Row: {
          chat_started_at: string | null
          completed_at: string | null
          created_at: string
          current_phase: string
          fields_completed: number
          id: string
          logo_started_at: string | null
          payments_started_at: string | null
          updated_at: string
          upload_started_at: string | null
          used_extraction: boolean
          user_id: string
        }
        Insert: {
          chat_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_phase?: string
          fields_completed?: number
          id?: string
          logo_started_at?: string | null
          payments_started_at?: string | null
          updated_at?: string
          upload_started_at?: string | null
          used_extraction?: boolean
          user_id: string
        }
        Update: {
          chat_started_at?: string | null
          completed_at?: string | null
          created_at?: string
          current_phase?: string
          fields_completed?: number
          id?: string
          logo_started_at?: string | null
          payments_started_at?: string | null
          updated_at?: string
          upload_started_at?: string | null
          used_extraction?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string
          metadata: Json | null
          onboarding_phase: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          onboarding_phase?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          onboarding_phase?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          active: boolean | null
          created_at: string | null
          created_by: string
          expires_at: string | null
          id: string
          message: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          created_by: string
          expires_at?: string | null
          id?: string
          message: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          created_by?: string
          expires_at?: string | null
          id?: string
          message?: string
        }
        Relationships: []
      }
      user_payment_settings: {
        Row: {
          cashfree_client_id: string | null
          cashfree_client_secret_encrypted: string | null
          cashfree_credentials_verified_at: string | null
          cashfree_enabled: boolean | null
          cashfree_local_webhook_verified_at: string | null
          cashfree_test_mode: boolean | null
          cashfree_webhook_secret: string | null
          cashfree_webhook_verified_at: string | null
          created_at: string
          razorpay_account_name: string | null
          razorpay_credentials_verified_at: string | null
          razorpay_enabled: boolean | null
          razorpay_key_id: string | null
          razorpay_key_secret_encrypted: string | null
          razorpay_local_webhook_verified_at: string | null
          razorpay_provider_webhook_verified_at: string | null
          razorpay_test_mode: boolean | null
          razorpay_webhook_id: string | null
          razorpay_webhook_secret: string | null
          stripe_credentials_verified_at: string | null
          stripe_enabled: boolean | null
          stripe_secret_key_encrypted: string | null
          stripe_test_mode: boolean | null
          stripe_webhook_id: string | null
          stripe_webhook_secret: string | null
          stripe_webhook_verified_at: string | null
          updated_at: string
          user_id: string
          webhook_registered_at: string | null
        }
        Insert: {
          cashfree_client_id?: string | null
          cashfree_client_secret_encrypted?: string | null
          cashfree_credentials_verified_at?: string | null
          cashfree_enabled?: boolean | null
          cashfree_local_webhook_verified_at?: string | null
          cashfree_test_mode?: boolean | null
          cashfree_webhook_secret?: string | null
          cashfree_webhook_verified_at?: string | null
          created_at?: string
          razorpay_account_name?: string | null
          razorpay_credentials_verified_at?: string | null
          razorpay_enabled?: boolean | null
          razorpay_key_id?: string | null
          razorpay_key_secret_encrypted?: string | null
          razorpay_local_webhook_verified_at?: string | null
          razorpay_provider_webhook_verified_at?: string | null
          razorpay_test_mode?: boolean | null
          razorpay_webhook_id?: string | null
          razorpay_webhook_secret?: string | null
          stripe_credentials_verified_at?: string | null
          stripe_enabled?: boolean | null
          stripe_secret_key_encrypted?: string | null
          stripe_test_mode?: boolean | null
          stripe_webhook_id?: string | null
          stripe_webhook_secret?: string | null
          stripe_webhook_verified_at?: string | null
          updated_at?: string
          user_id: string
          webhook_registered_at?: string | null
        }
        Update: {
          cashfree_client_id?: string | null
          cashfree_client_secret_encrypted?: string | null
          cashfree_credentials_verified_at?: string | null
          cashfree_enabled?: boolean | null
          cashfree_local_webhook_verified_at?: string | null
          cashfree_test_mode?: boolean | null
          cashfree_webhook_secret?: string | null
          cashfree_webhook_verified_at?: string | null
          created_at?: string
          razorpay_account_name?: string | null
          razorpay_credentials_verified_at?: string | null
          razorpay_enabled?: boolean | null
          razorpay_key_id?: string | null
          razorpay_key_secret_encrypted?: string | null
          razorpay_local_webhook_verified_at?: string | null
          razorpay_provider_webhook_verified_at?: string | null
          razorpay_test_mode?: boolean | null
          razorpay_webhook_id?: string | null
          razorpay_webhook_secret?: string | null
          stripe_credentials_verified_at?: string | null
          stripe_enabled?: boolean | null
          stripe_secret_key_encrypted?: string | null
          stripe_test_mode?: boolean | null
          stripe_webhook_id?: string | null
          stripe_webhook_secret?: string | null
          stripe_webhook_verified_at?: string | null
          updated_at?: string
          user_id?: string
          webhook_registered_at?: string | null
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          ai_requests_count: number
          ai_tokens_used: number
          created_at: string
          documents_count: number
          emails_count: number
          estimated_cost_usd: number
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          documents_count?: number
          emails_count?: number
          estimated_cost_usd?: number
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          documents_count?: number
          emails_count?: number
          estimated_cost_usd?: number
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      public_rate_limits: {
        Row: {
          category: string
          identifier_hash: string
          request_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          category: string
          identifier_hash: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          category?: string
          identifier_hash?: string
          request_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_id: string
          event_type: string
          gateway: string
          id: string
          last_error: string | null
          payload_hash: string | null
          processed_at: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_id: string
          event_type: string
          gateway?: string
          id?: string
          last_error?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          event_id?: string
          event_type?: string
          gateway?: string
          id?: string
          last_error?: string | null
          payload_hash?: string | null
          processed_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      recent_audit_activity: {
        Row: {
          action: string | null
          created_at: string | null
          id: string | null
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_usage_summary: {
        Row: {
          ai_requests_count: number | null
          ai_tokens_used: number | null
          estimated_cost_usd: number | null
          month: string | null
          user_id: string | null
        }
        Insert: {
          ai_requests_count?: number | null
          ai_tokens_used?: number | null
          estimated_cost_usd?: number | null
          month?: string | null
          user_id?: string | null
        }
        Update: {
          ai_requests_count?: number | null
          ai_tokens_used?: number | null
          estimated_cost_usd?: number | null
          month?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_email_schedules: {
        Args: { p_reason?: string; p_session_id: string }
        Returns: number
      }
      apply_admin_tier_override: {
        Args: {
          p_admin_email: string
          p_expires_at?: string | null
          p_reason: string
          p_tier: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_subscription_charge_event: {
        Args: {
          p_amount: number
          p_billing_cycle: string
          p_currency: string
          p_event_created_at: string
          p_event_type: string
          p_invoice_id: string
          p_order_id: string
          p_payment_id: string
          p_period_end: string
          p_period_start: string
          p_plan: string
          p_plan_id: string
          p_previous_subscription_id?: string | null
          p_subscription_id: string
          p_user_id: string
        }
        Returns: Json
      }
      apply_invoice_payment_event: {
        Args: {
          p_amount_paid?: number | null
          p_currency?: string | null
          p_gateway: string
          p_is_test_mode?: boolean
          p_paid_at?: string | null
          p_provider_link_id: string
          p_provider_payment_id?: string | null
          p_status: string
          p_user_id: string
        }
        Returns: Json
      }
      get_admin_email_campaign_snapshot: {
        Args: {
          p_category?: string
          p_email_status?: string
          p_now?: string
          p_page?: number
          p_page_size?: number
          p_search?: string | null
        }
        Returns: Json
      }
      get_admin_overview_snapshot: {
        Args: {
          p_bounds_end?: string | null
          p_bounds_start?: string | null
          p_now: string
          p_period: string
          p_previous_end?: string | null
          p_previous_start?: string | null
          p_timezone: string
        }
        Returns: Json
      }
      create_signature_request: {
        Args: {
          p_client_name: string | null
          p_created_at: string
          p_document_hash: string
          p_document_id: string | null
          p_expires_at: string
          p_party: string
          p_session_id: string
          p_signature_id: string
          p_signer_email: string
          p_signer_name: string
          p_token_hash: string
          p_user_id: string
          p_verification_url: string
        }
        Returns: {
          outcome: string
          previous_client_name: string | null
          previous_sent_at: string | null
          previous_signature_cohort_id: string | null
          previous_status: string
          signature_id: string | null
        }[]
      }
      rollback_unsent_signature_request: {
        Args: {
          p_previous_client_name: string | null
          p_previous_sent_at: string | null
          p_previous_signature_cohort_id: string | null
          p_previous_status: string
          p_signature_id: string
          p_token_hash: string
          p_transitioned_at: string
        }
        Returns: boolean
      }
      claim_signature_attempt: {
        Args: { p_token_hash: string }
        Returns: {
          attempt_count: number
          document_hash: string | null
          document_id: string | null
          expires_at: string | null
          parent_public_id: string
          parent_sent_at: string | null
          parent_status: string
          session_id: string
          signature_id: string
          signed_at: string | null
          signer_action: string | null
          verification_url: string | null
        }[]
      }
      complete_signature_signing: {
        Args: {
          p_ip_address: unknown
          p_signature_id: string
          p_signature_image_url: string
          p_signed_at: string
          p_token_hash: string
          p_user_agent: string
        }
        Returns: {
          completed_session: boolean
          document_id: string | null
          outcome: string
          session_id: string | null
          signature_id: string | null
          verification_url: string | null
        }[]
      }
      cancel_signature_request: {
        Args: {
          p_cancelled_at: string
          p_signature_id: string
          p_user_id: string
        }
        Returns: {
          cancelled_count: number
          document_id: string | null
          outcome: string
          session_id: string | null
          signature_id: string | null
          signer_name: string | null
        }[]
      }
      respond_to_signature: {
        Args: { p_action: string; p_reason?: string | null; p_token_hash: string }
        Returns: {
          document_id: string | null
          outcome: string
          session_id: string | null
          signature_id: string | null
          signer_email: string | null
          signer_name: string | null
        }[]
      }
      check_public_rate_limit: {
        Args: {
          p_category: string
          p_identifier_hash: string
          p_max_requests: number
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after: number
        }[]
      }
      claim_webhook_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_gateway: string
          p_payload_hash: string
          p_user_id?: string | null
        }
        Returns: string
      }
      mark_invoice_manually_paid: {
        Args: {
          p_amount: number
          p_currency: string
          p_note: string | null
          p_paid_at: string
          p_payment_method: string
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      release_document_quota: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: undefined
      }
      reserve_document_quota: {
        Args: { p_month: string; p_session_id: string; p_user_id: string }
        Returns: Json
      }
      revert_manual_invoice_payment: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_category: string
          p_max_requests: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          error: string
          remaining: number
          retry_after: number
        }[]
      }
      check_subscription_expiry: {
        Args: { p_user_id: string }
        Returns: {
          is_expired: boolean
          plan: string
          status: string
        }[]
      }
      cleanup_abandoned_sessions: { Args: never; Returns: undefined }
      cleanup_expired_csrf_tokens: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_rate_limit_logs: { Args: never; Returns: undefined }
      get_secret: { Args: { secret_name: string }; Returns: string }
      increment_document_count: {
        Args: { p_month: string; p_user_id: string }
        Returns: undefined
      }
      increment_email_count: {
        Args: { p_month: string; p_user_id: string }
        Returns: undefined
      }
      increment_user_usage: {
        Args: {
          p_cost?: number
          p_month: string
          p_requests?: number
          p_tokens?: number
          p_user_id: string
        }
        Returns: undefined
      }
      match_compliance_rules: {
        Args: {
          match_count?: number
          match_country: string
          match_document_type: string
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          confidence_score: number
          country: string
          document_type: string
          id: string
          last_updated: string
          needs_human_review: boolean
          rules: Json
          similarity: number
          source_urls: string[]
          validated_by: string
        }[]
      }
      session_dedup_bucket: { Args: { ts: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

// Convenience type aliases
export type DocumentSession = Database['public']['Tables']['document_sessions']['Row'];
