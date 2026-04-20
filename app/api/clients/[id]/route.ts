import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError, validateOrigin, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { clientSchema } from "@/lib/invoice-types"
import type { Client } from "@/lib/invoice-types"

// UUID v4 regex — reject obviously invalid IDs before hitting the DB
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * PUT /api/clients/[id]
 * Updates a client for the authenticated user.
 * Requirements: 4.2, 11.2, 11.5
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { id } = await params

    // Validate ID format to prevent injection via path param
    if (!id || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 10 * 1024)
    if (sizeError) return sizeError

    const result = clientSchema.safeParse(body)
    if (!result.success) {
        return NextResponse.json(
            { error: "Validation failed", details: result.error.errors },
            { status: 400 }
        )
    }

    // Sanitize all text fields
    const sanitized = {
        name: sanitizeText(result.data.name),
        email: result.data.email ? sanitizeText(result.data.email) : null,
        phone: result.data.phone ? sanitizeText(result.data.phone) : null,
        address: result.data.address ? sanitizeText(result.data.address) : null,
        tax_id: result.data.tax_id ? sanitizeText(result.data.tax_id) : null,
        notes: result.data.notes ? sanitizeText(result.data.notes) : null,
    }

    if (!sanitized.name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data: client, error } = await auth.supabase
        .from("clients" as any)
        .update(sanitized)
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select()
        .single()

    if (error) {
        // PGRST116 = no rows found
        if (error.code === "PGRST116") {
            return NextResponse.json({ error: "Client not found" }, { status: 404 })
        }
        console.error("PUT /api/clients/[id] error:", error)
        return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
    }

    if (!client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json({ client: client as Client }, { status: 200 })
}

/**
 * DELETE /api/clients/[id]
 * Deletes a client for the authenticated user.
 * Requirements: 5.2, 11.2, 11.5
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const originError = validateOrigin(request)
    if (originError) return originError

    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { id } = await params

    // Validate ID format
    if (!id || !UUID_REGEX.test(id)) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const { data: deleted, error } = await auth.supabase
        .from("clients" as any)
        .delete()
        .eq("id", id)
        .eq("user_id", auth.user.id)
        .select()

    if (error) {
        console.error("DELETE /api/clients/[id] error:", error)
        return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
    }

    if (!deleted || deleted.length === 0) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
}
