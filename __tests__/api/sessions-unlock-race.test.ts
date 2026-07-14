import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), validateOrigin: vi.fn(), validateBodySize: vi.fn(),
  validateCsrf: vi.fn(), checkRateLimit: vi.fn(), createClient: vi.fn(),
  getCredentials: vi.fn(), cancelProviderLink: vi.fn(), logAudit: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  authenticateRequest: mocks.authenticate,
  validateOrigin: mocks.validateOrigin,
  validateBodySize: mocks.validateBodySize,
}))
vi.mock("@/lib/csrf", () => ({ validateCSRFToken: mocks.validateCsrf }))
vi.mock("@/lib/rate-limiter", () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/payment-credentials", () => ({ getUserPaymentCredentials: mocks.getCredentials }))
vi.mock("@/lib/payment-link-provider", () => ({ cancelProviderLink: mocks.cancelProviderLink }))
vi.mock("@/lib/audit-log", () => ({ logAudit: mocks.logAudit }))

const sessionId = "12345678-1234-4123-8123-123456789012"

function request() {
  return new NextRequest("https://clorefy.com/api/sessions/unlock", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify({ sessionId }),
  })
}

function selectWithTwoEq(result: unknown) {
  return vi.fn(() => ({
    eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(result) })) })),
  }))
}

function buildRaceDb() {
  const documentUpdate = vi.fn()
  const documentSessions = {
    select: selectWithTwoEq({
      data: { id: sessionId, status: "finalized", document_type: "invoice" }, error: null,
    }),
    update: documentUpdate,
  }

  const signatureSelect = vi.fn(() => {
    const firstRead = signatureSelect.mock.calls.length === 1
    const data = firstRead ? [] : [{ signed_at: "2026-07-14T10:00:00.000Z", signer_action: "signed" }]
    return {
      eq: vi.fn(() => ({ not: vi.fn().mockResolvedValue({ data, error: null }) })),
    }
  })
  const finalIs = vi.fn().mockResolvedValue({ error: null })
  const signatures = {
    select: signatureSelect,
    update: vi.fn(() => ({
      eq: vi.fn(() => ({ is: vi.fn(() => ({ is: finalIs })) })),
    })),
  }
  const invoicePayments = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
      })),
    })),
  }
  const db = {
    from: vi.fn((table: string) => {
      if (table === "document_sessions") return documentSessions
      if (table === "signatures") return signatures
      if (table === "invoice_payments") return invoicePayments
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
  return { db, documentUpdate, signatures }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mocks.validateOrigin.mockReturnValue(null)
  mocks.validateBodySize.mockReturnValue(null)
  mocks.validateCsrf.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.authenticate.mockResolvedValue({
    error: null, user: { id: "user-1" }, supabase: { from: vi.fn() },
  })
})

describe("POST /api/sessions/unlock signing race", () => {
  it("keeps the document locked when a signature lands during unlock", async () => {
    const { db, documentUpdate, signatures } = buildRaceDb()
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/sessions/unlock/route")

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.status).toBe("signed")
    expect(body.error).toContain("while unlock was in progress")
    expect(signatures.update).toHaveBeenCalledOnce()
    expect(documentUpdate).not.toHaveBeenCalled()
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })
})