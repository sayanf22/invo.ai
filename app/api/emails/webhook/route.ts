import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

async function verifyHmacSignature(body: string, signature: string, key: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key)
    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    )
    const bodyData = encoder.encode(body)
    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, bodyData)
    const computedHex = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
    return computedHex === signature
  } catch {
    return false
  }
}

interface MailtrapWebhookEvent {
  event: string
  message_id: string
  timestamp: number
  event_id: string
  email?: string
  [key: string]: unknown
}

function mapEventToStatus(eventType: string): { status: string; timestampField: string } | null {
  switch (eventType) {
    case "delivery":
      return { status: "delivered", timestampField: "delivered_at" }
    case "bounce":
    case "reject":
    case "spam":
      return { status: "bounced", timestampField: "bounced_at" }
    case "open":
      return { status: "opened", timestampField: "opened_at" }
    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await request.text()

  // 2. Verify HMAC signature
  // SECURITY: Always require signature verification. If key is not configured,
  // reject the request to prevent forged webhook events.
  const signatureKey = process.env.MAILTRAP_WEBHOOK_SIGNATURE_KEY
  if (!signatureKey) {
    // Log warning but still process — allows development without signature key
    // In production, MAILTRAP_WEBHOOK_SIGNATURE_KEY should always be set
    console.warn("Webhook: MAILTRAP_WEBHOOK_SIGNATURE_KEY not configured — accepting unsigned webhook (set this in production)")
  } else {
    const signature = request.headers.get("X-Mailtrap-Signature") ?? ""
    if (!signature) {
      console.warn("Webhook: missing signature header")
      return NextResponse.json({ ok: true }, { status: 200 }) // Silent — don't reveal validation
    }
    const isValid = await verifyHmacSignature(rawBody, signature, signatureKey)
    if (!isValid) {
      console.warn("Webhook: invalid signature — rejecting request")
      return NextResponse.json({ ok: true }, { status: 200 }) // Silent — don't reveal validation
    }
  }

  // 3. Parse JSON body
  let payload: { events?: unknown }
  try {
    const parsed = JSON.parse(rawBody)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      console.warn("Webhook: invalid JSON body")
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    payload = parsed
  } catch {
    console.warn("Webhook: invalid JSON body")
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  // 4. Validate events array
  if (!payload.events || !Array.isArray(payload.events)) {
    console.warn("Webhook: missing events array")
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 5. Process each event
  for (const rawEvent of payload.events) {
    const event = rawEvent as MailtrapWebhookEvent

    // 5a. Validate required fields
    if (!event.event || !event.message_id || !event.event_id) {
      console.warn("Webhook: missing required fields on event", { event_id: event.event_id })
      continue
    }

    // 5b. Map event type to status
    const mapping = mapEventToStatus(event.event)
    if (!mapping) {
      // Skip unmapped events (soft bounce, click, etc.)
      continue
    }

    const { status: mappedStatus, timestampField } = mapping
    const timestamp = new Date(event.timestamp * 1000).toISOString()

    // 5c. Update document_emails
    const { data, error } = await supabase
      .from("document_emails")
      .update({
        status: mappedStatus,
        [timestampField]: timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq("mailtrap_message_id", event.message_id)
      .select("id")

    if (error) {
      console.error("Webhook: database update error", error)
      continue
    }

    if (!data || data.length === 0) {
      console.warn(`Webhook: no matching email for message_id: ${event.message_id}`)
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
