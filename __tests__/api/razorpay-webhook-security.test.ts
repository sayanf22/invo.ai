import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verifySignature: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  hash: vi.fn(),
  handleSubscription: vi.fn(),
  createClient: vi.fn(),
}))

vi.mock("@/lib/razorpay", () => ({ verifyWebhookSignature: mocks.verifySignature }))
vi.mock("@/lib/webhook-events", () => ({
  claimWebhookEvent: mocks.claim,
  finishWebhookEvent: mocks.finish,
  hashWebhookPayload: mocks.hash,
}))
vi.mock("@/lib/razorpay-subscription-sync", () => ({
  handleRazorpaySubscriptionEvent: mocks.handleSubscription,
}))
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }))

const event = {
  event: "subscription.activated",
  payload: { subscription: { entity: { id: "sub_ABCDEF123" } } },
}

function request(options: { eventId?: string; signature?: string } = {}) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-razorpay-signature": options.signature ?? "valid-signature",
  })
  if (options.eventId !== undefined) headers.set("x-razorpay-event-id", options.eventId)
  return new Request("https://clorefy.com/api/razorpay/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(event),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key"
  mocks.verifySignature.mockResolvedValue(true)
  mocks.hash.mockResolvedValue("a".repeat(64))
  mocks.claim.mockResolvedValue("claimed")
  mocks.finish.mockResolvedValue(undefined)
  mocks.handleSubscription.mockResolvedValue(null)
  mocks.createClient.mockReturnValue({ from: vi.fn(), rpc: vi.fn() })
})

describe("Razorpay webhook replay and retry security", () => {
  it("rejects unsigned payloads before claiming an event", async () => {
    mocks.verifySignature.mockResolvedValue(false)
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request({ eventId: "evt_ABCDEF" }))

    expect(response.status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it("requires Razorpay's event id after signature verification", async () => {
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request())

    expect(response.status).toBe(400)
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it("short-circuits a fully processed duplicate", async () => {
    mocks.claim.mockResolvedValue("duplicate")
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request({ eventId: "evt_ABCDEF" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.duplicate).toBe(true)
    expect(mocks.handleSubscription).not.toHaveBeenCalled()
  })

  it("marks successful subscription handling processed only after synchronization", async () => {
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request({ eventId: "evt_ABCDEF" }))

    expect(response.status).toBe(200)
    expect(mocks.handleSubscription).toHaveBeenCalledTimes(1)
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "razorpay", "evt_ABCDEF", "processed",
    )
  })

  it("marks a failed transition retryable and returns 5xx", async () => {
    mocks.handleSubscription.mockResolvedValue(
      Response.json({ error: "sync failed" }, { status: 500 }),
    )
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request({ eventId: "evt_ABCDEF" }))

    expect(response.status).toBe(500)
    expect(mocks.finish).toHaveBeenCalledWith(
      expect.anything(), "razorpay", "evt_ABCDEF", "failed", expect.any(String),
    )
    expect(mocks.finish).not.toHaveBeenCalledWith(
      expect.anything(), "razorpay", "evt_ABCDEF", "processed",
    )
  })

  it("returns 5xx when durable replay protection is unavailable", async () => {
    mocks.claim.mockRejectedValue(new Error("database unavailable"))
    const { POST } = await import("@/app/api/razorpay/webhook/route")

    const response = await POST(request({ eventId: "evt_ABCDEF" }))

    expect(response.status).toBe(500)
    expect(mocks.handleSubscription).not.toHaveBeenCalled()
  })
})
