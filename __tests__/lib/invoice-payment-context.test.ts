import { describe, expect, it } from "vitest"
import { deriveInvoicePaymentDetails } from "@/lib/invoice-payment-context"

describe("deriveInvoicePaymentDetails", () => {
  it("derives the payable amount from line items and ignores malicious client totals", () => {
    const details = deriveInvoicePaymentDetails({
      items: [
        { quantity: 2, rate: 100, discount: 10 },
        { quantity: 1, rate: 50 },
      ],
      discountType: "percent",
      discountValue: 10,
      taxRate: 18,
      shippingFee: 10,
      currency: "inr",
      invoiceNumber: "INV-42",
      toName: "Acme <script>alert(1)</script>",
      subtotal: 1,
      total: 1,
      amount: 1,
    }, "12345678-1234-4123-8123-123456789012")

    // (2 * 100 * .9 + 50) * .9 * 1.18 + 10 = 254.26 INR.
    expect(details.amount).toBe(25_426)
    expect(details.currency).toBe("INR")
    expect(details.referenceId).toBe("INV-42")
    expect(details.customerName).not.toContain("<")
  })

  it.each([
    { items: [], currency: "INR" },
    { items: [{ quantity: -1, rate: 100 }], currency: "INR" },
    { items: [{ quantity: 1, rate: Number.POSITIVE_INFINITY }], currency: "INR" },
  ])("rejects invalid line-item data instead of trusting totals", (context) => {
    expect(() => deriveInvoicePaymentDetails({ ...context, total: 999 }, "session-id"))
      .toThrow()
  })
})
