export interface LineItem {
  id: string
  description: string
  quantity: number
  rate: number
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
  fromLogo: string // base64 or URL

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
    layout: "classic" | "modern" | "bold" | "minimal" | "elegant" | "corporate" | "creative" | "warm" | "geometric"
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
  "Credit Card",
  "PayPal",
  "Stripe",
  "Cash",
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

export function calculateTotal(data: InvoiceData): {
  subtotal: number
  tax: number
  discount: number
  shipping: number
  total: number
} {
  const subtotal = calculateSubtotal(data.items)
  const discount =
    data.discountType === "percent"
      ? subtotal * (data.discountValue / 100)
      : data.discountValue
  const afterDiscount = subtotal - discount
  const tax = afterDiscount * (data.taxRate / 100)
  const shipping = data.shippingFee || 0
  const total = afterDiscount + tax + shipping
  return { subtotal, tax, discount, shipping, total }
}
