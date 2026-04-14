import { createClient } from "@supabase/supabase-js"

/**
 * AI Model Pricing Reference (2026)
 * 
 * DeepSeek V3.2 (deepseek-chat) — used for onboarding & general chat:
 *   Input:  $0.28 / 1M tokens
 *   Output: $0.42 / 1M tokens
 *   Cache:  $0.028 / 1M tokens
 * 
 * DeepSeek R1 (deepseek-reasoner) — used for document generation:
 *   Input:  $0.55 / 1M tokens
 *   Output: $2.19 / 1M tokens
 * 
 * OpenAI GPT-5.4 mini (vision/file analysis — images + PDFs):
 *   Input:  $0.75 / 1M tokens
 *   Output: $4.50 / 1M tokens
 *   Cache:  $0.075 / 1M tokens
 * 
 * Cost is tracked per-request in the user_usage table.
 */

// Service role client — bypasses RLS, server-side only
// Falls back to anon key if service role key is not set
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OverviewKPIs {
  totalUsers: number
  newSignupsToday: number
  newSignupsThisWeek: number
  newSignupsThisMonth: number
  newSignupsThisYear: number
  dailyActiveUsers: number
  monthlyActiveUsers: number
  accountsCreatedThisMonth: number
  activePaidUsers: number
  totalDocumentsAllTime: number
  totalDocumentsThisMonth: number
  totalAIRequestsThisMonth: number
  estimatedAICostThisMonth: number
  totalRevenue: number
  currentMRR: number
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  tierDistribution: Array<{ tier: string; count: number }>
  recentActivity: Array<Record<string, unknown>>
}

export interface UsersQueryParams {
  search?: string
  tier?: string
  status?: string
  onboarding?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
  page?: number
  pageSize?: number
}

export interface PaginatedUsers {
  users: Array<Record<string, unknown>>
  total: number
  page: number
  pageSize: number
}

export interface SubscriptionsQueryParams {
  plan?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface PaginatedSubscriptions {
  subscriptions: Array<Record<string, unknown>>
  total: number
  page: number
  pageSize: number
}

export interface AIUsageQueryParams {
  dateFrom?: string
  dateTo?: string
  docType?: string
  userEmail?: string
  success?: string
  page?: number
  pageSize?: number
}

export interface AIUsageData {
  summaryCards: {
    requestsToday: number
    requestsThisWeek: number
    requestsThisMonth: number
    tokensThisMonth: number
    estimatedCostThisMonth: number
  }
  topUsers: Array<Record<string, unknown>>
  docTypeBreakdown: Array<{ type: string; count: number }>
  avgGenerationTimeMs: number
  successRate: number
  errorRate: number
  history: Array<Record<string, unknown>>
  historyTotal: number
}

export interface RevenueData {
  mrr: number
  arr: number
  newRevenueThisMonth: number
  momChange: number
  revenueByPlan: Array<{ plan: string; count: number; revenue: number }>
  paymentHistory: Array<Record<string, unknown>>
  paymentHistoryTotal: number
}

export interface SecurityQueryParams {
  action?: string
  email?: string
  dateFrom?: string
  dateTo?: string
  ip?: string
  page?: number
  pageSize?: number
}

export interface SecurityData {
  auditLogs: Array<Record<string, unknown>>
  auditLogsTotal: number
  bruteForceEvents: Array<Record<string, unknown>>
  suspiciousActivity: Array<Record<string, unknown>>
  ipBlocklist: Array<Record<string, unknown>>
}

export interface UserDetail {
  profile: Record<string, unknown> | null
  business: Record<string, unknown> | null
  usageStats: Record<string, unknown> | null
  recentDocuments: Array<Record<string, unknown>>
  recentAuditLogs: Array<Record<string, unknown>>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0=Sun
  const diff = d.getDate() - day
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function currentMonthKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

// ─── 6.1 getOverviewKPIs ──────────────────────────────────────────────────────

export async function getOverviewKPIs(): Promise<OverviewKPIs> {
  const supabase = getAdminClient()
  const now = new Date()
  const todayISO = startOfDay(now).toISOString()
  const weekISO = startOfWeek(now).toISOString()
  const monthISO = startOfMonth(now).toISOString()
  const monthKey = currentMonthKey()

  // Total users
  const { count: totalUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .then(r => ({ count: r.count ?? 0 }))

  // New signups today
  const { count: newSignupsToday } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))

  // New signups this week
  const { count: newSignupsThisWeek } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekISO)
    .then(r => ({ count: r.count ?? 0 }))

  // New signups this month
  const { count: newSignupsThisMonth } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthISO)
    .then(r => ({ count: r.count ?? 0 }))

  // New signups this year
  const yearISO = new Date(now.getFullYear(), 0, 1).toISOString()
  const { count: newSignupsThisYear } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("created_at", yearISO)
    .then(r => ({ count: r.count ?? 0 }))

  // Daily Active Users (last 24 hours)
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const { count: dailyActiveUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_active_at", twentyFourHoursAgo)
    .then(r => ({ count: r.count ?? 0 }))

  // Monthly Active Users (last 30 days)
  const thirtyDaysAgoMAU = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { count: monthlyActiveUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_active_at", thirtyDaysAgoMAU)
    .then(r => ({ count: r.count ?? 0 }))

  // Active paid users (tier != 'free' and not suspended)
  const { count: activePaidUsers } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .neq("tier", "free")
    .is("suspended_at", null)
    .then(r => ({ count: r.count ?? 0 }))

  // Total documents all time
  const { count: totalDocumentsAllTime } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .eq("success", true)
    .then(r => ({ count: r.count ?? 0 }))

  // Total documents this month
  const { count: totalDocumentsThisMonth } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .eq("success", true)
    .gte("created_at", monthISO)
    .then(r => ({ count: r.count ?? 0 }))

  // AI requests and cost this month (sum across all users)
  const { data: usageRows } = await supabase
    .from("user_usage")
    .select("ai_requests_count, estimated_cost_usd")
    .eq("month", monthKey)

  const totalAIRequestsThisMonth = (usageRows ?? []).reduce(
    (sum, r) => sum + (r.ai_requests_count ?? 0),
    0
  )
  const estimatedAICostThisMonth = (usageRows ?? []).reduce(
    (sum, r) => sum + (r.estimated_cost_usd ?? 0),
    0
  )

  // Recent activity (last 20 audit log entries)
  const { data: recentActivity } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20)

  // MRR from subscriptions table (amount_paid is in paise for INR)
  const { data: activeSubs } = await supabase
    .from("subscriptions")
    .select("amount_paid, currency, plan")
    .eq("status", "active")
    .neq("plan", "free")

  let currentMRR = 0
  for (const s of activeSubs ?? []) {
    // amount_paid is in paise (smallest currency unit), convert to rupees
    currentMRR += (s.amount_paid ?? 0) / 100
  }

  const totalRevenue = (activeSubs ?? []).reduce((sum, s) => sum + ((s.amount_paid ?? 0) / 100), 0)

  // Revenue trend (last 6 months) — from audit_logs payment webhooks
  const { data: paymentLogs } = await supabase
    .from("audit_logs")
    .select("metadata, created_at")
    .eq("action", "payment.webhook")
    .order("created_at", { ascending: false })

  const revenueByMonth: Record<string, number> = {}
  for (const log of paymentLogs ?? []) {
    const meta = log.metadata as Record<string, unknown> | null
    const amount = meta?.amount
    if (typeof amount === "number" && amount > 0) {
      const month = (log.created_at ?? "").slice(0, 7)
      revenueByMonth[month] = (revenueByMonth[month] ?? 0) + amount
    }
  }

  const revenueTrend: Array<{ month: string; amount: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    revenueTrend.push({ month: key, amount: revenueByMonth[key] ?? 0 })
  }

  // Signups trend (last 30 days) — group by date in JS
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const { data: recentProfiles } = await supabase
    .from("profiles")
    .select("created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())

  const signupsByDay: Record<string, number> = {}
  for (const p of recentProfiles ?? []) {
    const day = (p.created_at ?? "").slice(0, 10)
    if (day) signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
  }
  const signupsTrend = Object.entries(signupsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Documents trend (last 30 days)
  const { data: recentDocs } = await supabase
    .from("generation_history")
    .select("created_at")
    .eq("success", true)
    .gte("created_at", thirtyDaysAgo.toISOString())

  const docsByDay: Record<string, number> = {}
  for (const d of recentDocs ?? []) {
    const day = (d.created_at ?? "").slice(0, 10)
    if (day) docsByDay[day] = (docsByDay[day] ?? 0) + 1
  }
  const documentsTrend = Object.entries(docsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Tier distribution
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("tier")

  const tierCounts: Record<string, number> = {}
  for (const p of allProfiles ?? []) {
    const tier = p.tier ?? "free"
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
  }
  const tierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({ tier, count }))

  return {
    totalUsers,
    newSignupsToday,
    newSignupsThisWeek,
    newSignupsThisMonth,
    newSignupsThisYear,
    dailyActiveUsers,
    monthlyActiveUsers,
    accountsCreatedThisMonth: newSignupsThisMonth,
    activePaidUsers,
    totalDocumentsAllTime,
    totalDocumentsThisMonth,
    totalAIRequestsThisMonth,
    estimatedAICostThisMonth: Math.round(estimatedAICostThisMonth * 85 * 100) / 100, // Convert USD to INR
    totalRevenue,
    currentMRR,
    signupsTrend,
    documentsTrend,
    revenueTrend,
    tierDistribution,
    recentActivity: (recentActivity ?? []) as Array<Record<string, unknown>>,
  }
}

// ─── 6.2 getUsersPage ─────────────────────────────────────────────────────────

export async function getUsersPage(params: UsersQueryParams): Promise<PaginatedUsers> {
  const supabase = getAdminClient()
  const {
    search,
    tier,
    status,
    onboarding,
    dateFrom,
    dateTo,
    sortBy = "created_at",
    sortDir = "desc",
    page = 1,
    pageSize = 20,
  } = params

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  if (tier) {
    query = query.eq("tier", tier)
  }

  if (status === "suspended") {
    query = query.not("suspended_at", "is", null)
  } else if (status === "active") {
    query = query.is("suspended_at", null)
  }

  if (onboarding === "complete") {
    query = query.eq("onboarding_complete", true)
  } else if (onboarding === "incomplete") {
    query = query.eq("onboarding_complete", false)
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom)
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo)
  }

  const allowedSortCols = ["created_at", "full_name", "email", "tier", "last_active_at"]
  const col = allowedSortCols.includes(sortBy) ? sortBy : "created_at"
  query = query.order(col, { ascending: sortDir === "asc" }).range(from, to)

  const { data, count, error } = await query

  if (error) {
    console.error("getUsersPage error:", error)
    return { users: [], total: 0, page, pageSize }
  }

  // Enrich with document counts
  if (data && data.length > 0) {
    const userIds = data.map((u: any) => u.id)
    const { data: docCounts } = await supabase
      .from("generation_history")
      .select("user_id")
      .eq("success", true)
      .in("user_id", userIds)
    
    const countMap: Record<string, number> = {}
    for (const d of docCounts ?? []) {
      countMap[d.user_id] = (countMap[d.user_id] ?? 0) + 1
    }
    
    for (const user of data as any[]) {
      user.documents_count = countMap[user.id] ?? 0
    }
  }

  return {
    users: (data ?? []) as Array<Record<string, unknown>>,
    total: count ?? 0,
    page,
    pageSize,
  }
}

// ─── 6.3 getUserDetail ────────────────────────────────────────────────────────

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const supabase = getAdminClient()
  const monthKey = currentMonthKey()

  const [profileRes, businessRes, usageRes, docsRes, auditRes] = await Promise.allSettled([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("businesses").select("*").eq("user_id", userId).single(),
    supabase.from("user_usage").select("*").eq("user_id", userId).eq("month", monthKey).single(),
    supabase
      .from("documents")
      .select("*")
      .eq("business_id", userId) // fallback — documents link via business_id
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  const profile =
    profileRes.status === "fulfilled" && !profileRes.value.error
      ? (profileRes.value.data as Record<string, unknown>)
      : null

  const business =
    businessRes.status === "fulfilled" && !businessRes.value.error
      ? (businessRes.value.data as Record<string, unknown>)
      : null

  const usageStats =
    usageRes.status === "fulfilled" && !usageRes.value.error
      ? (usageRes.value.data as Record<string, unknown>)
      : null

  const recentDocuments =
    docsRes.status === "fulfilled" && !docsRes.value.error
      ? ((docsRes.value.data ?? []) as Array<Record<string, unknown>>)
      : []

  const recentAuditLogs =
    auditRes.status === "fulfilled" && !auditRes.value.error
      ? ((auditRes.value.data ?? []) as Array<Record<string, unknown>>)
      : []

  return { profile, business, usageStats, recentDocuments, recentAuditLogs }
}

// ─── 6.4 getSubscriptions ─────────────────────────────────────────────────────

export async function getSubscriptions(
  params: SubscriptionsQueryParams
): Promise<PaginatedSubscriptions> {
  const supabase = getAdminClient()
  const { plan, status, dateFrom, dateTo, page = 1, pageSize = 20 } = params
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("subscriptions")
    .select("*", { count: "exact" })

  if (plan && plan !== 'all') query = query.eq("plan", plan)
  if (status && status !== 'all') query = query.eq("status", status)
  if (dateFrom) query = query.gte("created_at", dateFrom)
  if (dateTo) query = query.lte("created_at", dateTo)

  query = query.order("created_at", { ascending: false }).range(from, to)

  const { data, count, error } = await query
  if (error) {
    console.error("getSubscriptions error:", error)
    return { subscriptions: [], total: 0, page, pageSize }
  }

  // Enrich with profile and business data (manual join — more reliable than PostgREST !inner)
  const enriched = data ?? []
  if (enriched.length > 0) {
    const userIds = [...new Set(enriched.map((s: any) => s.user_id))]
    const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", userIds)
    const { data: businesses } = await supabase.from("businesses").select("user_id, country").in("user_id", userIds)

    const profileMap: Record<string, { email: string; full_name: string | null }> = {}
    for (const p of profiles ?? []) profileMap[p.id] = { email: p.email, full_name: p.full_name }

    const bizMap: Record<string, string> = {}
    for (const b of businesses ?? []) bizMap[b.user_id] = b.country ?? '—'

    for (const s of enriched as any[]) {
      s.profiles = profileMap[s.user_id] ?? { email: '—', full_name: '—' }
      s.businesses = { country: bizMap[s.user_id] ?? '—' }
    }
  }

  return {
    subscriptions: enriched as Array<Record<string, unknown>>,
    total: count ?? 0,
    page,
    pageSize,
  }
}

// ─── 6.5 getAIUsage ───────────────────────────────────────────────────────────

export async function getAIUsage(params: AIUsageQueryParams): Promise<AIUsageData> {
  const supabase = getAdminClient()
  const { dateFrom, dateTo, docType, userEmail, success, page = 1, pageSize = 20 } = params

  const now = new Date()
  const todayISO = startOfDay(now).toISOString()
  const weekISO = startOfWeek(now).toISOString()
  const monthISO = startOfMonth(now).toISOString()
  const monthKey = currentMonthKey()

  // Summary cards from user_usage (current month totals)
  const { data: usageRows } = await supabase
    .from("user_usage")
    .select("ai_requests_count, ai_tokens_used, estimated_cost_usd")
    .eq("month", monthKey)

  const requestsThisMonth = (usageRows ?? []).reduce(
    (s, r) => s + (r.ai_requests_count ?? 0),
    0
  )
  const tokensThisMonth = (usageRows ?? []).reduce(
    (s, r) => s + (r.ai_tokens_used ?? 0),
    0
  )
  const estimatedCostThisMonth = (usageRows ?? []).reduce(
    (s, r) => s + (r.estimated_cost_usd ?? 0),
    0
  )

  // Today / this week counts from generation_history
  const { count: requestsToday } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))

  const { count: requestsThisWeek } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .gte("created_at", weekISO)
    .then(r => ({ count: r.count ?? 0 }))

  // Top users by request count this month
  const { data: topUsersRaw } = await supabase
    .from("user_usage")
    .select("user_id, ai_requests_count, ai_tokens_used, estimated_cost_usd")
    .eq("month", monthKey)
    .order("ai_requests_count", { ascending: false })
    .limit(10)

  // Enrich top users with email from profiles
  const topUserIds = (topUsersRaw ?? []).map(u => u.user_id)
  let profileMap: Record<string, string> = {}
  if (topUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", topUserIds)
    for (const p of profileRows ?? []) {
      profileMap[p.id] = p.email ?? p.full_name ?? p.id
    }
  }

  const topUsers = (topUsersRaw ?? []).map(u => ({
    ...u,
    email: profileMap[u.user_id] ?? u.user_id,
  })) as Array<Record<string, unknown>>

  // Doc type breakdown from generation_history
  const { data: genRows } = await supabase
    .from("generation_history")
    .select("document_type")
    .gte("created_at", monthISO)

  const typeCounts: Record<string, number> = {}
  for (const r of genRows ?? []) {
    const t = r.document_type ?? "unknown"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const docTypeBreakdown = Object.entries(typeCounts).map(([type, count]) => ({ type, count }))

  // Avg generation time and success/error rates
  const { data: perfRows } = await supabase
    .from("generation_history")
    .select("generation_time_ms, success")
    .gte("created_at", monthISO)

  const totalRows = (perfRows ?? []).length
  const successCount = (perfRows ?? []).filter(r => r.success === true).length
  const errorCount = totalRows - successCount
  const totalTime = (perfRows ?? []).reduce((s, r) => s + (r.generation_time_ms ?? 0), 0)
  const avgGenerationTimeMs = totalRows > 0 ? Math.round(totalTime / totalRows) : 0
  const successRate = totalRows > 0 ? successCount / totalRows : 0
  const errorRate = totalRows > 0 ? errorCount / totalRows : 0

  // History with filters
  const histFrom = (page - 1) * pageSize
  const histTo = histFrom + pageSize - 1

  let histQuery = supabase
    .from("generation_history")
    .select("*", { count: "exact" })

  if (dateFrom) histQuery = histQuery.gte("created_at", dateFrom)
  if (dateTo) histQuery = histQuery.lte("created_at", dateTo)
  if (docType) histQuery = histQuery.eq("document_type", docType)
  if (success === "true") histQuery = histQuery.eq("success", true)
  if (success === "false") histQuery = histQuery.eq("success", false)

  // Filter by user email requires joining profiles — do a sub-query
  if (userEmail) {
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", `%${userEmail}%`)
    const ids = (matchedProfiles ?? []).map(p => p.id)
    if (ids.length > 0) {
      histQuery = histQuery.in("user_id", ids)
    } else {
      // No matching users — return empty
      return {
        summaryCards: {
          requestsToday,
          requestsThisWeek,
          requestsThisMonth,
          tokensThisMonth,
          estimatedCostThisMonth,
        },
        topUsers,
        docTypeBreakdown,
        avgGenerationTimeMs,
        successRate,
        errorRate,
        history: [],
        historyTotal: 0,
      }
    }
  }

  histQuery = histQuery.order("created_at", { ascending: false }).range(histFrom, histTo)

  const { data: history, count: historyTotal, error: histError } = await histQuery

  if (histError) {
    console.error("getAIUsage history error:", histError)
  }

  return {
    summaryCards: {
      requestsToday,
      requestsThisWeek,
      requestsThisMonth,
      tokensThisMonth,
      estimatedCostThisMonth,
    },
    topUsers,
    docTypeBreakdown,
    avgGenerationTimeMs,
    successRate,
    errorRate,
    history: (history ?? []) as Array<Record<string, unknown>>,
    historyTotal: historyTotal ?? 0,
  }
}

// ─── 6.6 getRevenue ───────────────────────────────────────────────────────────

const PLAN_PRICES: Record<string, number> = { starter: 9, pro: 24, agency: 59 }

export async function getRevenue(): Promise<RevenueData> {
  const supabase = getAdminClient()
  const now = new Date()
  const monthISO = startOfMonth(now).toISOString()
  const USD_TO_INR = 93 // Current approximate rate (April 2026)

  // Get ALL subscriptions (not just active) for payment history
  const { data: allSubs } = await supabase
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  // Enrich with profile emails and business country
  const userIds = [...new Set((allSubs ?? []).map((s: any) => s.user_id))]
  let profileMap: Record<string, { email: string; full_name: string | null }> = {}
  let businessMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { email: p.email ?? '—', full_name: p.full_name }
    }

    const { data: businesses } = await supabase
      .from("businesses")
      .select("user_id, country")
      .in("user_id", userIds)
    for (const b of businesses ?? []) {
      businessMap[b.user_id] = b.country ?? '—'
    }
  }

  // MRR from active paid subscriptions
  const activePaid = (allSubs ?? []).filter((s: any) => s.status === 'active' && s.plan !== 'free')
  let mrr = 0
  const planCounts: Record<string, number> = {}
  const planRevenue: Record<string, number> = {}

  for (const s of activePaid) {
    const amountInr = (s.amount_paid ?? 0) / 100
    // If currency is USD, convert to INR for dashboard display
    const displayAmount = s.currency === 'USD' ? amountInr * USD_TO_INR : amountInr
    mrr += displayAmount
    const plan = s.plan ?? 'unknown'
    planCounts[plan] = (planCounts[plan] ?? 0) + 1
    planRevenue[plan] = (planRevenue[plan] ?? 0) + displayAmount
  }

  const arr = mrr * 12
  const revenueByPlan = Object.entries(planCounts).map(([plan, count]) => ({
    plan,
    count,
    revenue: planRevenue[plan] ?? 0,
  }))

  // Payment history with full details
  const paymentHistory = (allSubs ?? []).map((s: any) => {
    const amountRaw = (s.amount_paid ?? 0) / 100
    const currency = s.currency ?? 'INR'
    const country = businessMap[s.user_id] ?? '—'
    const profile = profileMap[s.user_id]

    return {
      id: s.id,
      user_email: profile?.email ?? '—',
      user_name: profile?.full_name ?? '—',
      amount: amountRaw,
      amount_inr: currency === 'USD' ? Math.round(amountRaw * USD_TO_INR) : amountRaw,
      currency,
      plan: s.plan,
      billing_cycle: s.billing_cycle ?? '—',
      date: s.created_at,
      payment_id: s.razorpay_payment_id ?? '—',
      subscription_id: s.razorpay_subscription_id ?? '—',
      country,
      status: s.status === 'active' && s.plan !== 'free' ? 'paid' : s.status,
      period_start: s.current_period_start,
      period_end: s.current_period_end,
    }
  })

  // New revenue this month
  const { data: newSubsThisMonth } = await supabase
    .from("subscriptions")
    .select("amount_paid, currency")
    .gte("created_at", monthISO)
    .neq("plan", "free")

  const newRevenueThisMonth = (newSubsThisMonth ?? []).reduce((sum, s) => {
    const amt = (s.amount_paid ?? 0) / 100
    return sum + (s.currency === 'USD' ? amt * USD_TO_INR : amt)
  }, 0)

  // MoM change
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthISO = prevDate.toISOString()
  const { data: prevMonthSubs } = await supabase
    .from("subscriptions")
    .select("amount_paid, currency")
    .gte("created_at", prevMonthISO)
    .lt("created_at", monthISO)
    .neq("plan", "free")

  const prevMonthRevenue = (prevMonthSubs ?? []).reduce((sum, s) => {
    const amt = (s.amount_paid ?? 0) / 100
    return sum + (s.currency === 'USD' ? amt * USD_TO_INR : amt)
  }, 0)

  const momChange = prevMonthRevenue > 0
    ? ((newRevenueThisMonth - prevMonthRevenue) / prevMonthRevenue) * 100
    : 0

  return {
    mrr,
    arr,
    newRevenueThisMonth,
    momChange,
    revenueByPlan,
    paymentHistory: paymentHistory as Array<Record<string, unknown>>,
    paymentHistoryTotal: paymentHistoryTotal ?? 0,
  }
}

// ─── 6.7 getSecurity ──────────────────────────────────────────────────────────

export async function getSecurity(params: SecurityQueryParams): Promise<SecurityData> {
  const supabase = getAdminClient()
  const { action, email, dateFrom, dateTo, ip, page = 1, pageSize = 20 } = params

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // Resolve user IDs from email filter
  let filteredUserIds: string[] | null = null
  if (email) {
    const { data: matchedProfiles } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", `%${email}%`)
    filteredUserIds = (matchedProfiles ?? []).map(p => p.id)
  }

  // Audit logs with filters
  let auditQuery = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })

  if (action) {
    auditQuery = auditQuery.ilike("action", `${action}%`)
  }

  if (filteredUserIds !== null) {
    if (filteredUserIds.length === 0) {
      return {
        auditLogs: [],
        auditLogsTotal: 0,
        bruteForceEvents: [],
        suspiciousActivity: [],
        ipBlocklist: [],
      }
    }
    auditQuery = auditQuery.in("user_id", filteredUserIds)
  }

  if (dateFrom) auditQuery = auditQuery.gte("created_at", dateFrom)
  if (dateTo) auditQuery = auditQuery.lte("created_at", dateTo)
  if (ip) auditQuery = auditQuery.eq("ip_address", ip)

  auditQuery = auditQuery.order("created_at", { ascending: false }).range(from, to)

  const { data: auditLogs, count: auditLogsTotal, error: auditError } = await auditQuery
  if (auditError) console.error("getSecurity audit error:", auditError)

  // Brute force events
  const { data: bruteForceEvents } = await supabase
    .from("audit_logs")
    .select("*")
    .in("action", ["security.brute_force_block", "admin.pin_lockout"])
    .order("created_at", { ascending: false })
    .limit(50)

  // Suspicious activity: users with >50 AI requests in any 1-hour window
  // Use generation_history grouped by user_id and hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: recentGen } = await supabase
    .from("generation_history")
    .select("user_id, created_at")
    .gte("created_at", oneHourAgo)

  const userHourCounts: Record<string, number> = {}
  for (const r of recentGen ?? []) {
    userHourCounts[r.user_id] = (userHourCounts[r.user_id] ?? 0) + 1
  }

  const suspiciousUserIds = Object.entries(userHourCounts)
    .filter(([, count]) => count > 50)
    .map(([userId]) => userId)

  let suspiciousActivity: Array<Record<string, unknown>> = []
  if (suspiciousUserIds.length > 0) {
    const { data: suspProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", suspiciousUserIds)
    suspiciousActivity = (suspProfiles ?? []).map(p => ({
      ...p,
      requestsLastHour: userHourCounts[p.id] ?? 0,
    })) as Array<Record<string, unknown>>
  }

  // IP blocklist
  const { data: ipBlocklist } = await supabase
    .from("ip_blocklist")
    .select("*")
    .order("created_at", { ascending: false })

  return {
    auditLogs: (auditLogs ?? []) as Array<Record<string, unknown>>,
    auditLogsTotal: auditLogsTotal ?? 0,
    bruteForceEvents: (bruteForceEvents ?? []) as Array<Record<string, unknown>>,
    suspiciousActivity,
    ipBlocklist: (ipBlocklist ?? []) as Array<Record<string, unknown>>,
  }
}
