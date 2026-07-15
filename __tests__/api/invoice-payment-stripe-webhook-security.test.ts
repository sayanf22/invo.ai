import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verifySignature: vi.fn(),
  decrypt: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  hash: vi.fn(),
  applyPayment: vi.fn(),
  notifyPayment: vi.fn(),
  createClient: vi.fn(),
  dbFrom: vi.fn(),
  dbRpc: vi.fn(),
}))

vi.mock("@/lib/stripe-payments", () => ({ verifyStripeWebhookSignature: mocks.verifySignature }))
vi.mock("@/lib/encrypt", () => ({ decrypt: mocks.decrypt }))
vi.mock("@/lib/webhook-events", () => ({
  claimWebhookEvent: mocks.claim,
  finishWebhookEvent: mocks.finish,
  hashWebhookPayload: mocks.hash,
}))
vi.mock("@/lib/invoice-payment-events", () => ({
  applyInvoicePaymentEvent: mocks.applyPayment,
  notifyInvoicePayment: mocks.notifyPayment,
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))

const userId = "11111111-1111-4111-8111-111111111111"
const sessionId = "22222222-2222-4222-8222-222222222222"

function stripeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_secure_123456",
    type: "checkout.session.completed",
    livemode: false,
    created: 1_700_000_000,
    data: {
      object: {
        id: "cs_test_secure123",
        payment_status: "paid",
        amount_total: 12_345,
        currency: "usd",
        payment_intent: "pi_secure123",
        metadata: { platform: "clorefy", user_id: userId, session_id: sessionId },
      },
    },
    ...overrides,
  }
}
function request(event: Record<string, unknown>, test = false) {
  const headers = new Headers({
    "content-type": "application/json",
    "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=valid-signature`,
  })
  if (test) headers.set("x-clorefy-test-webhook", "1")
  return new Request(`https://clorefy.com/api/stripe/webhook/${userId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  })
}

function settingsQuery(stripeTestMode = true) {
  return {
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        stripe_webhook_secret: "encrypted-secret",
        stripe_enabled: true,
        stripe_test_mode: stripeTestMode,
      },
      error: null,
    }),
  }
}

async function post(event: Record<string, unknown>, test = false) {
  const { POST } = await import("@/app/api/stripe/webhook/[userId]/route")
  return POST(request(event, test) as never, { params: Promise.resolve({ userId }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  vi.spyOn(console, "error").mockImplementation(() => undefined)
  mocks.verifySignature.mockResolvedValue(true)
  mocks.decrypt.mockResolvedValue("decrypted-secret")
  mocks.hash.mockResolvedValue("a".repeat(64))
  mocks.claim.mockResolvedValue("claimed")
  mocks.finish.mockResolvedValue(undefined)
  mocks.applyPayment.mockResolvedValue({ applied: true, status: "paid" })
  mocks.notifyPayment.mockResolvedValue(undefined)
  mocks.dbFrom.mockImplementation(() => settingsQuery())
  mocks.createClient.mockReturnValue({ from: mocks.dbFrom, rpc: mocks.dbRpc })
})

describe("Stripe invoice payment webhook security", () => {
  it("accepts a valid signed test webhook without claiming or mutating payment state", async () => {
    const response = await post(stripeEvent(), true)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ received: true, test: true })
    expect(mocks.decrypt).toHaveBeenCalledWith("encrypted-secret")
    expect(mocks.verifySignature).toHaveBeenCalledWith(
      expect.any(String), expect.stringContaining("v1=valid-signature"), "decrypted-secret",
    )
    expect(mocks.claim).not.toHaveBeenCalled()
    expect(mocks.finish).not.toHaveBeenCalled()
    expect(mocks.applyPayment).not.toHaveBeenCalled()
    expect(mocks.dbRpc).not.toHaveBeenCalled()
  })

  it("completes the durable claim without applying paid state when payment_status is not paid", async () => {
    const event = stripeEvent()
    ;(event.data.object as Record<string, unknown>).payment_status = "unpaid"

    const response = await post(event)

    expect(response.status).toBe(200)
    expect(mocks.applyPayment).not.toHaveBeenCalled()
    expect(mocks.notifyPayment).not.toHaveBeenCalled()
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "processed",
    )
  })

  it("forwards the exact paid amount, currency, mode, and provider session", async () => {
    const event = stripeEvent()

    const response = await post(event)

    expect(response.status).toBe(200)
    expect(mocks.applyPayment).toHaveBeenCalledWith(expect.anything(), {
      userId,
      gateway: "stripe",
      providerLinkId: "cs_test_secure123",
      status: "paid",
      amountPaid: 12_345,
      currency: "usd",
      providerPaymentId: "pi_secure123",
      isTestMode: true,
      paidAt: new Date(1_700_000_000 * 1000).toISOString(),
    })
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "processed",
    )
  })

  it("rejects a livemode/settings mismatch and marks the durable claim failed", async () => {
    const event = stripeEvent({ livemode: true })

    const response = await post(event)

    expect(response.status).toBe(500)
    expect(mocks.applyPayment).not.toHaveBeenCalled()
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "failed",
      "Stripe event mode does not match gateway settings",
    )
    expect(mocks.finish).not.toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "processed",
    )
  })

  it.each([
    {
      name: "invalid ownership metadata",
      mutate: (event: ReturnType<typeof stripeEvent>) => {
        ;(event.data.object as { metadata: Record<string, unknown> }).metadata.user_id =
          "33333333-3333-4333-8333-333333333333"
      },
      message: "Stripe Checkout ownership metadata is invalid",
    },
    {
      name: "invalid amount",
      mutate: (event: ReturnType<typeof stripeEvent>) => {
        ;(event.data.object as Record<string, unknown>).amount_total = -1
      },
      message: "Stripe payment amount is invalid",
    },
  ])("does not mark an invoice paid for $name", async ({ mutate, message }) => {
    const event = stripeEvent()
    mutate(event)

    const response = await post(event)

    expect(response.status).toBe(500)
    expect(mocks.applyPayment).not.toHaveBeenCalled()
    expect(mocks.notifyPayment).not.toHaveBeenCalled()
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "failed", message,
    )
    expect(mocks.finish).not.toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "processed",
    )
  })

  it("returns 5xx when the durable claim database call fails", async () => {
    const event = stripeEvent()
    mocks.claim.mockRejectedValue(new Error("claim database unavailable"))

    const response = await post(event)

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(mocks.applyPayment).not.toHaveBeenCalled()
    expect(mocks.notifyPayment).not.toHaveBeenCalled()
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "stripe", event.id, "failed", "claim database unavailable",
    )
  })
})