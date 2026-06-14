/**
 * POST /api/cron/brevo-sync
 * Runs daily at 08:00 UTC via Supabase pg_cron.
 *
 * ── EXACT EMAIL RULES ──────────────────────────────────────────────────────────
 *
 * For INACTIVE users (completed onboarding):
 *
 *   1. User goes idle (last_active_at stops updating).
 *   2. On day 7 of idle → send Email 1.
 *   3. Wait 7 more days (from Email 1 send date, NOT from last_active_at).
 *   4. On day 7 after Email 1 → IF still idle → send Email 2.
 *   5. AUTO STOP. No more emails regardless of inactivity.
 *
 *   IF the user returns (logs in) at ANY point:
 *   - Middleware updates last_active_at → timer resets to 0
 *   - Cron deletes their inactive send logs → fresh 7-day clock starts
 *   - They'll get Email 1 again if they go idle 7+ days after returning
 *
 *   Example timeline:
 *   Day 0: active. Day 4: active (logs in, timer → 0). Day 11 (4+7): Email 1.
 *   Day 18: Email 2. Day 18+: STOP.
 *   If user logs in on day 15 → logs cleared, timer restarts. Day 22: Email 1 again.
 *
 * For DROP-OFF users (never completed onboarding):
 *   Day 2 idle → Email 1. Day 6 → Email 2. Day 15+ → STOP.
 *   If user comes back and completes onboarding → switch to inactive track.
 *
 * ── WHAT THIS CRON DOES ───────────────────────────────────────────────────────
 *   1. Check each user's idle days and email history
 *   2. If eligible: add to Brevo list → Brevo automation sends email
 *   3. Record in user_email_send_log with timestamp
 *   4. On user return (detected via last_active_at reset): delete old logs
 *
 * Auth: x-cron-secret header required.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 60

const BASE = "https://api.brevo.com/v3"

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase credentials")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function isAuthorized(req: NextRequest): boolean {
  return req.headers.get("x-cron-secret") === (process.env.CRON_SECRET ?? "")
}

async function brevoAdd(email: string, listId: number, attrs: Record<string, unknown>): Promise<boolean> {
  const key = process.env.BREVO_API_KEY ?? ""
  if (!key) return false
  try {
    const r = await fetch(`${BASE}/contacts`, {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, listIds: [listId], updateEnabled: true, attributes: attrs }),
    })
    return r.ok
  } catch { return false }
}

async function brevoRemove(email: string, listId: number): Promise<void> {
  const key = process.env.BREVO_API_KEY ?? ""
  if (!key) return
  await fetch(`${BASE}/contacts/lists/${listId}/contacts/remove`, {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ emails: [email] }),
  }).catch(() => {})
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = getServiceClient()
  const now = new Date()
  const todayStr = now.toISOString()

  const ONBOARDING_LIST = Number(process.env.BREVO_ONBOARDING_LIST_ID ?? 4)
  const ACTIVE_LIST = Number(process.env.BREVO_ACTIVE_LIST_ID ?? 5)

  // ── Fetch all data upfront ────────────────────────────────────────────────

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, email, full_name, onboarding_complete, last_active_at, created_at, suspended_at, businesses!left(business_type)")
    .not("email", "is", null)

  if (pErr || !profiles) return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })

  const userIds = profiles.map((p: any) => p.id)

  const [{ data: sendLogs }, { data: docRows }] = await Promise.all([
    supabase.from("user_email_send_log").select("user_id, email_type, sent_at").in("user_id", userIds),
    supabase.from("document_sessions").select("user_id").in("user_id", userIds),
  ])

  // Build lookups
  const sentMap = new Map<string, Map<string, Date>>()
  for (const log of sendLogs ?? []) {
    if (!sentMap.has(log.user_id)) sentMap.set(log.user_id, new Map())
    sentMap.get(log.user_id)!.set(log.email_type, new Date(log.sent_at))
  }

  const docCount = new Map<string, number>()
  for (const r of docRows ?? []) {
    docCount.set(r.user_id, (docCount.get(r.user_id) ?? 0) + 1)
  }

  // ── Process each user ─────────────────────────────────────────────────────

  const stats = { dropoff1: 0, dropoff2: 0, inactive1: 0, inactive2: 0, reset: 0, stopped: 0, skipped: 0 }

  for (const user of profiles as any[]) {
    if (!user.email) { stats.skipped++; continue }

    // ── Suspended users: never send re-engagement emails. Pull them from both
    // Brevo lists so any in-flight automation stops, then skip. Their data is
    // retained — this only affects marketing/automation emails.
    if (user.suspended_at) {
      await brevoRemove(user.email, ONBOARDING_LIST)
      await brevoRemove(user.email, ACTIVE_LIST)
      stats.skipped++
      continue
    }

    const uid: string = user.id
    const sent = sentMap.get(uid) ?? new Map<string, Date>()
    const firstName = user.full_name?.split(" ")[0] ?? null
    const businessType = user.businesses?.[0]?.business_type ?? null
    const docsCount = docCount.get(uid) ?? 0

    const signedUp = new Date(user.created_at ?? now)
    // LAST_ACTIVE is the single source of truth for the idle timer.
    // It's updated by middleware on every real login (via updateLastActive).
    const lastActive = user.last_active_at ? new Date(user.last_active_at) : signedUp

    const daysSinceSignup = (now.getTime() - signedUp.getTime()) / 86400000
    const daysSinceActive = (now.getTime() - lastActive.getTime()) / 86400000

    const baseAttrs = {
      ...(firstName ? { FIRSTNAME: firstName.slice(0, 64) } : {}),
      ...(businessType ? { BUSINESS_TYPE: businessType.slice(0, 100) } : {}),
      DOCS_COUNT: docsCount,
      ONBOARDING_COMPLETE: user.onboarding_complete ?? false,
      SIGNUP_AT: signedUp.toISOString().split("T")[0],
    }

    // ── DROP-OFF: never completed onboarding ──────────────────────────────────
    if (!user.onboarding_complete) {
      if (daysSinceActive < 2) { stats.skipped++; continue } // still potentially onboarding

      const gotD1 = sent.has("dropoff_1")
      const gotD2 = sent.has("dropoff_2")
      const d1SentAt = sent.get("dropoff_1")

      // If user returned (last_active reset after dropoff_1 was sent) → clear logs
      if (gotD1 && d1SentAt && lastActive > d1SentAt) {
        await supabase.from("user_email_send_log")
          .delete().eq("user_id", uid).in("email_type", ["dropoff_1", "dropoff_2"])
        await brevoRemove(user.email, ONBOARDING_LIST)
        stats.reset++
        // Don't send email immediately — let them settle, next cron will handle
        continue
      }

      if (daysSinceSignup < 2) { stats.skipped++; continue }

      if (!gotD1 && daysSinceSignup <= 5) {
        const ok = await brevoAdd(user.email, ONBOARDING_LIST, baseAttrs)
        if (ok) { await recordSend(supabase, uid, "dropoff_1"); stats.dropoff1++ }
      }
      else if (gotD1 && !gotD2 && d1SentAt) {
        // Email 2: 7 days after Email 1, not 7 days after signup
        const daysSinceEmail1 = (now.getTime() - d1SentAt.getTime()) / 86400000
        if (daysSinceEmail1 >= 7) {
          await recordSend(supabase, uid, "dropoff_2") // marks as due; automation sends
          stats.dropoff2++
        }
      }
      else if (gotD2 || daysSinceSignup > 30) {
        // Permanently stopped — remove from list
        await brevoRemove(user.email, ONBOARDING_LIST)
        stats.stopped++
      } else {
        stats.skipped++
      }
    }

    // ── INACTIVE: completed onboarding ────────────────────────────────────────
    else {
      const gotI1 = sent.has("inactive_1")
      const gotI2 = sent.has("inactive_2")
      const i1SentAt = sent.get("inactive_1")
      const i2SentAt = sent.get("inactive_2")

      // ── KEY RULE: if user returned after an email was sent, reset everything ──
      // "Returned" means last_active_at was updated AFTER the last email was sent.
      // This restarts their 7-day idle clock completely.
      const lastEmailSentAt = i2SentAt ?? i1SentAt
      if (lastEmailSentAt && lastActive > lastEmailSentAt) {
        // User came back after receiving an email — delete their email history
        // so the 7-day timer starts fresh from their last login
        await supabase.from("user_email_send_log")
          .delete().eq("user_id", uid).in("email_type", ["inactive_1", "inactive_2"])
        stats.reset++
        // Don't send anything now — let next cron handle when they go idle again
        continue
      }

      // User active in last 7 days → don't send anything
      if (daysSinceActive < 7) { stats.skipped++; continue }

      // Auto-stopped after Email 2: never send again automatically
      // (Admin can always send manual email from dashboard)
      if (gotI2) { stats.stopped++; continue }

      // Email 1: idle 7+ days, never got it
      if (!gotI1) {
        const ok = await brevoAdd(user.email, ACTIVE_LIST, { ...baseAttrs, ONBOARDING_COMPLETE: true })
        if (ok) { await recordSend(supabase, uid, "inactive_1"); stats.inactive1++ }
      }
      // Email 2: idle 7+ days AFTER Email 1 was sent (not 14 days since last_active)
      else if (gotI1 && !gotI2 && i1SentAt) {
        const daysSinceEmail1 = (now.getTime() - i1SentAt.getTime()) / 86400000
        if (daysSinceEmail1 >= 7) {
          // Still idle 7+ days after Email 1 → send Email 2
          // Also check they haven't returned between Email 1 and now
          // (already handled above by the lastActive > lastEmailSentAt check)
          const ok = await brevoAdd(user.email, ACTIVE_LIST, { ...baseAttrs, ONBOARDING_COMPLETE: true })
          if (ok) { await recordSend(supabase, uid, "inactive_2"); stats.inactive2++ }
        } else {
          stats.skipped++ // waiting for 7-day window after Email 1
        }
      }
    }

    await new Promise<void>((r) => setTimeout(r, 85)) // ~12/sec rate limit
  }

  const result = { success: true, total: profiles.length, ...stats, timestamp: todayStr }
  console.log("[cron/brevo-sync]", result)

  try {
    await supabase.from("admin_email_campaigns").insert({
      segment: "cron-daily",
      emails_sent: stats.dropoff1 + stats.dropoff2 + stats.inactive1 + stats.inactive2,
      emails_failed: 0,
      subject: `Cron — inact:${stats.inactive1}/${stats.inactive2} dropoff:${stats.dropoff1}/${stats.dropoff2} reset:${stats.reset} stopped:${stats.stopped}`,
      sent_by: "cron",
      sent_at: todayStr,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(result)
}

// ── Helper ────────────────────────────────────────────────────────────────────

async function recordSend(supabase: SupabaseClient, userId: string, emailType: string): Promise<void> {
  await supabase.from("user_email_send_log").upsert(
    { user_id: userId, email_type: emailType, sent_at: new Date().toISOString() },
    { onConflict: "user_id,email_type" }
  )
}
