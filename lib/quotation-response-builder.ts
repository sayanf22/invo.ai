/**
 * Shared types and helpers for quotation response handling.
 * Extracted from the route file so it can be exported without
 * conflicting with Next.js route export conventions.
 */

export type ResponseType = "accepted" | "declined" | "changes_requested"

export const VALID_RESPONSE_TYPES: ResponseType[] = ["accepted", "declined", "changes_requested"]

export interface QuotationResponseInput {
  sessionId: string
  responseType: ResponseType
  clientName: string
  clientEmail: string
  reason?: string
}

export interface QuotationResponseRow {
  session_id: string
  response_type: ResponseType
  client_name: string
  client_email: string
  reason: string | null
  ip_address: string
  user_agent: string | null
  responded_at: string
}

/**
 * Build the quotation_responses insert row from validated input.
 * Used by the route handler and property-based tests (Property 11).
 */
export function buildQuotationResponseRow(
  input: QuotationResponseInput,
  ipAddress: string,
  userAgent: string | null
): QuotationResponseRow {
  return {
    session_id: input.sessionId,
    response_type: input.responseType,
    client_name: input.clientName,
    client_email: input.clientEmail,
    reason: input.reason ?? null,
    ip_address: ipAddress,
    user_agent: userAgent,
    responded_at: new Date().toISOString(),
  }
}
