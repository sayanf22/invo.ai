import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PaymentSettings } from "@/components/payment-settings"
import { authFetch } from "@/lib/auth-fetch"

vi.mock("@/lib/auth-fetch", () => ({ authFetch: vi.fn() }))
vi.mock("@/components/auth-provider", () => ({ useUser: () => ({ id: "user-1" }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const baseGateway = {
  testMode: true,
  credentialsVerified: true,
  verifiedAt: "2026-07-17T08:00:00.000Z",
  webhookUrl: "https://clorefy.com/api/provider/webhook/user-1",
  webhookConfigured: true,
  webhookRegistered: true,
  localReceiverVerifiedAt: "2026-07-17T08:00:00.000Z",
  providerWebhookVerifiedAt: "2026-07-17T08:00:00.000Z",
}

const settings = {
  razorpay: {
    ...baseGateway,
    keyIdHint: "rzp_test••••1234",
    credentialsVerified: false,
    webhookMode: "manual" as const,
  },
  stripe: { ...baseGateway, webhookMode: "automatic" as const },
  cashfree: {
    ...baseGateway,
    clientIdHint: "abcd••••1234",
    webhookMode: "per_link" as const,
  },
}

describe("PaymentSettings connection action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authFetch).mockImplementation(async (url, init) => {
      if (String(url) === "/api/payments/test-webhook" && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            success: true,
            checks: [{ id: "credentials", label: "API credentials", status: "passed", detail: "Accepted" }],
            message: "Payment API and webhook checks passed.",
          }),
        } as Response
      }
      return { ok: true, json: async () => ({ settings }) } as Response
    })
  })

  afterEach(cleanup)

  it("keeps a visible test or retest action on every configured gateway", async () => {
    render(<PaymentSettings />)

    expect(await screen.findByRole("button", { name: "Test Razorpay connection" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retest Stripe connection" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Retest Cashfree connection" })).toBeTruthy()
  })

  it("runs the saved-credential test and renders its checks", async () => {
    render(<PaymentSettings />)
    fireEvent.click(await screen.findByRole("button", { name: "Test Razorpay connection" }))

    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
      "/api/payments/test-webhook",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ gateway: "razorpay" }) }),
    ))
    expect(await screen.findByText("API credentials")).toBeTruthy()
    expect(screen.getByText("Payment API and webhook checks passed.")).toBeTruthy()
  })
})
