/**
 * Unit Tests — Bug 2: Cancelled document signing link (GET /api/signatures?token=...)
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.4, 3.11
 *
 * Tests:
 *  1. GET with a token whose parent session has status="cancelled" but signer_action=null
 *     → assert HTTP 410 with body { cancelled: true }
 *  2. GET with a token whose parent session has status="sent" (finalized)
 *     → assert HTTP 200 (no regression on valid tokens)
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: vi.fn(),
  validateBodySize: vi.fn().mockReturnValue(null),
  getClientIP: vi.fn().mockReturnValue("1.2.3.4"),
}))

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/signature-audit", () => ({
  recordAuditEvent: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/r2", () => ({
  getObject: vi.fn().mockResolvedValue(null),
}))

// ── Supabase mock factory ──────────────────────────────────────────────────────

/**
 * Build a Supabase service-role client mock that returns:
 *  - the given signature row for signatures.select(...).eq("token", token).single()
 *  - the given session row for document_sessions.select("status").eq("id", ...).single()
 *  - no-op for audit-event / notification inserts
 */
function buildServiceSupabaseMock(opts: {
  signatureRow: Record<string, unknown>
  sessionStatus: string | null
}) {
  const { signatureRow, sessionStatus } = opts

  return {
    rpc: vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 100, retry_after: 0 }],
      error: null,
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "signatures") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: signatureRow,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }
      }

      if (table === "document_sessions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: sessionStatus !== null ? {
                  status: sessionStatus,
                  sent_at: null,
                  user_id: "owner-user-id",
                  document_type: "contract",
                  context: {},
                  auto_invoice_on_sign: false,
                  public_id: "b".repeat(64),
                } : null,
                error: sessionStatus !== null ? null : { message: "not found" },
              }),
            }),
          }),
        }
      }

      if (table === "signature_audit_events") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
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

      // Default: no-op for notifications, audit_events, etc.
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    },
  }
}

// ── Mock @supabase/supabase-js createClient ────────────────────────────────────

const mockCreateClient = vi.fn()
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

// ── Helper ─────────────────────────────────────────────────────────────────────

const VALID_TOKEN = "sign_" + "a".repeat(32)
const SESSION_ID = "session-uuid-1234-5678-abcd-ef0123456789"

function makeTokenRequest(token: string): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/signatures?token=${token}`)
  )
}

const baseSignatureRow = {
  id: "sig-uuid-123",
  token: VALID_TOKEN,
  signer_name: "Jane Doe",
  signer_email: "jane@example.com",
  party: "Client",
  signed_at: null,
  signer_action: null,    // <-- not yet cancelled at the signature level
  expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  session_id: SESSION_ID,
  document_id: "doc-uuid-123",
  signature_image_url: null,
  verification_url: null,
  documents: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/signatures?token — Bug 2: cancelled session returns 410", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Provide dummy env vars so createClient doesn't throw
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"
  })

  /**
   * Bug condition: parent session has status="cancelled" but signer_action is null
   * → Must return HTTP 410 with { cancelled: true }
   *
   * Validates: Requirements 2.1, 2.2
   */
  it("returns 410 with { cancelled: true } when parent session is cancelled and signer_action is null", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: null },
      sessionStatus: "cancelled",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.cancelled).toBe(true)
    expect(body.error).toContain("cancelled")
  })

  /**
   * Bug condition 2: parent session has status="cancelled" AND signer_action is also "cancelled"
   * → Must still return HTTP 410 with { cancelled: true }
   *
   * Validates: Requirements 2.1, 2.2
   */
  it("returns 410 when both session is cancelled and signer_action is cancelled", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: "cancelled" },
      sessionStatus: "cancelled",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.cancelled).toBe(true)
  })

  /**
   * Preservation: parent session has status="finalized" (sent), signer_action is null
   * → Must return HTTP 200 — no regression on valid signing tokens
   *
   * Validates: Requirement 3.4
   */
  it("returns 200 when parent session status is finalized (sent) and token is valid", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: null },
      sessionStatus: "finalized",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    // Should NOT be 410 — this is a valid signing token
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cancelled).toBeUndefined()
    expect(body.signature).toBeDefined()
  })

  /**
   * Preservation: parent session has status="sent", signer_action is null
   * → Must return HTTP 200
   *
   * Validates: Requirement 3.4
   */
  it("returns 200 when parent session status is sent and token is valid", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: null },
      sessionStatus: "sent",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.cancelled).toBeUndefined()
  })

  /**
   * Preservation: parent session has status="active" (not cancelled, not sent)
   * → Must NOT return 410 due to session check
   *
   * Validates: Requirement 3.4
   */
  it("does not return 410 for session status active", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: null },
      sessionStatus: "active",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    // Status active = not cancelled, so should not get 410
    expect(res.status).not.toBe(410)
  })

  /**
   * Existing behavior preserved: signer_action === "cancelled" → still 410
   * even if parent session is not "cancelled"
   *
   * Validates: Requirements 2.1, 3.4 (preservation of existing signer_action check)
   */
  it("returns 410 when signer_action is cancelled even if session is not cancelled", async () => {
    const mockSupabase = buildServiceSupabaseMock({
      signatureRow: { ...baseSignatureRow, signer_action: "cancelled" },
      sessionStatus: "finalized",
    })
    mockCreateClient.mockReturnValue(mockSupabase)

    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest(VALID_TOKEN)
    const res = await GET(req)

    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.cancelled).toBe(true)
  })

  /**
   * Invalid token format returns 404 (not changed by this fix)
   */
  it("returns 404 for invalid token format", async () => {
    const { GET } = await import("@/app/api/signatures/route")
    const req = makeTokenRequest("invalid-token")
    const res = await GET(req)
    expect(res.status).toBe(404)
  })
})
