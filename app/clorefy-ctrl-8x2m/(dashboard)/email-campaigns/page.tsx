import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
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
  ] = await Promise.all([
    supabase.from("profiles")
      .select("id, email, full_name, onboarding_complete, last_active_at, created_at, tier")
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
  ])

  // Build lookups
  const sendLogMap = new Map<string, Array<{ email_type: string; sent_at: string }>>()
  for (const log of sendLogs ?? []) {
    if (!sendLogMap.has(log.user_id)) sendLogMap.set(log.user_id, [])
    sendLogMap.get(log.user_id)!.push({ email_type: log.email_type, sent_at: log.sent_at })
  }

  const emailEventMap = new Map<string, { event: string; event_at: string }>()
  for (const ev of emailEvents ?? []) {
    if (!emailEventMap.has(ev.email)) {
      emailEventMap.set(ev.email, { event: ev.event, event_at: ev.event_at })
    }
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
    const lastEvent = emailEventMap.get(p.email) ?? null
    const docsCount = docCountMap.get(p.id) ?? 0
    const daysSinceActive = p.last_active_at
      ? Math.floor((now - new Date(p.last_active_at).getTime()) / 86400000)
      : Math.floor((now - new Date(p.created_at).getTime()) / 86400000)
    const daysSinceSignup = Math.floor((now - new Date(p.created_at).getTime()) / 86400000)

    // Determine last email sent for "timer since last email" display
    const lastSentAt = sentEmails.length > 0
      ? sentEmails.reduce((latest, s) => new Date(s.sent_at) > new Date(latest.sent_at) ? s : latest)
      : null

    let category = "active"
    if (!p.onboarding_complete && daysSinceSignup >= 2) category = "dropoff"
    else if (p.onboarding_complete && daysSinceActive >= 7) category = "inactive"

    // Auto-stopped = got both emails and hasn't come back
    const hasBothEmails = sentEmails.some(s => s.email_type === "inactive_1") &&
      sentEmails.some(s => s.email_type === "inactive_2")

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
      last_sent_at: lastSentAt?.sent_at ?? null,
      category,
      never_emailed: sentEmails.length === 0,
      auto_stopped: hasBothEmails && p.onboarding_complete,
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
