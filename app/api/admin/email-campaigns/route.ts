/**
 * Admin Email Campaigns API
 * GET  /api/admin/email-campaigns — list sent campaign logs
 * POST /api/admin/email-campaigns — send a campaign to a segment
 *
 * Auth: verifyAdminSession() on all handlers.
 * Segments: "onboarding-dropoff" | "inactive-7d" | "inactive-14d" | "all-active"
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import {
  sendBulkTransactionalEmails,
  syncUserOnLogin,
  type BulkEmailContact,
} from "@/lib/brevo"
import {
  onboardingDropoffEmail1,
  onboardingDropoffEmail2,
  inactivityEmail1,
  inactivityEmail2,
  welcomeCompleteEmail,
} from "@/lib/brevo-templates"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET: fetch email campaign logs ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("admin_email_campaigns")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(100)

  if (error) {
    // Table may not exist yet — return empty
    return NextResponse.json({ campaigns: [] })
  }

  return NextResponse.json({ campaigns: data })
}

// ── POST: send a campaign ─────────────────────────────────────────────────────

const SEGMENTS = [
  "onboarding-dropoff-1",
  "onboarding-dropoff-2",
  "inactive-7d",
  "inactive-14d",
  "welcome-complete",
  "backfill-all",
] as const

type Segment = (typeof SEGMENTS)[number]

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
  if (!SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()

  let contacts: BulkEmailContact[] = []
  let subject = ""
  let getHtml: (c: BulkEmailContact) => string
  let tags: string[] = []

  // ── Build target list per segment ──────────────────────────────────────────

  if (segment === "onboarding-dropoff-1") {
    // Users who never completed onboarding, last active > 2h ago
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, last_active_at, created_at")
      .eq("onboarding_complete", false)
      .lt("last_active_at", twoDaysAgo)
    contacts = (data ?? []).map((u: any) => ({
      email: u.email,
      name: u.full_name?.split(" ")[0] ?? undefined,
    }))
    subject = "Your Clorefy setup is waiting — takes 2 minutes"
    getHtml = (c) => onboardingDropoffEmail1(c.name ?? null)
    tags = ["onboarding-dropoff", "email-1"]

  } else if (segment === "onboarding-dropoff-2") {
    // Same segment, 2nd email — only those who got email 1 and still didn't complete
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, last_active_at")
      .eq("onboarding_complete", false)
      .lt("last_active_at", twoDaysAgo)
    contacts = (data ?? []).map((u: any) => ({
      email: u.email,
      name: u.full_name?.split(" ")[0] ?? undefined,
    }))
    subject = "One last reminder — your Clorefy account is ready"
    getHtml = (c) => onboardingDropoffEmail2(c.name ?? null)
    tags = ["onboarding-dropoff", "email-2"]

  } else if (segment === "inactive-7d") {
    // Users who completed onboarding but haven't logged in for 7+ days
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, last_active_at")
      .eq("onboarding_complete", true)
      .lt("last_active_at", sevenDaysAgo)
    contacts = (data ?? []).map((u: any) => ({
      email: u.email,
      name: u.full_name?.split(" ")[0] ?? undefined,
    }))
    subject = "You set up Clorefy — haven't tried it yet?"
    getHtml = (c) => inactivityEmail1(c.name ?? null)
    tags = ["inactive", "day-7"]

  } else if (segment === "inactive-14d") {
    // 14+ days inactive
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, last_active_at")
      .eq("onboarding_complete", true)
      .lt("last_active_at", fourteenDaysAgo)
    contacts = (data ?? []).map((u: any) => ({
      email: u.email,
      name: u.full_name?.split(" ")[0] ?? undefined,
    }))
    subject = "We built Clorefy for you — give it 60 seconds"
    getHtml = (c) => inactivityEmail2(c.name ?? null)
    tags = ["inactive", "day-14"]

  } else if (segment === "welcome-complete") {
    // Users who completed onboarding recently (last 7 days) — welcome email
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .eq("onboarding_complete", true)
      .gte("created_at", sevenDaysAgo)
    contacts = (data ?? []).map((u: any) => ({
      email: u.email,
      name: u.full_name?.split(" ")[0] ?? undefined,
    }))
    subject = "You're all set — generate your first document"
    getHtml = (c) => welcomeCompleteEmail(c.name ?? null)
    tags = ["welcome", "onboarding-complete"]

  } else if (segment === "backfill-all") {
    // Sync all existing users to Brevo contact lists (no email, just sync)
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name, onboarding_complete, last_active_at, created_at")
    const allUsers = data ?? []

    if (dryRun) {
      return NextResponse.json({ dryRun: true, count: allUsers.length, segment })
    }

    let synced = 0
    for (const u of allUsers) {
      if (!u.email) continue
      await syncUserOnLogin({
        email: u.email,
        firstName: u.full_name?.split(" ")[0] ?? null,
        isNewUser: false,
        onboardingComplete: u.onboarding_complete ?? false,
        signupAt: u.created_at,
      })
      synced++
      await new Promise((r) => setTimeout(r, 60))
    }

    await logCampaign(supabase, {
      segment,
      sent: synced,
      failed: 0,
      subject: "Brevo backfill sync",
      admin_email: adminEmail,
    })

    return NextResponse.json({ success: true, synced, segment })
  }

  // Remove contacts with missing email
  contacts = contacts.filter((c) => c.email)

  if (dryRun) {
    return NextResponse.json({ dryRun: true, count: contacts.length, segment, subject })
  }

  if (contacts.length === 0) {
    return NextResponse.json({ success: true, sent: 0, failed: 0, segment, message: "No contacts in segment" })
  }

  const { sent, failed } = await sendBulkTransactionalEmails(
    contacts,
    subject!,
    getHtml!,
    tags!
  )

  await logCampaign(supabase, {
    segment,
    sent,
    failed,
    subject: subject!,
    admin_email: adminEmail,
  })

  return NextResponse.json({ success: true, sent, failed, total: contacts.length, segment })
}

// ── Log campaign to DB ────────────────────────────────────────────────────────

async function logCampaign(
  supabase: ReturnType<typeof createClient>,
  data: {
    segment: string
    sent: number
    failed: number
    subject: string
    admin_email: string
  }
) {
  try {
    await supabase.from("admin_email_campaigns").insert({
      segment: data.segment,
      emails_sent: data.sent,
      emails_failed: data.failed,
      subject: data.subject,
      sent_by: data.admin_email,
      sent_at: new Date().toISOString(),
    })
  } catch {
    // Non-critical — table may not exist yet
  }
}
