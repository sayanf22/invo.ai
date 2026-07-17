import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  checkCashfreeConnection,
  checkRazorpayConnection,
  checkStripeConnection,
  connectionFailureStatus,
} from "@/lib/payment-connection-test"

const fetchMock = vi.fn()

describe("payment provider connection probes", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it("authenticates a non-transactional Razorpay API request", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }))

    await expect(checkRazorpayConnection("rzp_test_key", "secret-value"))
      .resolves.toMatchObject({ ok: true, httpStatus: 200 })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/payment_links?count=1",
      expect.objectContaining({
        headers: { Authorization: `Basic ${btoa("rzp_test_key:secret-value")}` },
      }),
    )
  })

  it("reads Stripe account readiness without creating a charge", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
    }), { status: 200 }))

    await expect(checkStripeConnection("sk_test_example")).resolves.toMatchObject({
      ok: true,
      account: { chargesEnabled: true, payoutsEnabled: false, detailsSubmitted: true },
    })
  })

  it("treats Cashfree's authenticated missing-link response as success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "not found" }), { status: 404 }))

    await expect(checkCashfreeConnection("client-id", "client-secret", true))
      .resolves.toMatchObject({ ok: true, httpStatus: 404 })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/sandbox\.cashfree\.com\/pg\/links\/clorefy_connection_/),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-version": "2025-01-01",
          "x-client-id": "client-id",
          "x-client-secret": "client-secret",
        }),
      }),
    )
  })

  it.each([401, 403])("classifies provider status %s as invalid credentials", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }))

    const result = await checkRazorpayConnection("bad-key", "bad-secret")
    expect(result).toMatchObject({ ok: false, failure: "invalid_credentials", httpStatus: status })
    expect(connectionFailureStatus(result)).toBe(422)
  })

  it("keeps temporary provider outages distinct from rejected credentials", async () => {
    fetchMock.mockRejectedValue(new Error("network unavailable"))

    const result = await checkStripeConnection("sk_test_example")
    expect(result).toMatchObject({ ok: false, failure: "provider_unavailable", httpStatus: 0 })
    expect(connectionFailureStatus(result)).toBe(503)
  })
})
