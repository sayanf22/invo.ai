import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminSession } from "@/lib/admin-auth"
import type { Database, Json } from "@/lib/database.types"

type Bounds = { start: Date; end: Date } | null
type CalendarDate = { year: number; month: number; day: number }
type CalendarUnit = "day" | "week" | "month" | "year"

const DAY_MS = 86_400_000

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error("Admin database credentials are not configured")
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function resolveTimeZone(requested?: string): string {
  const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  for (const candidate of [requested, serverTimeZone, "UTC"]) {
    if (!candidate) continue
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions().timeZone
    } catch {
      // Try the server timezone, then UTC.
    }
  }
  return "UTC"
}

function localDateAt(value: Date, timeZone: string): CalendarDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) }
}

function compareCalendarDates(left: CalendarDate, right: CalendarDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day
}

/** Resolve the first UTC instant belonging to a local calendar date. */
function localMidnightToUtc(date: CalendarDate, timeZone: string): Date {
  const approximate = Date.UTC(date.year, date.month - 1, date.day)
  let low = approximate - 2 * DAY_MS
  let high = approximate + 2 * DAY_MS
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2)
    if (compareCalendarDates(localDateAt(new Date(middle), timeZone), date) >= 0) high = middle
    else low = middle + 1
  }
  return new Date(low)
}

function addCalendar(date: CalendarDate, amount: number, unit: CalendarUnit): CalendarDate {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day))
  if (unit === "day") value.setUTCDate(value.getUTCDate() + amount)
  else if (unit === "week") value.setUTCDate(value.getUTCDate() + amount * 7)
  else if (unit === "month") value.setUTCMonth(value.getUTCMonth() + amount)
  else value.setUTCFullYear(value.getUTCFullYear() + amount)
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}

function startOf(unit: CalendarUnit, value: CalendarDate): CalendarDate {
  if (unit === "day") return value
  if (unit === "week") {
    const dayOfWeek = new Date(Date.UTC(value.year, value.month - 1, value.day)).getUTCDay()
    return addCalendar(value, -((dayOfWeek + 6) % 7), "day")
  }
  if (unit === "month") return { year: value.year, month: value.month, day: 1 }
  return { year: value.year, month: 1, day: 1 }
}

function parseLocalDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const parsed = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const normalized = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  return normalized.getUTCFullYear() === parsed.year
    && normalized.getUTCMonth() + 1 === parsed.month
    && normalized.getUTCDate() === parsed.day
    ? parsed
    : null
}

function getBounds(period: string, now: Date, timeZone: string, from?: string, to?: string): Bounds {
  if (period === "all") return null
  const localNow = localDateAt(now, timeZone)
  if (period === "custom") {
    const start = from ? parseLocalDate(from) : null
    const inclusiveEnd = to ? parseLocalDate(to) : null
    if (!start || (to && !inclusiveEnd)) return null
    const endDate = inclusiveEnd ? addCalendar(inclusiveEnd, 1, "day") : addCalendar(localNow, 1, "day")
    return { start: localMidnightToUtc(start, timeZone), end: localMidnightToUtc(endDate, timeZone) }
  }
  const unit: CalendarUnit = period === "today" ? "day" : period === "week" || period === "year" ? period : "month"
  const localStart = startOf(unit, localNow)
  return {
    start: localMidnightToUtc(localStart, timeZone),
    end: localMidnightToUtc(addCalendar(localStart, 1, unit), timeZone),
  }
}

function getPreviousBounds(period: string, bounds: Bounds, timeZone: string): Bounds {
  if (!bounds || period === "all" || period === "custom") return null
  const unit: CalendarUnit = period === "today" ? "day" : period === "week" || period === "year" ? period : "month"
  const localStart = localDateAt(bounds.start, timeZone)
  return { start: localMidnightToUtc(addCalendar(localStart, -1, unit), timeZone), end: bounds.start }
}

function pctChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 100)
}

function asRecord(value: Json | null): Record<string, Json | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : null
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const { searchParams } = request.nextUrl
    const requestedPeriod = searchParams.get("period") ?? "month"
    const period = ["today", "week", "month", "year", "all", "custom"].includes(requestedPeriod)
      ? requestedPeriod
      : "month"
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined
    const timeZone = resolveTimeZone(searchParams.get("timezone") ?? undefined)
    const now = new Date()
    const bounds = getBounds(period, now, timeZone, from, to)
    if (period === "custom" && !bounds) {
      return NextResponse.json({ error: "A valid custom date range is required" }, { status: 400 })
    }
    if (bounds && bounds.start >= bounds.end) {
      return NextResponse.json({ error: "The custom date range is invalid" }, { status: 400 })
    }
    const previousBounds = getPreviousBounds(period, bounds, timeZone)

    const { data, error } = await getAdminClient().rpc("get_admin_overview_snapshot", {
      p_period: period,
      p_timezone: timeZone,
      p_now: now.toISOString(),
      p_bounds_start: bounds?.start.toISOString() ?? null,
      p_bounds_end: bounds?.end.toISOString() ?? null,
      p_previous_start: previousBounds?.start.toISOString() ?? null,
      p_previous_end: previousBounds?.end.toISOString() ?? null,
    })
    if (error) throw error
    const snapshot = asRecord(data)
    if (!snapshot) throw new Error("Admin overview aggregate returned an invalid result")

    const signups = Number(snapshot.signupsInPeriod ?? 0)
    const previousSignups = Number(snapshot.signupsPrevious ?? 0)
    const documents = Number(snapshot.totalDocuments ?? 0)
    const previousDocuments = Number(snapshot.documentsPrevious ?? 0)
    delete snapshot.signupsPrevious
    delete snapshot.documentsPrevious

    return NextResponse.json({
      ...snapshot,
      period,
      from,
      to,
      metadata: {
        timezone: timeZone,
        aiCostGranularity: snapshot.aiCostAvailable === false ? "monthly_only" : "selected_period",
      },
      signupsDelta: previousBounds ? pctChange(signups, previousSignups) : null,
      documentsDelta: previousBounds ? pctChange(documents, previousDocuments) : null,
    })
  } catch (error) {
    console.error("[admin/overview] aggregate failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}