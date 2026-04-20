import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, sanitizeError, validateOrigin, validateBodySize } from "@/lib/api-auth"
import { sanitizeText } from "@/lib/sanitize"
import { clientSchema } from "@/lib/invoice-types"
import type { Client } from "@/lib/invoice-types"

/**
 * GET /api/clients
 * Returns all clients for the authenticated user, ordered by name ASC.
 * Requirements: 2.1, 11.1, 11.2, 11.4
 */
export async function GET(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { data: clients, error } = await auth.supabase
        .from("clients" as any)
        .select("*")
        .eq("user_id", auth.user.id)
        .order("name", { ascending: true })

    if (error) {
        console.error("GET /api/clients error:", error)
        return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
    }

    return NextResponse.json({ clients: (clients ?? []) as unknown as Client[] })
}

/**
 * POST /api/clients
 * Creates a new client for the authenticated user.
 * Requirements: 3.2, 1.4, 11.1, 11.4
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

    const sizeError = validateBodySize(body, 10 * 1024) // 10KB max
    if (sizeError) return sizeError

    const result = clientSchema.safeParse(body)
    if (!result.success) {
        return NextResponse.json(
            { error: "Validation failed", details: result.error.errors },
            { status: 400 }
        )
    }

    // Sanitize all text fields before inserting
    const sanitized = {
        name: sanitizeText(result.data.name),
        email: result.data.email ? sanitizeText(result.data.email) : null,
        phone: result.data.phone ? sanitizeText(result.data.phone) : null,
        address: result.data.address ? sanitizeText(result.data.address) : null,
        tax_id: result.data.tax_id ? sanitizeText(result.data.tax_id) : null,
        notes: result.data.notes ? sanitizeText(result.data.notes) : null,
        user_id: auth.user.id,
    }

    if (!sanitized.name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const { data: client, error } = await auth.supabase
        .from("clients" as any)
        .insert(sanitized)
        .select()
        .single()

    if (error) {
        console.error("POST /api/clients error:", error)
        return NextResponse.json({ error: sanitizeError(error) }, { status: 500 })
    }

    return NextResponse.json({ client: client as unknown as Client }, { status: 201 })
}
