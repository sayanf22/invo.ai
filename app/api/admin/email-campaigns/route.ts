/**
 * Admin Email Campaigns API
 *
 * GET  /api/admin/email-campaigns  — users enriched with email status + send logs + stats
 * POST /api/admin/email-campaigns  — force-sync segment (advanced / emergency use)
 *
 * The sync is handled automatically by the daily cron at 08:00 UTC.
 * This endpoint is the data source for the dashboard view.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { syncUserOnLogin } from "@/lib/brevo"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const supabase = getServiceClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  // Fetch everything in parallel
  const [
    { data: profiles },
    { data: sendLogs },
    { data: emailEvents },
    { data: docRows },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id, email, full_name, onboarding_complete, last_active_at, created_at, tier")
      .not("email", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("user_email_send_log")
      .select("user_id, email_type, sent_at"),
    supabase.from("email_events")
      .select("email, event, event_at, subject, tag")
      .gte("event_at", thirtyDaysAgo)
      .order("event_at", { ascending: false }),
    supabase.from("document_sessions")
      .select("user_id"),
    supabase.from("admin_email_campaigns")
      .select("*").order("sent_at", { ascending: false }).limit(30),
  ])

  // Build per-user email send log
  const sendLogMap = new Map<string, Array<{ email_type: string; sent_at: string }>>()
  for (const log of sendLogs ?? []) {
    if (!sendLogMap.has(log.user_id)) sendLogMap.set(log.user_id, [])
    sendLogMap.get(log.user_id)!.push({ email_type: log.email_type, sent_at: log.sent_at })
  }

  // Build per-email latest event
  const emailEventMap = new Map<string, { event: string; event_at: string }>()
  for (const ev of emailEvents ?? []) {
    if (!emailEventMap.has(ev.email)) {
      emailEventMap.set(ev.email, { event: ev.event, event_at: ev.event_at })
    }
  }

  // Build doc count map
  const docCountMap = new Map<string, number>()
  for (const r of docRows ?? []) {
    docCountMap.set(r.user_id, (docCountMap.get(r.user_id) ?? 0) + 1)
  }

  const now = Date.now()

  // Enrich each user
  const usersWithStatus = (profiles ?? []).map((p: any) => {
    const sentEmails = sendLogMap.get(p.id) ?? []
    const lastEvent = emailEventMap.get(p.email) ?? null
    const docsCount = docCountMap.get(p.id) ?? 0
    const daysSinceActive = p.last_active_at
      ? Math.floor((now - new Date(p.last_active_at).getTime()) / 86400000)
      : Math.floor((now - new Date(p.created_at).getTime()) / 86400000)
    const daysSinceSignup = Math.floor((now - new Date(p.created_at).getTime()) / 86400000)

    // Determine user category
    let category = "active"
    if (!p.onboarding_complete && daysSinceSignup >= 2) {
      category = "dropoff"
    } else if (p.onboarding_complete && daysSinceActive >= 7) {
      category = "inactive"
    }

    return {
      id: p.id as string,
      email: p.email as string,
      name: (p.full_name as string | null) ?? null,
      onboarding_complete: p.onboarding_complete ?? false,
      last_active_at: p.last_active_at as string | null,
      created_at: p.created_at as string,
      tier: (p.tier as string | null) ?? "free",
      days_since_active: daysSinceActive,
      days_since_signup: daysSinceSignup,
      docs_count: docsCount,
      sent_emails: sentEmails,
      last_email_event: lastEvent,
      category,
      never_emailed: sentEmails.length === 0,
    }
  })

  // Email summary for KPI cards
  const emailSummary: Record<string, number> = {}
  for (const ev of emailEvents ?? []) {
    emailSummary[ev.event] = (emailSummary[ev.event] ?? 0) + 1
  }

  // Count emails queued today (from send_log)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const sentTodayCount = (sendLogs ?? []).filter(
    (l: any) => new Date(l.sent_at) >= todayStart
  ).length

  return NextResponse.json({
    users: usersWithStatus,
    campaigns: campaigns ?? [],
    emailSummary,
    sentToday: sentTodayCount,
    recentEvents: (emailEvents ?? []).slice(0, 50),
  })
}

// ── POST: force-sync (emergency / advanced) ───────────────────────────────────

const VALID_SEGMENTS = ["sync-dropoff", "sync-active", "sync-all"] as const
type Segment = (typeof VALID_SEGMENTS)[number]

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: { segment: Segment; dryRun?: boolean }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { segment, dryRun = false } = body
  if (!VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString()

  type UserRecord = { email: string; full_name: string | null; onboarding_complete: boolean; last_active_at: string | null; created_at: string }
  let users: UserRecord[] = []

  if (segment === "sync-dropoff") {
    const { data } = await supabase.from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", false)
      .or(`last_active_at.is.null,last_active_at.lt.${twoDaysAgo}`)
    users = (data ?? []).filter((u: any) => u.email)
  } else if (segment === "sync-active") {
    const { data } = await supabase.from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", true)
    users = (data ?? []).filter((u: any) => u.email)
  } else {
    const { data } = await supabase.from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
    users = (data ?? []).filter((u: any) => u.email)
  }

  if (dryRun) return NextResponse.json({ dryRun: true, count: users.length, segment })

  let synced = 0, failed = 0
  for (const u of users) {
    try {
      await syncUserOnLogin({
        email: u.email,
        firstName: u.full_name?.split(" ")[0] ?? null,
        isNewUser: false,
        onboardingComplete: u.onboarding_complete ?? false,
        signupAt: u.created_at,
      })
      synced++
    } catch { failed++ }
    await new Promise<void>((r) => setTimeout(r, 70))
  }

  try {
    await supabase.from("admin_email_campaigns").insert({
      segment, emails_sent: synced, emails_failed: failed,
      subject: `Manual ${segment} Brevo sync`, sent_by: adminEmail,
      sent_at: new Date().toISOString(),
    })
  } catch { /* non-critical */ }

  return NextResponse.json({ success: true, synced, failed, total: users.length, segment })
}
