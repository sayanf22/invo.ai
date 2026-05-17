/**
 * Admin Email Campaigns API
 *
 * GET  /api/admin/email-campaigns         — stats + users + campaign log
 * POST /api/admin/email-campaigns         — sync segment to Brevo lists
 *
 * Auth: verifyAdminSession() on all handlers.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { syncUserOnLogin } from "@/lib/brevo"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const supabase = getServiceClient()
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()

  const [
    { count: dropoffCount },
    { count: inactive7Count },
    { count: inactive14Count },
    { count: allActiveCount },
    { data: campaigns },
    // Fetch all users for the direct email picker
    { data: allUsers },
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
    supabase.from("profiles").select("id, email, full_name, onboarding_complete, last_active_at")
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ])

  return NextResponse.json({
    segmentCounts: {
      dropoff: dropoffCount ?? 0,
      inactive7: inactive7Count ?? 0,
      inactive14: inactive14Count ?? 0,
      allActive: allActiveCount ?? 0,
    },
    campaigns: campaigns ?? [],
    users: (allUsers ?? []).map((u: any) => ({
      id: u.id,
      email: u.email,
      name: u.full_name ?? null,
      onboarding_complete: u.onboarding_complete ?? false,
      last_active_at: u.last_active_at ?? null,
    })),
  })
}

// ── POST: sync segment ────────────────────────────────────────────────────────

const VALID_SEGMENTS = ["sync-dropoff", "sync-active", "sync-all"] as const
type Segment = (typeof VALID_SEGMENTS)[number]

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) return NextResponse.json({ error: "Not found" }, { status: 404 })

  let body: { segment: Segment; dryRun?: boolean }
  try { body = await request.json() }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  const { segment, dryRun = false } = body
  if (!VALID_SEGMENTS.includes(segment)) {
    return NextResponse.json({ error: "Invalid segment" }, { status: 400 })
  }

  const supabase = getServiceClient()
  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString()

  type UserRecord = { email: string; full_name: string | null; onboarding_complete: boolean; last_active_at: string | null; created_at: string }
  let users: UserRecord[] = []

  if (segment === "sync-dropoff") {
    const { data } = await supabase
      .from("profiles").select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", false)
      .or(`last_active_at.is.null,last_active_at.lt.${twoDaysAgo}`)
    users = (data ?? []).filter((u: any) => u.email)
  } else if (segment === "sync-active") {
    const { data } = await supabase
      .from("profiles").select("email, full_name, onboarding_complete, last_active_at, created_at")
      .eq("onboarding_complete", true)
    users = (data ?? []).filter((u: any) => u.email)
  } else {
    const { data } = await supabase
      .from("profiles").select("email, full_name, onboarding_complete, last_active_at, created_at")
    users = (data ?? []).filter((u: any) => u.email)
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, count: users.length, segment })
  }

  let synced = 0, failed = 0
  for (const u of users) {
    try {
      await syncUserOnLogin({
        email: u.email,
        firstName: u.full_name?.split(" ")[0] ?? null,
        isNewUser: false,
        onboardingComplete: u.onboarding_complete ?? false,
        signupAt: u.created_at,
      })
      synced++
    } catch { failed++ }
    await new Promise<void>((r) => setTimeout(r, 70))
  }

  try {
    await supabase.from("admin_email_campaigns").insert({
      segment, emails_sent: synced, emails_failed: failed,
      subject: `Manual ${segment} sync`, sent_by: adminEmail,
      sent_at: now.toISOString(),
    })
  } catch { /* non-critical */ }

  return NextResponse.json({
    success: true, synced, failed, total: users.length, segment,
    note: "Contacts synced to Brevo. Automation workflows send emails with timing and unsubscribe links.",
  })
}
