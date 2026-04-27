import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/emails/track-view
 *
 * Public endpoint — no auth required (called by email recipients).
 * Tracks when a document is viewed via /view/ or /pay/ page.
 *
 * SECURITY:
 * - UUID format validation prevents arbitrary DB queries
 * - Uses anon key — RLS policies apply (not service role)
 * - Rate-limited: max 1 view increment per session per 60s via DB timestamp check
 * - Only increments if the session actually has an active payment record
 * - Does NOT expose any document data in the response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: true }) // Silent fail — non-critical
    }

    const { sessionId } = body

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ ok: true })
    }

    // Strict UUID format check — prevents SQL injection and arbitrary queries
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sessionId)) {
      return NextResponse.json({ ok: true })
    }

    // Use anon key — RLS policies apply. Service role is not needed here
    // since we only update view_count on payment records (no sensitive data exposed).
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const now = new Date()
    const nowIso = now.toISOString()

    // Rate-limit: only increment if last view was > 60 seconds ago
    const { data: payment } = await supabase
      .from("invoice_payments")
      .select("id, view_count, link_viewed_at")
      .eq("session_id", sessionId)
      .in("status", ["created", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (payment) {
      // Throttle: skip if last view was within 60 seconds (prevents spam inflation)
      const lastViewed = payment.link_viewed_at ? new Date(payment.link_viewed_at) : null
      const secondsSinceLastView = lastViewed ? (now.getTime() - lastViewed.getTime()) / 1000 : Infinity

      if (secondsSinceLastView > 60) {
        await supabase
          .from("invoice_payments")
          .update({
            view_count: (payment.view_count || 0) + 1,
            link_viewed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", payment.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Always return 200 — tracking is non-critical
  }
}

    const now = new Date()
    const nowIso = now.toISOString()

    // Rate-limit: only increment if last view was > 60 seconds ago
    const { data: payment } = await supabase
      .from("invoice_payments")
      .select("id, view_count, link_viewed_at")
      .eq("session_id", sessionId)
      .in("status", ["created", "partially_paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (payment) {
      // Throttle: skip if last view was within 60 seconds (prevents spam inflation)
      const lastViewed = payment.link_viewed_at ? new Date(payment.link_viewed_at) : null
      const secondsSinceLastView = lastViewed ? (now.getTime() - lastViewed.getTime()) / 1000 : Infinity

      if (secondsSinceLastView > 60) {
        await supabase
          .from("invoice_payments")
          .update({
            view_count: (payment.view_count || 0) + 1,
            link_viewed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", payment.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true }) // Always return 200 — tracking is non-critical
  }
}
