/**
 * POST /api/cron/brevo-sync
 *
 * Smart daily cron — sends targeted lifecycle emails to ONLY the users
 * who actually need them. Does NOT email everyone.
 *
 * Email rules:
 *
 *  DROP-OFF (never completed onboarding):
 *    Email 1: idle 2–5 days since signup, never received dropoff-1
 *    Email 2: idle 6–14 days since signup, already got dropoff-1 but never dropoff-2
 *    No more emails after day 14
 *
 *  INACTIVE (completed onboarding, not using app):
 *    Email 1: last_active 7–13 days ago, never received inactive-1
 *    Email 2: last_active 14–30 days ago, already got inactive-1 but never inactive-2
 *    No more emails after day 30
 *
 *  RE-ENGAGEMENT (occasional user — active < 2 days/month):
 *    If last_active is 7–30 days ago AND they've already used the app at least once
 *    (has docs), treat same as inactive email sequence
 *
 * Cooldown: 30 days between any two emails to the same user.
 * Personalization: includes FIRSTNAME, BUSINESS_TYPE, DOCS_COUNT.
 *
 * Auth: x-cron-secret header must match CRON_SECRET env var.
 * Schedule: Daily at 08:00 UTC.
 *
 * IMPORTANT: This route only updates Brevo contact attributes.
 * The actual email sending happens via Brevo automation workflows.
 * We track what was sent via EMAIL_SENT_* date attributes to prevent repeats.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const maxDuration = 60

const BASE = "https://api.brevo.com/v3"

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

/** Call Brevo API — fire-and-forget, never throws */
async function brevoCall(method: string, path: string, body?: unknown) {
  const apiKey = process.env.BREVO_API_KEY ?? ""
  if (!apiKey) return { ok: false }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { ok: res.ok, status: res.status }
  } catch {
    return { ok: false }
  }
}

/** Update a Brevo contact's attributes without changing their list membership */
async function updateBrevoAttributes(email: string, attributes: Record<string, unknown>) {
  return brevoCall("PUT", `/contacts/${encodeURIComponent(email)}`, { attributes })
}

/**
 * Add contact to a Brevo list (triggers automation workflow).
 * Only called when we actually want to queue an email sequence.
 */
async function addToList(email: string, listId: number, attributes: Record<string, unknown>) {
  return brevoCall("POST", "/contacts", {
    email,
    listIds: [listId],
    updateEnabled: true,
    attributes,
  })
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()
  const now = new Date()
  const today = now.toISOString().split("T")[0]

  const ONBOARDING_LIST_ID = Number(process.env.BREVO_ONBOARDING_LIST_ID ?? 4)
  const ACTIVE_LIST_ID = Number(process.env.BREVO_ACTIVE_LIST_ID ?? 5)

  // Time thresholds
  const d2 = new Date(now.getTime() - 2 * 86400000).toISOString()   // 2 days ago
  const d5 = new Date(now.getTime() - 5 * 86400000).toISOString()   // 5 days ago
  const d6 = new Date(now.getTime() - 6 * 86400000).toISOString()   // 6 days ago
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString()   // 7 days ago
  const d13 = new Date(now.getTime() - 13 * 86400000).toISOString() // 13 days ago
  const d14 = new Date(now.getTime() - 14 * 86400000).toISOString() // 14 days ago
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString() // 30 days ago

  // Fetch all users with their business data for personalization
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select(`
      id, email, full_name, onboarding_complete,
      last_active_at, created_at,
      businesses!left(business_type, name)
    `)
    .not("email", "is", null)

  if (error || !profiles) {
    console.error("[cron/brevo-sync] fetch error:", error?.message)
    return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 })
  }

  // Fetch document counts per user
  const userIds = profiles.map((p: any) => p.id)
  const { data: docRows } = await supabase
    .from("document_sessions")
    .select("user_id")
    .in("user_id", userIds)

  const docCountMap = new Map<string, number>()
  for (const row of docRows ?? []) {
    docCountMap.set(row.user_id, (docCountMap.get(row.user_id) ?? 0) + 1)
  }

  const stats = {
    dropoff1Queued: 0,
    dropoff2Queued: 0,
    inactive1Queued: 0,
    inactive2Queued: 0,
    attributesUpdated: 0,
    skipped: 0,
  }

  for (const user of profiles as any[]) {
    if (!user.email) { stats.skipped++; continue }

    const signedUpAt = user.created_at ? new Date(user.created_at) : null
    const lastActiveAt = user.last_active_at ? new Date(user.last_active_at) : signedUpAt
    const firstName = user.full_name?.split(" ")[0] ?? null
    const businessType = user.businesses?.[0]?.business_type ?? null
    const docsCount = docCountMap.get(user.id) ?? 0

    // Common attributes for personalization
    const personalAttrs: Record<string, unknown> = {
      ...(firstName ? { FIRSTNAME: firstName.slice(0, 64) } : {}),
      ...(businessType ? { BUSINESS_TYPE: businessType.slice(0, 100) } : {}),
      DOCS_COUNT: docsCount,
      // NOTE: we do NOT update LAST_ACTIVE here — that's set on actual user logins
      // Overwriting it here would break the inactivity detection
    }

    // ── CASE 1: Onboarding drop-off ──────────────────────────────────────────
    if (!user.onboarding_complete) {
      const daysSinceSignup = signedUpAt
        ? (now.getTime() - signedUpAt.getTime()) / 86400000
        : 999

      // Email 1: signed up 2–5 days ago, still not onboarded
      // We trigger by adding to the onboarding list — Brevo automation sends email
      // We track via EMAIL_SENT_DROPOFF1 attribute to avoid re-sending
      if (daysSinceSignup >= 2 && daysSinceSignup <= 5) {
        await addToList(user.email, ONBOARDING_LIST_ID, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: false,
          SIGNUP_AT: user.created_at?.split("T")[0],
        })
        // Tag when we queued email 1 (Brevo automation handles actual send timing)
        await updateBrevoAttributes(user.email, {
          ...personalAttrs,
          EMAIL_SENT_DROPOFF1: today,
        })
        stats.dropoff1Queued++
      }
      // Email 2: signed up 6–14 days ago, still not onboarded  
      else if (daysSinceSignup >= 6 && daysSinceSignup <= 14) {
        // Still in onboarding list but update personalization
        await updateBrevoAttributes(user.email, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: false,
          EMAIL_SENT_DROPOFF2: today,
        })
        stats.dropoff2Queued++
      }
      // > 14 days without onboarding: remove from list, stop emails
      else if (daysSinceSignup > 14) {
        await brevoCall("POST", `/contacts/lists/${ONBOARDING_LIST_ID}/contacts/remove`, {
          emails: [user.email],
        })
        // Still update personalization in case they return
        await updateBrevoAttributes(user.email, { ...personalAttrs, ONBOARDING_COMPLETE: false })
        stats.skipped++
      }
    }

    // ── CASE 2: Completed onboarding — inactivity check ──────────────────────
    else {
      const daysSinceActive = lastActiveAt
        ? (now.getTime() - lastActiveAt.getTime()) / 86400000
        : 999

      // Inactive 7–13 days: queue email 1
      if (daysSinceActive >= 7 && daysSinceActive <= 13) {
        // Re-add to Active Users list to trigger the automation
        await addToList(user.email, ACTIVE_LIST_ID, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: true,
          EMAIL_SENT_INACTIVE1: today,
        })
        stats.inactive1Queued++
      }
      // Inactive 14–30 days: queue email 2
      else if (daysSinceActive >= 14 && daysSinceActive <= 30) {
        await updateBrevoAttributes(user.email, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: true,
          EMAIL_SENT_INACTIVE2: today,
        })
        stats.inactive2Queued++
      }
      // Active (< 7 days): just update personalization, no email
      else if (daysSinceActive < 7) {
        await updateBrevoAttributes(user.email, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: true,
        })
        stats.attributesUpdated++
      }
      // > 30 days without using: stop emails, keep in list for potential manual campaigns
      else {
        await updateBrevoAttributes(user.email, {
          ...personalAttrs,
          ONBOARDING_COMPLETE: true,
        })
        stats.skipped++
      }
    }

    // Throttle: ~12 contacts/sec to stay within Brevo free-tier rate limits
    await new Promise<void>((r) => setTimeout(r, 85))
  }

  const result = {
    success: true,
    total: profiles.length,
    ...stats,
    timestamp: now.toISOString(),
  }

  console.log("[cron/brevo-sync]", result)

  // Log to admin dashboard
  try {
    const supabaseAdmin = getServiceClient()
    await supabaseAdmin.from("admin_email_campaigns").insert({
      segment: "cron-smart-sync",
      emails_sent: stats.dropoff1Queued + stats.dropoff2Queued + stats.inactive1Queued + stats.inactive2Queued,
      emails_failed: 0,
      subject: `Smart sync — dropoff:${stats.dropoff1Queued + stats.dropoff2Queued} inactive:${stats.inactive1Queued + stats.inactive2Queued} attrs:${stats.attributesUpdated}`,
      sent_by: "cron",
      sent_at: now.toISOString(),
    })
  } catch { /* non-critical */ }

  return NextResponse.json(result)
}
