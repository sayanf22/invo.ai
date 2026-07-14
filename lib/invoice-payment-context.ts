import { CURRENCIES } from "@/lib/invoice-types"

export interface InvoicePaymentDetails {
    amount: number
    currency: string
    description: string
    referenceId: string
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    dueDate?: string
}

const SUPPORTED_CURRENCIES = new Set(CURRENCIES.map((currency) => currency.code))
const MAX_ITEMS = 200
const MAX_SMALLEST_UNIT_AMOUNT = 1_000_000_000_000

function finiteNumber(value: unknown, field: string, min: number, max: number): number {
    const parsed = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
        throw new Error(`Invalid invoice ${field}`)
    }
    return parsed
}

function cleanText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") return ""
    return value.replace(/[<>\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
}

function currencyMultiplier(currency: string): number {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency })
        .resolvedOptions().maximumFractionDigits ?? 2
    return 10 ** Math.min(Math.max(digits, 0), 3)
}

export function deriveInvoicePaymentDetails(
    contextValue: unknown,
    sessionId: string,
): InvoicePaymentDetails {
    if (!contextValue || typeof contextValue !== "object" || Array.isArray(contextValue)) {
        throw new Error("Invoice data is unavailable")
    }
    const context = contextValue as Record<string, unknown>
    if (!Array.isArray(context.items) || context.items.length === 0 || context.items.length > MAX_ITEMS) {
        throw new Error("Invoice must contain valid line items")
    }

    let subtotalAfterItemDiscounts = 0
    for (const rawItem of context.items) {
        if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
            throw new Error("Invalid invoice line item")
        }
        const item = rawItem as Record<string, unknown>
        const quantity = finiteNumber(item.quantity, "quantity", 0, 1_000_000)
        const rate = finiteNumber(item.rate, "rate", 0, 1_000_000_000)
        const discount = finiteNumber(item.discount ?? 0, "item discount", 0, 100)
        subtotalAfterItemDiscounts += quantity * rate * (1 - discount / 100)
    }

    const discountType = context.discountType === "flat" ? "flat" : "percent"
    const discountValue = finiteNumber(context.discountValue ?? 0, "discount", 0, 1_000_000_000)
    const discountAmount = discountType === "percent"
        ? subtotalAfterItemDiscounts * Math.min(discountValue, 100) / 100
        : discountValue
    const taxableAmount = subtotalAfterItemDiscounts - discountAmount
    const taxRate = finiteNumber(context.taxRate ?? 0, "tax rate", 0, 100)
    const shippingFee = finiteNumber(context.shippingFee ?? 0, "shipping fee", 0, 1_000_000_000)
    const total = taxableAmount + taxableAmount * taxRate / 100 + shippingFee
    if (!Number.isFinite(total) || total <= 0) throw new Error("Invoice total must be greater than zero")

    const currency = cleanText(context.currency, 3).toUpperCase()
    if (!SUPPORTED_CURRENCIES.has(currency as (typeof CURRENCIES)[number]["code"])) {
        throw new Error("Unsupported invoice currency")
    }
    const amount = Math.round(total * currencyMultiplier(currency))
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_SMALLEST_UNIT_AMOUNT) {
        throw new Error("Invoice total is outside the supported payment range")
    }

    const fallbackReference = `INV-${sessionId.slice(0, 8).toUpperCase()}`
    const referenceId = cleanText(context.invoiceNumber || context.referenceNumber, 40) || fallbackReference
    const customerName = cleanText(context.toName, 100) || undefined
    const customerEmail = cleanText(context.toEmail, 255) || undefined
    const customerPhone = cleanText(context.toPhone, 20) || undefined
    const dueDateValue = cleanText(context.dueDate, 32)
    const dueDate = dueDateValue && Number.isFinite(Date.parse(dueDateValue)) ? dueDateValue : undefined

    return {
        amount,
        currency,
        referenceId,
        description: cleanText(`Invoice ${referenceId}${customerName ? ` for ${customerName}` : ""}`, 255),
        customerName,
        customerEmail,
        customerPhone,
        dueDate,
    }
}
