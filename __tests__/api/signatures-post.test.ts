/**
 * Unit tests for POST /api/signatures
 * app/api/signatures/route.ts
 *
 * Requirements: 1.1, 9.5
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(),
  validateBodySize: vi.fn().mockReturnValue(null),
  getClientIP: vi.fn().mockReturnValue("1.2.3.4"),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/mailtrap", () => ({
  sendEmail: vi.fn(),
}))

vi.mock("@/lib/document-fingerprint", () => ({
  computeDocumentFingerprint: vi.fn().mockReturnValue("a".repeat(64)),
}))

vi.mock("@/lib/signature-audit", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}))

// ── Imports after mocks ────────────────────────────────────────────────

import { POST } from "@/app/api/signatures/route"
import { authenticateRequest } from "@/lib/api-auth"
import { sendEmail } from "@/lib/mailtrap"

// ── Constants ──────────────────────────────────────────────────────────

const MOCK_SESSION_ID = "session-uuid-123"
const MOCK_DOCUMENT_ID = "doc-uuid-456"
const MOCK_SIGNATURE_ID = "sig-uuid-789"
const MOCK_HASH = "a".repeat(64)

const mockUser = { id: "user-abc" }

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/signatures", {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify(body),
  })
}

function buildSupabaseMock(opts: { insertSpy?: ReturnType<typeof vi.fn> } = {}) {
  const insertSpy = opts.insertSpy ?? vi.fn()

  return {
    insertSpy,
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "document_sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: MOCK_SESSION_ID,
                    user_id: mockUser.id,
                    document_id: MOCK_DOCUMENT_ID,
                    document_type: "contract",
                    context: { referenceNumber: "CTR-001", clientName: "Acme" },
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "businesses") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { name: "Test Corp", logo_url: null },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "signatures") {
          return {
            insert: insertSpy.mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: MOCK_SIGNATURE_ID,
                    document_id: MOCK_DOCUMENT_ID,
                    signer_email: "signer@example.com",
                    signer_name: "Jane Doe",
                    party: "Client",
                    token: "sign_" + "0".repeat(32),
                    document_hash: MOCK_HASH,
                    session_id: MOCK_SESSION_ID,
                    expires_at: new Date(Date.now() + 604800000).toISOString(),
                    created_at: new Date().toISOString(),
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        // fallback
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }
      }),
    },
  }
}

const validBody = {
  sessionId: MOCK_SESSION_ID,
  signerEmail: "signer@example.com",
  signerName: "Jane Doe",
  party: "Client",
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("POST /api/signatures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    const { NextResponse } = await import("next/server")
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null,
      supabase: null,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(401)
  })

  it("returns 400 when sessionId is missing", async () => {
    const { supabase } = buildSupabaseMock()
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(makeRequest({ signerEmail: "a@b.com", signerName: "Bob" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("sessionId")
  })

  it("returns 400 for invalid email format", async () => {
    const { supabase } = buildSupabaseMock()
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(makeRequest({ sessionId: MOCK_SESSION_ID, signerEmail: "not-an-email", signerName: "Bob" }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("email")
  })

  it("returns 404 when session is not found", async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "document_sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
              }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    }
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(404)
  })

  it("returns 403 when session belongs to a different user", async () => {
    const supabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "document_sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: MOCK_SESSION_ID,
                    user_id: "other-user-id",
                    document_id: MOCK_DOCUMENT_ID,
                    document_type: "contract",
                    context: {},
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }),
    }
    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(403)
  })

  // Sub-task 5.5: Test that signature record is NOT created when email fails
  it("does NOT create signature record when email send fails (atomic)", async () => {
    const { insertSpy, supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    // Email fails
    vi.mocked(sendEmail).mockResolvedValue({
      success: false,
      statusCode: 500,
      message: "SMTP error",
    })

    const res = await POST(makeRequest(validBody))

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain("email")

    // The signatures.insert should NOT have been called
    expect(insertSpy).not.toHaveBeenCalled()
  })

  // Sub-task 5.5: Test that document_hash is set correctly
  it("sets document_hash on the signature row using computeDocumentFingerprint", async () => {
    const { insertSpy, supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    // insertSpy was called with an object containing document_hash = MOCK_HASH
    expect(insertSpy).toHaveBeenCalledOnce()
    const insertArg = insertSpy.mock.calls[0][0]
    expect(insertArg.document_hash).toBe(MOCK_HASH)
  })

  // Sub-task 5.5: Test that verification_url is correct
  it("sets verification_url to https://clorefy.com/verify/[signatureId]", async () => {
    const { supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.signature.verification_url).toBe(`https://clorefy.com/verify/${MOCK_SIGNATURE_ID}`)
  })

  it("sets session_id on the signature row", async () => {
    const { insertSpy, supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    await POST(makeRequest(validBody))

    const insertArg = insertSpy.mock.calls[0][0]
    expect(insertArg.session_id).toBe(MOCK_SESSION_ID)
  })

  it("sets expires_at to exactly created_at + 604800 seconds", async () => {
    const { insertSpy, supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    const before = Date.now()
    await POST(makeRequest(validBody))
    const after = Date.now()

    const insertArg = insertSpy.mock.calls[0][0]
    const createdAt = new Date(insertArg.created_at).getTime()
    const expiresAt = new Date(insertArg.expires_at).getTime()
    const diff = expiresAt - createdAt

    // Should be exactly 604800000 ms (7 days)
    expect(diff).toBe(604800 * 1000)

    // created_at should be within the test window
    expect(createdAt).toBeGreaterThanOrEqual(before)
    expect(createdAt).toBeLessThanOrEqual(after)
  })

  it("defaults party to 'Client' when not provided", async () => {
    const { insertSpy, supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    const bodyWithoutParty = { sessionId: MOCK_SESSION_ID, signerEmail: "signer@example.com", signerName: "Jane" }
    await POST(makeRequest(bodyWithoutParty))

    const insertArg = insertSpy.mock.calls[0][0]
    expect(insertArg.party).toBe("Client")
  })

  it("returns 200 with signingUrl on success", async () => {
    const { supabase } = buildSupabaseMock()

    vi.mocked(authenticateRequest).mockResolvedValue({
      error: null,
      user: mockUser as any,
      supabase: supabase as any,
    })

    vi.mocked(sendEmail).mockResolvedValue({ success: true, messageIds: ["msg-1"] })

    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.signingUrl).toMatch(/^https:\/\/clorefy\.com\/sign\/sign_[0-9a-f]{32}$/)
    expect(body.expiresAt).toBeDefined()
  })
})
