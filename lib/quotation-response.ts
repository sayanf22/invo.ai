/**
 * Shared types and helpers for quotation/proposal client responses.
 * Exported from a lib file (not the route) to avoid Next.js route export conflicts.
 *
 * Used by:
 * - app/api/quotations/respond/route.ts (route handler)
 * - __tests__/properties/quotation-response.property.test.ts (property tests)
 */

export type ResponseType = "accepted" | "declined" | "changes_requested"

/** Validated response types — matches the DB CHECK constraint */
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
  ip_address: string | null
  user_agent: string | null
  responded_at: string
}

/**
 * Build the quotation_responses insert row from validated input.
 * Used by the route handler and property-based tests (Property 11).
 *
 * Security notes:
 * - reason is trimmed to remove whitespace
 * - user_agent is capped at 500 chars to prevent oversized inserts
 * - ip_address is nullable (unknown if header not present)
 */
export function buildQuotationResponseRow(
  input: QuotationResponseInput,
  ipAddress: string | null,
  userAgent: string | null
): QuotationResponseRow {
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
