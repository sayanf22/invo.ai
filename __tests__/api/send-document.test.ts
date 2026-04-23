/**
 * Unit tests for Send Document API
 * app/api/emails/send-document/route.ts
 *
 * Requirements: 2.1, 2.2, 2.4, 2.8, 2.11, 8.2
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(),
  sanitizeError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Internal server error"
  ),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock("@/lib/mailtrap", () => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/email-template", () => ({
  generateEmailSubject: vi.fn().mockReturnValue("Invoice INV-001 from Test Business"),
  renderEmailTemplate: vi.fn().mockReturnValue("<html>email</html>"),
}))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

// ── Imports after mocks ────────────────────────────────────────────────

import { POST } from "@/app/api/emails/send-document/route"
import { authenticateRequest } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"
import { sendEmail } from "@/lib/mailtrap"

// ── Helpers ────────────────────────────────────────────────────────────

const createSupabaseMock = (overrides = {}) => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: "email-record-id" }, error: null }),
      }),
    }),
  }),
  ...overrides,
})

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/emails/send-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const mockUser = { id: "user-123" }

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/emails/send-document", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue(null)
  })

  it("returns 401 without auth", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      supabase: null,
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(401)
  })

  it("returns 400 for missing required fields", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: createSupabaseMock() as any,
    })

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Missing required fields")
  })

  it("returns 400 for invalid email format", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: createSupabaseMock() as any,
    })

    const res = await POST(makeRequest({ sessionId: "some-id", recipientEmail: "not-an-email" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("Invalid email format")
  })

  it("returns 400 for personal message > 500 chars", async () => {
    const supabase = createSupabaseMock()
    // Session found
    const sessionChain = {
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: "some-id", document_type: "invoice", context: {} },
        error: null,
      }),
    }
    supabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(sessionChain),
        }),
      }),
      insert: vi.fn(),
    })

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(
      makeRequest({
        sessionId: "some-id",
        recipientEmail: "test@example.com",
        personalMessage: "x".repeat(501),
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("500")
  })

  it("returns 404 for non-owned session", async () => {
    const supabase = createSupabaseMock()
    // maybeSingle returns null data (session not found / not owned)
    supabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    })

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(
      makeRequest({ sessionId: "some-id", recipientEmail: "test@example.com" })
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toContain("not found")
  })

  it("resend creates a new email record and returns 200 with emailId", async () => {
    const supabase = createSupabaseMock()

    // Track which table is being queried
    supabase.from = vi.fn().mockImplementation((table: string) => {
      if (table === "document_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "some-id", document_type: "invoice", context: { invoiceNumber: "INV-001" } },
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      if (table === "businesses") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: "Test Business", logo_url: null },
                error: null,
              }),
            }),
          }),
        }
      }
      if (table === "invoice_payments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === "document_emails") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "new-email-record-id" },
                error: null,
              }),
            }),
          }),
        }
      }
      // audit_logs fallback
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-123"] })

    const res = await POST(
      makeRequest({ sessionId: "some-id", recipientEmail: "test@example.com", resend: true })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.emailId).toBeDefined()
  })
})
