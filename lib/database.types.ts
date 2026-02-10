export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
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
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            match_compliance_rules: {
                Args: {
                    query_embedding: string
                    match_country: string
                    match_document_type: string
                    match_threshold?: number
                    match_count?: number
                }
                Returns: {
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

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Convenience type aliases
export type Profile = Tables<'profiles'>
export type Business = Tables<'businesses'>
export type Document = Tables<'documents'>
export type DocumentVersion = Tables<'document_versions'>
export type Signature = Tables<'signatures'>
export type ComplianceRule = Tables<'compliance_rules'>
export type ComplianceAlert = Tables<'compliance_alerts'>

// Business address type
export interface BusinessAddress {
    street?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
    line1?: string
    line2?: string
}

// Primary signatory type
export interface PrimarySignatory {
    name?: string
    title?: string
    email?: string
    signature_image_url?: string
}

// Tax IDs type (country-specific)
export interface TaxIds {
    gstin?: string       // India
    ein?: string         // USA
    vat?: string         // UK, Netherlands
    steuernummer?: string // Germany
    bn?: string          // Canada
    abn?: string         // Australia
    gst?: string         // Singapore
    trn?: string         // UAE
    tin?: string         // Philippines
    siret?: string       // France
    btw?: string         // Netherlands
}

// Payment methods type
export interface PaymentMethods {
    bank_transfer?: {
        bank_name?: string
        account_holder?: string
        account_number?: string
        routing_code?: string
        ifsc_code?: string
        branch?: string
    }
    upi?: string
    international?: {
        iban?: string
        swift?: string
        bank_name?: string
        bank_address?: string
    }
    paypal?: string
    stripe?: string
    wise?: string
    payoneer?: string
}

// Compliance rules structure
export interface ComplianceRulesData {
    required_fields?: Array<{
        name: string
        format?: string
        validation?: string
    }>
    tax_rules?: {
        domestic?: {
            rate: number
            applicable_on?: string
        }
        export?: {
            rate: number
            requires?: string
        }
    }
    legal_notices?: string[]
    format_requirements?: Record<string, string>
}
