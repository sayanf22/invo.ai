/**
 * Property-Based Tests for Signing Endpoint Security
 * 
 * Feature: security-hardening
 * Properties: 18 (Signing token format validation), 19 (Signature data URL validation)
 * 
 * Uses fast-check for property-based testing with minimum 100 iterations.
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
    isValidSigningToken,
    validateSignatureDataUrl,
    MAX_DECODED_IMAGE_SIZE,
} from "@/lib/signing-validation"

// ── Property 18: Signing Token Format Validation ───────────────────────

describe("Feature: security-hardening, Property 18: Signing token format validation", () => {
    /**
     * **Validates: Requirements 12.1**
     *
     * Tokens starting with "sign_" and length ≤ 100 are accepted.
     */
    it("accepts tokens starting with sign_ and length ≤ 100", () => {
        fc.assert(
            fc.property(
                // Generate a suffix so total length is 5 ("sign_") + suffix ≤ 100
                fc.string({ minLength: 0, maxLength: 95 }).map((s) => "sign_" + s),
                (token) => {
                    expect(isValidSigningToken(token)).toBe(true)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.1**
     *
     * Tokens NOT starting with "sign_" are always rejected.
     */
    it("rejects tokens that do not start with sign_", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 100 }).filter(
                    (s) => !s.startsWith("sign_")
                ),
                (token) => {
                    expect(isValidSigningToken(token)).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.1**
     *
     * Tokens starting with "sign_" but longer than 100 characters are rejected.
     */
    it("rejects tokens starting with sign_ but longer than 100 characters", () => {
        fc.assert(
            fc.property(
                // Generate suffix that makes total length > 100
                fc.string({ minLength: 96, maxLength: 200 }).map((s) => "sign_" + s),
                (token) => {
                    expect(token.length).toBeGreaterThan(100)
                    expect(isValidSigningToken(token)).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.1**
     *
     * Non-string types are always rejected.
     */
    it("rejects non-string types", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer(),
                    fc.boolean(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.array(fc.string()),
                    fc.dictionary(fc.string(), fc.string())
                ),
                (input) => {
                    expect(isValidSigningToken(input)).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.1**
     *
     * The boundary case: exactly 100 characters is accepted, 101 is rejected.
     */
    it("accepts exactly 100-char token and rejects 101-char token", () => {
        const token100 = "sign_" + "a".repeat(95)
        expect(token100.length).toBe(100)
        expect(isValidSigningToken(token100)).toBe(true)

        const token101 = "sign_" + "a".repeat(96)
        expect(token101.length).toBe(101)
        expect(isValidSigningToken(token101)).toBe(false)
    })
})

// ── Property 19: Signature Data URL Validation ─────────────────────────

describe("Feature: security-hardening, Property 19: Signature data URL validation", () => {
    /**
     * Helper: build a valid data:image/ URL from raw bytes of a given size.
     */
    function buildDataUrl(byteSize: number, mimeSubtype = "png"): string {
        // Create a buffer of the desired size and encode to base64
        const buf = Buffer.alloc(byteSize, 0x41) // fill with 'A'
        return `data:image/${mimeSubtype};base64,${buf.toString("base64")}`
    }

    /**
     * **Validates: Requirements 12.6**
     *
     * Valid data:image/ URLs with decoded size ≤ 500KB are accepted.
     */
    it("accepts data:image/ URLs with decoded size ≤ 500KB", () => {
        fc.assert(
            fc.property(
                // Generate sizes from 1 byte up to exactly 500KB
                fc.integer({ min: 1, max: MAX_DECODED_IMAGE_SIZE }),
                fc.constantFrom("png", "jpeg", "webp", "gif", "svg+xml"),
                (size, subtype) => {
                    const url = buildDataUrl(size, subtype)
                    const result = validateSignatureDataUrl(url)
                    expect(result.valid).toBe(true)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.6**
     *
     * Data URLs with decoded size > 500KB are rejected.
     */
    it("rejects data:image/ URLs with decoded size > 500KB", () => {
        fc.assert(
            fc.property(
                // Generate sizes just above 500KB up to 1MB
                fc.integer({ min: MAX_DECODED_IMAGE_SIZE + 1, max: 1024 * 1024 }),
                (size) => {
                    const url = buildDataUrl(size)
                    const result = validateSignatureDataUrl(url)
                    expect(result.valid).toBe(false)
                    if (!result.valid) {
                        expect(result.reason).toContain("too large")
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.6**
     *
     * URLs that don't start with "data:image/" are rejected.
     */
    it("rejects URLs that do not start with data:image/", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 200 }).filter(
                    (s) => !s.startsWith("data:image/")
                ),
                (url) => {
                    const result = validateSignatureDataUrl(url)
                    expect(result.valid).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.6**
     *
     * data:image/ URLs missing the comma separator are rejected.
     */
    it("rejects data:image/ URLs without comma separator", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !s.includes(",")),
                (suffix) => {
                    const url = "data:image/png;base64" + suffix
                    // Only test if there's truly no comma
                    if (!url.includes(",")) {
                        const result = validateSignatureDataUrl(url)
                        expect(result.valid).toBe(false)
                        if (!result.valid) {
                            expect(result.reason).toContain("format")
                        }
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.6**
     *
     * Non-string types are always rejected.
     */
    it("rejects non-string types", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.integer(),
                    fc.boolean(),
                    fc.constant(null),
                    fc.constant(undefined),
                    fc.array(fc.string())
                ),
                (input) => {
                    const result = validateSignatureDataUrl(input)
                    expect(result.valid).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 12.6**
     *
     * Boundary: exactly 500KB decoded is accepted, 500KB + 1 byte is rejected.
     */
    it("accepts exactly 500KB and rejects 500KB + 1 byte", () => {
        const urlExact = buildDataUrl(MAX_DECODED_IMAGE_SIZE)
        expect(validateSignatureDataUrl(urlExact).valid).toBe(true)

        const urlOver = buildDataUrl(MAX_DECODED_IMAGE_SIZE + 1)
        expect(validateSignatureDataUrl(urlOver).valid).toBe(false)
    })
})
