import { z } from "zod"

// ─── Client Management ────────────────────────────────────────────────────────

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ClientInput {
  name: string
  email?: string
  phone?: string
  address?: string
  tax_id?: string
  notes?: string
}

export const clientSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  tax_id: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
})

// ─────────────────────────────────────────────────────────────────────────────

export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
  discount?: number // per-item discount percentage (0-100)
}

export interface InvoiceData {
  documentType: string | null
  status: "draft" | "sent" | "paid" | "overdue"

  // Invoice meta
  invoiceNumber: string
  referenceNumber: string
  invoiceDate: string
  dueDate: string
  paymentTerms: string
  currency: string

  // Seller / From
  fromName: string
  fromEmail: string
  fromAddress: string
  fromPhone: string
  fromTaxId: string
  fromWebsite: string
  fromLogo: string // R2 object key, base64, or URL
  showLogo: boolean // whether to display logo on the document
  logoShape: "rounded" | "circle" // logo display shape on the document
  logoSize: number // logo size in PDF points (32–96, default 44)

  // Buyer / To
  toName: string
  toEmail: string
  toAddress: string
  toPhone: string
  toTaxId: string

  // Line items
  items: LineItem[]

  // Financials
  taxRate: number
  taxLabel: string
  discountType: "percent" | "flat"
  discountValue: number
  shippingFee: number

  // Payment
  paymentInstructions: string
  paymentMethod: string
  paymentLink?: string        // Razorpay short_url e.g. https://rzp.io/i/xxx
  paymentLinkStatus?: "created" | "paid" | "partially_paid" | "expired" | "cancelled"
  showPaymentLinkInPdf?: boolean  // Controls whether payment link & QR code are embedded in PDF

  // Additional
  notes: string
  terms: string
  description: string

  // Signature
  signatureName: string
  signatureTitle: string

  // Design & Branding
  design?: {
    templateId: string
    font: "Helvetica" | "Times-Roman" | "Courier" | "Inter" | "Playfair" | "Roboto Mono" | "Lora"
    headerColor: string // hex code
    tableColor: string // hex code
    layout: "classic" | "modern" | "bold" | "minimal" | "elegant" | "corporate" | "creative" | "warm" | "geometric" | "receipt"
  }
}

export const CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "\u20AC", name: "Euro" },
  { code: "GBP", symbol: "\u00A3", name: "British Pound" },
  { code: "INR", symbol: "\u20B9", name: "Indian Rupee" },
  { code: "JPY", symbol: "\u00A5", name: "Japanese Yen" },
  { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  { code: "CNY", symbol: "\u00A5", name: "Chinese Yuan" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "AED", symbol: "AED", name: "UAE Dirham" },
  { code: "SAR", symbol: "SAR", name: "Saudi Riyal" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "ZAR", symbol: "R", name: "South African Rand" },
  { code: "MXN", symbol: "MX$", name: "Mexican Peso" },
  { code: "KRW", symbol: "\u20A9", name: "South Korean Won" },
  { code: "TRY", symbol: "\u20BA", name: "Turkish Lira" },
  { code: "NGN", symbol: "\u20A6", name: "Nigerian Naira" },
] as const

export const PAYMENT_TERMS = [
  "Due on Receipt",
  "Net 7",
  "Net 15",
  "Net 30",
  "Net 45",
  "Net 60",
  "Net 90",
  "Custom",
] as const

export const PAYMENT_METHODS = [
  "Bank Transfer",
  "UPI",
  "Cash",
  "Credit Card",
  "Razorpay",
  "Stripe",
  "Cashfree",
  "PayPal",
  "Check",
  "Wire Transfer",
  "Crypto",
  "Other",
] as const

export const TAX_LABELS = [
  "Tax",
  "VAT",
  "GST",
  "HST",
  "Sales Tax",
  "Service Tax",
] as const

export function getInitialInvoiceData(): InvoiceData {
  const today = new Date().toISOString().split("T")[0]
  return {
    documentType: null,
    status: "draft",
    invoiceNumber: `INV-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    referenceNumber: "",
    invoiceDate: today,
    dueDate: "",
    paymentTerms: "Net 30",
    currency: "USD",
    fromName: "",
    fromEmail: "",
    fromAddress: "",
    fromPhone: "",
    fromTaxId: "",
    fromWebsite: "",
    fromLogo: "",
    showLogo: true,
    logoShape: "rounded",
    logoSize: 44,
    toName: "",
    toEmail: "",
    toAddress: "",
    toPhone: "",
    toTaxId: "",
    items: [{ id: "1", description: "", quantity: 1, rate: 0 }],
    taxRate: 0,
    taxLabel: "Tax",
    discountType: "percent",
    discountValue: 0,
    shippingFee: 0,
    paymentInstructions: "",
    paymentMethod: "",
    showPaymentLinkInPdf: true,
    notes: "",
    terms: "",
    description: "",
    signatureName: "",
    signatureTitle: "",
  }
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

export function formatCurrency(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode)
  return `${symbol} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function calculateSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.rate, 0)
}

/** Calculate the total per-item discount amount across all items */
export function calculateItemDiscounts(items: LineItem[]): number {
  return items.reduce((sum, item) => {
    const lineTotal = item.quantity * item.rate
    const disc = item.discount ? lineTotal * (item.discount / 100) : 0
    return sum + disc
  }, 0)
}

/** Get the effective line total after per-item discount */
export function getLineTotal(item: LineItem): number {
  const raw = item.quantity * item.rate
  return item.discount ? raw - raw * (item.discount / 100) : raw
}

export function calculateTotal(data: InvoiceData): {
  subtotal: number
  itemDiscount: number
  tax: number
  discount: number
  shipping: number
  total: number
} {
  const subtotal = calculateSubtotal(data.items)
  const itemDiscount = calculateItemDiscounts(data.items)
  const afterItemDiscount = subtotal - itemDiscount
  // Global discount applies on top of per-item discounts
  const discount =
    data.discountType === "percent"
      ? afterItemDiscount * (data.discountValue / 100)
      : data.discountValue
  const afterDiscount = afterItemDiscount - discount
  const tax = afterDiscount * (data.taxRate / 100)
  const shipping = data.shippingFee || 0
  const total = afterDiscount + tax + shipping
  return { subtotal, itemDiscount, tax, discount, shipping, total }
}

// Placeholder patterns that should be treated as empty/missing
const PLACEHOLDER_PATTERNS = [
  /^\[.*\]$/,                          // [To be provided], [Client Name], etc.
  /^to be (provided|shared|confirmed|updated|filled|added)$/i,
  /^not (provided|available|specified|applicable)$/i,
  /^n\/?a$/i,                          // N/A, n/a
  /^tbd$/i,                            // TBD
  /^pending$/i,
  /^-+$/,                              // ---, ----
  /^_+$/,                              // ___, ____
  /^\.{3,}$/,                          // ...
]

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return PLACEHOLDER_PATTERNS.some(p => p.test(trimmed))
}

/** Strip placeholder text from all string fields in InvoiceData.
 *  Returns a new object — does not mutate the original. */
export function cleanDataForExport(data: InvoiceData): InvoiceData {
  const cleaned = { ...data }

  const stringFields: (keyof InvoiceData)[] = [
    "fromName", "fromEmail", "fromAddress", "fromPhone", "fromTaxId", "fromWebsite",
    "toName", "toEmail", "toAddress", "toPhone", "toTaxId",
    "paymentInstructions", "paymentMethod",
    "notes", "terms", "description",
    "signatureName", "signatureTitle",
    "invoiceNumber", "referenceNumber",
  ]

  for (const field of stringFields) {
    const val = cleaned[field]
    if (typeof val === "string" && isPlaceholder(val)) {
      (cleaned as any)[field] = ""
    }
  }

  return cleaned
}
