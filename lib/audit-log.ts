/**
 * Audit Logging Module
 * 
 * Logs all sensitive operations for security auditing and compliance.
 * Tracks who did what, when, and from where.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "./database.types"
import type { NextRequest } from "next/server"

export type AuditAction =
    | "document.create"
    | "document.update"
    | "document.delete"
    | "document.export"
    | "document.sign"
    | "signature.create"
    | "signature.complete"
    | "business.create"
    | "business.update"
    | "auth.login"
    | "auth.logout"
    | "auth.signup"
    | "compliance.query"
    | "ai.generate"
    | "ai.onboarding"

export type ResourceType =
    | "document"
    | "signature"
    | "business"
    | "user"
    | "compliance_rule"

interface AuditLogEntry {
    user_id: string
    action: AuditAction
    resource_type?: ResourceType
    resource_id?: string
    ip_address?: string
    user_agent?: string
    metadata?: Json
}

/**
 * Extract IP address from request
 */
function getIPAddress(request: NextRequest): string {
    // Check common proxy headers
    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) {
        return forwarded.split(",")[0].trim()
    }

    const realIP = request.headers.get("x-real-ip")
    if (realIP) {
        return realIP
    }

    // Fallback to connection IP (may not be available in serverless)
    return "unknown"
}

/**
 * Extract user agent from request
 */
function getUserAgent(request: NextRequest): string {
    return request.headers.get("user-agent") || "unknown"
}

/**
 * Log an audit event
 */
export async function logAudit(
    supabase: SupabaseClient<Database>,
    entry: AuditLogEntry,
    request?: NextRequest
): Promise<void> {
    try {
        const logEntry = {
            user_id: entry.user_id,
            action: entry.action,
            resource_type: entry.resource_type || null,
            resource_id: entry.resource_id || null,
            ip_address: request ? getIPAddress(request) : null,
            user_agent: request ? getUserAgent(request) : null,
            metadata: entry.metadata || null,
        }

        const { error } = await supabase
            .from("audit_logs")
            .insert(logEntry)

        if (error) {
            console.error("Audit log insert failed:", error)
            // Don't throw - audit logging failure shouldn't break the app
        }
    } catch (error) {
        console.error("Audit logging failed:", error)
    }
}

/**
 * Log document creation
 */
export async function logDocumentCreate(
    supabase: SupabaseClient<Database>,
    userId: string,
    documentId: string,
    documentType: string,
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "document.create",
            resource_type: "document",
            resource_id: documentId,
            metadata: { document_type: documentType },
        },
        request
    )
}

/**
 * Log document export
 */
export async function logDocumentExport(
    supabase: SupabaseClient<Database>,
    userId: string,
    documentId: string,
    format: string,
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "document.export",
            resource_type: "document",
            resource_id: documentId,
            metadata: { format },
        },
        request
    )
}

/**
 * Log signature creation
 */
export async function logSignatureCreate(
    supabase: SupabaseClient<Database>,
    userId: string,
    signatureId: string,
    documentId: string,
    signerEmail: string,
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "signature.create",
            resource_type: "signature",
            resource_id: signatureId,
            metadata: {
                document_id: documentId,
                signer_email: signerEmail,
            },
        },
        request
    )
}

/**
 * Log signature completion
 */
export async function logSignatureComplete(
    supabase: SupabaseClient<Database>,
    userId: string,
    signatureId: string,
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "signature.complete",
            resource_type: "signature",
            resource_id: signatureId,
        },
        request
    )
}

/**
 * Log AI generation
 */
export async function logAIGeneration(
    supabase: SupabaseClient<Database>,
    userId: string,
    documentType: string,
    tokensUsed: number,
    cost: number,
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "ai.generate",
            metadata: {
                document_type: documentType,
                tokens_used: tokensUsed,
                estimated_cost: cost,
            },
        },
        request
    )
}

/**
 * Log business profile update
 */
export async function logBusinessUpdate(
    supabase: SupabaseClient<Database>,
    userId: string,
    businessId: string,
    changedFields: string[],
    request?: NextRequest
): Promise<void> {
    await logAudit(
        supabase,
        {
            user_id: userId,
            action: "business.update",
            resource_type: "business",
            resource_id: businessId,
            metadata: { changed_fields: changedFields },
        },
        request
    )
}

/**
 * Query audit logs for a user
 */
export async function getUserAuditLogs(
    supabase: SupabaseClient<Database>,
    userId: string,
    options: {
        limit?: number
        action?: AuditAction
        resourceType?: ResourceType
        startDate?: Date
        endDate?: Date
    } = {}
): Promise<Array<Record<string, unknown>>> {
    try {
        let query = supabase
            .from("audit_logs")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })

        if (options.action) {
            query = query.eq("action", options.action)
        }

        if (options.resourceType) {
            query = query.eq("resource_type", options.resourceType)
        }

        if (options.startDate) {
            query = query.gte("created_at", options.startDate.toISOString())
        }

        if (options.endDate) {
            query = query.lte("created_at", options.endDate.toISOString())
        }

        if (options.limit) {
            query = query.limit(options.limit)
        }

        const { data, error } = await query

        if (error) {
            console.error("Error fetching audit logs:", error)
            return []
        }

        return data || []
    } catch (error) {
        console.error("Audit log query failed:", error)
        return []
    }
}
