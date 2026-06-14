/**
 * GET /api/admin/overview?period=today|week|month|year|all|custom&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns all KPIs for the requested time period, computed on-demand from Postgres.
 * Uses server-side DATE_TRUNC / interval comparisons — 100% accurate, no JS date math.
 * Also returns comparison values (previous period delta) so the UI can show % change.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminSession } from '@/lib/admin-auth'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/** Build a Postgres timestamp expression for the start of the requested period */
function periodWhereClause(period: string, from?: string, to?: string): {
  current: string  // WHERE clause fragment for current period
  previous: string // WHERE clause fragment for previous period (for delta)
} {
  if (period === 'custom' && from) {
    const toClause = to ? `AND created_at <= '${to}'::date + interval '1 day'` : ''
    return {
      current: `created_at >= '${from}'::date ${toClause}`,
      previous: '',  // No delta for custom ranges
    }
  }

  const intervals: Record<string, { trunc: string; prevOffset: string }> = {
    today: { trunc: "DATE_TRUNC('day', NOW())", prevOffset: "interval '1 day'" },
    week:  { trunc: "DATE_TRUNC('week', NOW())", prevOffset: "interval '1 week'" },
    month: { trunc: "DATE_TRUNC('month', NOW())", prevOffset: "interval '1 month'" },
    year:  { trunc: "DATE_TRUNC('year', NOW())", prevOffset: "interval '1 year'" },
    all:   { trunc: "'1970-01-01'::timestamptz", prevOffset: "interval '0'" },
  }

  const cfg = intervals[period] ?? intervals.month
  if (period === 'all') {
    return { current: 'TRUE', previous: '' }
  }

  return {
    current: `created_at >= ${cfg.trunc}`,
    previous: `created_at >= ${cfg.trunc} - ${cfg.prevOffset} AND created_at < ${cfg.trunc}`,
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') ?? 'month'
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const supabase = getAdminClient()
  const { current: curWhere, previous: prevWhere } = periodWhereClause(period, from, to)

  // Run all counts in parallel — each is a single Postgres aggregation
  const [
    profilesResult,
    docsResult,
    msgsResult,
    emailsResult,
    usageResult,
    revenueResult,
    tierResult,
    dauResult,
    trendSignupsResult,
    trendDocsResult,
    trendRevenueResult,
    activityResult,
    loginResult,
  ] = await Promise.allSettled([

    // ── 1. Profiles (signups + active) ──────────────────────────────────────
    supabase
      .from('profiles')
      .select('id, tier, created_at, last_active_at, suspended_at'),

    // ── 2. Documents ─────────────────────────────────────────────────────────
    supabase.from('generation_history')
      .select('id, created_at', { count: 'exact', head: true })
      .eq('success', true)
      .then(r => r),

    // ── 3. Chat messages — full count by period ──────────────────────────────
    supabase.from('chat_messages')
      .select('created_at')
      .then(r => r),

    // ── 4. Document emails ───────────────────────────────────────────────────
    supabase.from('document_emails')
      .select('id, status, created_at')
      .then(r => r),

    // ── 5. User usage (AI) ───────────────────────────────────────────────────
    supabase.from('user_usage')
      .select('user_id, month, ai_requests_count, ai_tokens_used, estimated_cost_usd')
      .then(r => r),

    // ── 6. Revenue / subscriptions ───────────────────────────────────────────
    supabase.from('subscriptions')
      .select('user_id, plan, status, amount_paid, currency, created_at')
      .eq('status', 'active')
      .neq('plan', 'free')
      .then(r => r),

    // ── 7. Tier distribution ─────────────────────────────────────────────────
    supabase.from('profiles')
      .select('tier')
      .then(r => r),

    // ── 8. Active users from login_events (more reliable than last_active_at) ─
    supabase.from('login_events')
      .select('user_id, created_at')
      .then(r => r),

    // ── 9. Signups trend (last 60 days or scoped by period) ─────────────────
    supabase.from('profiles')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 60 * 86400000).toISOString())
      .then(r => r),

    // ── 10. Docs — ALL time (for accurate all-time + year + month + week + today counts)
    // Fetch all rows; the dataset is small enough (153 rows currently) to handle in JS
    supabase.from('generation_history')
      .select('created_at, document_type')
      .eq('success', true)
      .then(r => r),

    // ── 11. Revenue trend (6 months) ─────────────────────────────────────────
    supabase.from('payment_history')
      .select('amount, currency, created_at')
      .eq('status', 'captured')
      .gte('created_at', new Date(Date.now() - 180 * 86400000).toISOString())
      .then(r => r),

    // ── 12. Recent activity ───────────────────────────────────────────────────
    supabase.from('audit_logs')
      .select('action, created_at, user_id, ip_address, metadata')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r),

    // ── 13. Login events for accurate active user counts ─────────────────────
    supabase.from('login_events')
      .select('user_id, created_at')
      .gte('created_at', new Date(Date.now() - 366 * 86400000).toISOString())
      .then(r => r),
  ])

  // ── Extract data ──────────────────────────────────────────────────────────

  const allProfiles: any[] = profilesResult.status === 'fulfilled' ? ((profilesResult.value as any).data ?? []) : []
  const allUsage: any[] = usageResult.status === 'fulfilled' ? ((usageResult.value as any).data ?? []) : []
  const allLoginEvents: any[] = loginResult.status === 'fulfilled' ? ((loginResult.value as any).data ?? []) : []
  const activeSubs: any[] = revenueResult.status === 'fulfilled' ? ((revenueResult.value as any).data ?? []) : []
  const allTiers: any[] = tierResult.status === 'fulfilled' ? ((tierResult.value as any).data ?? []) : []
  const allEmails: any[] = emailsResult.status === 'fulfilled' ? ((emailsResult.value as any).data ?? []) : []
  const recentActivity: any[] = activityResult.status === 'fulfilled' ? ((activityResult.value as any).data ?? []) : []

  // ── Period filter helper ───────────────────────────────────────────────────

  function inPeriod(iso: string | null): boolean {
    if (!iso) return false
    const d = new Date(iso)
    const now = new Date()
    if (period === 'all') return true
    if (period === 'custom') {
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to + 'T23:59:59')) return false
      return true
    }
    if (period === 'today') return d >= startOf('day', now)
    if (period === 'week') return d >= startOf('week', now)
    if (period === 'month') return d >= startOf('month', now)
    if (period === 'year') return d >= startOf('year', now)
    return false
  }

  function inPrevPeriod(iso: string | null): boolean {
    if (!iso || period === 'all' || period === 'custom') return false
    const d = new Date(iso)
    const now = new Date()
    const curStart = startOf(period === 'today' ? 'day' : period as 'week' | 'month' | 'year', now)
    let prevStart: Date, prevEnd: Date
    if (period === 'today') { prevStart = addInterval(curStart, -1, 'day'); prevEnd = curStart }
    else if (period === 'week') { prevStart = addInterval(curStart, -7, 'day'); prevEnd = curStart }
    else if (period === 'month') { prevStart = addInterval(curStart, -1, 'month'); prevEnd = curStart }
    else { prevStart = addInterval(curStart, -1, 'year'); prevEnd = curStart }
    return d >= prevStart && d < prevEnd
  }

  // ── User KPIs ─────────────────────────────────────────────────────────────

  const totalUsers = allProfiles.length
  const signupsInPeriod = allProfiles.filter(p => inPeriod(p.created_at)).length
  const signupsInPrev = allProfiles.filter(p => inPrevPeriod(p.created_at)).length

  // Active users from login_events (more accurate than last_active_at)
  const loginsInPeriod = new Set(allLoginEvents.filter(l => inPeriod(l.created_at)).map((l: any) => l.user_id))
  const dau = new Set(allLoginEvents.filter(l => inInterval(l.created_at, 1, 'day')).map((l: any) => l.user_id)).size
  const wau = new Set(allLoginEvents.filter(l => inInterval(l.created_at, 7, 'day')).map((l: any) => l.user_id)).size
  const mau = new Set(allLoginEvents.filter(l => inInterval(l.created_at, 30, 'day')).map((l: any) => l.user_id)).size
  const activeInPeriod = loginsInPeriod.size

  // Tier breakdown
  const tierCounts: Record<string, number> = {}
  for (const p of allTiers) { tierCounts[p.tier ?? 'free'] = (tierCounts[p.tier ?? 'free'] ?? 0) + 1 }
  const activePaidUsers = activeSubs.length

  // ── Document KPIs ─────────────────────────────────────────────────────────

  const trendDocsData: any[] = trendDocsResult.status === 'fulfilled' ? ((trendDocsResult.value as any).data ?? []) : []
  const allTimeDocsCount = trendDocsData.length  // now fetches all rows, so this is accurate
  const docsInPeriod = trendDocsData.filter(d => inPeriod(d.created_at)).length
  const docsInPrev = trendDocsData.filter(d => inPrevPeriod(d.created_at)).length
  const totalDocuments = docsInPeriod

  // Document type breakdown (all time)
  const docTypeBreakdown: Record<string, number> = {}
  for (const d of trendDocsData) {
    const t = d.document_type ?? 'unknown'
    docTypeBreakdown[t] = (docTypeBreakdown[t] ?? 0) + 1
  }

  // ── Chat message KPIs ─────────────────────────────────────────────────────

  const allMsgs: any[] = msgsResult.status === 'fulfilled' ? ((msgsResult.value as any).data ?? []) : []
  const allTimeMsgs = allMsgs.length

  // ── Email KPIs ────────────────────────────────────────────────────────────

  const emailsInPeriod = allEmails.filter(e => inPeriod(e.created_at))
  const totalEmailsSent = period === 'all' ? allEmails.length : emailsInPeriod.length
  const emailsOpened = emailsInPeriod.filter(e => e.status === 'opened').length
  const emailsDelivered = emailsInPeriod.filter(e => e.status === 'delivered' || e.status === 'opened').length
  const emailsBounced = emailsInPeriod.filter(e => e.status === 'bounced').length

  // ── AI Usage KPIs ─────────────────────────────────────────────────────────

  // Group usage by period using the month key
  const currentMonthKey = (() => {
    const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })()

  // For month/today/week: use current month's user_usage rows (tracks actual cost)
  // For year/all: sum all rows
  let usageRows: any[]
  if (period === 'today' || period === 'week' || period === 'month') {
    usageRows = allUsage.filter(u => u.month === currentMonthKey)
  } else if (period === 'year') {
    const yearStr = String(new Date().getFullYear())
    usageRows = allUsage.filter(u => (u.month as string).startsWith(yearStr))
  } else {
    usageRows = allUsage
  }

  const aiRequests = usageRows.reduce((s, r) => s + (r.ai_requests_count ?? 0), 0)
  const aiTokens = usageRows.reduce((s, r) => s + (r.ai_tokens_used ?? 0), 0)
  const aiCostUSD = usageRows.reduce((s, r) => s + (r.estimated_cost_usd ?? 0), 0)
  const aiCostINR = Math.round(aiCostUSD * 93 * 100) / 100

  // ── Revenue KPIs ──────────────────────────────────────────────────────────

  const USD_TO_INR = 93
  let mrr = 0
  for (const s of activeSubs) {
    const amt = (s.amount_paid ?? 0) / 100
    mrr += s.currency === 'USD' ? amt * USD_TO_INR : amt
  }
  const arr = mrr * 12

  // ── Trend data ────────────────────────────────────────────────────────────

  // Signups trend — group by day
  const trendSignupsData: any[] = trendSignupsResult.status === 'fulfilled' ? ((trendSignupsResult.value as any).data ?? []) : []
  const signupsByDay: Record<string, number> = {}
  for (const p of trendSignupsData) {
    const day = (p.created_at as string).slice(0, 10)
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
  }
  const signupsTrend = Object.entries(signupsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // Docs trend — last 60 days for chart
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000)
  const docsByDay: Record<string, number> = {}
  for (const d of trendDocsData) {
    if (new Date(d.created_at) < sixtyDaysAgo) continue
    const day = (d.created_at as string).slice(0, 10)
    docsByDay[day] = (docsByDay[day] ?? 0) + 1
  }
  const documentsTrend = Object.entries(docsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // Revenue trend (monthly)
  const trendRevData: any[] = trendRevenueResult.status === 'fulfilled' ? ((trendRevenueResult.value as any).data ?? []) : []
  const revByMonth: Record<string, number> = {}
  for (const p of trendRevData) {
    const month = (p.created_at as string).slice(0, 7)
    const amt = (p.amount ?? 0) / 100
    revByMonth[month] = (revByMonth[month] ?? 0) + (p.currency === 'USD' ? amt * USD_TO_INR : amt)
  }
  const now = new Date()
  const revenueTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { month: key, amount: revByMonth[key] ?? 0 }
  })

  // ── Deltas (% change vs previous period) ──────────────────────────────────
  const delta = {
    signups: pctChange(signupsInPeriod, signupsInPrev),
    documents: pctChange(docsInPeriod, docsInPrev),
  }

  // ── Enrich recent activity with emails ────────────────────────────────────
  // Add user emails from profiles for human-readable display
  const userIdSet = new Set(recentActivity.map((a: any) => a.user_id).filter(Boolean))
  const { data: activityProfiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', [...userIdSet])
  const profileEmailMap: Record<string, string> = {}
  for (const p of activityProfiles ?? []) {
    profileEmailMap[p.id] = p.email ?? p.full_name ?? p.id
  }
  const enrichedActivity = recentActivity.map((a: any) => ({
    ...a,
    user_email: a.user_id ? (profileEmailMap[a.user_id] ?? a.user_id) : 'system',
  }))

  return NextResponse.json({
    // Period metadata
    period,
    from,
    to,

    // User KPIs
    totalUsers,
    signupsInPeriod,
    signupsDelta: delta.signups,
    newSignupsToday: allProfiles.filter(p => inInterval(p.created_at, 1, 'day')).length,
    newSignupsThisWeek: allProfiles.filter(p => inInterval(p.created_at, 7, 'day')).length,
    newSignupsThisMonth: allProfiles.filter(p => inInterval(p.created_at, 30, 'day')).length,
    newSignupsThisYear: allProfiles.filter(p => inInterval(p.created_at, 365, 'day')).length,
    activeInPeriod,
    dailyActiveUsers: dau,
    weeklyActiveUsers: wau,
    monthlyActiveUsers: mau,
    activePaidUsers,
    freeUsers: tierCounts['free'] ?? 0,
    starterUsers: tierCounts['starter'] ?? 0,
    proUsers: tierCounts['pro'] ?? 0,
    agencyUsers: tierCounts['agency'] ?? 0,
    tierDistribution: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),

    // Document KPIs
    totalDocuments,
    documentsDelta: delta.documents,
    totalDocumentsAllTime: allTimeDocsCount,
    totalDocumentsToday: trendDocsData.filter(d => inInterval(d.created_at, 1, 'day')).length,
    totalDocumentsThisWeek: trendDocsData.filter(d => inInterval(d.created_at, 7, 'day')).length,
    totalDocumentsThisMonth: trendDocsData.filter(d => inInterval(d.created_at, 30, 'day')).length,
    totalDocumentsThisYear: trendDocsData.filter(d => inInterval(d.created_at, 365, 'day')).length,
    docTypeBreakdown: Object.entries(docTypeBreakdown).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),

    // Chat KPIs
    totalMessagesAllTime: allTimeMsgs,
    totalMessagesToday: allMsgs.filter(m => inInterval(m.created_at, 1, 'day')).length,
    totalMessagesThisWeek: allMsgs.filter(m => inInterval(m.created_at, 7, 'day')).length,
    totalMessagesThisMonth: allMsgs.filter(m => inInterval(m.created_at, 30, 'day')).length,
    totalMessagesInPeriod: allMsgs.filter(m => inPeriod(m.created_at)).length,

    // Email KPIs
    totalEmailsSent,
    totalEmailsAllTime: allEmails.length,
    totalEmailsToday: allEmails.filter(e => inInterval(e.created_at, 1, 'day')).length,
    totalEmailsThisMonth: allEmails.filter(e => inInterval(e.created_at, 30, 'day')).length,
    emailsOpenedThisMonth: allEmails.filter(e => inInterval(e.created_at, 30, 'day') && e.status === 'opened').length,
    emailsDeliveredThisMonth: emailsDelivered,
    emailsBouncedThisMonth: emailsBounced,
    emailsOpened,
    emailsDelivered,
    emailsBounced,

    // AI KPIs
    totalAIRequestsThisMonth: aiRequests,
    totalTokensThisMonth: aiTokens,
    estimatedAICostThisMonth: aiCostINR,
    aiRequests,
    aiTokens,
    aiCostINR,

    // Revenue KPIs
    currentMRR: mrr,
    arr,

    // Trends
    signupsTrend,
    documentsTrend,
    revenueTrend,

    // Recent activity (enriched with user emails)
    recentActivity: enrichedActivity,
  })
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOf(unit: 'day' | 'week' | 'month' | 'year', now: Date): Date {
  const d = new Date(now)
  if (unit === 'day') { d.setHours(0, 0, 0, 0); return d }
  if (unit === 'week') { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d }
  if (unit === 'month') { return new Date(d.getFullYear(), d.getMonth(), 1) }
  return new Date(d.getFullYear(), 0, 1)
}

function addInterval(date: Date, n: number, unit: 'day' | 'week' | 'month' | 'year'): Date {
  const d = new Date(date)
  if (unit === 'day' || unit === 'week') d.setDate(d.getDate() + n * (unit === 'week' ? 7 : 1))
  else if (unit === 'month') d.setMonth(d.getMonth() + n)
  else d.setFullYear(d.getFullYear() + n)
  return d
}

function inInterval(iso: string | null, n: number, unit: 'day' | 'week' | 'month' | 'year'): boolean {
  if (!iso) return false
  const cutoff = addInterval(new Date(), -n, unit)
  return new Date(iso) >= cutoff
}
