/**
 * GET /api/admin/email-stats
 * Returns email event statistics for the admin dashboard.
 * Supports filtering by time range, email, and tag.
 *
 * Auth: verifyAdminSession()
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const emailFilter = searchParams.get("email") ?? undefined
  const tagFilter = searchParams.get("tag") ?? undefined
  const userIdFilter = searchParams.get("userId") ?? undefined
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") ?? 30)))
  const page = Math.max(1, Number(searchParams.get("page") ?? 1))
  const pageSize = 50

  const supabase = getServiceClient()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // Aggregate counts by event type
  const { data: counts, error: countsErr } = await supabase
    .from("email_events")
    .select("event")
    .gte("event_at", since)
    .then(({ data, error }) => {
      if (error || !data) return { data: null, error }
      const agg: Record<string, number> = {}
      for (const row of data) {
        agg[row.event] = (agg[row.event] ?? 0) + 1
      }
      return { data: agg, error: null }
    })

  // Recent events with optional filters (paginated)
  let query = supabase
    .from("email_events")
    .select("id, email, event, subject, tag, event_at, reason, link, user_id, message_id", { count: "exact" })
    .gte("event_at", since)
    .order("event_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (emailFilter) query = query.ilike("email", `%${emailFilter}%`)
  if (tagFilter) query = query.eq("tag", tagFilter)
  if (userIdFilter) query = query.eq("user_id", userIdFilter)

  const { data: events, count: totalEvents, error: eventsErr } = await query

  if (eventsErr || countsErr) {
    console.error("[email-stats] error:", eventsErr || countsErr)
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 })
  }

  // Delivery rate calculation
  const sent = (counts?.["sent"] ?? 0) + (counts?.["request"] ?? 0)
  const delivered = counts?.["delivered"] ?? 0
  const opened = counts?.["opened"] ?? 0
  const clicked = counts?.["click"] ?? 0
  const hardBounce = counts?.["hardBounce"] ?? 0
  const softBounce = counts?.["softBounce"] ?? 0
  const spam = counts?.["spam"] ?? 0
  const unsubscribed = counts?.["unsubscribed"] ?? 0

  return NextResponse.json({
    summary: {
      sent,
      delivered,
      opened,
      clicked,
      hardBounce,
      softBounce,
      spam,
      unsubscribed,
      blocked: counts?.["blocked"] ?? 0,
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 100) : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      bounceRate: sent > 0 ? Math.round(((hardBounce + softBounce) / sent) * 100) : 0,
    },
    events: events ?? [],
    total: totalEvents ?? 0,
    page,
    pageSize,
    days,
  })
}
