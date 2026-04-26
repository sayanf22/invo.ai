import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"

// GET /api/emails/schedules?sessionId=xxx — list pending schedules for a session
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const sessionId = request.nextUrl.searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from("email_schedules")
      .select("id, sequence_step, sequence_type, scheduled_for, status, sent_at, cancelled_reason")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .order("scheduled_for", { ascending: true })

    if (error) {
      console.error("Get schedules DB error:", error.message)
      return NextResponse.json({ error: "Failed to load schedules" }, { status: 500 })
    }

    return NextResponse.json({ schedules: data ?? [] })
  } catch (error) {
    console.error("Get schedules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/emails/schedules?sessionId=xxx — cancel all pending follow-ups for a session
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { user, supabase } = auth
    const sessionId = request.nextUrl.searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 })
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from("document_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const { error } = await (supabase as any)
      .from("email_schedules")
      .update({
        status: "cancelled",
        cancelled_reason: "user_cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .eq("status", "pending")

    if (error) {
      console.error("Cancel schedules DB error:", error.message)
      return NextResponse.json({ error: "Failed to cancel reminders" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Cancel schedules error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
