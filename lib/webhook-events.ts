import type { SupabaseClient } from "@supabase/supabase-js"

export type WebhookClaim = "claimed" | "duplicate" | "in_progress"

export async function hashWebhookPayload(body: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function claimWebhookEvent(
    db: SupabaseClient,
    gateway: string,
    eventId: string,
    eventType: string,
    payloadHash: string,
    userId?: string | null,
): Promise<WebhookClaim> {
    const args: Record<string, unknown> = {
        p_gateway: gateway,
        p_event_id: eventId,
        p_event_type: eventType,
        p_payload_hash: payloadHash,
    }
    if (userId) args.p_user_id = userId
    const { data, error } = await (db.rpc as any)("claim_webhook_event", args)
    if (error) throw error
    if (!['claimed', 'duplicate', 'in_progress'].includes(data)) {
        throw new Error("Invalid webhook claim result")
    }
    return data as WebhookClaim
}

export async function finishWebhookEvent(
    db: SupabaseClient,
    gateway: string,
    eventId: string,
    status: "processed" | "failed",
    errorMessage?: string,
): Promise<void> {
    const { error } = await (db as any).from("webhook_events").update({
        status,
        processed_at: status === "processed" ? new Date().toISOString() : null,
        last_error: status === "failed" ? (errorMessage || "Webhook processing failed").slice(0, 1000) : null,
        updated_at: new Date().toISOString(),
    }).eq("gateway", gateway).eq("event_id", eventId)
    if (error) throw error
}
