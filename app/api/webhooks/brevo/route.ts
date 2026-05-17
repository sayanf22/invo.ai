/**
 * POST /api/webhooks/brevo
 *
 * Receives real-time event notifications from Brevo for both:
 *   - Transactional emails (direct admin-to-user messages)
 *   - Marketing automation emails (sent via Brevo automation workflows)
 *
 * Events tracked: sent, delivered, opened, clicked, hardBounce, softBounce,
 *                 spam, blocked, unsubscribed
 *
 * Security:
 *   - Brevo does not sign webhook payloads (no HMAC secret available on free plan)
 *   - We validate the request source by checking for a secret query param
 *   - Deduplication via unique index on (message_id, event) prevents double-writes
 *     on Brevo's webhook retry mechanism
 *
 * Brevo retries webhooks up to 3 times on timeout. Idempotency is handled by
 * the DB unique constraint — duplicate inserts are silently ignored.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Webhook secret appended as query param: ?secret=BREVO_WEBHOOK_SECRET
// Set BREVO_WEBHOOK_SECRET in .env and use it in the Brevo webhook URL
function isValidRequest(request: NextRequest): boolean {
  const secret = request.nextUrl.searchParams.get("secret")
  const envSecret = process.env.BREVO_WEBHOOK_SECRET
  if (!envSecret) return true  // no secret configured = allow all (for testing)
  return secret === envSecret
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

// Brevo webhook payload shape (common fields across event types)
interface BrevoWebhookPayload {
  event: string
  email: string
  id?: number           // Brevo internal ID
  "message-id"?: string // transactional message ID
  "X-Mailin-custom"?: string
  subject?: string
  tag?: string | string[]
  "template-id"?: number
  ts?: number           // event timestamp (Unix seconds)
  ts_event?: number
  ip?: string
  link?: string         // for click events
  reason?: string       // for bounce events
  "user-agent"?: string
  "X-Mailin-Tag"?: string
  tags?: string[]
}

export async function POST(request: NextRequest) {
  // Validate webhook secret
  if (!isValidRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let payload: BrevoWebhookPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Required fields
  if (!payload.event || !payload.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Sanitize event type — only track known events
  const TRACKED_EVENTS = new Set([
    "sent", "delivered", "opened", "uniqueOpened",
    "click", "hardBounce", "softBounce", "spam",
    "blocked", "unsubscribed", "request",
  ])
  if (!TRACKED_EVENTS.has(payload.event)) {
    // Unknown event — acknowledge but don't store
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = getServiceClient()

  // Resolve the user_id from email (best-effort — don't fail if not found)
  let userId: string | null = null
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", payload.email)
      .limit(1)
    userId = profiles?.[0]?.id ?? null
  } catch { /* non-critical */ }

  // Extract tag from various possible locations in payload
  const rawTag = payload.tag || payload["X-Mailin-Tag"] || payload.tags?.[0] || null
  const tag = typeof rawTag === "string"
    ? rawTag.slice(0, 128)
    : Array.isArray(rawTag)
    ? rawTag[0]?.slice(0, 128) ?? null
    : null

  // Event timestamp
  const eventAt = payload.ts
    ? new Date(payload.ts * 1000).toISOString()
    : payload.ts_event
    ? new Date(payload.ts_event * 1000).toISOString()
    : new Date().toISOString()

  const messageId = payload["message-id"]
    ? payload["message-id"].slice(0, 512)
    : null

  try {
    await supabase.from("email_events").insert({
      message_id: messageId,
      email: payload.email.toLowerCase().slice(0, 254),
      event: payload.event,
      subject: payload.subject?.slice(0, 512) ?? null,
      tag,
      template_id: payload["template-id"] ?? null,
      user_id: userId,
      ip: payload.ip?.slice(0, 64) ?? null,
      user_agent: payload["user-agent"]?.slice(0, 512) ?? null,
      link: payload.link?.slice(0, 2048) ?? null,
      reason: payload.reason?.slice(0, 512) ?? null,
      event_at: eventAt,
    })
  } catch (err: any) {
    // Unique constraint violation = duplicate event, silently ignore
    if (err?.code === "23505" || String(err?.message).includes("duplicate")) {
      return NextResponse.json({ ok: true, duplicate: true })
    }
    console.error("[webhook/brevo] insert error:", err)
    // Return 200 anyway — Brevo retries on non-2xx which causes more duplicates
    return NextResponse.json({ ok: false, error: "DB error" })
  }

  return NextResponse.json({ ok: true })
}
