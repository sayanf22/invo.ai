import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { computeFunnelStage } from "@/lib/funnel-stage"
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
    { data: manualEmails },
    { data: engagementEvents },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id, email, full_name, onboarding_complete, plan_selected, last_active_at, created_at, tier, last_login_location, last_login_at, last_login_ip")
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
    supabase.from("audit_logs")
      .select("user_id, created_at, metadata")
      .eq("action", "admin.direct_email")
      .order("created_at", { ascending: false }),
    // All-time open/click events — used to attribute engagement to each send
    supabase.from("email_events")
      .select("email, event, event_at, subject")
      .in("event", ["opened", "uniqueOpened", "click"])
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
  const AUTO_EMAIL_LABELS: Record<string, string> = {
    dropoff_1: "Onboarding nudge",
    dropoff_2: "Onboarding final nudge",
    inactive_1: "Win-back #1",
    inactive_2: "Win-back #2",
  }
  const autoEmailLabel = (type: string) => AUTO_EMAIL_LABELS[type] ?? type.replace(/_/g, " ")

  // Subject lines per automated email — used to attribute opens/clicks to a send
  const AUTO_EMAIL_SUBJECTS: Record<string, string> = {
    dropoff_1: "Your first doc is 1 click away ✨",
    dropoff_2: "One last nudge 👋",
    inactive_1: "Miss us yet? 👀",
    inactive_2: "Okay, last one 🙈",
  }
  const autoEmailSubject = (type: string): string | null => AUTO_EMAIL_SUBJECTS[type] ?? null

  type EmailHistoryEntry = {
    kind: "auto" | "manual"; label: string; subject: string | null; sent_at: string
    open_count: number; click_count: number; opens: string[]; last_opened_at: string | null
  }

  // Attribute open/click events to specific sends (history sorted newest-first)
  const attributeEngagement = (
    history: EmailHistoryEntry[],
    events: Array<{ subject: string | null; event: string; event_at: string }>
  ) => {
    for (const ev of events) {
      const subj = (ev.subject ?? "").trim().toLowerCase()
      if (!subj) continue
      const evTime = new Date(ev.event_at).getTime()
      const target = history.find(
        (h) => (h.subject ?? "").trim().toLowerCase() === subj && new Date(h.sent_at).getTime() <= evTime
      )
      if (!target) continue
      if (ev.event === "click") target.click_count += 1
      else if (ev.event === "opened" || ev.event === "uniqueOpened") { target.open_count += 1; target.opens.push(ev.event_at) }
    }
    for (const h of history) {
      h.opens.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      h.last_opened_at = h.opens.length > 0 ? h.opens[h.opens.length - 1] : null
    }
  }

  // Per-email all-time open/click list for per-send attribution
  const engagementByEmail = new Map<string, Array<{ subject: string | null; event: string; event_at: string }>>()
  for (const ev of engagementEvents ?? []) {
    const key = (ev.email ?? "").toLowerCase()
    if (!key) continue
    if (!engagementByEmail.has(key)) engagementByEmail.set(key, [])
    engagementByEmail.get(key)!.push({ subject: ev.subject, event: ev.event, event_at: ev.event_at })
  }

  // Build lookups
  const sendLogMap = new Map<string, Array<{ email_type: string; sent_at: string }>>()
  for (const log of sendLogs ?? []) {
    if (!sendLogMap.has(log.user_id)) sendLogMap.set(log.user_id, [])
    sendLogMap.get(log.user_id)!.push({ email_type: log.email_type, sent_at: log.sent_at })
  }

  // Manual (admin 1:1) emails per user — count, last sent, full history entries
  const manualMap = new Map<string, { count: number; last_sent_at: string | null; entries: EmailHistoryEntry[] }>()
  for (const m of manualEmails ?? []) {
    if (!m.user_id) continue
    const cur = manualMap.get(m.user_id) ?? { count: 0, last_sent_at: null, entries: [] }
    cur.count += 1
    if (!cur.last_sent_at) cur.last_sent_at = m.created_at
    const meta = (m.metadata ?? {}) as Record<string, unknown>
    cur.entries.push({
      kind: "manual",
      label: "Direct email",
      subject: typeof meta.subject === "string" ? meta.subject : null,
      sent_at: m.created_at,
      open_count: 0, click_count: 0, opens: [], last_opened_at: null,
    })
    manualMap.set(m.user_id, cur)
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
    const manual = manualMap.get(p.id) ?? { count: 0, last_sent_at: null, entries: [] }
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
    const autoSentCount = sentEmails.length
    const manualSentCount = manual.count
    const totalSentCount = autoSentCount + manualSentCount

    // Unified email history (auto lifecycle + manual 1:1), newest first
    const emailHistory: EmailHistoryEntry[] = [
      ...sentEmails.map(e => ({
        kind: "auto" as const, label: autoEmailLabel(e.email_type), subject: autoEmailSubject(e.email_type),
        sent_at: e.sent_at, open_count: 0, click_count: 0, opens: [] as string[], last_opened_at: null as string | null,
      })),
      ...manual.entries,
    ].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())

    // Attribute real open/click events to each send (all-time, by subject + time)
    attributeEngagement(emailHistory, engagementByEmail.get((p.email ?? "").toLowerCase()) ?? [])

    const lastSentAt = emailHistory.length > 0 ? emailHistory[0].sent_at : null
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
      last_manual_sent_at: manual.last_sent_at,
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
