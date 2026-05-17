/**
 * POST /api/cron/brevo-sync
 *
 * Daily cron job that keeps Brevo contact lists in sync with Supabase.
 * This ensures Brevo automations fire correctly for:
 *   - Onboarding drop-off users (added to "Onboarding Started" list)
 *   - Active users (kept in "Active Users" list with updated LAST_ACTIVE)
 *
 * HOW IT WORKS:
 * 1. Queries Supabase for users needing list sync
 * 2. Adds/updates contacts in the correct Brevo list
 * 3. Brevo automation workflows send the emails — NOT this cron job
 *
 * Auth: Invoked by Supabase pg_cron via pg_net.http_post().
 * Sends x-cron-secret header matching CRON_SECRET env var.
 *
 * Schedule: Daily at 08:00 UTC (defined in Supabase migration).
 * Safe to call multiple times — upsert is idempotent.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { syncUserOnLogin } from "@/lib/brevo"

export const runtime = "nodejs"
export const maxDuration = 60

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error("Missing Supabase credentials")
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isAuthorized(request: NextRequest): boolean {
  const secret = request.headers.get("x-cron-secret")
  const envSecret = process.env.CRON_SECRET
  if (!envSecret) return false
  return secret === envSecret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()
  const now = new Date()

  // Fetch all users — we sync all of them daily to keep Brevo accurate
  // Brevo upsert is idempotent so this is safe
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, onboarding_complete, last_active_at, created_at")
    .not("email", "is", null)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[cron/brevo-sync] profiles fetch error:", error.message)
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }

  const users = profiles ?? []
  console.log(`[cron/brevo-sync] Syncing ${users.length} users to Brevo`)

  let synced = 0
  let failed = 0
  let skipped = 0

  for (const user of users) {
    if (!user.email) { skipped++; continue }

    try {
      await syncUserOnLogin({
        email: user.email,
        firstName: user.full_name?.split(" ")[0] ?? null,
        isNewUser: false,
        onboardingComplete: user.onboarding_complete ?? false,
        signupAt: user.created_at,
      })
      synced++
    } catch (err) {
      console.error(`[cron/brevo-sync] failed for ${user.email}:`, err)
      failed++
    }

    // Throttle: ~12/sec to stay within Brevo API rate limits
    await new Promise<void>((r) => setTimeout(r, 85))
  }

  const result = {
    success: true,
    total: users.length,
    synced,
    failed,
    skipped,
    timestamp: now.toISOString(),
  }

  console.log("[cron/brevo-sync]", result)

  // Log to admin_email_campaigns for visibility in admin dashboard
  try {
    await supabase.from("admin_email_campaigns").insert({
      segment: "cron-daily-sync",
      emails_sent: synced,
      emails_failed: failed,
      subject: `Daily Brevo sync — ${synced} contacts updated`,
      sent_by: "cron",
      sent_at: now.toISOString(),
    })
  } catch { /* non-critical */ }

  return NextResponse.json(result)
}
