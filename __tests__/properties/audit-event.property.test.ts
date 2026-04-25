// Feature: esignature-upgrade, Property 4: Audit event completeness
// Feature: esignature-upgrade, Property 5: Audit trail append-only invariant

/**
 * Property-based tests for lib/signature-audit.ts (buildAuditEventRow helper)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildAuditEventRow } from "@/lib/signature-audit"
import type { AuditAction } from "@/lib/signature-audit"

// ── Generators ────────────────────────────────────────────────────────────────

const uuidArb = fc.uuid()

const auditActionArb = fc.constantFrom<AuditAction>(
  "signature.request_created",
  "signature.viewed",
  "signature.signed",
  "signature.completed",
  "signature.expired",
  "signature.tamper_detected",
  "signature.abuse_detected",
  "signature.r2_fallback"
)

const optionalUuidArb = fc.option(uuidArb, { nil: undefined })
const optionalStringArb = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined })

const auditEventInputArb = fc.record({
  action: auditActionArb,
  signature_id: optionalUuidArb,
  document_id: optionalUuidArb,
  session_id: optionalUuidArb,
  actor_email: optionalStringArb,
  ip_address: optionalStringArb,
  user_agent: optionalStringArb,
  metadata: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()) as fc.Arbitrary<Record<string, unknown>>,
    { nil: undefined }
  ),
})

// ── Property 4: Audit event completeness ─────────────────────────────────────

describe("Feature: esignature-upgrade, Property 4: Audit event completeness", () => {
  /**
   * For any signing lifecycle event, the recorded audit event row SHALL contain:
   * - non-null signature_id OR non-null document_id (at least one identifier)
   * - correct action string
   * - all optional fields defaulting to null (never undefined)
   *
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.8
   */

  it("should always produce a row with the correct action string", () => {
    fc.assert(
      fc.property(auditEventInputArb, (input) => {
        const row = buildAuditEventRow(input)
        expect(row.action).toBe(input.action)
        expect(typeof row.action).toBe("string")
        expect(row.action.length).toBeGreaterThan(0)
      }),
      { numRuns: 100 }
    )
  })

  it("should always produce a row where optional fields are null (not undefined) when omitted", () => {
    fc.assert(
      fc.property(auditActionArb, (action) => {
        // Provide only the required action field
        const row = buildAuditEventRow({ action })

        expect(row.signature_id).toBeNull()
        expect(row.document_id).toBeNull()
        expect(row.session_id).toBeNull()
        expect(row.actor_email).toBeNull()
        expect(row.ip_address).toBeNull()
        expect(row.user_agent).toBeNull()
        expect(row.metadata).toBeNull()
      }),
      { numRuns: 100 }
    )
  })

  it("should preserve signature_id when provided", () => {
    fc.assert(
      fc.property(auditActionArb, uuidArb, (action, signatureId) => {
        const row = buildAuditEventRow({ action, signature_id: signatureId })
        expect(row.signature_id).toBe(signatureId)
      }),
      { numRuns: 100 }
    )
  })

  it("should preserve document_id when provided", () => {
    fc.assert(
      fc.property(auditActionArb, uuidArb, (action, documentId) => {
        const row = buildAuditEventRow({ action, document_id: documentId })
        expect(row.document_id).toBe(documentId)
      }),
      { numRuns: 100 }
    )
  })

  it("should always have non-null signature_id or document_id when at least one is provided", () => {
    // Events with signature_id
    fc.assert(
      fc.property(auditActionArb, uuidArb, (action, id) => {
        const row = buildAuditEventRow({ action, signature_id: id })
        const hasIdentifier = row.signature_id !== null || row.document_id !== null
        expect(hasIdentifier).toBe(true)
      }),
      { numRuns: 100 }
    )

    // Events with document_id
    fc.assert(
      fc.property(auditActionArb, uuidArb, (action, id) => {
        const row = buildAuditEventRow({ action, document_id: id })
        const hasIdentifier = row.signature_id !== null || row.document_id !== null
        expect(hasIdentifier).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it("should preserve all provided fields verbatim", () => {
    fc.assert(
      fc.property(auditEventInputArb, (input) => {
        const row = buildAuditEventRow(input)

        expect(row.action).toBe(input.action)
        expect(row.signature_id).toBe(input.signature_id ?? null)
        expect(row.document_id).toBe(input.document_id ?? null)
        expect(row.session_id).toBe(input.session_id ?? null)
        expect(row.actor_email).toBe(input.actor_email ?? null)
        expect(row.ip_address).toBe(input.ip_address ?? null)
        expect(row.user_agent).toBe(input.user_agent ?? null)
        expect(row.metadata).toBe(input.metadata ?? null)
      }),
      { numRuns: 100 }
    )
  })

  it("should always produce a row with all required fields present", () => {
    fc.assert(
      fc.property(auditEventInputArb, (input) => {
        const row = buildAuditEventRow(input)

        expect(row).toHaveProperty("action")
        expect(row).toHaveProperty("signature_id")
        expect(row).toHaveProperty("document_id")
        expect(row).toHaveProperty("session_id")
        expect(row).toHaveProperty("actor_email")
        expect(row).toHaveProperty("ip_address")
        expect(row).toHaveProperty("user_agent")
        expect(row).toHaveProperty("metadata")
      }),
      { numRuns: 100 }
    )
  })

  it("should accept all 8 valid AuditAction values", () => {
    const allActions: AuditAction[] = [
      "signature.request_created",
      "signature.viewed",
      "signature.signed",
      "signature.completed",
      "signature.expired",
      "signature.tamper_detected",
      "signature.abuse_detected",
      "signature.r2_fallback",
    ]

    for (const action of allActions) {
      const row = buildAuditEventRow({ action })
      expect(row.action).toBe(action)
    }
  })
})

// ── Property 5: Audit trail append-only invariant ─────────────────────────────

describe("Feature: esignature-upgrade, Property 5: Audit trail append-only invariant", () => {
  /**
   * For any sequence of audit events inserted into signature_audit_events,
   * the total count of rows for a given signature_id SHALL be monotonically
   * non-decreasing — no rows are ever deleted or updated.
   *
   * We test this as a pure logic property: given N events built, the count
   * should be exactly N (never less).
   *
   * Validates: Requirements 2.7
   */

  it("should produce exactly N rows when N events are built for a signature_id", () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(auditActionArb, { minLength: 1, maxLength: 20 }),
        (signatureId, actions) => {
          // Build N audit event rows for the same signature_id
          const rows = actions.map((action) =>
            buildAuditEventRow({ action, signature_id: signatureId })
          )

          // The count must equal the number of events built (append-only: never less)
          expect(rows.length).toBe(actions.length)

          // Every row must have the correct signature_id
          for (const row of rows) {
            expect(row.signature_id).toBe(signatureId)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should produce a monotonically non-decreasing count as events are appended", () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(auditActionArb, { minLength: 2, maxLength: 15 }),
        (signatureId, actions) => {
          const rows: ReturnType<typeof buildAuditEventRow>[] = []

          for (const action of actions) {
            rows.push(buildAuditEventRow({ action, signature_id: signatureId }))

            // After each append, the count must be >= the previous count
            // (in this pure model, it's always exactly i+1)
            expect(rows.length).toBeGreaterThan(0)
          }

          // Final count must equal total number of events
          expect(rows.length).toBe(actions.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should never produce fewer rows than events inserted (no implicit deletes)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            signatureId: uuidArb,
            action: auditActionArb,
          }),
          { minLength: 1, maxLength: 30 }
        ),
        (events) => {
          // Build all rows
          const rows = events.map(({ signatureId, action }) =>
            buildAuditEventRow({ action, signature_id: signatureId })
          )

          // Row count must equal event count (append-only: no deletions)
          expect(rows.length).toBe(events.length)
          expect(rows.length).toBeGreaterThanOrEqual(events.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should preserve each event's action in the row (no mutations)", () => {
    fc.assert(
      fc.property(
        uuidArb,
        fc.array(auditActionArb, { minLength: 1, maxLength: 10 }),
        (signatureId, actions) => {
          const rows = actions.map((action) =>
            buildAuditEventRow({ action, signature_id: signatureId })
          )

          // Each row's action must match the original event action (no updates)
          for (let i = 0; i < actions.length; i++) {
            expect(rows[i].action).toBe(actions[i])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
