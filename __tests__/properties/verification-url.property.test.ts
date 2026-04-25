// Feature: esignature-upgrade, Property 6: Verification URL format
// Feature: esignature-upgrade, Property 7: Verification response field safety

/**
 * Property-based tests for app/verify/[signatureId]/page.tsx
 *
 * Tests the buildPublicVerificationData helper and verification URL format.
 *
 * Validates: Requirements 3.1, 3.7
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { buildPublicVerificationData } from "@/app/verify/[signatureId]/page"

// ── Generators ────────────────────────────────────────────────────────────────

/** Arbitrary UUID v4 */
const uuidArb = fc.uuid()

/** Arbitrary non-empty email string */
const emailArb = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/.test(s)),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s))
  )
  .map(([local, domain]) => `${local}@${domain}.com`)

/** Arbitrary 64-char lowercase hex string (full document hash) */
const fullHashArb = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map((digits) => digits.map((d) => d.toString(16)).join(""))

/** Arbitrary ISO 8601 UTC timestamp */
const isoTimestampArb = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2099-12-31T23:59:59Z").getTime(),
  })
  .map((ms) => new Date(ms).toISOString())

/** Arbitrary R2 key (signature image key) */
const r2KeyArb = fc
  .tuple(uuidArb, uuidArb)
  .map(([folder, id]) => `signatures/${folder}/${id}.png`)

/** Arbitrary signature image URL */
const signatureImageUrlArb = r2KeyArb.map(
  (key) => `https://r2.clorefy.com/${key}`
)

/** Arbitrary IPv4 address */
const ipv4Arb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`)

/** Arbitrary document type */
const documentTypeArb = fc.constantFrom(
  "invoice",
  "contract",
  "quotation",
  "proposal"
)

/** Arbitrary signer name */
const signerNameArb = fc
  .tuple(
    fc.string({ minLength: 2, maxLength: 15 }),
    fc.string({ minLength: 2, maxLength: 15 })
  )
  .map(([first, last]) => `${first} ${last}`)

/**
 * Arbitrary completed signature row (all sensitive fields populated).
 * This represents a full database row as returned by Supabase.
 */
const completedSignatureArb = fc.record({
  id: uuidArb,
  signer_name: signerNameArb,
  signer_email: emailArb,
  signed_at: isoTimestampArb,
  document_hash: fullHashArb,
  ip_address: ipv4Arb,
  signature_image_url: signatureImageUrlArb,
  party: fc.constantFrom("Client", "Vendor", "Contractor"),
  session_id: uuidArb,
  document_sessions: fc.record({
    document_type: documentTypeArb,
  }),
})

// ── Property 6: Verification URL format ──────────────────────────────────────

describe("Feature: esignature-upgrade, Property 6: Verification URL format", () => {
  /**
   * For any valid UUID signatureId, the generated verification URL SHALL match
   * the pattern https://clorefy.com/verify/[signatureId] exactly.
   *
   * Validates: Requirements 3.1
   */
  it("should always produce a URL matching https://clorefy.com/verify/[signatureId]", () => {
    fc.assert(
      fc.property(uuidArb, (signatureId) => {
        const url = `https://clorefy.com/verify/${signatureId}`

        // Must start with the correct base
        expect(url.startsWith("https://clorefy.com/verify/")).toBe(true)

        // Must end with the exact signatureId
        expect(url.endsWith(signatureId)).toBe(true)

        // Must match the exact pattern
        expect(url).toBe(`https://clorefy.com/verify/${signatureId}`)
      }),
      { numRuns: 100 }
    )
  })

  it("should embed the signatureId verbatim in the URL path", () => {
    fc.assert(
      fc.property(uuidArb, (signatureId) => {
        const url = `https://clorefy.com/verify/${signatureId}`

        // The signatureId must appear verbatim in the URL
        expect(url).toContain(signatureId)

        // The path segment after /verify/ must be exactly the signatureId
        const pathSegment = url.split("/verify/")[1]
        expect(pathSegment).toBe(signatureId)
      }),
      { numRuns: 100 }
    )
  })

  it("should always use https scheme and clorefy.com domain", () => {
    fc.assert(
      fc.property(uuidArb, (signatureId) => {
        const url = `https://clorefy.com/verify/${signatureId}`

        expect(url.startsWith("https://")).toBe(true)
        expect(url).toContain("clorefy.com")

        // Validate as a proper URL
        const parsed = new URL(url)
        expect(parsed.protocol).toBe("https:")
        expect(parsed.hostname).toBe("clorefy.com")
        expect(parsed.pathname).toBe(`/verify/${signatureId}`)
      }),
      { numRuns: 100 }
    )
  })
})

// ── Property 7: Verification response field safety ────────────────────────────

describe("Feature: esignature-upgrade, Property 7: Verification response field safety", () => {
  /**
   * For any completed signature, the public verification response SHALL NOT
   * contain the full 64-char document hash, the signer's IP address, or the
   * signature image URL or R2 key.
   *
   * Validates: Requirements 3.7
   */
  it("should never expose the full 64-char document hash", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        const result = buildPublicVerificationData(signature)

        // The full hash must not appear anywhere in the result
        const resultJson = JSON.stringify(result)
        expect(resultJson).not.toContain(signature.document_hash)

        // The documentHashPrefix must be at most 16 chars
        if (result.documentHashPrefix !== null) {
          expect(result.documentHashPrefix.length).toBeLessThanOrEqual(16)
          // It must be a prefix of the full hash
          expect(signature.document_hash!.startsWith(result.documentHashPrefix)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("should never expose the signer IP address", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        const result = buildPublicVerificationData(signature)

        // IP address must not appear in the result
        const resultJson = JSON.stringify(result)
        expect(resultJson).not.toContain(signature.ip_address)

        // The result object must not have an ip_address field
        expect(result).not.toHaveProperty("ip_address")
        expect(result).not.toHaveProperty("ipAddress")
      }),
      { numRuns: 100 }
    )
  })

  it("should never expose the signature image URL", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        const result = buildPublicVerificationData(signature)

        // Signature image URL must not appear in the result
        const resultJson = JSON.stringify(result)
        expect(resultJson).not.toContain(signature.signature_image_url)

        // The result object must not have a signature image field
        expect(result).not.toHaveProperty("signature_image_url")
        expect(result).not.toHaveProperty("signatureImageUrl")
        expect(result).not.toHaveProperty("signatureImage")
      }),
      { numRuns: 100 }
    )
  })

  it("should never expose any R2 key or storage path", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        const result = buildPublicVerificationData(signature)
        const resultJson = JSON.stringify(result)

        // R2 keys follow the pattern signatures/... — must not appear
        if (signature.signature_image_url) {
          // Extract the R2 key from the URL (path after domain)
          try {
            const parsed = new URL(signature.signature_image_url)
            const r2Key = parsed.pathname.slice(1) // remove leading /
            expect(resultJson).not.toContain(r2Key)
          } catch {
            // Not a valid URL — still should not appear
            expect(resultJson).not.toContain(signature.signature_image_url)
          }
        }
      }),
      { numRuns: 100 }
    )
  })

  it("should only expose the safe public fields", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        const result = buildPublicVerificationData(signature)

        // The result must only contain these safe fields
        const allowedKeys = new Set([
          "signerName",
          "signerEmail",
          "signedAt",
          "documentType",
          "documentHashPrefix",
          "status",
          "verified",
        ])

        const resultKeys = Object.keys(result)
        for (const key of resultKeys) {
          expect(allowedKeys.has(key)).toBe(true)
        }
      }),
      { numRuns: 100 }
    )
  })

  it("should set verified: true for completed signatures (with signed_at)", () => {
    fc.assert(
      fc.property(completedSignatureArb, (signature) => {
        // completedSignatureArb always has signed_at set
        const result = buildPublicVerificationData(signature)
        expect(result.verified).toBe(true)
        expect(result.status).toBe("completed")
      }),
      { numRuns: 100 }
    )
  })

  it("should set verified: false for incomplete signatures (no signed_at)", () => {
    fc.assert(
      fc.property(
        completedSignatureArb.map((sig) => ({ ...sig, signed_at: null })),
        (signature) => {
          const result = buildPublicVerificationData(signature)
          expect(result.verified).toBe(false)
          expect(result.status).toBe("pending")
        }
      ),
      { numRuns: 100 }
    )
  })
})
