import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/secrets", () => ({
  getSecret: vi.fn(async (name: string) => name === "RAZORPAY_KEY_ID" ? "key" : "secret"),
}))

import { getVerifiedSubscriptionCharge } from "@/lib/razorpay"

const sub = {
  id: "sub_live", status: "active", plan_id: "plan_T9YVdDh330CpPq",
  notes: { platform: "clorefy", user_id: "user-1" }, current_start: 100, current_end: 200,
}
const invoice = {
  id: "inv_exact", payment_id: "pay_exact", order_id: "order_exact",
  subscription_id: "sub_live", amount: 179900, amount_paid: 179900, amount_due: 0,
  currency: "INR", status: "paid", issued_at: 150, paid_at: 151,
}
const payment = {
  id: "pay_exact", amount: 179900, currency: "INR", status: "captured",
  order_id: "order_exact", invoice_id: "inv_exact", subscription_id: "sub_live",
}

function json(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status, headers: { "content-type": "application/json" },
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith("/subscriptions/sub_live")) return json(sub)
    if (url.endsWith("/payments/pay_exact")) return json(payment)
    if (url.endsWith("/invoices/inv_exact")) return json(invoice)
    if (url.includes("/invoices?subscription_id=sub_live")) return json({ items: [invoice] })
    return json({}, 404)
  }))
})

describe("Razorpay paid-entitlement evidence", () => {
  it("refetches live subscription and accepts only the exact captured invoice charge", async () => {
    const result = await getVerifiedSubscriptionCharge("sub_live", "pay_exact")
    expect(result).toMatchObject({
      id: "pay_exact", invoice_id: "inv_exact", order_id: "order_exact",
      subscription_id: "sub_live", amount: 179900, currency: "INR",
    })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/subscriptions/sub_live"), expect.anything())
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/invoices/inv_exact"), expect.anything())
  })
  it("rejects authorization-only payments without exact invoice correlation", async () => {
    vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/subscriptions/sub_live")) return json(sub)
      if (url.endsWith("/payments/pay_exact")) {
        return json({ ...payment, invoice_id: null, subscription_id: null, order_id: null })
      }
      return json({}, 404)
    }))

    await expect(getVerifiedSubscriptionCharge("sub_live", "pay_exact")).resolves.toBeNull()
  })

  it("rejects mismatched invoice, order, subscription, amount, or currency evidence", async () => {
    for (const mismatch of [
      { invoice_id: "inv_other" },
      { order_id: "order_other" },
      { subscription_id: "sub_other" },
      { amount: 1 },
      { currency: "USD" },
    ]) {
      vi.stubGlobal("fetch", vi.fn((input: string | URL | Request) => {
        const url = String(input)
        if (url.endsWith("/subscriptions/sub_live")) return json(sub)
        if (url.endsWith("/payments/pay_exact")) return json({ ...payment, ...mismatch })
        if (url.includes("/invoices/")) return json(invoice)
        return json({}, 404)
      }))
      await expect(getVerifiedSubscriptionCharge("sub_live", "pay_exact")).resolves.toBeNull()
    }
  })

  it("does not reuse a paid invoice older than an immediate provider update", async () => {
    await expect(getVerifiedSubscriptionCharge("sub_live", undefined, 152_000)).resolves.toBeNull()
  })
})