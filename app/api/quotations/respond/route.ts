import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getClientIP, validateBodySize, validateOrigin } from "@/lib/api-auth"
import { checkPublicRateLimit } from "@/lib/public-rate-limit"
import { isPublicDocumentId } from "@/lib/public-capability"
import { VALID_RESPONSE_TYPES, type ResponseType } from "@/lib/quotation-response"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
    const originError = validateOrigin(request)
    if (originError) return originError

    let body: {
        publicId?: unknown
        response?: unknown
        clientName?: unknown
        clientEmail?: unknown
        note?: unknown
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const sizeError = validateBodySize(body, 8 * 1024)
    if (sizeError) return sizeError

    const publicId = typeof body.publicId === "string" ? body.publicId : ""
    const response = typeof body.response === "string" ? body.response : ""
    const clientName = typeof body.clientName === "string" ? body.clientName.trim() : ""
    const clientEmail = typeof body.clientEmail === "string" ? body.clientEmail.trim().toLowerCase() : ""
    const note = typeof body.note === "string" ? body.note.trim() : ""

    if (!isPublicDocumentId(publicId)) {
        return NextResponse.json({ error: "Invalid public document capability" }, { status: 400 })
    }
    if (!VALID_RESPONSE_TYPES.includes(response as ResponseType)) {
        return NextResponse.json({ error: "Invalid response" }, { status: 400 })
    }
    if (!clientName || clientName.length > 200) {
        return NextResponse.json({ error: "Your name is required and must be 200 characters or less" }, { status: 400 })
    }
    if (!EMAIL_PATTERN.test(clientEmail) || clientEmail.length > 254) {
        return NextResponse.json({ error: "A valid email address is required" }, { status: 400 })
    }
    if (note.length > 2000) {
        return NextResponse.json({ error: "Response note must be 2,000 characters or less" }, { status: 400 })
    }
    if (response === "changes_requested" && !note) {
        return NextResponse.json({ error: "Please describe the changes you need" }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
        console.error("[quotations/respond] Service credentials are not configured")
        return NextResponse.json({ error: "Service temporarily unavailable" }, { status: 503 })
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
    const ipAddress = getClientIP(request)

    const ipRateError = await checkPublicRateLimit(
        supabase, ipAddress, "quotation_response_ip", 20, 3600
    )
    if (ipRateError) return ipRateError
    const capabilityRateError = await checkPublicRateLimit(
        supabase, publicId, "quotation_response_capability", 8, 3600
    )
    if (capabilityRateError) return capabilityRateError

    const { data, error } = await (supabase.rpc as any)("record_quotation_response", {
        p_public_id: publicId,
        p_response_type: response,
        p_client_name: clientName,
        p_client_email: clientEmail,
        p_reason: note || null,
        p_ip_address: ipAddress === "unknown" ? null : ipAddress,
        p_user_agent: request.headers.get("user-agent") ?? "unknown",
    })
    if (error) {
        console.error("[quotations/respond] Atomic response recording failed:", error)
        return NextResponse.json({ error: "Response service temporarily unavailable" }, { status: 503 })
    }

    const result = Array.isArray(data) ? data[0] : data
    const existingResponse = result?.response_type && result?.responded_at
        ? { response_type: result.response_type, responded_at: result.responded_at }
        : null

    if (result?.outcome === "recorded") {
        return NextResponse.json({ success: true, response: existingResponse })
    }
    if (result?.outcome === "already_responded") {
        return NextResponse.json(
            { error: "A response has already been recorded", existingResponse },
            { status: 409 }
        )
    }
    if (result?.outcome === "response_disabled" || result?.outcome === "signature_required") {
        return NextResponse.json({ error: "Client responses are not enabled for this document" }, { status: 403 })
    }
    if (result?.outcome === "not_found") {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    if (result?.outcome === "not_available") {
        return NextResponse.json({ error: "This document is not available for responses" }, { status: 409 })
    }
    return NextResponse.json({ error: "Invalid response request" }, { status: 400 })
}
