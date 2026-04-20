import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError, validateOrigin, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { clientSchema } from "@/lib/invoice-types"

/**
 * POST /api/clients/bulk
 * Bulk-inserts clients for the authenticated user.
 * Validates every row with clientSchema and sanitizes all text fields.
 * Requirements: 6.4, 6.5, 11.1
 */
export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    // 500KB max for bulk import
    const sizeError = validateBodySize(body, 500 * 1024)
    if (sizeError) return sizeError

    const { clients } = body as { clients: unknown }

    if (!Array.isArray(clients)) {
        return NextResponse.json({ error: "clients must be an array" }, { status: 400 })
    }

    // Hard cap: prevent abuse via massive bulk inserts
    if (clients.length > 1000) {
        return NextResponse.json({ error: "Maximum 1000 clients per import" }, { status: 400 })
    }

    const validRows: Record<string, string | null>[] = []
    let skipped = 0

    for (const row of clients) {
        // Skip rows with empty/missing name (server-side guard)
        if (!row || typeof row !== "object" || !row.name || !String(row.name).trim()) {
            skipped++
            continue
        }

        // Validate with Zod schema — same rules as single create
        const parsed = clientSchema.safeParse(row)
        if (!parsed.success) {
            skipped++
            continue
        }

        // Sanitize all text fields
        const sanitized = {
            name: sanitizeText(parsed.data.name),
            email: parsed.data.email ? sanitizeText(parsed.data.email) : null,
            phone: parsed.data.phone ? sanitizeText(parsed.data.phone) : null,
            address: parsed.data.address ? sanitizeText(parsed.data.address) : null,
            tax_id: parsed.data.tax_id ? sanitizeText(parsed.data.tax_id) : null,
            notes: parsed.data.notes ? sanitizeText(parsed.data.notes) : null,
            user_id: auth.user.id,
        }

        // Skip if name became empty after sanitization
        if (!sanitized.name) {
            skipped++
            continue
        }

        validRows.push(sanitized)
    }

    if (validRows.length === 0) {
        return NextResponse.json({ inserted: 0, skipped })
    }

    const { error } = await auth.supabase
        .from("clients" as any)
        .insert(validRows as any[])

    if (error) {
        console.error("POST /api/clients/bulk error:", error)
        return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
    }

    return NextResponse.json({ inserted: validRows.length, skipped })
}
