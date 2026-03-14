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
          last_message_at: string | null
          status: string
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
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
          last_message_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
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
      user_usage: {
        Row: {
          ai_requests_count: number
          ai_tokens_used: number
          created_at: string
          documents_count: number | null
          estimated_cost_usd: number
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          documents_count?: number | null
          estimated_cost_usd?: number
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_requests_count?: number
          ai_tokens_used?: number
          created_at?: string
          documents_count?: number | null
          estimated_cost_usd?: number
          month?: string
          updated_at?: string
          user_id?: string
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
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_rate_limit_logs: { Args: never; Returns: undefined }
      increment_document_count: {
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
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience type aliases
export type DocumentSession = Database["public"]["Tables"]["document_sessions"]["Row"]
