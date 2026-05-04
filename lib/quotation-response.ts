/**
 * Shared types and helpers for quotation/proposal client responses.
 * Exported from a lib file (not the route) to avoid Next.js route export conflicts.
 */

export type ResponseType = "accepted" | "declined" | "changes_requested"

export interface QuotationResponseInput {
  sessionId: string
  responseType: ResponseType
  clientName: string
  clientEmail: string
  reason?: string
}

export function buildQuotationResponseRow(
  input: QuotationResponseInput,
  ipAddress: string | null,
  userAgent: string | null
): {
  session_id: string
  response_type: ResponseType
  client_name: string
  client_email: string
  reason: string | null
  ip_address: string | null
  user_agent: string | null
  responded_at: string
} {
  return {
    session_id: input.sessionId,
    response_type: input.responseType,
    client_name: input.clientName,
    client_email: input.clientEmail,
    reason: input.reason?.trim() || null,
    ip_address: ipAddress,
    user_agent: userAgent ? userAgent.slice(0, 500) : null,
    responded_at: new Date().toISOString(),
  }
}
