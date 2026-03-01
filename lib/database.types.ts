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
      ai_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_prompts: {
        Row: {
          created_at: string | null
          document_type: string
          examples: Json | null
          id: string
          instructions: string | null
          is_active: boolean | null
          system_prompt: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          examples?: Json | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          system_prompt: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          examples?: Json | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          system_prompt?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
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
          logo_url: string | null
          name: string
          owner_name: string | null
          payment_methods: Json | null
          phone: string | null
          primary_signatory: Json | null
          signature_url: string | null
          state_province: string | null
          tax_ids: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
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
          logo_url?: string | null
          name: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_signatory?: Json | null
          signature_url?: string | null
          state_province?: string | null
          tax_ids?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
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
          logo_url?: string | null
          name?: string
          owner_name?: string | null
          payment_methods?: Json | null
          phone?: string | null
          primary_signatory?: Json | null
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
      compliance_alerts: {
        Row: {
          country: string
          created_at: string | null
          effective_date: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          source_urls: string[] | null
          status: string | null
          summary: string
        }
        Insert: {
          country: string
          created_at?: string | null
          effective_date?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          source_urls?: string[] | null
          status?: string | null
          summary: string
        }
        Update: {
          country?: string
          created_at?: string | null
          effective_date?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          source_urls?: string[] | null
          status?: string | null
          summary?: string
        }
        Relationships: []
      }
      compliance_knowledge: {
        Row: {
          category: string
          confidence_score: number | null
          content: string
          country_code: string
          created_at: string | null
          id: string
          last_updated: string | null
          next_review_date: string | null
          source_urls: string[] | null
          topic: string
        }
        Insert: {
          category: string
          confidence_score?: number | null
          content: string
          country_code: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          next_review_date?: string | null
          source_urls?: string[] | null
          topic: string
        }
        Update: {
          category?: string
          confidence_score?: number | null
          content?: string
          country_code?: string
          created_at?: string | null
          id?: string
          last_updated?: string | null
          next_review_date?: string | null
          source_urls?: string[] | null
          topic?: string
        }
        Relationships: []
      }
      compliance_rules: {
        Row: {
          confidence_score: number | null
          country: string
          created_at: string | null
          document_type: string
          embedding: string | null
          id: string
          last_updated: string | null
          needs_human_review: boolean | null
          rules: Json
          source_urls: string[] | null
          validated_by: string | null
        }
        Insert: {
          confidence_score?: number | null
          country: string
          created_at?: string | null
          document_type: string
          embedding?: string | null
          id?: string
          last_updated?: string | null
          needs_human_review?: boolean | null
          rules?: Json
          source_urls?: string[] | null
          validated_by?: string | null
        }
        Update: {
          confidence_score?: number | null
          country?: string
          created_at?: string | null
          document_type?: string
          embedding?: string | null
          id?: string
          last_updated?: string | null
          needs_human_review?: boolean | null
          rules?: Json
          source_urls?: string[] | null
          validated_by?: string | null
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
      document_sessions: {
        Row: {
          business_context: Json | null
          completed_at: string | null
          context: Json | null
          created_at: string | null
          document_id: string | null
          document_type: string
          id: string
          last_message_at: string | null
          status: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_context?: Json | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          document_id?: string | null
          document_type?: string
          id?: string
          last_message_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_context?: Json | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          document_id?: string | null
          document_type?: string
          id?: string
          last_message_at?: string | null
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
      document_templates: {
        Row: {
          compliance_notes: string | null
          country_code: string
          created_at: string | null
          created_by: string | null
          document_type: string
          example_data: Json | null
          field_validations: Json | null
          generation_prompt: string | null
          id: string
          is_active: boolean | null
          language_requirements: Json | null
          last_verified_at: string | null
          layout_guidelines: Json | null
          legal_references: string[] | null
          mandatory_clauses: string[] | null
          numbering_format: string | null
          optional_fields: Json | null
          required_fields: Json
          tax_requirements: Json | null
          template_version: string
          updated_at: string | null
        }
        Insert: {
          compliance_notes?: string | null
          country_code: string
          created_at?: string | null
          created_by?: string | null
          document_type: string
          example_data?: Json | null
          field_validations?: Json | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          language_requirements?: Json | null
          last_verified_at?: string | null
          layout_guidelines?: Json | null
          legal_references?: string[] | null
          mandatory_clauses?: string[] | null
          numbering_format?: string | null
          optional_fields?: Json | null
          required_fields?: Json
          tax_requirements?: Json | null
          template_version?: string
          updated_at?: string | null
        }
        Update: {
          compliance_notes?: string | null
          country_code?: string
          created_at?: string | null
          created_by?: string | null
          document_type?: string
          example_data?: Json | null
          field_validations?: Json | null
          generation_prompt?: string | null
          id?: string
          is_active?: boolean | null
          language_requirements?: Json | null
          last_verified_at?: string | null
          layout_guidelines?: Json | null
          legal_references?: string[] | null
          mandatory_clauses?: string[] | null
          numbering_format?: string | null
          optional_fields?: Json | null
          required_fields?: Json
          tax_requirements?: Json | null
          template_version?: string
          updated_at?: string | null
        }
        Relationships: []
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
      onboarding_sessions: {
        Row: {
          collected_data: Json | null
          created_at: string | null
          id: string
          messages: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          collected_data?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          collected_data?: Json | null
          created_at?: string | null
          id?: string
          messages?: Json | null
          updated_at?: string | null
          user_id?: string | null
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
          onboarding_complete: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_complete?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_complete?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
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
      rate_limits: {
        Row: {
          created_at: string
          id: string
          request_timestamps: string[]
          route_category: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_timestamps?: string[]
          route_category: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          request_timestamps?: string[]
          route_category?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signatures: {
        Row: {
          created_at: string | null
          document_hash: string | null
          document_id: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          party: string
          signature_image_url: string | null
          signed_at: string | null
          signer_email: string
          signer_name: string | null
          token: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          document_hash?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          party: string
          signature_image_url?: string | null
          signed_at?: string | null
          signer_email: string
          signer_name?: string | null
          token?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          document_hash?: string | null
          document_id?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          party?: string
          signature_image_url?: string | null
          signed_at?: string | null
          signer_email?: string
          signer_name?: string | null
          token?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      template_update_history: {
        Row: {
          change_type: string
          changes_made: Json | null
          created_at: string | null
          id: string
          reason: string | null
          source_urls: string[] | null
          template_id: string | null
          verified_by: string | null
        }
        Insert: {
          change_type: string
          changes_made?: Json | null
          created_at?: string | null
          id?: string
          reason?: string | null
          source_urls?: string[] | null
          template_id?: string | null
          verified_by?: string | null
        }
        Update: {
          change_type?: string
          changes_made?: Json | null
          created_at?: string | null
          id?: string
          reason?: string | null
          source_urls?: string[] | null
          template_id?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_update_history_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_update_schedule: {
        Row: {
          auto_update_enabled: boolean | null
          check_frequency_days: number | null
          created_at: string | null
          id: string
          last_check_at: string | null
          next_check_at: string
          template_id: string | null
        }
        Insert: {
          auto_update_enabled?: boolean | null
          check_frequency_days?: number | null
          created_at?: string | null
          id?: string
          last_check_at?: string | null
          next_check_at: string
          template_id?: string | null
        }
        Update: {
          auto_update_enabled?: boolean | null
          check_frequency_days?: number | null
          created_at?: string | null
          id?: string
          last_check_at?: string | null
          next_check_at?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_update_schedule_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_usage: {
        Row: {
          ai_requests_count: number
          ai_tokens_used: number
          created_at: string
          estimated_cost_usd: number
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          estimated_cost_usd?: number
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          estimated_cost_usd?: number
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      welcome_messages: {
        Row: {
          created_at: string | null
          document_type: string
          id: string
          is_active: boolean | null
          message: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          id?: string
          is_active?: boolean | null
          message: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          id?: string
          is_active?: boolean | null
          message?: string
          updated_at?: string | null
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
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_requests_count?: number | null
          ai_tokens_used?: number | null
          estimated_cost_usd?: number | null
          month?: string | null
          status?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_requests_count?: number | null
          ai_tokens_used?: number | null
          estimated_cost_usd?: number | null
          month?: string | null
          status?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      cleanup_abandoned_sessions: { Args: never; Returns: undefined }
      cleanup_expired_csrf_tokens: { Args: never; Returns: undefined }
      cleanup_old_onboarding_sessions: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_rate_limit_logs: { Args: never; Returns: undefined }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      get_ai_config: { Args: { p_config_key: string }; Returns: Json }
      get_ai_prompt: {
        Args: { p_document_type: string }
        Returns: {
          examples: Json
          instructions: string
          system_prompt: string
        }[]
      }
      get_templates_needing_update: {
        Args: never
        Returns: {
          country_code: string
          days_since_check: number
          document_type: string
          last_check_at: string
          template_id: string
        }[]
      }
      get_welcome_message: {
        Args: { p_document_type: string }
        Returns: string
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

// Exported convenience types
export type Document = Tables<"documents">
export type Business = Tables<"businesses">
export type Profile = Tables<"profiles">
export type DocumentSession = Tables<"document_sessions">
export type Signature = Tables<"signatures">
export type DocumentTemplate = Tables<"document_templates">
export type ComplianceRule = Tables<"compliance_rules">
export type DocumentVersion = Tables<"document_versions">
export type OnboardingSession = Tables<"onboarding_sessions">
export type AuditLog = Tables<"audit_logs">

export interface ComplianceRulesData {
  required_fields: { name: string; format: string }[]
  tax_rules?: {
    domestic?: { rate: number; applicable_on: string }
    export?: { rate: number; requires: string }
  }
  legal_notices?: string[]
}

