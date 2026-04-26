/**
 * Webhook deduplication — prevents replay attacks across all payment gateways.
 *
 * Uses the webhook_events table with a (gateway, event_id) unique constraint.
 * If the same event_id is received twice, the second call returns false.
 *
 * Also validates webhook timestamps to reject stale replays (>5 minutes old).
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type WebhookGateway = "razorpay" | "stripe" | "cashfree"

/**
 * Try to mark a webhook event as processed.
 * Returns true if this is the first time we've seen this event (safe to process).
 * Returns false if we've already processed it (duplicate — skip).
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING for atomic deduplication.
 */
export async function markWebhookProcessed(
  supabase: SupabaseClient,
  gateway: WebhookGateway,
  eventId: string,
  userId?: string
): Promise<boolean> {
  if (!eventId) return true // No event ID — can't deduplicate, allow through

  try {
    const { error } = await (supabase as any)
      .from("webhook_events")
      .insert({
        gateway,
        event_id: eventId,
        user_id: userId ?? null,
        processed_at: new Date().toISOString(),
      })

    if (error) {
      // Unique constraint violation = duplicate event
      if (error.code === "23505") return false
      // Other DB error — fail open (allow processing) to avoid blocking legitimate payments
      console.error(`[webhook-dedup] DB error for ${gateway}/${eventId}:`, error.message)
      return true
    }

    return true // First time seeing this event
  } catch (err) {
    // Fail open — don't block legitimate payments due to dedup errors
    console.error(`[webhook-dedup] Unexpected error:`, err)
    return true
  }
}

/**
 * Validate that a webhook timestamp is recent (within 5 minutes).
 * Rejects stale replays.
 *
 * @param timestampSeconds - Unix timestamp in seconds (Stripe/Razorpay format)
 * @param toleranceSeconds - How old a webhook can be (default: 300s = 5 min)
 */
export function isWebhookTimestampValid(
  timestampSeconds: number,
  toleranceSeconds = 300
): boolean {
  if (!timestampSeconds || isNaN(timestampSeconds)) return true // No timestamp — allow
  const ageSeconds = Math.floor(Date.now() / 1000) - timestampSeconds
  return ageSeconds <= toleranceSeconds && ageSeconds >= -60 // Allow 1 min clock skew
}

/**
 * Constant-time string comparison to prevent timing attacks on signature verification.
 * Uses crypto.subtle to compare two hex strings without leaking timing info.
 */
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false
  try {
    const encoder = new TextEncoder()
    const aBytes = encoder.encode(a)
    const bBytes = encoder.encode(b)
    // XOR all bytes — if any differ, result is non-zero
    let diff = 0
    for (let i = 0; i < aBytes.length; i++) {
      diff |= aBytes[i] ^ bBytes[i]
    }
    return diff === 0
  } catch {
    return a === b // Fallback
  }
}
