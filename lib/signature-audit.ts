import type { SupabaseClient } from "@supabase/supabase-js"

export type AuditAction =
  | "signature.request_created"
  | "signature.viewed"
  | "signature.signed"
  | "signature.completed"
  | "signature.expired"
  | "signature.tamper_detected"
  | "signature.abuse_detected"
  | "signature.r2_fallback"

export function buildAuditEventRow(event: {
  action: AuditAction
  signature_id?: string
  document_id?: string
  session_id?: string
  actor_email?: string
  ip_address?: string
  user_agent?: string
  metadata?: Record<string, unknown>
}) {
  return {
    action: event.action,
    signature_id: event.signature_id ?? null,
    document_id: event.document_id ?? null,
    session_id: event.session_id ?? null,
    actor_email: event.actor_email ?? null,
    ip_address: event.ip_address ?? null,
    user_agent: event.user_agent ?? null,
    metadata: event.metadata ?? null,
  }
}

export async function recordAuditEvent(
  supabase: SupabaseClient,
  event: {
    action: AuditAction
    signature_id?: string
    document_id?: string
    session_id?: string
    actor_email?: string
    ip_address?: string
    user_agent?: string
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    const { error } = await supabase.from("signature_audit_events").insert({
      action: event.action,
      signature_id: event.signature_id ?? null,
      document_id: event.document_id ?? null,
      session_id: event.session_id ?? null,
      actor_email: event.actor_email ?? null,
      ip_address: event.ip_address ?? null,
      user_agent: event.user_agent ?? null,
      metadata: event.metadata ?? null,
    })

    if (error) {
      console.error("[signature-audit] insert failed:", error)
    }
  } catch (err) {
    console.error("[signature-audit] unexpected error:", err)
  }
}
