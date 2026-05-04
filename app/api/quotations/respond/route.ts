import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/quotations/respond
 * Public endpoint (no auth required) — called by recipients from the /pay/ page
 * to accept, reject, or request changes on a quotation or proposal.
 *
 * Body: { sessionId: string, response: "accepted" | "rejected" | "changes_requested", note?: string }
 */
export async function POST(request: NextRequest) {
    let body: { sessionId?: string; response?: string; note?: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { sessionId, response, note } = body

    if (!sessionId || !response) {
        return NextResponse.json({ error: "sessionId and response are required" }, { status: 400 })
    }

    const validResponses = ["accepted", "rejected", "changes_requested"]
    if (!validResponses.includes(response)) {
        return NextResponse.json({ error: "Invalid response. Must be: accepted, rejected, or changes_requested" }, { status: 400 })
    }

    // Use service role — this is a public endpoint (recipient has no auth)
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )

    // Verify session exists and is a quotation or proposal
    const { data: session, error: fetchError } = await supabase
        .from("document_sessions")
        .select("id, user_id, document_type, client_name, status")
        .eq("id", sessionId)
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    if (!["quotation", "proposal"].includes(session.document_type)) {
        return NextResponse.json({ error: "Only quotations and proposals can be accepted or rejected" }, { status: 400 })
    }

    // Update the session with the client's response
    const { error: updateError } = await supabase
        .from("document_sessions")
        .update({
            client_response: response,
            client_response_note: note || null,
            client_response_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as any)
        .eq("id", sessionId)

    if (updateError) {
        console.error("Failed to save response:", updateError)
        return NextResponse.json({ error: "Failed to save response" }, { status: 500 })
    }

    // Create a notification for the document owner
    try {
        const clientName = session.client_name || "A client"
        const docType = session.document_type
        const actionLabel = response === "accepted" ? "accepted" : response === "rejected" ? "declined" : "requested changes on"

        await supabase.from("notifications").insert({
            user_id: session.user_id,
            type: `${docType}_${response}`,
            title: `${clientName} ${actionLabel} your ${docType}`,
            message: note ? `Note: "${note}"` : undefined,
            metadata: { sessionId, response, note },
        } as any)
    } catch {
        // Non-fatal — notification failure shouldn't block the response
    }

    return NextResponse.json({ success: true, response })
}
