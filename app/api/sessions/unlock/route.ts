import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

/**
 * POST /api/sessions/unlock
 * Reverts a finalized (sent) document session back to "active" so the user
 * can edit it again. Only works for sessions with status "finalized" — signed
 * or paid sessions cannot be unlocked.
 *
 * Body: { sessionId: string }
 */
export async function POST(request: NextRequest) {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { sessionId } = await request.json()
    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    // Verify the session belongs to this user and is in a revertible state
    const { data: session, error: fetchError } = await auth.supabase
        .from("document_sessions")
        .select("id, status")
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)
        .single()

    if (fetchError || !session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.status === "signed") {
        return NextResponse.json(
            { error: "Signed documents cannot be unlocked", status: session.status },
            { status: 403 }
        )
    }

    if (session.status === "paid") {
        return NextResponse.json(
            { error: "Paid documents cannot be unlocked", status: session.status },
            { status: 403 }
        )
    }

    if (session.status === "active") {
        return NextResponse.json({ success: true, message: "Document is already editable" })
    }

    // Reset status to active
    const { error: updateError } = await auth.supabase
        .from("document_sessions")
        .update({
            status: "active",
            updated_at: new Date().toISOString(),
        } as any)
        .eq("id", sessionId)
        .eq("user_id", auth.user.id)

    if (updateError) {
        console.error("Failed to unlock session:", updateError)
        return NextResponse.json({ error: "Failed to unlock document" }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "Document unlocked and editable again" })
}
