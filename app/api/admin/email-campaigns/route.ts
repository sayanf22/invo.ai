/**
 * Admin email campaign data and emergency Brevo synchronization.
 * GET is backed by a bounded aggregate RPC; no platform table is downloaded.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { verifyAdminSession } from "@/lib/admin-auth"
import { syncUserOnLogin } from "@/lib/brevo"
import { computeFunnelStage } from "@/lib/funnel-stage"
import type { Database, Json } from "@/lib/database.types"

const PAGE_SIZE = 50
const SYNC_BATCH_SIZE = 500
const VALID_CATEGORIES = ["all", "dropoff", "inactive", "active", "stopped"] as const
const VALID_EMAIL_STATUSES = ["all", "emailed", "never", "opened", "notopened"] as const
const VALID_SEGMENTS = ["sync-dropoff", "sync-active", "sync-all"] as const

type Segment = (typeof VALID_SEGMENTS)[number]
type ServiceClient = SupabaseClient<Database>
type JsonRecord = Record<string, unknown>

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error("Admin database credentials are not configured")
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function asRecord(value: Json | null): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asBoolean(value: unknown): boolean {
  return value === true
}
function enrichUser(value: unknown, now: number): JsonRecord | null {
  const row = value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null
  const id = asString(row?.id)
  const email = asString(row?.email)
  const createdAt = asString(row?.created_at)
  if (!row || !id || !email || !createdAt) return null

  const lastActiveAt = asString(row.last_active_at)
  const docsCount = Number(row.docs_count ?? 0)
  const daysSinceActive = Math.max(0, Math.floor(
    (now - new Date(lastActiveAt ?? createdAt).getTime()) / 86_400_000
  ))
  const daysSinceSignup = Math.max(0, Math.floor(
    (now - new Date(createdAt).getTime()) / 86_400_000
  ))
  const funnel = computeFunnelStage({
    createdAt,
    lastActiveAt,
    planSelected: asBoolean(row.plan_selected),
    onboardingComplete: asBoolean(row.onboarding_complete),
    onboardingPhase: asString(row.onboarding_phase),
    docsCount,
  }, now)

  return {
    ...row,
    id,
    email,
    name: asString(row.name),
    created_at: createdAt,
    last_active_at: lastActiveAt,
    days_since_active: daysSinceActive,
    days_since_signup: daysSinceSignup,
    docs_count: docsCount,
    sent_emails: Array.isArray(row.sent_emails) ? row.sent_emails : [],
    sent_email_log_count: Number(row.sent_email_log_count ?? 0),
    sent_emails_truncated: asBoolean(row.sent_emails_truncated),
    email_history: Array.isArray(row.email_history) ? row.email_history : [],
    last_email_event: asRecord((row.last_email_event ?? null) as Json | null),
    funnel_stage: funnel.label,
    funnel_detail: funnel.detail,
    funnel_stuck: funnel.stuck,
  }
}

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  try {
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1")
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
    const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 200)
    const requestedCategory = request.nextUrl.searchParams.get("category") ?? "all"
    const requestedEmailStatus = request.nextUrl.searchParams.get("emailStatus") ?? "all"
    const category = VALID_CATEGORIES.includes(requestedCategory as typeof VALID_CATEGORIES[number])
      ? requestedCategory
      : "all"
    const emailStatus = VALID_EMAIL_STATUSES.includes(requestedEmailStatus as typeof VALID_EMAIL_STATUSES[number])
      ? requestedEmailStatus
      : "all"
    const now = new Date()

    const { data, error } = await getServiceClient().rpc("get_admin_email_campaign_snapshot", {
      p_page: page,
      p_page_size: PAGE_SIZE,
      p_search: search || null,
      p_category: category,
      p_email_status: emailStatus,
      p_now: now.toISOString(),
    })
    if (error) throw error
    const snapshot = asRecord(data)
    if (!snapshot) throw new Error("Campaign aggregate returned an invalid result")

    const users = (Array.isArray(snapshot.users) ? snapshot.users : [])
      .map(value => enrichUser(value, now.getTime()))
      .filter((value): value is JsonRecord => value !== null)

    return NextResponse.json({ ...snapshot, users })
  } catch (error) {
    console.error("[admin/email-campaigns] aggregate failed:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
type UserRecord = {
  id: string
  email: string | null
  full_name: string | null
  onboarding_complete: boolean | null
  last_active_at: string | null
  created_at: string | null
}

async function fetchSyncBatch(
  supabase: ServiceClient,
  segment: Segment,
  offset: number,
  twoDaysAgo: string
): Promise<UserRecord[]> {
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, onboarding_complete, last_active_at, created_at")
    .not("email", "is", null)

  if (segment === "sync-dropoff") {
    query = query
      .eq("onboarding_complete", false)
      .or(`last_active_at.is.null,last_active_at.lt.${twoDaysAgo}`)
  } else if (segment === "sync-active") {
    query = query.eq("onboarding_complete", true)
  }

  const { data, error } = await query
    .order("id", { ascending: true })
    .range(offset, offset + SYNC_BATCH_SIZE - 1)
  if (error) throw error
  return (data ?? []) as UserRecord[]
}

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: { segment?: string; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.segment || !VALID_SEGMENTS.includes(body.segment as Segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 })
  }
  if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
    return NextResponse.json({ error: "dryRun must be a boolean" }, { status: 400 })
  }

  try {
    const segment = body.segment as Segment
    const dryRun = body.dryRun === true
    const supabase = getServiceClient()
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString()
    let offset = 0
    let total = 0
    let synced = 0
    let failed = 0

    while (true) {
      const users = await fetchSyncBatch(supabase, segment, offset, twoDaysAgo)
      total += users.length

      if (!dryRun) {
        for (const user of users) {
          if (!user.email || !user.created_at) {
            failed += 1
            continue
          }
          try {
            await syncUserOnLogin({
              email: user.email,
              firstName: user.full_name?.split(" ")[0] ?? null,
              isNewUser: false,
              onboardingComplete: user.onboarding_complete ?? false,
              signupAt: user.created_at,
            })
            synced += 1
          } catch {
            failed += 1
          }
          await new Promise<void>(resolve => setTimeout(resolve, 70))
        }
      }

      if (users.length < SYNC_BATCH_SIZE) break
      offset += SYNC_BATCH_SIZE
    }

    if (dryRun) return NextResponse.json({ dryRun: true, count: total, segment })

    const { error: campaignError } = await supabase.from("admin_email_campaigns").insert({
      segment,
      emails_sent: synced,
      emails_failed: failed,
      subject: `Manual ${segment} Brevo sync`,
      sent_by: adminEmail,
      sent_at: new Date().toISOString(),
    })
    if (campaignError) console.error("[admin/email-campaigns] failed to record sync:", campaignError)

    return NextResponse.json({ success: true, synced, failed, total, segment })
  } catch (error) {
    console.error("[admin/email-campaigns] sync failed:", error)
    return NextResponse.json({ error: "Failed to synchronize email contacts" }, { status: 500 })
  }
}
