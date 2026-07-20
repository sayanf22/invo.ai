/**
 * Verifies that /api/sessions/unlock (the route the CHAT "cancel" flow uses)
 * blocks unlock/cancel once a quote/proposal recipient has formally responded
 * (accepted / declined / changes requested) — mirroring /api/sessions/cancel,
 * so a document the client already acted on can't be voided from chat.
 */

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

/**
 * @param response  a quotation_responses row to return, or null for "no response"
 * @param docType   the session document_type
 */
function buildDb(opts: { response: { response_type: string } | null; docType: string }) {
  const documentUpdate = vi.fn(() => ({
    eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: sessionId }, error: null }) }) }) }) }),
  }))
  const documentSessions = {
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { id: sessionId, status: "finalized", document_type: opts.docType }, error: null,
    }) }) }) }),
    update: documentUpdate,
  }
  const quotationResponses = {
    select: () => ({ eq: () => ({ limit: async () => ({ data: opts.response ? [opts.response] : [], error: null }) }) }),
  }
  const onboardingForms = {
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }) }),
    update: () => ({ eq: () => ({ eq: () => ({ in: () => ({ select: async () => ({ data: [], error: null }) }) }) }) }),
  }
  const signatures = {
    select: () => ({ eq: () => ({ not: async () => ({ data: [], error: null }) }) }),
    update: () => ({ eq: () => ({ is: () => ({ is: async () => ({ error: null }) }) }) }),
  }
  const invoicePayments = {
    select: () => ({ eq: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) }),
  }
  const emailSchedules = {
    update: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }) }),
  }
  const db = {
    from: vi.fn((table: string) => {
      if (table === "document_sessions") return documentSessions
      if (table === "quotation_responses") return quotationResponses
      if (table === "onboarding_forms") return onboardingForms
      if (table === "signatures") return signatures
      if (table === "invoice_payments") return invoicePayments
      if (table === "email_schedules") return emailSchedules
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
  return { db, documentUpdate }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mocks.validateOrigin.mockReturnValue(null)
  mocks.validateBodySize.mockReturnValue(null)
  mocks.validateCsrf.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.logAudit.mockResolvedValue(undefined)
  mocks.authenticate.mockResolvedValue({
    error: null, user: { id: "user-1" }, supabase: { from: vi.fn() },
  })
})

describe("POST /api/sessions/unlock — quote/proposal responses", () => {
  for (const response_type of ["accepted", "declined", "changes_requested"] as const) {
    it(`blocks unlock/cancel when the recipient has ${response_type}`, async () => {
      const { db, documentUpdate } = buildDb({ response: { response_type }, docType: "quote" })
      mocks.createClient.mockReturnValue(db)
      const { POST } = await import("@/app/api/sessions/unlock/route")

      const res = await POST(request())
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.status).toBe("responded")
      expect(body.responseType).toBe(response_type)
      // Must NOT flip the session back to active.
      expect(documentUpdate).not.toHaveBeenCalled()
    })
  }

  it("allows unlock when a quote has no client response yet", async () => {
    const { db, documentUpdate } = buildDb({ response: null, docType: "quote" })
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/sessions/unlock/route")

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(documentUpdate).toHaveBeenCalled()
  })
})
