import { createClient } from "@supabase/supabase-js"
import { fromMinorUnits } from "@/lib/invoice-types"

/**
 * AI Model Pricing Reference (2026)
 * 
 * DeepSeek V4 Flash (deepseek-v4-flash) — used for onboarding & general chat:
 *   Input:  $0.28 / 1M tokens
 *   Output: $0.42 / 1M tokens
 *   Cache:  $0.028 / 1M tokens
 * 
 * DeepSeek V4 Pro (deepseek-v4-pro, thinking mode) — used for document generation:
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
  // Tier breakdown
  freeUsers: number
  starterUsers: number
  proUsers: number
  agencyUsers: number
  // Documents
  totalDocumentsAllTime: number
  totalDocumentsToday: number
  totalDocumentsThisWeek: number
  totalDocumentsThisMonth: number
  // Chat messages
  totalMessagesAllTime: number
  totalMessagesThisMonth: number
  totalMessagesToday: number
  // Emails
  totalEmailsAllTime: number
  totalEmailsThisMonth: number
  totalEmailsToday: number
  emailsOpenedThisMonth: number
  emailsDeliveredThisMonth: number
  emailsBouncedThisMonth: number
  // AI
  totalAIRequestsThisMonth: number
  totalTokensThisMonth: number
  estimatedAICostThisMonth: number
  estimatedAICostToday: number
  // Revenue
  totalRevenue: number
  currentMRR: number
  mrrByCurrency: Record<string, number>
  arrByCurrency: Record<string, number>
  revenueTrendByCurrency: Record<string, Array<{ month: string; amount: number }>>
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
  summary: {
    active: number
    /** Legacy minor-unit maps retained for the existing subscriptions UI. */
    mrrByCurrency: Record<string, number>
    arrByCurrency: Record<string, number>
    mrrByCurrencyMajorUnits: Record<string, number>
    arrByCurrencyMajorUnits: Record<string, number>
  }
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
  /** INR compatibility values; native currencies are never combined. */
  mrr: number
  arr: number
  newRevenueThisMonth: number
  momChange: number
  mrrByCurrency: Record<string, number>
  arrByCurrency: Record<string, number>
  newRevenueThisMonthByCurrency: Record<string, number>
  previousMonthRevenueByCurrency: Record<string, number>
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
  logs: Array<Record<string, unknown>>
  total: number
  bruteForce: Array<{ ip: string; attempts: number; last_seen: string; emails: string[] }>
  securityEvents: Array<{
    action: string
    user_id: string | null
    email: string
    count: number
    last_seen: string
    ip_address: string | null
  }>
  /** Compatibility alias for securityEvents; no generation traffic is included. */
  suspicious: SecurityData["securityEvents"]
  blockedIPs: Array<Record<string, unknown>>
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
  recentEmails: Array<Record<string, unknown>>
  totalEmailsSent: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeek(d: Date): Date {
  const daysSinceMonday = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday)
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

type PageResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

/** Fetch every row for an application-side reduction without exceeding API row caps. */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  requestedPageSize = 1000
): Promise<T[]> {
  const pageSize = Math.max(1, Math.min(1000, Math.floor(requestedPageSize)))
  const rows: T[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw new Error(error.message || "Admin pagination query failed")
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

function boundedPositiveInt(value: number | undefined, fallback: number, max: number): number {
  return Number.isInteger(value) && (value ?? 0) > 0 ? Math.min(value!, max) : fallback
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

  // Effective paid count is derived below after subscription and override precedence.
  let activePaidUsers = 0

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
  const usageRows = await fetchAllPages<any>((first, last) => supabase
    .from("user_usage")
    .select("user_id, month, ai_requests_count, estimated_cost_usd")
    .eq("month", monthKey)
    .order("month")
    .order("user_id")
    .range(first, last))
  const usageResetRows = await fetchAllPages<any>((first, last) => supabase
    .from("subscription_usage_resets")
    .select("user_id, usage_month, previous_ai_requests_count")
    .eq("usage_month", monthKey)
    .order("usage_month")
    .order("user_id")
    .range(first, last))

  const totalAIRequestsThisMonth = (usageRows ?? []).reduce(
    (sum, r) => sum + (r.ai_requests_count ?? 0),
    (usageResetRows ?? []).reduce((sum, r) => sum + (r.previous_ai_requests_count ?? 0), 0)
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

  // MRR and revenue from active INR subscriptions only. Cross-currency totals
  // are intentionally excluded because no authoritative FX rate is stored.
  const activeSubs = await fetchAllPages<any>((first, last) => supabase
    .from("subscriptions")
    .select("id, amount_paid, currency, plan, billing_cycle, current_period_end")
    .eq("status", "active")
    .in("plan", ["starter", "pro", "agency"])
    .gt("current_period_end", now.toISOString())
    .order("id")
    .range(first, last))

  // Native-currency MRR/ARR maps use major units; INR scalar fields remain
  // compatibility aliases and no currencies are combined.
  const mrrByCurrency: Record<string, number> = {}
  let totalRevenue = 0
  for (const subscription of activeSubs) {
    const currency = String(subscription.currency ?? "INR").toUpperCase()
    const amount = fromMinorUnits(subscription.amount_paid ?? 0, currency)
    const monthly = subscription.billing_cycle === "yearly" ? amount / 12 : amount
    mrrByCurrency[currency] = (mrrByCurrency[currency] ?? 0) + monthly
    if (currency === "INR") totalRevenue += amount
  }
  const arrByCurrency = Object.fromEntries(
    Object.entries(mrrByCurrency).map(([currency, amount]) => [currency, amount * 12])
  )
  const currentMRR = mrrByCurrency.INR ?? 0

  // Revenue trend (last 6 months), explicitly INR-only.
  const paymentLogs = await fetchAllPages<any>((first, last) => supabase
    .from("payment_history")
    .select("id, amount, currency, created_at")
    .eq("status", "captured")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(first, last))

  const revenueByCurrencyMonth: Record<string, Record<string, number>> = {}
  for (const payment of paymentLogs) {
    const currency = String(payment.currency ?? "INR").toUpperCase()
    const month = (payment.created_at ?? "").slice(0, 7)
    revenueByCurrencyMonth[currency] ??= {}
    revenueByCurrencyMonth[currency][month] = (revenueByCurrencyMonth[currency][month] ?? 0)
      + fromMinorUnits(payment.amount ?? 0, currency)
  }

  const revenueCurrencies = new Set([...Object.keys(mrrByCurrency), ...Object.keys(revenueByCurrencyMonth), "INR"])
  const revenueTrendByCurrency = Object.fromEntries([...revenueCurrencies].map(currency => [
    currency,
    Array.from({ length: 6 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { month: key, amount: revenueByCurrencyMonth[currency]?.[key] ?? 0 }
    }),
  ]))
  const revenueTrend = revenueTrendByCurrency.INR

  // Signups trend (last 30 days) — group by date in JS
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentProfiles = await fetchAllPages<any>((first, last) => supabase
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at")
    .order("id")
    .range(first, last))

  const signupsByDay: Record<string, number> = {}
  for (const p of recentProfiles ?? []) {
    const day = (p.created_at ?? "").slice(0, 10)
    if (day) signupsByDay[day] = (signupsByDay[day] ?? 0) + 1
  }
  const signupsTrend = Object.entries(signupsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Documents trend (last 30 days)
  const recentDocs = await fetchAllPages<any>((first, last) => supabase
    .from("generation_history")
    .select("id, created_at")
    .eq("success", true)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at")
    .order("id")
    .range(first, last))

  const docsByDay: Record<string, number> = {}
  for (const d of recentDocs ?? []) {
    const day = (d.created_at ?? "").slice(0, 10)
    if (day) docsByDay[day] = (docsByDay[day] ?? 0) + 1
  }
  const documentsTrend = Object.entries(docsByDay)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Effective tier: all profile users start free; valid paid subscriptions apply,
  // then each user's latest non-expired override wins, including free.
  const nowIso = now.toISOString()
  const [tierProfiles, effectivePaidSubs, tierOverrides] = await Promise.all([
    fetchAllPages<any>((first, last) => supabase.from("profiles").select("id").order("id").range(first, last)),
    fetchAllPages<any>((first, last) => supabase.from("subscriptions")
      .select("id, user_id, plan, created_at").eq("status", "active")
      .in("plan", ["starter", "pro", "agency"]).gt("current_period_end", nowIso)
      .order("created_at").order("id").range(first, last)),
    fetchAllPages<any>((first, last) => supabase.from("admin_tier_overrides")
      .select("id, user_id, tier, created_at, expires_at")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order("created_at").order("id").range(first, last)),
  ])
  const effectiveTiers = new Map<string, string>(tierProfiles.map(profile => [profile.id, "free"]))
  for (const subscription of effectivePaidSubs) {
    if (effectiveTiers.has(subscription.user_id)) effectiveTiers.set(subscription.user_id, subscription.plan)
  }
  for (const override of tierOverrides) {
    if (effectiveTiers.has(override.user_id) && ["free", "starter", "pro", "agency"].includes(override.tier)) {
      effectiveTiers.set(override.user_id, override.tier)
    }
  }
  const tierCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, agency: 0 }
  for (const tier of effectiveTiers.values()) tierCounts[tier] = (tierCounts[tier] ?? 0) + 1
  activePaidUsers = [...effectiveTiers.values()].filter(tier => tier !== "free").length
  const tierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({ tier, count }))

  const freeUsers = tierCounts["free"] ?? 0
  const starterUsers = tierCounts["starter"] ?? 0
  const proUsers = tierCounts["pro"] ?? 0
  const agencyUsers = tierCounts["agency"] ?? 0

  // Documents today and this week
  const { count: totalDocumentsToday } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .eq("success", true)
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))

  const { count: totalDocumentsThisWeek } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .eq("success", true)
    .gte("created_at", weekISO)
    .then(r => ({ count: r.count ?? 0 }))

  // Chat messages
  const { count: totalMessagesAllTime } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .then(r => ({ count: r.count ?? 0 }))

  const { count: totalMessagesThisMonth } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthISO)
    .then(r => ({ count: r.count ?? 0 }))

  const { count: totalMessagesToday } = await supabase
    .from("chat_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))

  // Emails sent — from document_emails table (most accurate) + user_usage.emails_count
  const { count: totalEmailsAllTime } = await supabase
    .from("document_emails")
    .select("*", { count: "exact", head: true })
    .then(r => ({ count: r.count ?? 0 }))

  const { count: totalEmailsThisMonth } = await supabase
    .from("document_emails")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthISO)
    .then(r => ({ count: r.count ?? 0 }))

  const { count: totalEmailsToday } = await supabase
    .from("document_emails")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))

  // Email delivery breakdown (opened, bounced, delivered)
  const emailStatusRows = await fetchAllPages<any>((first, last) => supabase
    .from("document_emails")
    .select("id, status, created_at")
    .gte("created_at", monthISO)
    .order("created_at")
    .order("id")
    .range(first, last))

  const emailStatusCounts: Record<string, number> = {}
  for (const r of emailStatusRows ?? []) {
    const s = r.status ?? "sent"
    emailStatusCounts[s] = (emailStatusCounts[s] ?? 0) + 1
  }
  const emailsOpenedThisMonth = emailStatusCounts["opened"] ?? 0
  const emailsDeliveredThisMonth = emailStatusCounts["delivered"] ?? 0
  const emailsBouncedThisMonth = emailStatusCounts["bounced"] ?? 0

  // Tokens from generation_history (more accurate than user_usage)
  const tokenRows = await fetchAllPages<any>((first, last) => supabase
    .from("generation_history")
    .select("id, tokens_used, created_at")
    .gte("created_at", monthISO)
    .order("created_at")
    .order("id")
    .range(first, last))

  const totalTokensThisMonth = (tokenRows ?? []).reduce((s, r) => s + (r.tokens_used ?? 0), 0)

  // Estimated AI cost is stored and reported in USD; do not invent an FX rate.
  const { count: aiRequestsToday } = await supabase
    .from("generation_history")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayISO)
    .then(r => ({ count: r.count ?? 0 }))
  const estimatedAICostToday = Math.round(aiRequestsToday * 0.00094 * 100) / 100

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
    freeUsers,
    starterUsers,
    proUsers,
    agencyUsers,
    totalDocumentsAllTime,
    totalDocumentsToday,
    totalDocumentsThisWeek,
    totalDocumentsThisMonth,
    totalMessagesAllTime,
    totalMessagesThisMonth,
    totalMessagesToday,
    totalEmailsAllTime,
    totalEmailsThisMonth,
    totalEmailsToday,
    emailsOpenedThisMonth,
    emailsDeliveredThisMonth,
    emailsBouncedThisMonth,
    totalAIRequestsThisMonth,
    totalTokensThisMonth,
    estimatedAICostThisMonth: Math.round(estimatedAICostThisMonth * 100) / 100,
    estimatedAICostToday,
    totalRevenue,
    currentMRR,
    mrrByCurrency,
    arrByCurrency,
    revenueTrendByCurrency,
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
  } = params
  const page = boundedPositiveInt(params.page, 1, 100_000)
  const pageSize = boundedPositiveInt(params.pageSize, 20, 100)

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

  // Enrich with document counts and email counts
  if (data && data.length > 0) {
    const userIds = data.map((u: any) => u.id)
    const [docCounts, emailCounts] = await Promise.all([
      fetchAllPages<any>((first, last) => supabase
        .from("generation_history")
        .select("id, user_id")
        .eq("success", true)
        .in("user_id", userIds)
        .order("user_id")
        .order("id")
        .range(first, last)),
      fetchAllPages<any>((first, last) => supabase
        .from("document_emails")
        .select("id, user_id")
        .in("user_id", userIds)
        .order("user_id")
        .order("id")
        .range(first, last)),
    ])

    const countMap: Record<string, number> = {}
    for (const d of docCounts ?? []) {
      countMap[d.user_id] = (countMap[d.user_id] ?? 0) + 1
    }

    const emailCountMap: Record<string, number> = {}
    for (const e of emailCounts ?? []) {
      emailCountMap[e.user_id] = (emailCountMap[e.user_id] ?? 0) + 1
    }
    
    for (const user of data as any[]) {
      user.documents_count = countMap[user.id] ?? 0
      user.emails_count = emailCountMap[user.id] ?? 0
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

  const [profileRes, businessRes, usageRes, docsRes, auditRes, emailsRes] = await Promise.allSettled([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("businesses").select("*").eq("user_id", userId).single(),
    supabase.from("user_usage").select("*").eq("user_id", userId).eq("month", monthKey).single(),
    // Use generation_history (the correct table for documents per user)
    supabase
      .from("generation_history")
      .select("id, document_type, prompt, success, tokens_used, generation_time_ms, created_at, session_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("document_emails")
      .select("id, document_type, status, created_at, recipient_email, subject")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const profile =
    profileRes.status === "fulfilled" && !profileRes.value.error
      ? (profileRes.value.data as Record<string, unknown>)
      : null

  const business =
    businessRes.status === "fulfilled" && !businessRes.value.error
      ? (businessRes.value.data as Record<string, unknown>)
      : null

  // Enrich usageStats with all-time document and email counts
  let usageStats: Record<string, unknown> | null =
    usageRes.status === "fulfilled" && !usageRes.value.error
      ? (usageRes.value.data as Record<string, unknown>)
      : null

  // Add all-time counts even if no monthly row exists
  const [{ count: allTimeDocsCount }, { count: allTimeEmailsCount }] = await Promise.all([
    supabase
      .from("generation_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("success", true)
      .then(r => ({ count: r.count ?? 0 })),
    supabase
      .from("document_emails")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .then(r => ({ count: r.count ?? 0 })),
  ])

  usageStats = {
    ...(usageStats ?? {}),
    documents_count_all_time: allTimeDocsCount,
    emails_count_all_time: allTimeEmailsCount,
  }

  const recentDocuments =
    docsRes.status === "fulfilled" && !docsRes.value.error
      ? ((docsRes.value.data ?? []) as Array<Record<string, unknown>>).map((d: any) => ({
          ...d,
          // Expose a human-readable title field for the drawer UI
          title: d.document_type
            ? d.document_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
            : "Unknown",
        }))
      : []

  const recentAuditLogs =
    auditRes.status === "fulfilled" && !auditRes.value.error
      ? ((auditRes.value.data ?? []) as Array<Record<string, unknown>>)
      : []

  const recentEmails =
    emailsRes.status === "fulfilled" && !(emailsRes.value as any).error
      ? (((emailsRes.value as any).data ?? []) as Array<Record<string, unknown>>)
      : []

  // Total email count for this user (all time)
  const totalEmailsSent = allTimeEmailsCount

  return { profile, business, usageStats, recentDocuments, recentAuditLogs, recentEmails, totalEmailsSent }
}

// ─── 6.4 getSubscriptions ─────────────────────────────────────────────────────

export async function getSubscriptions(
  params: SubscriptionsQueryParams
): Promise<PaginatedSubscriptions> {
  const supabase = getAdminClient()
  const { plan, status, dateFrom, dateTo } = params
  const page = boundedPositiveInt(params.page, 1, 100_000)
  const pageSize = boundedPositiveInt(params.pageSize, 20, 100)
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
    return {
      subscriptions: [],
      total: 0,
      page,
      pageSize,
      summary: {
        active: 0,
        mrrByCurrency: {},
        arrByCurrency: {},
        mrrByCurrencyMajorUnits: {},
        arrByCurrencyMajorUnits: {},
      },
    }
  }

  const nowIso = new Date().toISOString()
  const activeSubscriptions = await fetchAllPages<any>((first, last) => supabase
    .from("subscriptions")
    .select("id, plan,status,amount_paid,currency,billing_cycle,current_period_end")
    .eq("status", "active")
    .in("plan", ["starter", "pro", "agency"])
    .gt("current_period_end", nowIso)
    .order("id")
    .range(first, last))
  const mrrByCurrency: Record<string, number> = {}
  const mrrByCurrencyMajorUnits: Record<string, number> = {}
  for (const subscription of activeSubscriptions) {
    const currency = String(subscription.currency || "INR").toUpperCase()
    const monthlyMinor = subscription.billing_cycle === "yearly"
      ? (subscription.amount_paid ?? 0) / 12
      : (subscription.amount_paid ?? 0)
    const monthlyMajor = subscription.billing_cycle === "yearly"
      ? fromMinorUnits(subscription.amount_paid ?? 0, currency) / 12
      : fromMinorUnits(subscription.amount_paid ?? 0, currency)
    mrrByCurrency[currency] = (mrrByCurrency[currency] ?? 0) + monthlyMinor
    mrrByCurrencyMajorUnits[currency] = (mrrByCurrencyMajorUnits[currency] ?? 0) + monthlyMajor
  }
  const arrByCurrency = Object.fromEntries(
    Object.entries(mrrByCurrency).map(([currency, amount]) => [currency, amount * 12])
  )
  const arrByCurrencyMajorUnits = Object.fromEntries(
    Object.entries(mrrByCurrencyMajorUnits).map(([currency, amount]) => [currency, amount * 12])
  )

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
    summary: {
      active: activeSubscriptions.length,
      mrrByCurrency,
      arrByCurrency,
      mrrByCurrencyMajorUnits,
      arrByCurrencyMajorUnits,
    },
  }
}

// ─── 6.5 getAIUsage ───────────────────────────────────────────────────────────

export async function getAIUsage(params: AIUsageQueryParams): Promise<AIUsageData> {
  const supabase = getAdminClient()
  const { dateFrom, dateTo, docType, userEmail, success } = params
  const page = boundedPositiveInt(params.page, 1, 100_000)
  const pageSize = boundedPositiveInt(params.pageSize, 20, 100)

  const now = new Date()
  const todayISO = startOfDay(now).toISOString()
  const weekISO = startOfWeek(now).toISOString()
  const monthISO = startOfMonth(now).toISOString()
  const monthKey = currentMonthKey()

  // Summary cards from user_usage (current month totals)
  const usageRows = await fetchAllPages<any>((first, last) => supabase
    .from("user_usage")
    .select("user_id, month, ai_requests_count, ai_tokens_used, estimated_cost_usd")
    .eq("month", monthKey)
    .order("month")
    .order("user_id")
    .range(first, last))
  const usageResetRows = await fetchAllPages<any>((first, last) => supabase
    .from("subscription_usage_resets")
    .select("user_id, usage_month, previous_ai_requests_count")
    .eq("usage_month", monthKey)
    .order("usage_month")
    .order("user_id")
    .range(first, last))

  const requestsThisMonth = (usageRows ?? []).reduce(
    (s, r) => s + (r.ai_requests_count ?? 0),
    (usageResetRows ?? []).reduce((s, r) => s + (r.previous_ai_requests_count ?? 0), 0)
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

  // Top users by request count this month, including pre-transition counts
  // archived when an allowance reset occurred.
  const archivedRequestsByUser = new Map<string, number>()
  for (const row of usageResetRows ?? []) {
    archivedRequestsByUser.set(
      row.user_id,
      (archivedRequestsByUser.get(row.user_id) ?? 0) + (row.previous_ai_requests_count ?? 0),
    )
  }
  const topUsersRaw = (usageRows ?? [])
    .map(row => ({
      ...row,
      ai_requests_count: (row.ai_requests_count ?? 0) + (archivedRequestsByUser.get(row.user_id) ?? 0),
    }))
    .sort((a, b) => b.ai_requests_count - a.ai_requests_count)
    .slice(0, 10)

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
  const genRows = await fetchAllPages<any>((first, last) => supabase
    .from("generation_history")
    .select("id, document_type, created_at")
    .gte("created_at", monthISO)
    .order("created_at")
    .order("id")
    .range(first, last))

  const typeCounts: Record<string, number> = {}
  for (const r of genRows ?? []) {
    const t = r.document_type ?? "unknown"
    typeCounts[t] = (typeCounts[t] ?? 0) + 1
  }
  const docTypeBreakdown = Object.entries(typeCounts).map(([type, count]) => ({ type, count }))

  // Avg generation time and success/error rates
  const perfRows = await fetchAllPages<any>((first, last) => supabase
    .from("generation_history")
    .select("id, generation_time_ms, success, created_at")
    .gte("created_at", monthISO)
    .order("created_at")
    .order("id")
    .range(first, last))

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
    const matchedProfiles = await fetchAllPages<any>((first, last) => supabase
      .from("profiles")
      .select("id")
      .ilike("email", `%${userEmail}%`)
      .order("id")
      .range(first, last))
    const ids = matchedProfiles.map(p => p.id)
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
    }  }

  histQuery = histQuery.order("created_at", { ascending: false }).range(histFrom, histTo)

  const { data: history, count: historyTotal, error: histError } = await histQuery

  if (histError) {
    console.error("getAIUsage history error:", histError)
  }

  // Enrich history rows with user emails (batch lookup, not per-row)
  const historyRows = (history ?? []) as Array<Record<string, unknown>>
  if (historyRows.length > 0) {
    const rowUserIds = [...new Set(historyRows.map((r) => r.user_id as string).filter(Boolean))]
    const { data: histProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", rowUserIds)
    const histEmailMap: Record<string, string> = {}
    for (const p of histProfiles ?? []) {
      histEmailMap[p.id] = p.email ?? p.id
    }
    for (const row of historyRows) {
      row.user_email = histEmailMap[row.user_id as string] ?? (row.user_id as string)
    }
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
    history: historyRows,
    historyTotal: historyTotal ?? 0,
  }
}

// ─── 6.6 getRevenue ───────────────────────────────────────────────────────────

export interface RevenueQueryParams {
  page?: number
  pageSize?: number
  status?: string
}

export async function getRevenue(params: RevenueQueryParams = {}): Promise<RevenueData> {
  const supabase = getAdminClient()
  const { status } = params
  const page = boundedPositiveInt(params.page, 1, 100_000)
  const pageSize = boundedPositiveInt(params.pageSize, 25, 100)
  const now = new Date()
  const monthISO = startOfMonth(now).toISOString()

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  // ── Primary: payment_history table (actual Razorpay payments) ────────────────
  let phQuery = supabase
    .from("payment_history")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })

  if (status) phQuery = phQuery.eq("status", status)
  phQuery = phQuery.range(from, to)

  const { data: paymentRows, count: phTotal } = await phQuery

  // Enrich with profile + business
  const phUserIds = [...new Set((paymentRows ?? []).map((r: any) => r.user_id).filter(Boolean))]
  let phProfileMap: Record<string, { email: string; full_name: string | null }> = {}
  let phBizMap: Record<string, string> = {}
  if (phUserIds.length > 0) {
    const [{ data: phProfiles }, { data: phBiz }] = await Promise.all([
      supabase.from("profiles").select("id, email, full_name").in("id", phUserIds),
      supabase.from("businesses").select("user_id, country").in("user_id", phUserIds),
    ])
    for (const p of phProfiles ?? []) phProfileMap[p.id] = { email: p.email ?? "—", full_name: p.full_name }
    for (const b of phBiz ?? []) phBizMap[b.user_id] = b.country ?? "—"
  }

  const paymentHistory = (paymentRows ?? []).map((r: any) => {
    const currency = String(r.currency ?? "INR").toUpperCase()
    const amount = fromMinorUnits(r.amount ?? 0, currency)
    const profile = phProfileMap[r.user_id]
    return {
      id: r.id,
      user_email: profile?.email ?? "—",
      user_name: profile?.full_name ?? "—",
      amount,
      amount_inr: currency === "INR" ? amount : null,
      currency,
      plan: (r.metadata as any)?.plan ?? r.plan ?? "—",
      billing_cycle: (r.metadata as any)?.billing_cycle ?? "—",
      date: r.created_at,
      payment_id: r.razorpay_payment_id ?? "—",
      subscription_id: (r.metadata as any)?.subscription_id ?? "—",
      country: phBizMap[r.user_id] ?? "—",
      status: r.status,
      period_start: null,
      period_end: null,
    }
  })

  // ── MRR / revenue metrics from subscriptions ────────────────────────────────
  const allSubs = await fetchAllPages<any>((first, last) => supabase
    .from("subscriptions")
    .select("id, user_id, plan, status, amount_paid, currency, created_at, current_period_start, current_period_end, billing_cycle")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(first, last))

  const activePaid = allSubs.filter((s: any) =>
    s.status === "active"
    && ["starter", "pro", "agency"].includes(s.plan)
    && Boolean(s.current_period_end)
    && new Date(s.current_period_end) > now
  )
  const mrrByCurrency: Record<string, number> = {}
  const planCounts: Record<string, number> = {}
  const planRevenue: Record<string, number> = {}

  for (const s of activePaid) {
    const currency = String(s.currency ?? "INR").toUpperCase()
    const nativeAmount = fromMinorUnits(s.amount_paid ?? 0, currency)
    const monthlyNativeAmount = s.billing_cycle === "yearly" ? nativeAmount / 12 : nativeAmount
    mrrByCurrency[currency] = (mrrByCurrency[currency] ?? 0) + monthlyNativeAmount
    const displayAmount = currency === "INR" ? monthlyNativeAmount : 0
    const plan = s.plan ?? "unknown"
    planCounts[plan] = (planCounts[plan] ?? 0) + 1
    planRevenue[plan] = (planRevenue[plan] ?? 0) + displayAmount
  }
  const arrByCurrency = Object.fromEntries(
    Object.entries(mrrByCurrency).map(([currency, amount]) => [currency, amount * 12])
  )
  const mrr = mrrByCurrency.INR ?? 0
  const arr = arrByCurrency.INR ?? 0

  const revenueByPlan = Object.entries(planCounts).map(([plan, count]) => ({
    plan,
    count,
    revenue: planRevenue[plan] ?? 0,
  }))

  // New revenue this month (from payment_history, most accurate)
  const newSubsThisMonth = await fetchAllPages<any>((first, last) => supabase
    .from("payment_history")
    .select("id, amount, currency, created_at")
    .gte("created_at", monthISO)
    .eq("status", "captured")
    .order("created_at")
    .order("id")
    .range(first, last))

  const newRevenueThisMonthByCurrency: Record<string, number> = {}
  for (const row of newSubsThisMonth) {
    const currency = String(row.currency ?? "INR").toUpperCase()
    newRevenueThisMonthByCurrency[currency] = (newRevenueThisMonthByCurrency[currency] ?? 0)
      + fromMinorUnits(row.amount ?? 0, currency)
  }
  const newRevenueThisMonth = newRevenueThisMonthByCurrency.INR ?? 0

  // MoM change
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthISO = prevDate.toISOString()
  const prevMonthPayments = await fetchAllPages<any>((first, last) => supabase
    .from("payment_history")
    .select("id, amount, currency, created_at")
    .gte("created_at", prevMonthISO)
    .lt("created_at", monthISO)
    .eq("status", "captured")
    .order("created_at")
    .order("id")
    .range(first, last))

  const previousMonthRevenueByCurrency: Record<string, number> = {}
  for (const row of prevMonthPayments) {
    const currency = String(row.currency ?? "INR").toUpperCase()
    previousMonthRevenueByCurrency[currency] = (previousMonthRevenueByCurrency[currency] ?? 0)
      + fromMinorUnits(row.amount ?? 0, currency)
  }
  const prevMonthRevenue = previousMonthRevenueByCurrency.INR ?? 0

  const momChange =
    prevMonthRevenue > 0
      ? ((newRevenueThisMonth - prevMonthRevenue) / prevMonthRevenue) * 100
      : 0

  return {
    mrr,
    arr,
    mrrByCurrency,
    arrByCurrency,
    newRevenueThisMonth,
    newRevenueThisMonthByCurrency,
    previousMonthRevenueByCurrency,
    momChange,
    revenueByPlan,
    paymentHistory: paymentHistory as Array<Record<string, unknown>>,
    paymentHistoryTotal: phTotal ?? 0,
  }
}

// ─── 6.7 getSecurity ──────────────────────────────────────────────────────────

export async function getSecurity(params: SecurityQueryParams): Promise<SecurityData> {
  const supabase = getAdminClient()
  const { action, email, dateFrom, dateTo, ip } = params
  const page = boundedPositiveInt(params.page, 1, 100_000)
  const pageSize = boundedPositiveInt(params.pageSize, 20, 100)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let filteredUserIds: string[] | null = null
  if (email) {
    const matchedProfiles = await fetchAllPages<any>((first, last) => supabase
      .from("profiles")
      .select("id")
      .ilike("email", `%${email}%`)
      .order("id")
      .range(first, last))
    filteredUserIds = matchedProfiles.map(profile => profile.id)
  }

  let auditLogs: any[] = []
  let auditLogsTotal = 0
  if (filteredUserIds === null || filteredUserIds.length > 0) {
    let auditQuery = supabase.from("audit_logs").select("*", { count: "exact" })
    if (action) auditQuery = auditQuery.ilike("action", `${action}%`)
    if (filteredUserIds) auditQuery = auditQuery.in("user_id", filteredUserIds)
    if (dateFrom) auditQuery = auditQuery.gte("created_at", dateFrom)
    if (dateTo) auditQuery = auditQuery.lte("created_at", dateTo)
    if (ip) auditQuery = auditQuery.eq("ip_address", ip)
    const result = await auditQuery.order("created_at", { ascending: false }).range(from, to)
    if (result.error) console.error("getSecurity audit error:", result.error)
    auditLogs = result.data ?? []
    auditLogsTotal = result.count ?? 0
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [securityRows, pinLockouts, profiles, ipBlocklist] = await Promise.all([
    fetchAllPages<any>((first, last) => supabase.from("audit_logs")
      .select("id, action, user_id, ip_address, metadata, created_at")
      .like("action", "security.%").gte("created_at", oneDayAgo)
      .order("created_at").order("id").range(first, last)),
    fetchAllPages<any>((first, last) => supabase.from("audit_logs")
      .select("id, action, user_id, ip_address, metadata, created_at")
      .eq("action", "admin.pin_lockout").gte("created_at", oneDayAgo)
      .order("created_at").order("id").range(first, last)),
    fetchAllPages<any>((first, last) => supabase.from("profiles")
      .select("id, email, full_name").order("id").range(first, last)),
    fetchAllPages<any>((first, last) => supabase.from("ip_blocklist")
      .select("*").order("created_at", { ascending: false })
      .order("id", { ascending: false }).range(first, last)),
  ])
  const profileMap = new Map(profiles.map(profile => [
    profile.id,
    profile.email ?? profile.full_name ?? profile.id,
  ]))

  for (const row of auditLogs) {
    row.email = row.user_id ? profileMap.get(row.user_id) ?? row.user_id : "system"
  }

  const bruteForceByIp = new Map<string, { ip: string; attempts: number; last_seen: string; emails: Set<string> }>()
  const bruteRows = [...securityRows.filter(row =>
    row.action === "security.brute_force_block" || row.action === "security.auth_failure"
  ), ...pinLockouts]
  for (const row of bruteRows) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const address = String(row.ip_address ?? metadata.ip ?? "unknown")
    const existing = bruteForceByIp.get(address) ?? {
      ip: address,
      attempts: 0,
      last_seen: String(row.created_at),
      emails: new Set<string>(),
    }
    existing.attempts += typeof metadata.failed_attempts === "number" ? metadata.failed_attempts : 1
    if (String(row.created_at) > existing.last_seen) existing.last_seen = String(row.created_at)
    if (typeof metadata.email === "string") existing.emails.add(metadata.email)
    if (row.user_id && profileMap.has(row.user_id)) existing.emails.add(profileMap.get(row.user_id)!)
    if (Array.isArray(metadata.target_emails)) {
      for (const target of metadata.target_emails) if (typeof target === "string") existing.emails.add(target)
    }
    bruteForceByIp.set(address, existing)
  }
  const bruteForce = [...bruteForceByIp.values()]
    .map(event => ({ ...event, emails: [...event.emails] }))
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen))

  const groupedEvents = new Map<string, SecurityData["securityEvents"][number]>()
  for (const row of securityRows) {
    const userId = row.user_id ?? null
    const key = `${row.action}\u0000${userId ?? "system"}`
    const existing = groupedEvents.get(key)
    if (existing) {
      existing.count += 1
      if (String(row.created_at) > existing.last_seen) {
        existing.last_seen = String(row.created_at)
        existing.ip_address = row.ip_address ?? null
      }
    } else {
      groupedEvents.set(key, {
        action: String(row.action),
        user_id: userId,
        email: userId ? profileMap.get(userId) ?? userId : "system",
        count: 1,
        last_seen: String(row.created_at),
        ip_address: row.ip_address ?? null,
      })
    }
  }
  const securityEvents = [...groupedEvents.values()]
    .sort((a, b) => b.last_seen.localeCompare(a.last_seen))

  const blockedIPs = ipBlocklist as Array<Record<string, unknown>>
  return {
    logs: auditLogs,
    total: auditLogsTotal,
    bruteForce,
    securityEvents,
    suspicious: securityEvents,
    blockedIPs,
    auditLogs,
    auditLogsTotal,
    bruteForceEvents: bruteRows,
    suspiciousActivity: securityEvents,
    ipBlocklist: blockedIPs,
  }
}

// ─── 6.8 getActivityInsights ──────────────────────────────────────────────────
// Returns hourly peak data per document type for the last 30 days

export interface HourlyBucket {
  hour: number   // 0–23
  count: number
}

export interface DocTypePeaks {
  type: string
  hourly: HourlyBucket[]
  peakHour: number
  total: number
}

export interface ActivityInsights {
  byDocType: DocTypePeaks[]
  overallHourly: HourlyBucket[]
  overallPeakHour: number
  totalLast30Days: number
  dailyTrend: Array<Record<string, number | string>>
}

export async function getActivityInsights(): Promise<ActivityInsights> {
  const supabase = getAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const rows = await fetchAllPages<any>((first, last) => supabase
    .from("generation_history")
    .select("id, document_type, created_at, success")
    .gte("created_at", thirtyDaysAgo)
    .eq("success", true)
    .order("created_at")
    .order("id")
    .range(first, last))

  // Build hourly buckets per doc type
  const typeHourly: Record<string, Record<number, number>> = {}
  const overallHourly: Record<number, number> = {}
  const dailyMap: Record<string, Record<string, number>> = {}

  for (const r of rows ?? []) {
    const dt = (r.document_type ?? "unknown").toLowerCase()
    const d = new Date(r.created_at ?? "")
    const hour = d.getUTCHours()
    const day = r.created_at?.slice(0, 10) ?? ""

    if (!typeHourly[dt]) typeHourly[dt] = {}
    typeHourly[dt][hour] = (typeHourly[dt][hour] ?? 0) + 1
    overallHourly[hour] = (overallHourly[hour] ?? 0) + 1

    if (day) {
      if (!dailyMap[day]) dailyMap[day] = {}
      dailyMap[day][dt] = (dailyMap[day][dt] ?? 0) + 1
      dailyMap[day]["total"] = (dailyMap[day]["total"] ?? 0) + 1
    }
  }

  // All supported document types from the registry
  const docTypes = [
    "invoice", "contract", "quote", "estimate", "proposal",
    "sow", "change_order", "nda", "client_onboarding_form", "payment_followup"
  ]

  // Also include any types that appear in the data but aren't in the list
  // (e.g. legacy "quotation" alias) so nothing gets silently dropped
  const seenTypes = Object.keys(typeHourly)
  for (const t of seenTypes) {
    if (!docTypes.includes(t) && t !== "unknown") docTypes.push(t)
  }

  const byDocType: DocTypePeaks[] = docTypes.map(type => {
    const hourMap = typeHourly[type] ?? {}
    const hourly: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourMap[h] ?? 0,
    }))
    const total = hourly.reduce((s, b) => s + b.count, 0)
    const peakHour = hourly.reduce((best, b) => b.count > best.count ? b : best, { hour: 0, count: 0 }).hour
    return { type, hourly, peakHour, total }
  })

  const overallHourlyArr: HourlyBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: overallHourly[h] ?? 0,
  }))
  const overallPeakHour = overallHourlyArr.reduce((best, b) => b.count > best.count ? b : best, { hour: 0, count: 0 }).hour
  const totalLast30Days = (rows ?? []).length

  // Daily trend — include all doc types dynamically so no type is hardcoded
  const allDailyTypes = [
    "invoice", "contract", "quote", "estimate", "proposal",
    "sow", "change_order", "nda", "client_onboarding_form", "payment_followup",
    ...Object.keys(typeHourly).filter(t => !["invoice","contract","quote","estimate","proposal","sow","change_order","nda","client_onboarding_form","payment_followup"].includes(t) && t !== "unknown")
  ]
  const dailyTrend = Object.entries(dailyMap)
    .map(([date, counts]) => {
      const row: Record<string, number | string> = { date, total: counts["total"] ?? 0 }
      for (const t of allDailyTypes) row[t] = counts[t] ?? 0
      return row
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))

  return { byDocType, overallHourly: overallHourlyArr, overallPeakHour, totalLast30Days, dailyTrend }
}
