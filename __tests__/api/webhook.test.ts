/**
 * Unit tests for Webhook Handler
 * app/api/emails/webhook/route.ts
 *
 * Requirements: 7.2, 7.6, 7.7, 7.8, 7.9
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────

const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          select: mockSelect.mockResolvedValue({ data: [{ id: "email-1" }], error: null }),
        }),
      }),
    }),
  })),
}))

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body)
  return new NextRequest("http://localhost/api/emails/webhook", {
    method: "POST",
    body: bodyStr,
    headers: { "Content-Type": "application/json", ...headers },
  })
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/emails/webhook", () => {
  beforeEach(() => {
    delete process.env.MAILTRAP_WEBHOOK_SIGNATURE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key"
    vi.clearAllMocks()

    // Re-apply default mock chain after clearAllMocks
    mockSelect.mockResolvedValue({ data: [{ id: "email-1" }], error: null })
    mockEq.mockReturnValue({ select: mockSelect })
    mockUpdate.mockReturnValue({ eq: mockEq })
  })

  it("processes events array correctly", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const res = await POST(
      makeRequest({
        events: [
          {
            event: "delivery",
            message_id: "msg-1",
            event_id: "evt-1",
            timestamp: 1700000000,
          },
        ],
      })
    )

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "delivered",
      delivered_at: expect.any(String),
      updated_at: expect.any(String),
    })
    expect(mockEq).toHaveBeenCalledWith("mailtrap_message_id", "msg-1")
  })

  it("processes duplicate event_ids without error (idempotency - no crash)", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const res = await POST(
      makeRequest({
        events: [
          {
            event: "delivery",
            message_id: "msg-1",
            event_id: "evt-1",
            timestamp: 1700000000,
          },
          {
            event: "delivery",
            message_id: "msg-1",
            event_id: "evt-1",
            timestamp: 1700000000,
          },
        ],
      })
    )

    expect(res.status).toBe(200)
  })

  it("rejects invalid signatures when key is configured (returns 200 but skips processing)", async () => {
    process.env.MAILTRAP_WEBHOOK_SIGNATURE_KEY = "test-secret"

    const { POST } = await import("@/app/api/emails/webhook/route")

    const res = await POST(
      makeRequest(
        {
          events: [
            {
              event: "delivery",
              message_id: "msg-1",
              event_id: "evt-1",
              timestamp: 1700000000,
            },
          ],
        },
        { "X-Mailtrap-Signature": "wrong-signature" }
      )
    )

    expect(res.status).toBe(200)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("returns 200 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/emails/webhook/route")

    const res = await POST(makeRequest("not valid json"))

    expect(res.status).toBe(200)
  })

  it("returns 200 when no matching email record found", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    mockEq.mockReturnValue({ select: mockSelect })
    mockUpdate.mockReturnValue({ eq: mockEq })

    const { POST } = await import("@/app/api/emails/webhook/route")

    const res = await POST(
      makeRequest({
        events: [
          {
            event: "delivery",
            message_id: "msg-no-match",
            event_id: "evt-2",
            timestamp: 1700000000,
          },
        ],
      })
    )

    expect(res.status).toBe(200)
  })
})
