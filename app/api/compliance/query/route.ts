/**
 * RAG Compliance Query API
 * Retrieves compliance rules using pgvector semantic similarity search
 * Per project.md: "Use Supabase pgvector for semantic search"
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"

interface ComplianceQueryRequest {
    country: string
    documentType: "invoice" | "contract" | "nda" | "agreement"
    query?: string  // Optional semantic query
}

interface ComplianceRule {
    id: string
    country: string
    document_type: string
    rules: {
        required_fields: string[]
        tax_rates?: Record<string, number>
        legal_notices?: string[]
        format_requirements?: Record<string, string>
    }
    source_urls: string[]
    confidence_score: number
    last_updated: string
    needs_human_review: boolean
    similarity?: number
}

interface QueryResult {
    success: boolean
    rules: ComplianceRule | null
    similarity?: number
    freshness: "current" | "stale" | "missing"
    message?: string
}

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        // SECURITY: Rate limit
        const rateLimitError = await checkRateLimit(auth.user.id, "general")
        if (rateLimitError) return rateLimitError

        const body: ComplianceQueryRequest = await request.json()

        // SECURITY: Input size limit (10KB)
        const sizeError = validateBodySize(body, 10 * 1024)
        if (sizeError) return sizeError

        const { country, documentType, query } = body

        if (!country || !documentType) {
            return NextResponse.json(
                { error: "Missing required fields: country, documentType" },
                { status: 400 }
            )
        }

        // SECURITY: Validate country format (2-3 letter code)
        if (typeof country !== "string" || country.length > 3) {
            return NextResponse.json(
                { error: "Invalid country code" },
                { status: 400 }
            )
        }

        // SECURITY: Validate document type
        const validTypes = ["invoice", "contract", "nda", "agreement"]
        if (!validTypes.includes(documentType)) {
            return NextResponse.json(
                { error: "Invalid document type" },
                { status: 400 }
            )
        }

        // SECURITY: Use authenticated Supabase client (respects RLS)
        const supabase = auth.supabase

        // If query provided and OpenAI key exists, use semantic search
        const openaiKey = process.env.OPENAI_API_KEY
        if (query && openaiKey && openaiKey !== "your_openai_api_key_here") {
            // SECURITY: Limit query length
            if (query.length > 500) {
                return NextResponse.json(
                    { error: "Query too long. Maximum 500 characters." },
                    { status: 400 }
                )
            }
            const result = await semanticSearch(supabase, country, documentType, query, openaiKey)
            return NextResponse.json(result)
        }

        // Otherwise, use direct database query
        const result = await directQuery(supabase, country, documentType)
        return NextResponse.json(result)

    } catch (error) {
        console.error("Compliance query error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * Direct database query (fallback when no semantic search needed)
 */
async function directQuery(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    country: string,
    documentType: string
): Promise<QueryResult> {
    const { data, error } = await supabase
        .from("compliance_rules")
        .select("*")
        .eq("country", country.toUpperCase())
        .eq("document_type", documentType)
        .order("last_updated", { ascending: false })
        .limit(1)
        .single()

    if (error || !data) {
        return {
            success: false,
            rules: null,
            freshness: "missing",
            message: `No compliance rules found for ${country} ${documentType}. Rules will be populated by the compliance monitoring system.`
        }
    }

    // Check freshness (7 days per spec)
    const lastUpdated = new Date(data.last_updated)
    const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    const freshness = daysSinceUpdate <= 7 ? "current" : "stale"

    return {
        success: true,
        rules: data as ComplianceRule,
        freshness,
        message: freshness === "stale"
            ? "Rules may be outdated. Last updated " + Math.floor(daysSinceUpdate) + " days ago."
            : undefined
    }
}

/**
 * Semantic search using pgvector
 * Per project.md: "Generate embedding for search query, Supabase performs vector similarity search"
 */
async function semanticSearch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any,
    country: string,
    documentType: string,
    query: string,
    openaiKey: string
): Promise<QueryResult> {
    try {
        // Generate embedding for the query
        const embeddingResponse = await fetch(OPENAI_EMBEDDINGS_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openaiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "text-embedding-3-small",
                input: `${country} ${documentType} compliance: ${query}`
            })
        })

        if (!embeddingResponse.ok) {
            console.error("OpenAI Embeddings API error:", embeddingResponse.status)
            // Fallback to direct query
            return directQuery(supabase, country, documentType)
        }

        const embeddingData = await embeddingResponse.json()
        const embedding = embeddingData.data?.[0]?.embedding

        if (!embedding) {
            return directQuery(supabase, country, documentType)
        }

        // Perform vector similarity search using Supabase RPC function
        const { data, error } = await supabase.rpc("match_compliance_rules", {
            query_embedding: embedding,
            match_country: country.toUpperCase(),
            match_document_type: documentType,
            match_threshold: 0.5,
            match_count: 1
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const results = data as any[]
        if (error || !results || results.length === 0) {
            // Fallback to direct query if RPC fails
            return directQuery(supabase, country, documentType)
        }

        const rule = results[0] as ComplianceRule
        const lastUpdated = new Date(rule.last_updated)
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)

        return {
            success: true,
            rules: rule as ComplianceRule,
            similarity: rule.similarity,
            freshness: daysSinceUpdate <= 7 ? "current" : "stale",
            message: daysSinceUpdate > 7
                ? "Rules may be outdated. Last updated " + Math.floor(daysSinceUpdate) + " days ago."
                : undefined
        }

    } catch (error) {
        console.error("Semantic search error:", error)
        return directQuery(supabase, country, documentType)
    }
}

// Also support GET for simple queries
export async function GET(request: NextRequest) {
    // SECURITY: Authenticate user
    const auth = await authenticateRequest()
    if (auth.error) return auth.error

    // SECURITY: Rate limit
    const rateLimitError = await checkRateLimit(auth.user.id, "general")
    if (rateLimitError) return rateLimitError

    const { searchParams } = new URL(request.url)
    const country = searchParams.get("country")
    const documentType = searchParams.get("type") as ComplianceQueryRequest["documentType"]

    if (!country || !documentType) {
        return NextResponse.json(
            { error: "Missing query params: country, type" },
            { status: 400 }
        )
    }

    // Reuse POST logic with authenticated client
    const supabase = auth.supabase
    const result = await directQuery(supabase, country, documentType)
    return NextResponse.json(result)
}
