/**
 * Verifies that /api/sessions/unlock (the route the CHAT "cancel" flow uses)
 * correctly handles onboarding forms:
 *  - blocks unlock/cancel once the client has SUBMITTED the form
 *  - expires any outstanding fill link (pending/in_progress) on unlock so the
 *    public /onboard link stops working immediately
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

function buildDb(opts: { submitted?: boolean; expired?: Array<{ id: string }> }) {
  const onboardingUpdate = vi.fn(() => ({
    eq: () => ({ eq: () => ({ in: () => ({ select: async () => ({ data: opts.expired ?? [], error: null }) }) }) }),
  }))
  const documentSessions = {
    select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: { id: sessionId, status: "finalized", document_type: "client_onboarding_form" }, error: null,
    }) }) }) }),
    update: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: sessionId }, error: null }) }) }) }) }) }),
  }
  const onboardingForms = {
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({
      data: opts.submitted ? { id: "form-submitted" } : null, error: null,
    }) }) }) }) }) }),
    update: onboardingUpdate,
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
      if (table === "onboarding_forms") return onboardingForms
      if (table === "signatures") return signatures
      if (table === "invoice_payments") return invoicePayments
      if (table === "email_schedules") return emailSchedules
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
  return { db, onboardingUpdate }
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

describe("POST /api/sessions/unlock — onboarding forms", () => {
  it("blocks unlock/cancel when the client already submitted the form", async () => {
    const { db, onboardingUpdate } = buildDb({ submitted: true })
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/sessions/unlock/route")

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.status).toBe("submitted")
    // Never voids/expires or mutates a submitted form.
    expect(onboardingUpdate).not.toHaveBeenCalled()
  })

  it("expires the outstanding fill link when unlocking a sent form", async () => {
    const { db, onboardingUpdate } = buildDb({ submitted: false, expired: [{ id: "form-1" }] })
    mocks.createClient.mockReturnValue(db)
    const { POST } = await import("@/app/api/sessions/unlock/route")

    const res = await POST(request())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.onboardingLinkVoided).toBe(true)
    expect(onboardingUpdate).toHaveBeenCalled()
  })
})
