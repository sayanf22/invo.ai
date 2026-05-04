import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildQuotationResponseRow, type ResponseType } from "@/lib/quotation-response"

/**
 * POST /api/quotations/respond
 * Public endpoint (no auth required) — called by recipients from the /pay/ page
 * to accept, reject, or request changes on a quotation or proposal.
 *
 * Uses the existing `quotation_responses` table (created in esignature_upgrade.sql).
 * Service role is used to bypass RLS since recipients are not authenticated.
 *
 * Body: {
 *   sessionId: string
 *   response: "accepted" | "declined" | "changes_requested"
 *   clientName?: string
 *   clientEmail?: string
 *   note?: string
 * }
 */
export async function POST(request: NextRequest) {
    let body: {
        sessionId?: string
        response?: string
        clientName?: string
        clientEmail?: string
        note?: string
    }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { sessionId, response, clientName, clientEmail, note } = body

    if (!sessionId || !response) {
        return NextResponse.json({ error: "sessionId and response are required" }, { status: 400 })
    }

    // Validate response type — use "declined" to match the DB constraint
    const validResponses = ["accepted", "declined", "changes_requested"]
    if (!validResponses.includes(response)) {
        return NextResponse.json(
            { error: "Invalid response. Must be: accepted, declined, or changes_requested" },
            { status: 400 }
        )
    }

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
        return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 })
    }

    // Use service role — recipients are not authenticated
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )

    // Verify session exists and is a quotation or proposal
    const { data: session, error: fetchError } = await supabase
        .from("document_sessions")
        .select("id, user_id, document_type, client_name, status, context")
        .eq("id", sessionId)
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!["quotation", "proposal"].includes(session.document_type)) {
        return NextResponse.json(
            { error: "Only quotations and proposals can be accepted or rejected" },
            { status: 400 }
        )
    }

    // Check if client response is allowed (allowClientResponse defaults to true)
    const context = session.context as any
    if (context?.allowClientResponse === false) {
        return NextResponse.json(
            { error: "Client responses are not enabled for this document" },
            { status: 403 }
        )
    }

    // Extract IP and user agent for audit trail
    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || request.headers.get("x-real-ip")
        || "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"

    // Resolve client name/email from body or session context
    const resolvedClientName = clientName?.trim()
        || session.client_name
        || (context?.toName as string | undefined)
        || "Unknown"
    const resolvedClientEmail = clientEmail?.trim()
        || (context?.toEmail as string | undefined)
        || ""

    // Build the row using the exported helper
    const row = buildQuotationResponseRow(
        {
            sessionId,
            responseType: response as ResponseType,
            clientName: resolvedClientName,
            clientEmail: resolvedClientEmail,
            reason: note?.trim(),
        },
        ipAddress,
        userAgent
    )

    // Insert into the existing quotation_responses table
    const { error: insertError } = await (supabase as any)
        .from("quotation_responses")
        .insert(row)

    if (insertError) {
        console.error("Failed to save quotation response:", insertError)
        return NextResponse.json({ error: "Failed to save response" }, { status: 500 })
    }

    // Create a notification for the document owner
    try {
        const actionLabel = response === "accepted"
            ? "accepted"
            : response === "declined"
                ? "declined"
                : "requested changes on"

        await (supabase as any).from("notifications").insert({
            user_id: session.user_id,
            type: `${session.document_type}_${response}`,
            title: `${resolvedClientName} ${actionLabel} your ${session.document_type}`,
            message: note?.trim() ? `Note: "${note.trim()}"` : null,
            metadata: { sessionId, response, note: note?.trim() || null },
        })
    } catch {
        // Non-fatal — notification failure shouldn't block the response
    }

    return NextResponse.json({ success: true, response })
}
