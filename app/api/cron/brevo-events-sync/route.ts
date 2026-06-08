/**
 * POST /api/cron/brevo-events-sync
 *
 * Reconciliation layer for email tracking. The Brevo WEBHOOK (/api/webhooks/brevo)
 * is the real-time source of open/click/delivery events. This endpoint PULLS the
 * same events from the Brevo statistics API and backfills any that the webhook
 * may have missed (downtime, network blip, misconfig) — so `email_events` stays
 * complete and the dashboard never loses an open.
 *
 * Idempotent: only inserts events not already stored (dedup on message_id+event).
 *
 * Auth: either the cron secret (x-cron-secret header) OR an admin session, so it
 * can run on a schedule AND be triggered manually from the dashboard.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSession } from "@/lib/admin-auth"
import { fetchTransactionalEvents, normalizeBrevoEvent } from "@/lib/brevo"

export const runtime = "nodejs"
export const maxDuration = 60

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = req.headers.get("x-cron-secret")
  if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true
  }
  // Fall back to admin session (manual trigger from dashboard)
  const adminEmail = await verifyAdminSession(req)
  return !!adminEmail
}

export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // How far back to reconcile (default 7 days; cron can pass ?days=)
  const daysParam = Number(request.nextUrl.searchParams.get("days"))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 7

  const events = await fetchTransactionalEvents({ days, maxEvents: 5000 })
  if (events.length === 0) {
    return NextResponse.json({ ok: true, fetched: 0, inserted: 0, note: "No events returned" })
  }

  const supabase = getServiceClient()

  // Normalise + keep only events that carry a message id (needed for dedup)
  const normalized = events
    .filter((e) => e.messageId && e.email)
    .map((e) => ({
      message_id: e.messageId!.slice(0, 512),
      email: e.email.toLowerCase().slice(0, 254),
      event: normalizeBrevoEvent(e.event),
      subject: e.subject?.slice(0, 512) ?? null,
      tag: e.tag?.slice(0, 128) ?? null,
      template_id: e.templateId ?? null,
      ip: e.ip?.slice(0, 64) ?? null,
      link: e.link?.slice(0, 2048) ?? null,
      reason: e.reason?.slice(0, 512) ?? null,
      event_at: new Date(e.date).toISOString(),
    }))

  // Find which (message_id, event) pairs already exist so we only insert new ones
  const messageIds = Array.from(new Set(normalized.map((n) => n.message_id)))
  const existing = new Set<string>()
  // chunk the IN query to avoid oversized requests
  for (let i = 0; i < messageIds.length; i += 200) {
    const chunk = messageIds.slice(i, i + 200)
    const { data } = await supabase
      .from("email_events")
      .select("message_id, event")
      .in("message_id", chunk)
    for (const row of data ?? []) existing.add(`${row.message_id}|${row.event}`)
  }

  // Resolve user_id by email (batch)
  const emails = Array.from(new Set(normalized.map((n) => n.email)))
  const emailToUser = new Map<string, string>()
  for (let i = 0; i < emails.length; i += 200) {
    const chunk = emails.slice(i, i + 200)
    const { data } = await supabase.from("profiles").select("id, email").in("email", chunk)
    for (const row of data ?? []) {
      if (row.email) emailToUser.set(row.email.toLowerCase(), row.id)
    }
  }

  // Build the list of brand-new rows (dedup within the batch too)
  const seen = new Set<string>()
  const toInsert = normalized.filter((n) => {
    const key = `${n.message_id}|${n.event}`
    if (existing.has(key) || seen.has(key)) return false
    seen.add(key)
    return true
  }).map((n) => ({ ...n, user_id: emailToUser.get(n.email) ?? null }))

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { error } = await supabase.from("email_events").insert(batch)
    if (!error) inserted += batch.length
  }

  return NextResponse.json({
    ok: true,
    fetched: events.length,
    candidates: normalized.length,
    inserted,
    backfilled_from_api: inserted > 0,
  })
}
