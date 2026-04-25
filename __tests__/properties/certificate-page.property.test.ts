// Feature: esignature-upgrade, Property 8: Certificate page content completeness
// Feature: esignature-upgrade, Property 9: R2 certificate key format

/**
 * Property-based tests for components/certificate-page.tsx and lib/certificate-generator.ts
 *
 * Since we cannot easily render @react-pdf/renderer in a test environment,
 * we test the exported helper functions directly:
 *   - maskIp: always masks the last octet
 *   - formatSignedAt: always produces "DD MMM YYYY HH:mm UTC" format
 *   - LEGAL_STATEMENT: always present in the component module
 *   - buildCertificateKey: always produces "certificates/[documentId]_certificate.pdf"
 *
 * Validates: Requirements 4.2, 4.3, 4.6, 4.8
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { maskIp, formatSignedAt, LEGAL_STATEMENT } from "@/components/certificate-page"
import { buildCertificateKey } from "@/lib/certificate-generator"

// ── Generators ────────────────────────────────────────────────────────────────

/** Arbitrary valid IPv4 address */
const ipv4Arb = fc.tuple(
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/** Arbitrary ISO 8601 UTC timestamp (year 2000–2099) using integer ms to avoid invalid Date edge cases */
const isoTimestampArb = fc
  .integer({ min: new Date("2000-01-01T00:00:00Z").getTime(), max: new Date("2099-12-31T23:59:59Z").getTime() })
  .map((ms) => new Date(ms).toISOString())

/** Arbitrary UUID v4 */
const uuidArb = fc.uuid()

// ── Property 8: Certificate page content completeness ─────────────────────────

describe("Feature: esignature-upgrade, Property 8: Certificate page content completeness", () => {
  /**
   * maskIp always masks the last octet of an IPv4 address.
   * The result must end with ".xxx" and the first three octets must be preserved.
   *
   * Validates: Requirements 4.2
   */
  it("maskIp: always replaces the last IPv4 octet with 'xxx'", () => {
    fc.assert(
      fc.property(ipv4Arb, (ip) => {
        const masked = maskIp(ip)

        // Must end with ".xxx"
        expect(masked).toMatch(/\.xxx$/)

        // The first three octets must be preserved
        const parts = ip.split(".")
        const prefix = parts.slice(0, 3).join(".")
        expect(masked).toBe(`${prefix}.xxx`)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * maskIp result never contains the original last octet (when it's non-zero).
   *
   * Validates: Requirements 4.2
   */
  it("maskIp: masked result does not expose the original last octet", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 1, max: 255 }) // non-zero last octet to ensure it's distinguishable
        ),
        ([a, b, c, d]) => {
          const ip = `${a}.${b}.${c}.${d}`
          const masked = maskIp(ip)
          // The masked string should not end with the original last octet
          expect(masked).not.toMatch(new RegExp(`\\.${d}$`))
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * formatSignedAt always produces a string matching "DD MMM YYYY HH:mm UTC".
   *
   * Validates: Requirements 4.2
   */
  it("formatSignedAt: always produces 'DD MMM YYYY HH:mm UTC' format", () => {
    // Pattern: 2-digit day, space, 3-letter month, space, 4-digit year, space, HH:mm, space, UTC
    const pattern = /^\d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2} UTC$/

    fc.assert(
      fc.property(isoTimestampArb, (iso) => {
        const formatted = formatSignedAt(iso)
        expect(formatted).toMatch(pattern)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * formatSignedAt preserves the correct UTC date and time components.
   *
   * Validates: Requirements 4.2
   */
  it("formatSignedAt: preserves correct UTC date and time values", () => {
    fc.assert(
      fc.property(isoTimestampArb, (iso) => {
        const date = new Date(iso)
        const formatted = formatSignedAt(iso)

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        const expectedDay = String(date.getUTCDate()).padStart(2, "0")
        const expectedMonth = months[date.getUTCMonth()]
        const expectedYear = String(date.getUTCFullYear())
        const expectedHour = String(date.getUTCHours()).padStart(2, "0")
        const expectedMinute = String(date.getUTCMinutes()).padStart(2, "0")

        expect(formatted).toContain(expectedDay)
        expect(formatted).toContain(expectedMonth)
        expect(formatted).toContain(expectedYear)
        expect(formatted).toContain(`${expectedHour}:${expectedMinute}`)
        expect(formatted).toContain("UTC")
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The LEGAL_STATEMENT constant is always present in the module and contains
   * the required text about electronic signatures being legally binding.
   *
   * Validates: Requirements 4.8
   */
  it("LEGAL_STATEMENT: always contains the required legal text", () => {
    expect(typeof LEGAL_STATEMENT).toBe("string")
    expect(LEGAL_STATEMENT.length).toBeGreaterThan(0)
    expect(LEGAL_STATEMENT).toContain("electronically signed")
    expect(LEGAL_STATEMENT).toContain("legally binding")
    expect(LEGAL_STATEMENT).toContain("electronic signature laws")
  })

  /**
   * LEGAL_STATEMENT mentions Invo.ai as the platform.
   *
   * Validates: Requirements 4.8
   */
  it("LEGAL_STATEMENT: mentions Invo.ai as the signing platform", () => {
    expect(LEGAL_STATEMENT).toContain("Invo.ai")
  })
})

// ── Property 9: R2 certificate key format ─────────────────────────────────────

describe("Feature: esignature-upgrade, Property 9: R2 certificate key format", () => {
  /**
   * For any documentId UUID, the R2 key is always
   * "certificates/[documentId]_certificate.pdf".
   *
   * Validates: Requirements 4.6
   */
  it("buildCertificateKey: always produces 'certificates/[documentId]_certificate.pdf'", () => {
    fc.assert(
      fc.property(uuidArb, (documentId) => {
        const key = buildCertificateKey(documentId)
        expect(key).toBe(`certificates/${documentId}_certificate.pdf`)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The key always starts with "certificates/" prefix.
   *
   * Validates: Requirements 4.6
   */
  it("buildCertificateKey: always starts with 'certificates/' prefix", () => {
    fc.assert(
      fc.property(uuidArb, (documentId) => {
        const key = buildCertificateKey(documentId)
        expect(key.startsWith("certificates/")).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The key always ends with "_certificate.pdf" suffix.
   *
   * Validates: Requirements 4.6
   */
  it("buildCertificateKey: always ends with '_certificate.pdf' suffix", () => {
    fc.assert(
      fc.property(uuidArb, (documentId) => {
        const key = buildCertificateKey(documentId)
        expect(key.endsWith("_certificate.pdf")).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  /**
   * The documentId is always embedded verbatim in the key.
   *
   * Validates: Requirements 4.6
   */
  it("buildCertificateKey: embeds the documentId verbatim in the key", () => {
    fc.assert(
      fc.property(uuidArb, (documentId) => {
        const key = buildCertificateKey(documentId)
        expect(key).toContain(documentId)
      }),
      { numRuns: 100 }
    )
  })
})
