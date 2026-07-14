import { describe, expect, it, vi } from "vitest"
import { applyInvoicePaymentEvent, notifyInvoicePayment } from "@/lib/invoice-payment-events"

const input = {
  userId: "user-1",
  gateway: "cashfree" as const,
  providerLinkId: "cf-link-1",
  status: "paid" as const,
  amountPaid: 12_345,
  currency: "inr",
  providerPaymentId: "payment-1",
  isTestMode: true,
  paidAt: "2026-07-14T10:00:00.000Z",
}

describe("applyInvoicePaymentEvent", () => {
  it("forwards every transition parameter to the database RPC", async () => {
    const result = { applied: true, status: "paid", amount_paid: 12_345 }
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null })

    await expect(applyInvoicePaymentEvent({ rpc } as any, input)).resolves.toBe(result)
    expect(rpc).toHaveBeenCalledWith("apply_invoice_payment_event", {
      p_user_id: "user-1",
      p_gateway: "cashfree",
      p_provider_link_id: "cf-link-1",
      p_status: "paid",
      p_amount_paid: 12_345,
      p_currency: "INR",
      p_provider_payment_id: "payment-1",
      p_is_test_mode: true,
      p_paid_at: "2026-07-14T10:00:00.000Z",
    })
  })

  it("forwards nullable optional parameters rather than inventing values", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { applied: false }, error: null })
    await applyInvoicePaymentEvent({ rpc } as any, {
      userId: "user-1", gateway: "stripe", providerLinkId: "plink",
      status: "expired", isTestMode: false,
    })
    expect(rpc).toHaveBeenCalledWith("apply_invoice_payment_event", expect.objectContaining({
      p_amount_paid: null, p_currency: null, p_provider_payment_id: null, p_paid_at: null,
    }))
  })

  it("propagates RPC errors and rejects malformed transition results", async () => {
    const failure = new Error("transition rejected")
    await expect(applyInvoicePaymentEvent({
      rpc: vi.fn().mockResolvedValue({ data: null, error: failure }),
    } as any, input)).rejects.toBe(failure)

    await expect(applyInvoicePaymentEvent({
      rpc: vi.fn().mockResolvedValue({ data: { status: "paid" }, error: null }),
    } as any, input)).rejects.toThrow("Invalid invoice payment transition result")
  })
})

describe("notifyInvoicePayment", () => {
  it("propagates notification persistence errors", async () => {
    const failure = new Error("insert failed")
    const insert = vi.fn().mockResolvedValue({ error: failure })
    const db = { from: vi.fn(() => ({ insert })) }

    await expect(notifyInvoicePayment(db as any, "user-1", {
      applied: true,
      status: "paid",
      amount_paid: 12_345,
      currency: "INR",
      reference_id: "INV-1",
    }, "event-1")).rejects.toBe(failure)
  })

  it("does not insert notifications for unapplied or non-payment transitions", async () => {
    const from = vi.fn()
    await notifyInvoicePayment({ from } as any, "user-1", { applied: false }, "event-1")
    await notifyInvoicePayment({ from } as any, "user-1", {
      applied: true, status: "expired",
    }, "event-2")
    expect(from).not.toHaveBeenCalled()
  })
})