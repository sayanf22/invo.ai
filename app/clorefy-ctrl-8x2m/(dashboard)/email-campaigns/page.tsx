import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { computeFunnelStage } from "@/lib/funnel-stage"
import { buildEmailHistory, type RawEmailEvent } from "@/lib/email-history"
import EmailCampaignsClient from "./email-campaigns-client"

export default async function EmailCampaignsPage() {
  await requireAdmin()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString()
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const [
    { data: profiles },
    { data: sendLogs },
    { data: emailEvents },
    { data: docRows },
    { data: campaigns },
    { data: engagementEvents },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id, email, full_name, onboarding_complete, plan_selected, last_active_at, created_at, tier, last_login_location, last_login_at, last_login_ip, last_login_device")
      .not("email", "is", null)
      .order("created_at", { ascending: false }),
    supabase.from("user_email_send_log").select("user_id, email_type, sent_at"),
    supabase.from("email_events")
      .select("email, event, event_at, subject, tag, reason")
      .gte("event_at", thirtyDaysAgo)
      .order("event_at", { ascending: false }),
    supabase.from("document_sessions").select("user_id"),
    supabase.from("admin_email_campaigns")
      .select("*").order("sent_at", { ascending: false }).limit(20),
    // All-time email events (with message_id) — source of truth for history + opens
    supabase.from("email_events")
      .select("email, message_id, event, event_at, subject, tag")
      .order("event_at", { ascending: false }),
    // Onboarding progress per user — which phase they stalled at
    supabase.from("onboarding_progress").select("user_id, current_phase"),
  ])

  // Map user_id → onboarding phase
  const phaseMap = new Map<string, string | null>()
  for (const r of progressRows ?? []) {
    if (r.user_id) phaseMap.set(r.user_id, r.current_phase ?? null)
  }

  // Friendly labels for automated lifecycle emails
  // Group all-time events by recipient email — used to rebuild each user's history
  const eventsByEmail = new Map<string, RawEmailEvent[]>()
  for (const ev of engagementEvents ?? []) {
    const key = (ev.email ?? "").toLowerCase()
    if (!key) continue
    if (!eventsByEmail.has(key)) eventsByEmail.set(key, [])
    eventsByEmail.get(key)!.push({
      message_id: ev.message_id ?? null,
      event: ev.event,
      subject: ev.subject ?? null,
      tag: ev.tag ?? null,
      event_at: ev.event_at,
    })
  }

  // Build lookups
  const sendLogMap = new Map<string, Array<{ email_type: string; sent_at: string }>>()
  for (const log of sendLogs ?? []) {
    if (!sendLogMap.has(log.user_id)) sendLogMap.set(log.user_id, [])
    sendLogMap.get(log.user_id)!.push({ email_type: log.email_type, sent_at: log.sent_at })
  }

  // Per-email engagement stats
  type EmailStats = {
    last_event: { event: string; event_at: string } | null
    delivered: number; opened: number; clicked: number; bounced: number; last_opened_at: string | null
  }
  const emailStatsMap = new Map<string, EmailStats>()
  for (const ev of emailEvents ?? []) {
    const s = emailStatsMap.get(ev.email) ?? { last_event: null, delivered: 0, opened: 0, clicked: 0, bounced: 0, last_opened_at: null }
    if (!s.last_event) s.last_event = { event: ev.event, event_at: ev.event_at }
    if (ev.event === "delivered") s.delivered += 1
    else if (ev.event === "opened" || ev.event === "uniqueOpened") { s.opened += 1; if (!s.last_opened_at) s.last_opened_at = ev.event_at }
    else if (ev.event === "click") s.clicked += 1
    else if (ev.event === "hardBounce" || ev.event === "softBounce" || ev.event === "blocked") s.bounced += 1
    emailStatsMap.set(ev.email, s)
  }

  const docCountMap = new Map<string, number>()
  for (const r of docRows ?? []) {
    docCountMap.set(r.user_id, (docCountMap.get(r.user_id) ?? 0) + 1)
  }

  const emailSummary: Record<string, number> = {}
  for (const ev of emailEvents ?? []) {
    emailSummary[ev.event] = (emailSummary[ev.event] ?? 0) + 1
  }

  // Emails queued today (from send_log created today)
  const sentToday = (sendLogs ?? []).filter(
    (l: any) => new Date(l.sent_at) >= todayStart
  ).length

  const users = (profiles ?? []).map((p: any) => {
    const sentEmails = sendLogMap.get(p.id) ?? []
    const stats = emailStatsMap.get(p.email) ?? null
    const docsCount = docCountMap.get(p.id) ?? 0
    const daysSinceActive = p.last_active_at
      ? Math.floor((now - new Date(p.last_active_at).getTime()) / 86400000)
      : Math.floor((now - new Date(p.created_at).getTime()) / 86400000)
    const daysSinceSignup = Math.floor((now - new Date(p.created_at).getTime()) / 86400000)

    let category = "active"
    if (!p.onboarding_complete && daysSinceSignup >= 2) category = "dropoff"
    else if (p.onboarding_complete && daysSinceActive >= 7) category = "inactive"

    const autoStopped = sentEmails.some(s => s.email_type === "inactive_2" || s.email_type === "dropoff_2")

    // Build the real email history from Brevo events (grouped by message_id) — accurate opens
    const emailHistory = buildEmailHistory(eventsByEmail.get((p.email ?? "").toLowerCase()) ?? [])
    const autoSentCount = emailHistory.filter(h => h.kind === "auto").length
    const manualSentCount = emailHistory.filter(h => h.kind === "manual").length
    const totalSentCount = emailHistory.length

    const lastSentAt = emailHistory.length > 0 ? emailHistory[0].sent_at : null
    const lastManualSentAt = emailHistory.find(h => h.kind === "manual")?.sent_at ?? null
    const totalOpens = emailHistory.reduce((sum, h) => sum + h.open_count, 0)
    const totalClicks = emailHistory.reduce((sum, h) => sum + h.click_count, 0)
    const lastOpenedAt = emailHistory
      .map(h => h.last_opened_at)
      .filter((t): t is string => !!t)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null

    // Where the user is in the journey / where they got stuck
    const funnel = computeFunnelStage({
      createdAt: p.created_at,
      lastActiveAt: p.last_active_at,
      planSelected: p.plan_selected ?? false,
      onboardingComplete: p.onboarding_complete ?? false,
      onboardingPhase: phaseMap.get(p.id) ?? null,
      docsCount: docsCount,
    }, now)

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
      auto_sent_count: autoSentCount,
      manual_sent_count: manualSentCount,
      total_sent_count: totalSentCount,
      last_manual_sent_at: lastManualSentAt,
      last_sent_at: lastSentAt,
      email_history: emailHistory,
      last_email_event: stats?.last_event ?? null,
      opened: totalOpens > 0,
      open_count: totalOpens,
      delivered_count: stats?.delivered ?? 0,
      clicked_count: totalClicks,
      bounced: (stats?.bounced ?? 0) > 0,
      last_opened_at: lastOpenedAt,
      category,
      never_emailed: totalSentCount === 0,
      auto_stopped: autoStopped,
      funnel_stage: funnel.label,
      funnel_detail: funnel.detail,
      funnel_stuck: funnel.stuck,
      last_login_at: (p.last_login_at as string | null) ?? null,
      last_login_location: (p.last_login_location as string | null) ?? null,
      last_login_ip: (p.last_login_ip as string | null) ?? null,
      last_login_device: (p.last_login_device as string | null) ?? null,
    }
  })

  return (
    <EmailCampaignsClient
      users={users}
      campaigns={campaigns ?? []}
      emailSummary={emailSummary}
      sentToday={sentToday}
      recentEvents={(emailEvents ?? []).slice(0, 100).map((e: any) => ({
        id: `${e.email}-${e.event_at}`,
        email: e.email,
        event: e.event,
        subject: e.subject ?? null,
        tag: e.tag ?? null,
        event_at: e.event_at,
        reason: e.reason ?? null,
        user_id: null,
      }))}
    />
  )
}
