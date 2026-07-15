import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(), validateOrigin: vi.fn(), validateBodySize: vi.fn(),
  validateCsrf: vi.fn(), checkRateLimit: vi.fn(), createClient: vi.fn(),
  getCredentials: vi.fn(), createRazorpayLink: vi.fn(), createStripeLink: vi.fn(),
  createCashfreeLink: vi.fn(), cancelProviderLink: vi.fn(), logAudit: vi.fn(),
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
vi.mock("@/lib/razorpay", () => ({ createPaymentLink: mocks.createRazorpayLink }))
vi.mock("@/lib/stripe-payments", () => ({ createStripePaymentLink: mocks.createStripeLink }))
vi.mock("@/lib/cashfree-payment-links", () => ({ createCashfreePaymentLink: mocks.createCashfreeLink }))
vi.mock("@/lib/payment-link-provider", () => ({ cancelProviderLink: mocks.cancelProviderLink }))
vi.mock("@/lib/audit-log", () => ({ logAudit: mocks.logAudit }))

import { POST } from "@/app/api/payments/create-link/route"

const sessionId = "12345678-1234-4123-8123-123456789012"
const credentials = {
  razorpay: { keyId: "rzp_test_key", keySecret: "rzp_test_secret", testMode: true },
}
const ownedInvoiceSession = {
  id: sessionId,
  public_id: "a".repeat(64),
  user_id: "user-1",
  document_type: "invoice",
  status: "finalized",
  context: {
    items: [{ description: "Consulting", quantity: 2, rate: 1250, discount: 10 }],
    discountType: "percent", discountValue: 10, taxRate: 18, shippingFee: 100,
    currency: "INR", invoiceNumber: "INV-SERVER-42", toName: "Server Customer",
    toEmail: "server@example.com", toPhone: "+919999999999", dueDate: "2027-02-01",
  },
}
type DbOptions = {
  session?: typeof ownedInvoiceSession | null
  sessionError?: unknown
  existingReads?: Array<{ data: Record<string, unknown> | null; error: unknown }>
  insertResult?: { data: Record<string, unknown> | null; error: unknown }
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "payment-new", short_url: "https://rzp.io/new", status: "created",
    razorpay_payment_link_id: "plink-new", gateway: "razorpay",
    amount: 248950, currency: "INR", ...overrides,
  }
}

function buildDb(options: DbOptions = {}) {
  const sessionResult = {
    data: options.session === undefined ? ownedInvoiceSession : options.session,
    error: options.sessionError ?? null,
  }
  const sessionUserEq = vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(sessionResult) }))
  const documentSessions = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ eq: sessionUserEq })),
    })),
  }

  const reads = options.existingReads ?? [{ data: null, error: null }]
  let readIndex = 0
  const invoicePayments = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            maybeSingle: vi.fn().mockImplementation(() =>
              Promise.resolve(reads[Math.min(readIndex++, reads.length - 1)])),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue(options.insertResult ?? {
          data: paymentRow(), error: null,
        }),
      })),
    })),
  }
  const db = {
    from: vi.fn((table: string) => {
      if (table === "document_sessions") return documentSessions
      if (table === "invoice_payments") return invoicePayments
      throw new Error(`Unexpected table: ${table}`)
    }),
  }
  return { db, invoicePayments, sessionUserEq }
}

function request(extra: Record<string, unknown> = {}) {
  return new NextRequest("https://clorefy.com/api/payments/create-link", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://clorefy.com" },
    body: JSON.stringify({ sessionId, ...extra }),
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  process.env.NEXT_PUBLIC_APP_URL = "https://clorefy.com"
  mocks.validateOrigin.mockReturnValue(null)
  mocks.authenticate.mockResolvedValue({
    error: null, user: { id: "user-1" }, supabase: { from: vi.fn() },
  })
  mocks.validateCsrf.mockResolvedValue(null)
  mocks.checkRateLimit.mockResolvedValue(null)
  mocks.validateBodySize.mockReturnValue(null)
  mocks.getCredentials.mockResolvedValue(credentials)
  mocks.createRazorpayLink.mockResolvedValue({
    id: "plink-new", short_url: "https://rzp.io/new", expire_by: 1_800_000_000,
  })
  mocks.cancelProviderLink.mockResolvedValue(undefined)
  mocks.logAudit.mockResolvedValue(undefined)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => vi.restoreAllMocks())

describe("POST /api/payments/create-link security", () => {
  it("ignores client payment fields and sends server-derived owned-session values to the provider", async () => {
    const { db, invoicePayments, sessionUserEq } = buildDb()
    mocks.createClient.mockReturnValue(db)

    const response = await POST(request({
      amount: 1, currency: "USD", referenceId: "ATTACKER-REF",
      description: "attacker description", customerEmail: "attacker@example.com",
      context: { items: [{ quantity: 1, rate: 0.01 }], currency: "USD" },
      acceptPartial: true,
    }))

    expect(response.status).toBe(200)
    expect(sessionUserEq).toHaveBeenCalledWith("user_id", "user-1")
    expect(mocks.createRazorpayLink).toHaveBeenCalledWith({
      amount: 248950,
      currency: "INR",
      description: "Invoice INV-SERVER-42 for Server Customer",
      referenceId: "INV-SERVER-42",
      customerName: "Server Customer",
      customerEmail: "server@example.com",
      customerPhone: "+919999999999",
      sessionId,
      userId: "user-1",
      acceptPartial: true,
      dueDateIso: "2027-02-01",
      userKeyId: "rzp_test_key",
      userKeySecret: "rzp_test_secret",
    })
    expect(invoicePayments.insert).toHaveBeenCalledWith(expect.objectContaining({
      amount: 248950, currency: "INR", reference_id: "INV-SERVER-42",
      description: "Invoice INV-SERVER-42 for Server Customer",
      customer_email: "server@example.com", user_id: "user-1", session_id: sessionId,
    }))
    expect(mocks.createStripeLink).not.toHaveBeenCalled()
    expect(mocks.createCashfreeLink).not.toHaveBeenCalled()
  })

  it("cancels the orphaned provider link when the database insert fails", async () => {
    const insertError = { code: "PGRST500", message: "insert failed" }
    const { db } = buildDb({ insertResult: { data: null, error: insertError } })
    mocks.createClient.mockReturnValue(db)

    const response = await POST(request())

    expect(response.status).toBe(500)
    expect(mocks.cancelProviderLink).toHaveBeenCalledWith(
      "razorpay", "plink-new", "plink-new", credentials,
    )
  })

  it("cancels its orphan and returns the existing winner after a concurrent 23505 insert", async () => {
    const winner = paymentRow({ id: "payment-winner", short_url: "https://rzp.io/winner" })
    const { db } = buildDb({
      existingReads: [{ data: null, error: null }, { data: winner, error: null }],
      insertResult: { data: null, error: { code: "23505", message: "duplicate key" } },
    })
    mocks.createClient.mockReturnValue(db)

    const response = await POST(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.cancelProviderLink).toHaveBeenCalledWith(
      "razorpay", "plink-new", "plink-new", credentials,
    )
    expect(body.paymentLink).toMatchObject({
      id: "payment-winner", shortUrl: "https://rzp.io/winner", isExisting: true,
    })
  })

  it.each([
    ["a session owned by another user", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["a missing session", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
  ])("does not create a provider link for %s", async (_label, inaccessibleSessionId) => {
    const { db, sessionUserEq } = buildDb({ session: null })
    mocks.createClient.mockReturnValue(db)

    const response = await POST(request({ sessionId: inaccessibleSessionId }))

    expect(response.status).toBe(404)
    expect(sessionUserEq).toHaveBeenCalledWith("user_id", "user-1")
    expect(mocks.getCredentials).not.toHaveBeenCalled()
    expect(mocks.createRazorpayLink).not.toHaveBeenCalled()
    expect(mocks.createStripeLink).not.toHaveBeenCalled()
    expect(mocks.createCashfreeLink).not.toHaveBeenCalled()
  })
})
