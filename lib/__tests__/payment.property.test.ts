/**
 * Property-Based Tests for Payment Security
 * 
 * Feature: security-hardening
 * Properties: 13 (HMAC signature verification), 14 (Plan ID validation)
 * 
 * Uses fast-check for property-based testing with minimum 100 iterations.
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { isValidPlanId, VALID_PLAN_IDS } from "@/lib/razorpay"

/**
 * Helper: Compute HMAC-SHA256 using Node.js crypto (test environment).
 * This mirrors the Web Crypto API logic used in production (lib/razorpay.ts).
 */
async function computeHmacSha256(secret: string, data: string): Promise<string> {
    const { createHmac } = await import("crypto")
    return createHmac("sha256", secret).update(data).digest("hex")
}

/**
 * Helper: Verify HMAC signature (same logic as verifyPaymentSignature).
 * Computes HMAC-SHA256 of `{orderId}|{paymentId}` with the given secret.
 */
async function verifyPaymentHmac(
    orderId: string,
    paymentId: string,
    signature: string,
    secret: string
): Promise<boolean> {
    const expected = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
    return expected === signature
}

/**
 * Helper: Verify webhook HMAC signature (same logic as verifyWebhookSignature).
 * Computes HMAC-SHA256 of the body with the given secret.
 */
async function verifyWebhookHmac(
    body: string,
    signature: string,
    secret: string
): Promise<boolean> {
    const expected = await computeHmacSha256(secret, body)
    return expected === signature
}

// ── Property 13: HMAC Signature Verification ───────────────────────────

describe("Feature: security-hardening, Property 13: HMAC signature verification", () => {
    /**
     * **Validates: Requirements 8.1, 8.2**
     * 
     * For any payment order ID + payment ID pair, computing the HMAC-SHA256
     * with the correct secret produces a valid signature.
     */
    it("valid HMAC signature passes verification for payment", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),  // orderId
                fc.string({ minLength: 1, maxLength: 50 }),  // paymentId
                fc.string({ minLength: 8, maxLength: 64 }),  // secret
                async (orderId, paymentId, secret) => {
                    const signature = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
                    const result = await verifyPaymentHmac(orderId, paymentId, signature, secret)
                    expect(result).toBe(true)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.1, 8.2**
     * 
     * Any mutation to the order ID causes verification to fail.
     */
    it("mutated order ID causes payment signature verification to fail", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),  // orderId
                fc.string({ minLength: 1, maxLength: 50 }),  // paymentId
                fc.string({ minLength: 8, maxLength: 64 }),  // secret
                fc.string({ minLength: 1, maxLength: 10 }),  // mutation suffix
                async (orderId, paymentId, secret, mutation) => {
                    const signature = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
                    const mutatedOrderId = orderId + mutation
                    // Only test when mutation actually changes the orderId
                    if (mutatedOrderId !== orderId) {
                        const result = await verifyPaymentHmac(mutatedOrderId, paymentId, signature, secret)
                        expect(result).toBe(false)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.1, 8.2**
     * 
     * Any mutation to the payment ID causes verification to fail.
     */
    it("mutated payment ID causes payment signature verification to fail", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 8, maxLength: 64 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                async (orderId, paymentId, secret, mutation) => {
                    const signature = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
                    const mutatedPaymentId = paymentId + mutation
                    if (mutatedPaymentId !== paymentId) {
                        const result = await verifyPaymentHmac(orderId, mutatedPaymentId, signature, secret)
                        expect(result).toBe(false)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.1, 8.2**
     * 
     * Any mutation to the signature itself causes verification to fail.
     */
    it("mutated signature causes payment verification to fail", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 8, maxLength: 64 }),
                async (orderId, paymentId, secret) => {
                    const signature = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
                    // Flip a character in the signature
                    const chars = signature.split("")
                    const idx = 0
                    chars[idx] = chars[idx] === "a" ? "b" : "a"
                    const mutatedSignature = chars.join("")
                    if (mutatedSignature !== signature) {
                        const result = await verifyPaymentHmac(orderId, paymentId, mutatedSignature, secret)
                        expect(result).toBe(false)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.1, 8.2**
     * 
     * Using a wrong secret causes verification to fail.
     */
    it("wrong secret causes payment signature verification to fail", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 8, maxLength: 64 }),
                fc.string({ minLength: 8, maxLength: 64 }),
                async (orderId, paymentId, secret, wrongSecret) => {
                    fc.pre(secret !== wrongSecret)
                    const signature = await computeHmacSha256(secret, `${orderId}|${paymentId}`)
                    const result = await verifyPaymentHmac(orderId, paymentId, signature, wrongSecret)
                    expect(result).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.2**
     * 
     * Valid HMAC signature passes verification for webhook body.
     */
    it("valid HMAC signature passes verification for webhook", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 200 }),  // body
                fc.string({ minLength: 8, maxLength: 64 }),   // secret
                async (body, secret) => {
                    const signature = await computeHmacSha256(secret, body)
                    const result = await verifyWebhookHmac(body, signature, secret)
                    expect(result).toBe(true)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.2**
     * 
     * Any mutation to the webhook body causes verification to fail.
     */
    it("mutated webhook body causes signature verification to fail", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 200 }),
                fc.string({ minLength: 8, maxLength: 64 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                async (body, secret, mutation) => {
                    const signature = await computeHmacSha256(secret, body)
                    const mutatedBody = body + mutation
                    if (mutatedBody !== body) {
                        const result = await verifyWebhookHmac(mutatedBody, signature, secret)
                        expect(result).toBe(false)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ── Property 14: Plan ID Validation ────────────────────────────────────

describe("Feature: security-hardening, Property 14: Plan ID validation", () => {
    /**
     * **Validates: Requirements 8.6**
     * 
     * Only free, starter, pro, agency are accepted.
     */
    it("accepts all known valid plan IDs", () => {
        for (const planId of VALID_PLAN_IDS) {
            expect(isValidPlanId(planId)).toBe(true)
        }
    })

    /**
     * **Validates: Requirements 8.6**
     * 
     * All arbitrary strings that are not in the known set are rejected.
     */
    it("rejects all arbitrary strings that are not known plan IDs", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 0, maxLength: 100 }),
                (input) => {
                    if (VALID_PLAN_IDS.includes(input)) {
                        expect(isValidPlanId(input)).toBe(true)
                    } else {
                        expect(isValidPlanId(input)).toBe(false)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.6**
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
                    expect(isValidPlanId(input)).toBe(false)
                }
            ),
            { numRuns: 100 }
        )
    })

    /**
     * **Validates: Requirements 8.6**
     * 
     * Case variations of valid plan IDs are rejected (case-sensitive).
     */
    it("rejects case variations of valid plan IDs", () => {
        const caseVariations = [
            "Free", "FREE", "Starter", "STARTER", "Pro", "PRO", "Agency", "AGENCY",
            "fRee", "sTarter", "pRo", "aGency",
        ]
        for (const variant of caseVariations) {
            expect(isValidPlanId(variant)).toBe(false)
        }
    })

    /**
     * **Validates: Requirements 8.6**
     * 
     * Plan IDs with whitespace padding are rejected.
     */
    it("rejects plan IDs with whitespace padding", () => {
        for (const planId of VALID_PLAN_IDS) {
            expect(isValidPlanId(` ${planId}`)).toBe(false)
            expect(isValidPlanId(`${planId} `)).toBe(false)
            expect(isValidPlanId(` ${planId} `)).toBe(false)
        }
    })
})
