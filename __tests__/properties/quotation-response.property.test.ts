// Feature: esignature-upgrade, Property 11: Quotation response recording completeness

/**
 * Property-based tests for the buildQuotationResponseRow helper
 * exported from app/api/quotations/respond/route.ts.
 *
 * Property 11: Quotation response recording completeness
 * For any quotation response submission (accepted, declined, or changes_requested),
 * the recorded quotation_responses row SHALL contain:
 *   - non-null session_id
 *   - correct response_type
 *   - non-empty client_name
 *   - valid client_email
 *   - non-null responded_at
 *   - reason present when response_type = changes_requested
 *
 * Validates: Requirements 8.3, 8.5, 8.7
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildQuotationResponseRow } from "@/app/api/quotations/respond/route"
import type { ResponseType, QuotationResponseInput } from "@/app/api/quotations/respond/route"

// ── Generators ────────────────────────────────────────────────────────────────

/** Arbitrary UUID v4 */
const uuidArb = fc.uuid()

/** Arbitrary valid email (contains @ and .) */
const emailArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s))
  )
  .map(([local, domain]) => `${local}@${domain}.com`)

/** Arbitrary non-empty client name */
const clientNameArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
    fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0)
  )
  .map(([first, last]) => `${first} ${last}`)

/** Arbitrary response type */
const responseTypeArb = fc.constantFrom<ResponseType>(
  "accepted",
  "declined",
  "changes_requested"
)

/** Arbitrary non-empty reason string */
const reasonArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.trim().length > 0)

/** Arbitrary IPv4 address */
const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/** Arbitrary user agent string (nullable) */
const userAgentArb = fc.option(
  fc.string({ minLength: 5, maxLength: 200 }),
  { nil: null }
)

/**
 * Arbitrary input for accepted or declined (reason optional)
 */
const nonChangesRequestedInputArb = fc.record({
  sessionId: uuidArb,
  responseType: fc.constantFrom<ResponseType>("accepted", "declined"),
  clientName: clientNameArb,
  clientEmail: emailArb,
  reason: fc.option(reasonArb, { nil: undefined }),
})

/**
 * Arbitrary input for changes_requested (reason required)
 */
const changesRequestedInputArb = fc.record({
  sessionId: uuidArb,
  responseType: fc.constant<ResponseType>("changes_requested"),
  clientName: clientNameArb,
  clientEmail: emailArb,
  reason: reasonArb,
})

/**
 * Arbitrary input for any response type (reason present when changes_requested)
 */
const anyValidInputArb: fc.Arbitrary<QuotationResponseInput> = fc.oneof(
  nonChangesRequestedInputArb,
  changesRequestedInputArb
)

// ── Property 11: Quotation response recording completeness ────────────────────

describe("Feature: esignature-upgrade, Property 11: Quotation response recording completeness", () => {
  /**
   * The recorded row SHALL always have a non-null session_id.
   */
  it("should always produce a non-null session_id", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.session_id).toBeTruthy()
        expect(typeof row.session_id).toBe("string")
        expect(row.session_id.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The recorded row SHALL always have the correct response_type.
   */
  it("should always record the correct response_type", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.response_type).toBe(input.responseType)
        expect(["accepted", "declined", "changes_requested"]).toContain(row.response_type)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The recorded row SHALL always have a non-empty client_name.
   */
  it("should always produce a non-empty client_name", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.client_name).toBeTruthy()
        expect(typeof row.client_name).toBe("string")
        expect(row.client_name.trim().length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The recorded row SHALL always have a valid client_email (contains @ and .).
   */
  it("should always produce a valid client_email containing @ and .", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.client_email).toBeTruthy()
        expect(typeof row.client_email).toBe("string")
        expect(row.client_email).toContain("@")
        expect(row.client_email).toContain(".")
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The recorded row SHALL always have a non-null responded_at timestamp.
   */
  it("should always produce a non-null responded_at", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.responded_at).toBeTruthy()
        expect(typeof row.responded_at).toBe("string")
        // Must be a valid ISO 8601 date
        const parsed = new Date(row.responded_at)
        expect(isNaN(parsed.getTime())).toBe(false)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The recorded row SHALL have reason present when response_type = changes_requested.
   */
  it("should always include reason when response_type is changes_requested", () => {
    fc.assert(
      fc.property(changesRequestedInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.response_type).toBe("changes_requested")
        expect(row.reason).not.toBeNull()
        expect(row.reason).not.toBeUndefined()
        expect(typeof row.reason).toBe("string")
        expect((row.reason as string).trim().length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The session_id in the row must match the input sessionId exactly.
   */
  it("should preserve session_id verbatim from input", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.session_id).toBe(input.sessionId)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The client_email in the row must match the input clientEmail exactly.
   */
  it("should preserve client_email verbatim from input", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        expect(row.client_email).toBe(input.clientEmail)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * For accepted and declined, reason may be null when not provided.
   */
  it("should allow null reason for accepted and declined response types", () => {
    const noReasonInputArb = fc.record({
      sessionId: uuidArb,
      responseType: fc.constantFrom<ResponseType>("accepted", "declined"),
      clientName: clientNameArb,
      clientEmail: emailArb,
      reason: fc.constant(undefined),
    })

    fc.assert(
      fc.property(noReasonInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)
        // reason is null when not provided (not required for accepted/declined)
        expect(row.reason).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  /**
   * All required fields are present in every row regardless of response type.
   */
  it("should always produce a row with all required fields present", () => {
    fc.assert(
      fc.property(anyValidInputArb, ipv4Arb, userAgentArb, (input, ip, ua) => {
        const row = buildQuotationResponseRow(input, ip, ua)

        // All required fields must be present
        expect(row).toHaveProperty("session_id")
        expect(row).toHaveProperty("response_type")
        expect(row).toHaveProperty("client_name")
        expect(row).toHaveProperty("client_email")
        expect(row).toHaveProperty("responded_at")
        expect(row).toHaveProperty("ip_address")
        expect(row).toHaveProperty("user_agent")
        expect(row).toHaveProperty("reason")
      }),
      { numRuns: 100 }
    )
  })
})
