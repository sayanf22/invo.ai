/**
 * Admin Email Campaigns API
 * GET  /api/admin/email-campaigns  — campaign log + segment counts
 * POST /api/admin/email-campaigns  — sync segment contacts to Brevo lists
 *                                    (triggers Brevo automations, NOT raw SMTP sends)
 * POST /api/admin/email-campaigns/direct — send a direct 1:1 email to a user
 *
 * HOW IT WORKS (important — read before editing):
 *
 * We do NOT send bulk emails via the Brevo transactional API.
 * That would violate Brevo ToS and CAN-SPAM (no unsubscribe link).
 *
 * Instead, this endpoint:
 *  1. Queries Supabase for users matching the segment criteria
 *  2. Adds/updates those contacts in the correct Brevo list
 *  3. Brevo's automation workflow then fires the emails with proper
 *     unsubscribe links, timing, and compliance headers
 *
 * Auth: verifyAdminSession() on all handlers.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import {
  syncUserOnLogin,
  sendTransactionalEmail,
  isContactBlocked,
} from "@/lib/brevo"
import { adminDirectEmailTemplate } from "@/lib/brevo-templates"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET: segment counts + campaign history ────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const supabase = getServiceClient()
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: dropoffCount },
    { count: inactive7Count },
    { count: inactive14Count },
    { count: allActiveCount },
    { data: campaigns },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("onboarding_complete", false)
      .or(`last_active_at.is.null,last_active_at.lt.${twoDaysAgo}`),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .or(`last_active_at.is.null,last_active_at.lt.${sevenDaysAgo}`),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true)
      .or(`last_active_at.is.null,last_active_at.lt.${fourteenDaysAgo}`),
    supabase.from("profiles").select("id", { count: "exact", head: true })
      .eq("onboarding_complete", true),
    supabase.from("admin_email_campaigns").select("*")
      .order("sent_at", { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    segmentCounts: {
      dropoff: dropoffCount ?? 0,
      inactive7: inactive7Count ?? 0,
      inactive14: inactive14Count ?? 0,
      allActive: allActiveCount ?? 0,
    },
    campaigns: campaigns ?? [],
  })
}

// ── POST: sync segment to Brevo lists (triggers automations) ──────────────────

const VALID_SEGMENTS = [
  "sync-dropoff",      // sync drop-off users to Onboarding Started list
  "sync-active",       // sync active users to Active Users list
  "sync-all",          // full backfill sync of all users
] as const

type Segment = (typeof VALID_SEGMENTS)[number]

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: { segment: Segment; dryRun?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { segment, dryRun = false } = body
  if (!VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json(
      { error: `Invalid segment. Valid: ${VALID_SEGMENTS.join(", ")}` },
      { status: 400 }
    )
  }

  const supabase = getServiceClient()
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

  let users: Array<{ email: string; full_name: string | null; onboarding_complete: boolean; last_active_at: string | null; created_at: string }> = []
  let description = ""

  if (segment === "sync-dropoff") {
    const { data } = await supabase
      .from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", false)
      .or(`last_active_at.is.null,last_active_at.lt.${twoDaysAgo}`)
    users = (data ?? []).filter((u: any) => u.email)
    description = "Sync onboarding drop-off users → Brevo Onboarding Started list (triggers drop-off automation)"

  } else if (segment === "sync-active") {
    const { data } = await supabase
      .from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", true)
    users = (data ?? []).filter((u: any) => u.email)
    description = "Sync active users → Brevo Active Users list (triggers inactivity automation)"

  } else if (segment === "sync-all") {
    const { data } = await supabase
      .from("profiles")
      .select("email, full_name, onboarding_complete, last_active_at, created_at")
    users = (data ?? []).filter((u: any) => u.email)
    description = "Full backfill sync of all users to Brevo"
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: users.length,
      segment,
      description,
      sample: users.slice(0, 3).map(u => u.email),
    })
  }

  if (users.length === 0) {
    return NextResponse.json({ success: true, synced: 0, segment, message: "No users in segment" })
  }

  // Sync contacts to Brevo — this triggers the automation workflows
  let synced = 0
  let failed = 0

  for (const u of users) {
    try {
      const isNewUser = false // these are existing users
      await syncUserOnLogin({
        email: u.email,
        firstName: u.full_name?.split(" ")[0] ?? null,
        isNewUser,
        onboardingComplete: u.onboarding_complete ?? false,
        signupAt: u.created_at,
      })
      synced++
    } catch {
      failed++
    }
    // Throttle: ~15 per second to avoid Brevo rate limits
    await new Promise<void>((r) => setTimeout(r, 70))
  }

  // Log to DB
  try {
    await supabase.from("admin_email_campaigns").insert({
      segment,
      emails_sent: synced,
      emails_failed: failed,
      subject: description,
      sent_by: adminEmail,
      sent_at: new Date().toISOString(),
    })
  } catch { /* non-critical */ }

  return NextResponse.json({
    success: true,
    synced,
    failed,
    total: users.length,
    segment,
    note: "Contacts synced to Brevo. Automation workflows will send emails with proper timing and unsubscribe links.",
  })
}
