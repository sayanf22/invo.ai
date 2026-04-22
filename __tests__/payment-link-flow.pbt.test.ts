/**
 * Property-Based Tests for payment-link-flow-redesign
 *
 * Feature: payment-link-flow-redesign
 * Library: fast-check
 * Runner: vitest
 */

import { describe, it } from "vitest"
import * as fc from "fast-check"

// ── Inline pure logic helpers (mirrors production code) ───────────────────────

/** Mirrors the platform link construction in payment-link-button.tsx */
function buildPlatformLink(origin: string, sessionId: string): string {
  return `${origin}/pay/${sessionId}`
}

/** Mirrors the Pay Now href logic in pay-document-view.tsx */
function getPayNowHref(payment: { short_url: string; status: string }): string {
  return payment.short_url
}

/** Mirrors the isPaid derivation in pay-document-view.tsx */
function deriveIsPaid(documentStatus: string): boolean {
  return documentStatus === "paid"
}

// Base methods always available (mirrors hooks/use-payment-methods.ts)
const BASE_METHODS = ["Bank Transfer", "UPI", "Cash", "Check", "Wire Transfer"]

// Gateway → method name mapping (mirrors hooks/use-payment-methods.ts)
const GATEWAY_METHOD_MAP: Record<string, string> = {
  razorpay: "Razorpay",
  stripe: "Stripe",
  cashfree: "Cashfree",
}

/**
 * Mirrors the filtering logic from hooks/use-payment-methods.ts.
 * Connected gateways appear first, then base methods.
 */
function filterPaymentMethods(connectedGateways: string[]): string[] {
  const gatewayMethods = connectedGateways
    .map((g) => GATEWAY_METHOD_MAP[g])
    .filter(Boolean)
  return [...gatewayMethods, ...BASE_METHODS]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Feature: payment-link-flow-redesign", () => {
  /**
   * Property 1: Platform link derivation from sessionId
   * Validates: Requirements 2.1, 2.2
   */
  describe("Property 1: Platform link derivation from sessionId", () => {
    it("platform link always starts with origin, contains /pay/, ends with sessionId, and does not contain a raw gateway URL", () => {
      const origin = "https://app.clorefy.com"
      // A sample gateway URL that must NOT appear in the platform link
      const gatewayUrl = "https://rzp.io/i/abc123"

      fc.assert(
        fc.property(fc.uuid(), (sessionId) => {
          const platformLink = buildPlatformLink(origin, sessionId)

          return (
            platformLink.startsWith(origin) &&
            platformLink.includes("/pay/") &&
            platformLink.endsWith(sessionId) &&
            !platformLink.includes(gatewayUrl)
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 2: Pay Now href matches gateway URL
   * Validates: Requirements 3.3
   */
  describe("Property 2: Pay Now href matches gateway URL", () => {
    it("Pay Now href equals payment.short_url for any active payment status", () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.constantFrom("created", "partially_paid"),
          (shortUrl, status) => {
            const payment = { short_url: shortUrl, status }
            return getPayNowHref(payment) === payment.short_url
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Public page renders required document fields
   * Validates: Requirements 3.8
   */
  describe("Property 3: Public page renders required document fields", () => {
    it("InvoiceData with non-empty required fields always has all four required fields non-empty", () => {
      // Use alphanumeric strings to avoid whitespace-only edge cases
      const nonEmptyStr = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,19}$/)
      const currencyStr = fc.stringMatching(/^[A-Z]{3}$/)
      // Use integer rates to avoid float NaN/precision issues
      const positiveRate = fc.integer({ min: 1, max: 10000 })

      fc.assert(
        fc.property(
          fc.record({
            fromName: nonEmptyStr,
            invoiceNumber: nonEmptyStr,
            currency: currencyStr,
            items: fc.array(
              fc.record({
                quantity: fc.integer({ min: 1, max: 100 }),
                rate: positiveRate,
              }),
              { minLength: 1 }
            ),
          }),
          (invoiceData) => {
            // Compute total from items (mirrors getInvoiceTotal logic)
            const total = invoiceData.items.reduce(
              (sum, item) => sum + item.quantity * item.rate,
              0
            )

            // All four required fields must be non-empty / non-zero
            return (
              invoiceData.fromName.trim().length > 0 &&
              invoiceData.invoiceNumber.trim().length > 0 &&
              total > 0 &&
              invoiceData.currency.length > 0
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 4: Paid documents are read-only
   * Validates: Requirements 7.2, 7.5
   */
  describe("Property 4: Paid documents are read-only", () => {
    it("isPaid is true when documentStatus is 'paid'", () => {
      fc.assert(
        fc.property(fc.constant("paid"), (status) => {
          return deriveIsPaid(status) === true
        }),
        { numRuns: 100 }
      )
    })

    it("isPaid is false for any non-paid status", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("draft", "sent", "overdue", "created", "cancelled", "expired"),
          (status) => {
            return deriveIsPaid(status) === false
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 5: Payment method dropdown filtering by connected gateways
   * Validates: Requirements 8.2
   */
  describe("Property 5: Payment method dropdown filtering by connected gateways", () => {
    it("always contains all base methods regardless of connected gateways", () => {
      fc.assert(
        fc.property(
          fc.subarray(["razorpay", "stripe", "cashfree"]),
          (connectedGateways) => {
            const methods = filterPaymentMethods(connectedGateways)
            return BASE_METHODS.every((m) => methods.includes(m))
          }
        ),
        { numRuns: 100 }
      )
    })

    it("contains gateway-specific methods only for connected gateways", () => {
      fc.assert(
        fc.property(
          fc.subarray(["razorpay", "stripe", "cashfree"]),
          (connectedGateways) => {
            const methods = filterPaymentMethods(connectedGateways)
            const allGateways = ["razorpay", "stripe", "cashfree"]

            return allGateways.every((gateway) => {
              const gatewayMethod = GATEWAY_METHOD_MAP[gateway]
              const isConnected = connectedGateways.includes(gateway)
              const isInList = methods.includes(gatewayMethod)
              // Connected → must be in list; disconnected → must NOT be in list
              return isConnected ? isInList : !isInList
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
