/**
 * POST /api/cron/brevo-sync
 *
 * Smart daily cron for lifecycle email targeting.
 * Runs at 08:00 UTC every day via Supabase pg_cron.
 *
 * EMAIL TARGETING RULES (strict — no duplicates, no spam):
 *
 *  DROP-OFF (never completed onboarding, went idle):
 *    Email 1 — sent once if: idle 2–5 days since signup AND never got dropoff_1
 *    Email 2 — sent once if: idle 6–14 days since signup AND got dropoff_1 AND never got dropoff_2
 *    Stop    — if active today OR day 15+ since signup
 *
 *  INACTIVE (completed onboarding, stopped using app):
 *    Email 1 — sent once if: idle 7–13 days AND never got inactive_1
 *    Email 2 — sent once if: idle 14–30 days AND got inactive_1 AND never got inactive_2
 *    Stop    — if active today OR day 30+ idle
 *
 *    IMPORTANT: "active on day 7" = if user logged in on day 6 or 7, do NOT send
 *    If a user comes back after getting inactive_1 and goes idle again 7+ days later,
 *    inactive_1 is already in the DB so they skip straight to eligible for inactive_2.
 *
 *  RE-ENTRY (user was inactive, came back, went idle again):
 *    If > 30 days since their last inactive email AND they've been idle 7+ days again,
 *    we reset their send log (delete old entries) so they re-enter the sequence.
 *    This handles users who come back every 15 days.
 *
 * HOW IT WORKS:
 *   1. Query Supabase for users + their email send history
 *   2. Determine eligibility for each email type
 *   3. Add eligible users to the correct Brevo list (triggers automation)
 *   4. Record the send in user_email_send_log (prevents duplicates)
 *
 * Auth: x-cron-secret header must match CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 60

const BASE = "https://api.brevo.com/v3"

function getServiceClient(): SupabaseClient {
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

async function brevoAdd(email: string, listId: number, attrs: Record<string, unknown>) {
  const apiKey = process.env.BREVO_API_KEY ?? ""
  if (!apiKey) return false
  try {
    const res = await fetch(`${BASE}/contacts`, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, listIds: [listId], updateEnabled: true, attributes: attrs }),
    })
    return res.ok
  } catch { return false }
}

async function recordSend(supabase: SupabaseClient, userId: string, emailType: string): Promise<boolean> {
  const { error } = await supabase.from("user_email_send_log").upsert(
    { user_id: userId, email_type: emailType, sent_at: new Date().toISOString() },
    { onConflict: "user_id,email_type" }
  )
  return !error
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()
  const now = new Date()
  const today = now.toISOString()

  const ONBOARDING_LIST = Number(process.env.BREVO_ONBOARDING_LIST_ID ?? 4)
  const ACTIVE_LIST = Number(process.env.BREVO_ACTIVE_LIST_ID ?? 5)

  // Fetch all users with business data for personalization
  const { data: profiles, error: profilesErr } = await supabase
    .from("profiles")
    .select(`
      id, email, full_name, onboarding_complete,
      last_active_at, created_at,
      businesses!left(business_type)
    `)
    .not("email", "is", null)

  if (profilesErr || !profiles) {
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }

  // Fetch all email send logs in one query
  const userIds = profiles.map((p: any) => p.id)
  const { data: sendLogs } = await supabase
    .from("user_email_send_log")
    .select("user_id, email_type, sent_at")
    .in("user_id", userIds)

  // Build a lookup: userId → Set of email types already sent
  const sentMap = new Map<string, Map<string, Date>>()
  for (const log of sendLogs ?? []) {
    if (!sentMap.has(log.user_id)) sentMap.set(log.user_id, new Map())
    sentMap.get(log.user_id)!.set(log.email_type, new Date(log.sent_at))
  }

  // Fetch document counts for personalization
  const { data: docRows } = await supabase
    .from("document_sessions")
    .select("user_id")
    .in("user_id", userIds)

  const docCount = new Map<string, number>()
  for (const r of docRows ?? []) {
    docCount.set(r.user_id, (docCount.get(r.user_id) ?? 0) + 1)
  }

  const stats = {
    dropoff1: 0, dropoff2: 0,
    inactive1: 0, inactive2: 0,
    reset: 0, skipped: 0,
  }

  for (const user of profiles as any[]) {
    if (!user.email) { stats.skipped++; continue }

    const uid = user.id
    const firstName = user.full_name?.split(" ")[0] ?? null
    const businessType = user.businesses?.[0]?.business_type ?? null
    const docsCount = docCount.get(uid) ?? 0
    const sent = sentMap.get(uid) ?? new Map<string, Date>()

    const signedUp = user.created_at ? new Date(user.created_at) : now
    const lastActive = user.last_active_at
      ? new Date(user.last_active_at)
      : signedUp

    const daysSinceSignup = (now.getTime() - signedUp.getTime()) / 86400000
    const daysSinceActive = (now.getTime() - lastActive.getTime()) / 86400000

    // Base personalization attributes (always include — never changes LAST_ACTIVE)
    const baseAttrs = {
      ...(firstName ? { FIRSTNAME: firstName.slice(0, 64) } : {}),
      ...(businessType ? { BUSINESS_TYPE: businessType.slice(0, 100) } : {}),
      DOCS_COUNT: docsCount,
      ONBOARDING_COMPLETE: user.onboarding_complete ?? false,
      SIGNUP_AT: signedUp.toISOString().split("T")[0],
    }

    // ── CASE 1: Drop-off (never completed onboarding) ────────────────────────
    if (!user.onboarding_complete) {
      // If active very recently (< 1 day), skip — they might still be onboarding
      if (daysSinceActive < 1) { stats.skipped++; continue }

      const gotDropoff1 = sent.has("dropoff_1")
      const gotDropoff2 = sent.has("dropoff_2")

      // Email 1: 2–5 days idle, never got it
      if (daysSinceSignup >= 2 && daysSinceSignup <= 5 && !gotDropoff1) {
        const ok = await brevoAdd(user.email, ONBOARDING_LIST, baseAttrs)
        if (ok) {
          await recordSend(supabase, uid, "dropoff_1")
          stats.dropoff1++
        }
      }
      // Email 2: 6–14 days idle, got email 1, never got email 2
      else if (daysSinceSignup > 5 && daysSinceSignup <= 14 && gotDropoff1 && !gotDropoff2) {
        // Don't re-add to list (already there), just mark as eligible for automation step 2
        // The automation workflow handles timing of email 2 after email 1
        await recordSend(supabase, uid, "dropoff_2")
        stats.dropoff2++
      }
      // Day 15+: stop completely — remove from list
      else if (daysSinceSignup > 14 && gotDropoff1) {
        await fetch(`${BASE}/contacts/lists/${ONBOARDING_LIST}/contacts/remove`, {
          method: "POST",
          headers: { "api-key": process.env.BREVO_API_KEY ?? "", "Content-Type": "application/json" },
          body: JSON.stringify({ emails: [user.email] }),
        }).catch(() => {})
        stats.skipped++
      } else {
        stats.skipped++
      }
    }

    // ── CASE 2: Completed onboarding — inactivity check ──────────────────────
    else {
      // Active in the last 24 hours → definitely do NOT send. Full stop.
      if (daysSinceActive < 1) { stats.skipped++; continue }

      // Active in last 6 days → not yet at 7 day threshold. Do nothing.
      if (daysSinceActive < 7) { stats.skipped++; continue }

      const gotInactive1 = sent.has("inactive_1")
      const gotInactive2 = sent.has("inactive_2")
      const inactive1SentAt = sent.get("inactive_1")
      const inactive2SentAt = sent.get("inactive_2")

      // Re-entry reset: user went inactive, got emails, came back, went inactive AGAIN
      // If it's been 30+ days since their last inactive email AND they're idle 7+ days
      const daysSinceLastEmail = inactive2SentAt
        ? (now.getTime() - inactive2SentAt.getTime()) / 86400000
        : inactive1SentAt
        ? (now.getTime() - inactive1SentAt.getTime()) / 86400000
        : Infinity

      if (daysSinceLastEmail > 30 && daysSinceActive >= 7) {
        // Reset their send history so they re-enter the sequence
        await supabase
          .from("user_email_send_log")
          .delete()
          .eq("user_id", uid)
          .in("email_type", ["inactive_1", "inactive_2"])
        
        // Re-add to active list to re-trigger automation
        const ok = await brevoAdd(user.email, ACTIVE_LIST, {
          ...baseAttrs,
          ONBOARDING_COMPLETE: true,
        })
        if (ok) {
          await recordSend(supabase, uid, "inactive_1")
          stats.reset++
          stats.inactive1++
        }
        continue
      }

      // Email 1: idle 7–13 days, never got it
      if (daysSinceActive >= 7 && daysSinceActive <= 13 && !gotInactive1) {
        const ok = await brevoAdd(user.email, ACTIVE_LIST, {
          ...baseAttrs,
          ONBOARDING_COMPLETE: true,
        })
        if (ok) {
          await recordSend(supabase, uid, "inactive_1")
          stats.inactive1++
        }
      }
      // Email 2: idle 14–30 days, got email 1, never got email 2
      else if (daysSinceActive >= 14 && daysSinceActive <= 30 && gotInactive1 && !gotInactive2) {
        // Mark eligible for email 2 in the automation sequence
        await recordSend(supabase, uid, "inactive_2")
        stats.inactive2++
      }
      // 30+ days inactive: stop all emails for this cycle
      else {
        stats.skipped++
      }
    }

    // Rate limit: ~12 users/sec — Brevo free tier is fine
    await new Promise<void>((r) => setTimeout(r, 85))
  }

  const summary = {
    success: true,
    total: profiles.length,
    ...stats,
    timestamp: today,
  }
  console.log("[cron/brevo-sync]", summary)

  // Log to admin dashboard
  try {
    await supabase.from("admin_email_campaigns").insert({
      segment: "cron-smart-sync",
      emails_sent: stats.dropoff1 + stats.dropoff2 + stats.inactive1 + stats.inactive2,
      emails_failed: 0,
      subject: `Smart sync — dropoff:${stats.dropoff1 + stats.dropoff2} inactive:${stats.inactive1 + stats.inactive2} reset:${stats.reset}`,
      sent_by: "cron",
      sent_at: today,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(summary)
}
