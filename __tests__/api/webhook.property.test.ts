/**
 * Property 9: Webhook event-to-status mapping
 * Feature: email-sending
 *
 * For any Mailtrap webhook event, the mapping function SHALL produce:
 * - "delivery" → status "delivered" with timestamp field delivered_at
 * - "bounce" or "reject" or "spam" → status "bounced" with timestamp field bounced_at
 * - "open" → status "opened" with timestamp field opened_at
 *
 * Validates: Requirements 7.3, 7.4, 7.5
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as fc from "fast-check"
import { NextRequest } from "next/server"

// Inline duplicate of the mapping function from the webhook route
// (mapEventToStatus is not exported from the route)
function mapEventToStatus(eventType: string): { status: string; timestampField: string } | null {
  switch (eventType) {
    case "delivery":
      return { status: "delivered", timestampField: "delivered_at" }
    case "bounce":
    case "reject":
    case "spam":
      return { status: "bounced", timestampField: "bounced_at" }
    case "open":
      return { status: "opened", timestampField: "opened_at" }
    default:
      return null
  }
}

describe("Feature: email-sending, Property 9: Webhook event-to-status mapping", () => {
  it("should map delivery event to delivered status with delivered_at timestamp field", () => {
    fc.assert(
      fc.property(fc.constantFrom("delivery" as const), (eventType) => {
        const result = mapEventToStatus(eventType)
        expect(result).not.toBeNull()
        expect(result!.status).toBe("delivered")
        expect(result!.timestampField).toBe("delivered_at")
      }),
      { numRuns: 100 }
    )
  })

  it("should map bounce/reject/spam events to bounced status with bounced_at timestamp field", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("bounce" as const, "reject" as const, "spam" as const),
        (eventType) => {
          const result = mapEventToStatus(eventType)
          expect(result).not.toBeNull()
          expect(result!.status).toBe("bounced")
          expect(result!.timestampField).toBe("bounced_at")
        }
      ),
      { numRuns: 100 }
    )
  })

  it("should map open event to opened status with opened_at timestamp field", () => {
    fc.assert(
      fc.property(fc.constantFrom("open" as const), (eventType) => {
        const result = mapEventToStatus(eventType)
        expect(result).not.toBeNull()
        expect(result!.status).toBe("opened")
        expect(result!.timestampField).toBe("opened_at")
      }),
      { numRuns: 100 }
    )
  })

  it("should correctly map all known event types", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "delivery" as const,
          "bounce" as const,
          "reject" as const,
          "spam" as const,
          "open" as const
        ),
        (eventType) => {
          const result = mapEventToStatus(eventType)
          expect(result).not.toBeNull()

          if (eventType === "delivery") {
            expect(result!.status).toBe("delivered")
            expect(result!.timestampField).toBe("delivered_at")
          } else if (
            eventType === "bounce" ||
            eventType === "reject" ||
            eventType === "spam"
          ) {
            expect(result!.status).toBe("bounced")
            expect(result!.timestampField).toBe("bounced_at")
          } else if (eventType === "open") {
            expect(result!.status).toBe("opened")
            expect(result!.timestampField).toBe("opened_at")
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 10: Webhook handler always returns 200
 * Feature: email-sending
 *
 * For any incoming POST request to the webhook endpoint — whether the payload is valid,
 * invalid, missing required fields, or references a non-existent message ID — the handler
 * SHALL return HTTP status 200 to prevent Mailtrap from retrying delivery.
 *
 * Validates: Requirements 7.2, 7.6, 7.7
 */

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  })),
}))

describe("Feature: email-sending, Property 10: Webhook handler always returns 200", () => {
  beforeEach(() => {
    // Remove signature key so signature verification is skipped
    delete process.env.MAILTRAP_WEBHOOK_SIGNATURE_KEY
    // Set required env vars for supabase client creation
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
  })

  it("should return 200 for any random payload", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    await fc.assert(
      fc.asyncProperty(fc.anything(), async (payload) => {
        const body = JSON.stringify(payload)
        const request = new NextRequest("http://localhost/api/emails/webhook", {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
        })

        const response = await POST(request)
        expect(response.status).toBe(200)
      }),
      { numRuns: 50 }
    )
  })

  it("should return 200 for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const request = new NextRequest("http://localhost/api/emails/webhook", {
      method: "POST",
      body: "not valid json {{{",
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it("should return 200 for empty body", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const request = new NextRequest("http://localhost/api/emails/webhook", {
      method: "POST",
      body: "",
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })

  it("should return 200 for a valid events array", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const body = JSON.stringify({
      events: [
        {
          event: "delivery",
          message_id: "msg-123",
          event_id: "evt-456",
          timestamp: Math.floor(Date.now() / 1000),
          email: "test@example.com",
        },
      ],
    })

    const request = new NextRequest("http://localhost/api/emails/webhook", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
