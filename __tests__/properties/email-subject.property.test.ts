// Feature: esignature-upgrade, Property 15: Email subject format

/**
 * Property-based tests for lib/signing-email.ts (buildSigningInvitationSubject helper)
 *
 * Property 15: Email subject format
 * For any signing invitation, the email subject SHALL match the pattern
 * "[Business Name] requests your signature on [Document Type] [Reference Number]",
 * with all three interpolated values non-empty.
 *
 * Validates: Requirements 9.4
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildSigningInvitationSubject } from "@/lib/signing-email"

// ── Generators ────────────────────────────────────────────────────────────────

/** Non-empty business name (no leading/trailing whitespace, as real business names would be) */
const businessNameArb = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim() === s && s.trim().length > 0)

/** Non-empty document type */
const documentTypeArb = fc.constantFrom(
  "Invoice",
  "Contract",
  "Quotation",
  "Proposal",
  "invoice",
  "contract",
  "quotation",
  "proposal"
)

/** Non-empty reference number */
const referenceNumberArb = fc
  .tuple(
    fc.constantFrom("INV", "CON", "QUO", "PRO"),
    fc.integer({ min: 1000, max: 9999 })
  )
  .map(([prefix, num]) => `${prefix}-${num}`)

// ── Property 15: Email subject format ────────────────────────────────────────

describe("Feature: esignature-upgrade, Property 15: Email subject format", () => {
  /**
   * The subject SHALL always match the exact pattern:
   * "[Business Name] requests your signature on [Document Type] [Reference Number]"
   */
  it("should always produce the correct subject pattern", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          const expected = `${businessName} requests your signature on ${documentType} ${referenceNumber}`
          expect(subject).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL always contain the business name.
   */
  it("should always contain the business name", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject).toContain(businessName)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL always contain the document type.
   */
  it("should always contain the document type", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject).toContain(documentType)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL always contain the reference number.
   */
  it("should always contain the reference number", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject).toContain(referenceNumber)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL always contain the fixed phrase "requests your signature on".
   */
  it("should always contain the fixed phrase 'requests your signature on'", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject).toContain("requests your signature on")
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL never be empty.
   */
  it("should always produce a non-empty subject", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(typeof subject).toBe("string")
          expect(subject.trim().length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL start with the business name.
   */
  it("should always start with the business name", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject.startsWith(businessName)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * The subject SHALL end with the reference number.
   */
  it("should always end with the reference number", () => {
    fc.assert(
      fc.property(
        businessNameArb,
        documentTypeArb,
        referenceNumberArb,
        (businessName, documentType, referenceNumber) => {
          const subject = buildSigningInvitationSubject(businessName, documentType, referenceNumber)
          expect(subject.endsWith(referenceNumber)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Verify exact subjects for concrete examples from the spec.
   */
  it("should produce correct subjects for concrete examples", () => {
    expect(
      buildSigningInvitationSubject("Acme Corp", "Contract", "CON-1234")
    ).toBe("Acme Corp requests your signature on Contract CON-1234")

    expect(
      buildSigningInvitationSubject("Smith & Associates", "Quotation", "QUO-5678")
    ).toBe("Smith & Associates requests your signature on Quotation QUO-5678")

    expect(
      buildSigningInvitationSubject("TechStart Ltd", "Proposal", "PRO-9999")
    ).toBe("TechStart Ltd requests your signature on Proposal PRO-9999")
  })
})
