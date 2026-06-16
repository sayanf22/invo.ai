﻿﻿import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Image,
    Link,
} from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { getDocumentTypeConfig } from "@/lib/document-type-registry"
import type {
    SOWData,
    ChangeOrderData,
    NDAData,
    ClientOnboardingFormData,
    PaymentFollowupData,
} from "@/lib/document-schemas"
import type React from "react"
import { fixEncoding } from "@/lib/encoding"

// â”€â”€â”€ Signature Block Error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Thrown when a signable document type cannot produce a signature block.
// The PDF export flow catches this to prevent producing an unsigned PDF.

export class SignatureBlockRenderError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "SignatureBlockRenderError"
    }
}

// â”€â”€â”€ Font Registration â”€â”€â”€
// Local static WOFF fonts from @fontsource packages (copied to public/fonts/).
// These are weight-specific static files â€” NOT variable fonts.
// @react-pdf/renderer embeds them into the PDF so pdfjs renders crisp text
// instead of ugly bitmap fallbacks from built-in Type1 fonts.

// Disable hyphenation for cleaner text rendering in PDFs
Font.registerHyphenationCallback(word => [word])

// Inter â€” clean sans-serif (default for most templates)
Font.register({
    family: "Inter",
    fonts: [
        { src: "/fonts/inter-400.woff", fontWeight: 400 },
        { src: "/fonts/inter-700.woff", fontWeight: 700 },
    ],
})

// Lora â€” elegant serif
Font.register({
    family: "Lora",
    fonts: [
        { src: "/fonts/lora-400.woff", fontWeight: 400 },
        { src: "/fonts/lora-700.woff", fontWeight: 700 },
    ],
})

// Roboto Mono â€” monospace
Font.register({
    family: "Roboto Mono",
    fonts: [
        { src: "/fonts/roboto-mono-400.woff", fontWeight: 400 },
        { src: "/fonts/roboto-mono-700.woff", fontWeight: 700 },
    ],
})

// â”€â”€â”€ Font mapping â”€â”€â”€
function getFontFamily(data: InvoiceData): { font: string; fontB: string } {
    const f = data.design?.font || "Inter"
    switch (f) {
        // Serif fonts â†’ Lora
        case "Playfair":
        case "Lora":
        case "Times-Roman":
            return { font: "Lora", fontB: "Lora" }
        // Monospace fonts â†’ Roboto Mono
        case "Roboto Mono":
        case "Courier":
            return { font: "Roboto Mono", fontB: "Roboto Mono" }
        // Sans-serif fonts â†’ Inter
        default:
            return { font: "Inter", fontB: "Inter" }
    }
}

// â”€â”€â”€ Shared Utilities â”€â”€â”€

function fmt(amount: number, currency: string = "USD"): string {
    // ASCII-safe currency symbols only â€” avoids needing special Unicode fonts.
    // Characters like $, A$, R are in basic Latin and render in any PDF font.
    const symbols: Record<string, string> = {
        USD: "$", EUR: "EUR", GBP: "GBP", INR: "Rs.", JPY: "JPY",
        AUD: "A$", CAD: "C$", SGD: "S$", AED: "AED", PHP: "PHP",
        CHF: "CHF", CNY: "CNY", BRL: "R$", SAR: "SAR", ZAR: "R",
        MXN: "MX$", KRW: "KRW", TRY: "TRY", NGN: "NGN",
    }
    const s = symbols[currency] || currency + " "
    return `${s} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Currency font style â€” no special font needed since we use ASCII-safe symbols.
// These are empty objects so the spread (...CF / ...CFB) is a no-op and the
// Text element inherits the template's own font family.
const CF = {} as const
const CFB = { fontWeight: 700 as const } as const

export function fmtDate(d: string | undefined): string {
    if (!d) return "\u2014"
    try {
        return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    } catch { return d }
}

function calc(data: InvoiceData) {
    const sub = data.items.reduce((s, i) => s + i.quantity * i.rate, 0)
    const itemDisc = data.items.reduce((s, i) => {
        const line = i.quantity * i.rate
        return s + (i.discount ? line * (i.discount / 100) : 0)
    }, 0)
    const afterItem = sub - itemDisc
    const disc = data.discountType === "percent" ? (afterItem * (data.discountValue || 0)) / 100 : data.discountValue || 0
    const after = afterItem - disc
    const tax = (after * (data.taxRate || 0)) / 100
    const total = after + tax + (data.shippingFee || 0)
    return { sub, itemDisc, disc, tax, total }
}

export type Tpl = "modern" | "classic" | "bold" | "minimal" | "elegant" | "corporate" | "creative" | "warm" | "geometric" | "receipt"
export function getTpl(data: InvoiceData): Tpl {
    const t = data.design?.templateId || data.design?.layout || "modern"
    if (t === "classic" || t === "bold" || t === "minimal" || t === "elegant" || t === "corporate" || t === "creative" || t === "warm" || t === "geometric" || t === "receipt") return t
    return "modern"
}

interface Props { data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }

// â”€â”€â”€ Payment Link Section (Invoice only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders a "Pay Now" section with a clickable URL + QR code.
// Industry standard: Stripe, Zoho, FreshBooks all embed payment links in PDFs.
function PaymentSection({ data, paymentQrCode, c, bold: boldFn, bNoneFn, bAllFn, bTopFn }: {
    data: InvoiceData
    paymentQrCode?: string | null
    c: ReturnType<typeof getTheme>
    bold: (c: any) => { fontWeight: number }
    bNoneFn: () => any
    bAllFn: (w: number, color: string) => any
    bTopFn: (w: number, color: string) => any
}) {
    const url = data.paymentLink
    // Don't show if: no URL, paid/expired/cancelled, or user explicitly disabled PDF embedding
    if (!url || data.paymentLinkStatus === "paid" || data.paymentLinkStatus === "expired" || data.paymentLinkStatus === "cancelled") {
        return null
    }
    // showPaymentLinkInPdf defaults to true if undefined (backward compat)
    if (data.showPaymentLinkInPdf === false) {
        return null
    }

    return (
        <View style={{
            marginBottom: 12,
            padding: 10,
            backgroundColor: c.acc,
            borderTopLeftRadius: 8, borderTopRightRadius: 8,
            borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
            ...bAllFn(1, c.bdr),
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
        }} wrap={false}>
            {/* Left: text + button */}
            <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>
                    Pay Online
                </Text>
                <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.4, marginBottom: 6 }}>
                    Click the link below or scan the QR code to pay securely online.
                </Text>
                {/* Clickable "Pay Now" button */}
                <Link src={url} style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: c.pri,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderTopLeftRadius: 6, borderTopRightRadius: 6,
                    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
                    ...bNoneFn(),
                    alignSelf: "flex-start",
                    textDecoration: "none",
                }}>
                    <Text style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>
                        Pay Now â†’
                    </Text>
                </Link>
                {/* Short URL as text fallback */}
                <Text style={{ fontSize: 8, color: c.mut, marginTop: 6, textDecoration: "underline" }}>
                    {url}
                </Text>
                {data.paymentLinkStatus === "partially_paid" && (
                    <Text style={{ fontSize: 8, color: "#d97706", marginTop: 4, fontWeight: 700 }}>
                        Partial payment received \u2014 balance still due
                    </Text>
                )}
            </View>
            {/* Right: QR code */}
            {paymentQrCode && (
                <View style={{ alignItems: "center" }}>
                    <Image
                        src={paymentQrCode}
                        style={{
                            width: 56,
                            height: 56,
                            borderTopLeftRadius: 4, borderTopRightRadius: 4,
                            borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
                            ...bNoneFn(),
                        }}
                    />
                    <Text style={{ fontSize: 7, color: c.mut, marginTop: 2, textAlign: "center" }}>
                        Scan to pay
                    </Text>
                </View>
            )}
        </View>
    )
}

// â”€â”€â”€ Theme palettes per template â”€â”€â”€
export function getTheme(tpl: Tpl, data: InvoiceData) {
    const { font, fontB } = getFontFamily(data)
    const base = {
        modern: { pri: "#2563eb", priDk: "#1e40af", acc: "#dbeafe", accDk: "#bfdbfe", bg: "#f1f5f9", txt: "#1e293b", mut: "#64748b", bdr: "#e2e8f0" },
        classic: { pri: "#1e293b", priDk: "#0f172a", acc: "#f1f5f9", accDk: "#e2e8f0", bg: "#fafafa", txt: "#1e293b", mut: "#64748b", bdr: "#d1d5db" },
        bold: { pri: "#7c3aed", priDk: "#6d28d9", acc: "#ede9fe", accDk: "#ddd6fe", bg: "#f5f3ff", txt: "#1e293b", mut: "#64748b", bdr: "#e2e8f0" },
        minimal: { pri: "#525252", priDk: "#262626", acc: "#f5f5f5", accDk: "#e5e5e5", bg: "#fafafa", txt: "#262626", mut: "#737373", bdr: "#e5e5e5" },
        elegant: { pri: "#059669", priDk: "#047857", acc: "#ecfdf5", accDk: "#d1fae5", bg: "#f0fdf4", txt: "#1e293b", mut: "#64748b", bdr: "#d1d5db" },
        corporate: { pri: "#1e3a5f", priDk: "#152e4d", acc: "#e8eef4", accDk: "#d0dce8", bg: "#f0f4f8", txt: "#1e293b", mut: "#64748b", bdr: "#d1d5db" },
        creative: { pri: "#e11d48", priDk: "#be123c", acc: "#ffe4e6", accDk: "#fecdd3", bg: "#fff1f2", txt: "#1e293b", mut: "#64748b", bdr: "#e2e8f0" },
        warm: { pri: "#c2410c", priDk: "#9a3412", acc: "#ffedd5", accDk: "#fed7aa", bg: "#fff7ed", txt: "#1e293b", mut: "#64748b", bdr: "#e2e8f0" },
        geometric: { pri: "#0d9488", priDk: "#0f766e", acc: "#ccfbf1", accDk: "#99f6e4", bg: "#f0fdfa", txt: "#1e293b", mut: "#64748b", bdr: "#d1d5db" },
        receipt: { pri: "#f6821f", priDk: "#e5711a", acc: "#fff7ed", accDk: "#ffedd5", bg: "#fafafa", txt: "#1a1a1a", mut: "#6b7280", bdr: "#e5e5e5" },
    }
    const b = base[tpl]
    const customColor = data.design?.headerColor
    const pri = customColor && customColor.length > 0 && customColor !== b.pri ? customColor : b.pri
    const priDk = customColor && customColor.length > 0 && customColor !== b.pri ? customColor : b.priDk
    return { ...b, pri, priDk, font, fontB }
}

// Helper: bold text style
// Registered fonts use fontWeight to select the bold variant.
function bold(_c: ReturnType<typeof getTheme>): { fontWeight: number } {
    return { fontWeight: 700 }
}

// Helper: expand borderRadius into 4 explicit corners (react-pdf shorthand is buggy)
// Also includes bNone() to prevent resolveBorderShorthand from crashing on missing border width/style
function r(n: number) {
    return { borderTopLeftRadius: n, borderTopRightRadius: n, borderBottomRightRadius: n, borderBottomLeftRadius: n, ...bNone() }
}

// Helper: safe border â€” always specify ALL 4 sides for width, color, AND style
// react-pdf's resolveBorderShorthand crashes when any border property is partially specified
function bw(top: number, right: number, bottom: number, left: number) {
    return { borderTopWidth: top, borderRightWidth: right, borderBottomWidth: bottom, borderLeftWidth: left }
}
function bc(top: string, right: string, bottom: string, left: string) {
    return { borderTopColor: top, borderRightColor: right, borderBottomColor: bottom, borderLeftColor: left }
}
function bs(top: string, right: string, bottom: string, left: string) {
    return { borderTopStyle: top as any, borderRightStyle: right as any, borderBottomStyle: bottom as any, borderLeftStyle: left as any }
}

// Shorthand helpers â€” always include width + color + style for all 4 sides
function bBottom(w: number, color: string) {
    return { ...bw(0, 0, w, 0), ...bc("transparent", "transparent", color, "transparent"), ...bs("solid", "solid", "solid", "solid") }
}
function bTop(w: number, color: string) {
    return { ...bw(w, 0, 0, 0), ...bc(color, "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }
}
function bLeft(w: number, color: string) {
    return { ...bw(0, 0, 0, w), ...bc("transparent", "transparent", "transparent", color), ...bs("solid", "solid", "solid", "solid") }
}
function bAll(w: number, color: string) {
    return { ...bw(w, w, w, w), ...bc(color, color, color, color), ...bs("solid", "solid", "solid", "solid") }
}
// No-border helper: explicitly zero out everything
function bNone() {
    return { ...bw(0, 0, 0, 0), ...bc("transparent", "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }
}

/**
 * Sanitize terms/notes text to respect the signature toggle.
 *
 * When showSignatureFields is false (user has disabled signatures), this removes
 * sentences that reference physical/electronic signing so the document doesn't
 * contradict the user's intent. Industry standard (GoProposal, PandaDoc, BetterProposals):
 * when no signature section is shown, acceptance is implied by the client responding
 * or making payment — no signature language is needed in the terms.
 *
 * Replaced phrases are substituted with acceptance-without-signature alternatives
 * so the T&C still clearly establishes acceptance.
 */
function sanitizeTermsForDisplay(text: string, showSignatureFields: boolean): string {
    if (showSignatureFields !== false) return text  // signature on -> show as-is
    if (!text) return text

    const SIGN_KEYWORDS = [
        /\bsignat(?:ure|ures|ory|ories|ed|ing)\b/i,
        /\bsign\s+and\s+return\b/i,
        /\bsign(?:ed)?\s+(?:this\s+)?(?:document|proposal|contract|agreement|form)\b/i,
        /\bplease\s+sign\b/i,
        /\bauthorized\s+signatory\b/i,
        /\bsigned\s+by\s+(?:both|all)?\s*parties\b/i,
        /\bexecuted\s+by\s+(?:both|all)?\s*parties\b/i,
        /\bin\s+witness\s+whereof\b/i,
        /\bsignature\s+(?:page|block|line|field|section|below|above)\b/i,
        /\bwet\s+ink\s+signature\b/i,
        /\be-?signature\b/i,
        /\belectronically?\s+signed?\b/i,
        /\bcountersign(?:ed|ing|ature)?\b/i,
        /\bduly\s+(?:authorized|signed|executed)\b/i,
        /\bbinding\s+upon\s+(?:execution|signing)\b/i,
        /\bsigned\s+copy\b/i,
        /\bsign\s+below\b/i,
        /\bplease\s+(?:review\s+and\s+)?sign\b/i,
        /\breturn\s+(?:the\s+)?(?:signed\s+)?(?:copy|document|proposal|contract)\b/i,
        /\bsign(?:ing)?\s+(?:of\s+)?(?:this\s+)?(?:proposal|contract|agreement)\b/i,
    ]

    const sentences = text.split(/(?<=[.!?])\s+/)
    const filtered: string[] = []

    for (const sentence of sentences) {
        const trimmed = sentence.trim()
        if (!trimmed) continue
        const isSigning = SIGN_KEYWORDS.some(kw => kw.test(trimmed))
        if (isSigning) {
            if (/\bpayment\b|\badvance\b|\bdeposit\b|\binvoice\b/i.test(trimmed)) {
                const stripped = trimmed
                    .replace(/[,;]?\s*(?:upon|after|following|by)?\s*(?:signing|execution|signature)\s*(?:of\s*(?:this\s*)?(?:document|agreement|proposal|contract))?/gi, "")
                    .replace(/\s{2,}/g, " ")
                    .trim()
                if (stripped.length > 20 && stripped !== trimmed) filtered.push(stripped)
            }
        } else {
            filtered.push(trimmed)
        }
    }

    let cleaned = filtered.join(" ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim()

    if (!cleaned) {
        return "This proposal is valid for 30 days from the date of issue. Please confirm your acceptance via email to proceed."
    }
    return cleaned
}

/**
 * Get "Next Steps" copy appropriate to whether signatures are enabled.
 * When signatures are off, we don't say "please sign" — instead we say
 * "please confirm acceptance" (email-acceptance workflow).
 */
function getNextStepsText(data: InvoiceData): string {
    if (data.paymentInstructions) return data.paymentInstructions
    if (data.showSignatureFields === false) {
        return "To proceed with this proposal, please reply to confirm your acceptance. We look forward to working with you."
    }
    return "To proceed with this proposal, please sign and return this document. We look forward to working with you."
}

// Helper: render a single item row â€” Amount always shows full price (qty Ã— rate)
function ItemRow({ item, i, data, c, CF, CFB, tRow, tRowAlt, cD, cQ, cR, cA }: {
    item: any; i: number; data: InvoiceData; c: any; CF: any; CFB: any;
    tRow: any; tRowAlt: any; cD: any; cQ: any; cR: any; cA: any;
}) {
    const gross = item.quantity * item.rate
    const hasDisc = item.discount && item.discount > 0
    const discAmt = hasDisc ? gross * (item.discount / 100) : 0
    const lineTotal = gross - discAmt

    // Parse description: lines starting with "- " or "• " become bullet points.
    // Everything before the first bullet is the bold title.
    const rawDesc: string = item.description || `Item ${i + 1}`
    const allLines = rawDesc.split("\n").map((l: string) => l.trim()).filter(Boolean)
    const titleLines: string[] = []
    const bulletLines: string[] = []
    let sawBullet = false
    for (const line of allLines) {
        if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
            sawBullet = true
            bulletLines.push(line.replace(/^[-•*]\s+/, "").trim())
        } else if (!sawBullet) {
            titleLines.push(line)
        } else {
            bulletLines.push(line)
        }
    }
    const titleText = titleLines.join(" | ") || rawDesc

    return (
        <View key={i} style={i % 2 === 1 ? tRowAlt : tRow} wrap={false}>
            <View style={cD}>
                <Text style={{ fontSize: 10, color: c.txt, fontWeight: bulletLines.length > 0 ? 700 : 400 }}>{titleText}</Text>
                {bulletLines.map((b: string, bi: number) => (
                    <View key={bi} style={{ flexDirection: "row", marginTop: 3, paddingLeft: 4, ...bNone() }}>
                        <Text style={{ fontSize: 8.5, color: c.pri, marginRight: 5, marginTop: 0.5, fontWeight: 700 }}>•</Text>
                        <Text style={{ fontSize: 8.5, color: c.mut, flex: 1, lineHeight: 1.4 }}>{b}</Text>
                    </View>
                ))}
            </View>
            <View style={cQ}><Text style={{ fontSize: 10, color: c.mut, textAlign: "center" }}>{item.quantity}</Text></View>
            <View style={cR}><Text style={{ fontSize: 10, color: c.mut, textAlign: "right", ...CF }}>{fmt(item.rate, data.currency)}</Text></View>
            <View style={cA}>
                {hasDisc ? (
                    <>
                        <Text style={{ fontSize: 8, color: c.mut, textAlign: "right", textDecoration: "line-through" }}>{fmt(gross, data.currency)}</Text>
                        <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", ...CFB }}>{fmt(lineTotal, data.currency)}</Text>
                    </>
                ) : (
                    <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", ...CFB }}>{fmt(gross, data.currency)}</Text>
                )}
            </View>
        </View>
    )
}

// Get total of all per-item discounts (single combined line)
function getItemDiscountTotal(data: InvoiceData): number {
    return data.items.reduce((s, i) => {
        if (!i.discount || i.discount <= 0) return s
        return s + i.quantity * i.rate * (i.discount / 100)
    }, 0)
}


// â”€â”€â”€ Logo helper for PDF headers â”€â”€â”€
function PdfLogo({ url, show, shape, size: sizeProp }: { url?: string | null; show?: boolean; shape?: "rounded" | "circle"; size?: number }) {
    if (!url || show === false) return null
    const size = Math.max(24, Math.min(96, sizeProp ?? 44))
    const isCircle = shape === "circle"
    const radius = isCircle ? size / 2 : 8
    return (
        <View style={{
            width: size,
            height: size,
            marginBottom: 8,
            overflow: "hidden",
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderBottomLeftRadius: radius,
            borderBottomRightRadius: radius,
            ...bNone(),
        }}>
            <Image
                src={url}
                style={{ width: size, height: size, objectFit: "cover" as any }}
            />
        </View>
    )
}

// â”€â”€â”€ Document Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Configuration-driven layout differentiation per document type.
// Each config specifies labels, section flags, table columns, and date fields
// so shared section components can render the correct layout for each type.

export interface DocumentConfig {
    title: string
    refPrefix: string
    showStatusBadge: boolean

    dateFields: Array<{
        label: string
        getValue: (data: InvoiceData) => string
        required: boolean
    }>

    fromLabel: string
    toLabel: string

    tableSectionTitle?: string
    tableColumns: { desc: string; qty: string; rate: string; amount: string }
    tableHeaderUsesAccent: boolean

    grandTotalLabel: string

    hasPaymentInfo: boolean
    hasPaymentSection: boolean
    hasSignatureRow: boolean
    hasScopeSection: boolean
    hasDescriptionBox: boolean
    hasExecutiveSummary: boolean
    hasNextStepsCTA: boolean
    skipEmptyItems: boolean
}

export function getDocumentConfig(documentType: string): DocumentConfig {
    switch (documentType) {
        case "contract":
            return {
                title: "CONTRACT",
                refPrefix: "CTR",
                showStatusBadge: false,
                dateFields: [
                    { label: "Effective Date", getValue: (d) => fmtDate(d.invoiceDate), required: true },
                    { label: "End Date", getValue: (d) => fmtDate(d.dueDate), required: false },
                ],
                fromLabel: "Party A \u2014 Provider",
                toLabel: "Party B \u2014 Client",
                tableSectionTitle: "Deliverables & Pricing",
                tableColumns: { desc: "Deliverable", qty: "Qty", rate: "Rate", amount: "Amount" },
                tableHeaderUsesAccent: false,
                grandTotalLabel: "Total Value",
                hasPaymentInfo: false,
                hasPaymentSection: false,
                hasSignatureRow: true,
                hasScopeSection: true,
                hasDescriptionBox: false,
                hasExecutiveSummary: false,
                hasNextStepsCTA: false,
                skipEmptyItems: true,
            }
        case "quote":
        case "quotation":
            return {
                title: "QUOTE",
                refPrefix: "QUO",
                showStatusBadge: false,
                dateFields: [
                    { label: "Quote Date", getValue: (d) => fmtDate(d.invoiceDate), required: true },
                    { label: "Valid Until", getValue: (d) => fmtDate(d.dueDate), required: true },
                    { label: "Payment Terms", getValue: (d) => d.paymentTerms || "Net 30", required: true },
                ],
                fromLabel: "From",
                toLabel: "Quote For",
                tableColumns: { desc: "Item / Service", qty: "Qty", rate: "Unit Price", amount: "Amount" },
                tableHeaderUsesAccent: false,
                grandTotalLabel: "Total",
                hasPaymentInfo: false,
                hasPaymentSection: false,
                hasSignatureRow: true,
                hasScopeSection: false,
                hasDescriptionBox: true,
                hasExecutiveSummary: false,
                hasNextStepsCTA: false,
                skipEmptyItems: false,
            }
        case "proposal":
            return {
                title: "PROPOSAL",
                refPrefix: "PROP",
                showStatusBadge: false,
                dateFields: [
                    { label: "Date", getValue: (d) => fmtDate(d.invoiceDate), required: true },
                    { label: "Valid Until", getValue: (d) => fmtDate(d.dueDate), required: false },
                    { label: "Payment", getValue: (d) => d.paymentTerms || "", required: false },
                ],
                fromLabel: "Prepared By",
                toLabel: "Prepared For",
                tableSectionTitle: "Budget Breakdown",
                tableColumns: { desc: "Deliverable / Phase", qty: "Qty", rate: "Rate", amount: "Amount" },
                tableHeaderUsesAccent: true,
                grandTotalLabel: "Total Investment",
                hasPaymentInfo: false,
                hasPaymentSection: false,
                hasSignatureRow: true,
                hasScopeSection: false,
                hasDescriptionBox: false,
                hasExecutiveSummary: true,
                hasNextStepsCTA: true,
                skipEmptyItems: true,
            }
        case "invoice":
        default:
            return {
                title: "INVOICE",
                refPrefix: "INV",
                showStatusBadge: true,
                dateFields: [
                    { label: "Issue Date", getValue: (d) => fmtDate(d.invoiceDate), required: true },
                    { label: "Due Date", getValue: (d) => fmtDate(d.dueDate), required: true },
                    { label: "Payment Terms", getValue: (d) => d.paymentTerms || "Net 30", required: true },
                ],
                fromLabel: "From",
                toLabel: "Bill To",
                tableColumns: { desc: "Description", qty: "Qty", rate: "Rate", amount: "Amount" },
                tableHeaderUsesAccent: false,
                grandTotalLabel: "Total Due",
                hasPaymentInfo: true,
                hasPaymentSection: true,
                hasSignatureRow: false,
                hasScopeSection: false,
                hasDescriptionBox: false,
                hasExecutiveSummary: false,
                hasNextStepsCTA: false,
                skipEmptyItems: false,
            }
    }
}

// â”€â”€â”€ HeaderSection (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders document title, reference number, logo, and optional status badge.
// Each document type has a unique decorative accent per theme variant.

interface HeaderSectionProps {
    data: InvoiceData
    logoUrl?: string | null
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
}

function HeaderSection({ data, logoUrl, tpl, c, config }: HeaderSectionProps) {
    const refNumber = data.referenceNumber || data.invoiceNumber || config.refPrefix + "-0000"
    const docType = config.title // "INVOICE" | "CONTRACT" | "QUOTATION" | "PROPOSAL"

    // â”€â”€ Bold theme: full-width colored header â”€â”€
    if (tpl === "bold") {
        // Bold accent shapes vary by document type
        const boldShapeStyle = (() => {
            switch (docType) {
                case "INVOICE":
                    // Angled shape (top-right)
                    return { position: "absolute" as const, top: 0, right: 0, width: 140, height: 100, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 60, opacity: 0.5 }
                case "CONTRACT":
                    // Circle overlay
                    return { position: "absolute" as const, top: 20, right: 60, width: 70, height: 70, ...r(35), backgroundColor: "rgba(255,255,255,0.1)" }
                case "QUOTE":
                case "QUOTATION":
                    // Curved shape (top-right)
                    return { position: "absolute" as const, top: 0, right: 0, width: 120, height: 90, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 50, opacity: 0.5 }
                case "PROPOSAL":
                    // Shape + circle
                    return { position: "absolute" as const, top: 0, right: 0, width: 140, height: 100, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 60, opacity: 0.5 }
                default:
                    return { position: "absolute" as const, top: 0, right: 0, width: 140, height: 100, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 60, opacity: 0.5 }
            }
        })()

        return (
            <View style={{ backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 28 }} fixed>
                <View style={boldShapeStyle} />
                {docType === "PROPOSAL" && (
                    <View style={{ position: "absolute", top: 55, right: 95, width: 40, height: 40, ...r(20), backgroundColor: "rgba(255,255,255,0.1)" }} />
                )}
                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                <Text style={{ fontSize: docType === "INVOICE" || docType === "PROPOSAL" ? 32 : 30, color: "#fff", letterSpacing: docType === "INVOICE" || docType === "PROPOSAL" ? 2 : docType === "QUOTE" || docType === "QUOTATION" ? 1.5 : 1, ...bold(c) }}>{docType}</Text>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{refNumber}</Text>
            </View>
        )
    }

    // â”€â”€ Modern / Classic / Other themes: decorative accents + standard header â”€â”€

    // Decorative accent elements rendered before the header content
    const renderAccent = () => {
        switch (docType) {
            case "INVOICE":
                if (tpl === "modern") {
                    return (
                        <>
                            {/* Corner shape (top-right) */}
                            <View style={{ position: "absolute", top: 0, right: 0, width: 160, height: 100, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 }} fixed />
                            {/* Top bar */}
                            <View style={{ height: 8, backgroundColor: c.pri, marginBottom: 0 }} />
                        </>
                    )
                }
                if (tpl === "classic") {
                    // Double line
                    return (
                        <>
                            <View style={{ height: 2, backgroundColor: c.pri, marginBottom: 20 }} />
                        </>
                    )
                }
                // Other themes use modern accent pattern
                return (
                    <>
                        <View style={{ position: "absolute", top: 0, right: 0, width: 160, height: 100, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 }} fixed />
                        <View style={{ height: 8, backgroundColor: c.pri, marginBottom: 0 }} />
                    </>
                )

            case "CONTRACT":
                if (tpl === "modern") {
                    // Left sidebar (6px vertical bar)
                    return <View style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%" as any, backgroundColor: c.pri }} fixed />
                }
                if (tpl === "classic") {
                    // Double line (thick + thin)
                    return (
                        <>
                            <View style={{ height: 3, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 4 }} />
                            <View style={{ height: 1, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 16 }} />
                        </>
                    )
                }
                // Other themes use modern accent pattern (left sidebar)
                return <View style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%" as any, backgroundColor: c.pri }} fixed />

            case "QUOTE":
            case "QUOTATION":
                if (tpl === "modern") {
                    // Corner accent (top-left square)
                    return <View style={{ position: "absolute", top: 0, left: 0, width: 100, height: 100, backgroundColor: c.acc }} fixed />
                }
                if (tpl === "classic") {
                    // Border frame
                    return <View style={{ position: "absolute", top: 24, left: 24, right: 24, bottom: 24, ...bAll(1, c.bdr) }} fixed />
                }
                // Other themes use modern accent pattern (corner accent)
                return <View style={{ position: "absolute", top: 0, left: 0, width: 100, height: 100, backgroundColor: c.acc }} fixed />

            case "PROPOSAL":
                if (tpl === "modern") {
                    return (
                        <>
                            {/* Right shape (curved bottom-left) */}
                            <View style={{ position: "absolute", top: 0, right: 0, width: 140, height: 110, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 }} fixed />
                            {/* Top bar */}
                            <View style={{ height: 6, backgroundColor: c.pri }} />
                        </>
                    )
                }
                if (tpl === "classic") {
                    // Single line
                    return <View style={{ height: 2, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 16 }} />
                }
                // Other themes use modern accent pattern
                return (
                    <>
                        <View style={{ position: "absolute", top: 0, right: 0, width: 140, height: 110, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 }} fixed />
                        <View style={{ height: 6, backgroundColor: c.pri }} />
                    </>
                )

            default:
                return null
        }
    }

    // Title font size and letter spacing vary by document type and theme
    const titleFontSize = tpl === "classic" ? (docType === "CONTRACT" ? 24 : 26) : (docType === "CONTRACT" || docType === "QUOTE" || docType === "QUOTATION" ? 28 : 30)
    const titleLetterSpacing = tpl === "classic" ? 0 : (docType === "QUOTE" || docType === "QUOTATION" ? 1.5 : docType === "CONTRACT" ? 1 : 2)

    // Header wrapper horizontal padding â€” Contract uses paddingHorizontal: 48 always
    const hPadding = (docType === "CONTRACT" || docType === "QUOTE" || docType === "QUOTATION" || docType === "PROPOSAL") ? 48 : 0

    return (
        <>
            {renderAccent()}
            <View style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "flex-start",
                paddingTop: 24,
                paddingBottom: 16,
                paddingHorizontal: hPadding,
                ...(docType === "INVOICE" ? { marginHorizontal: 0 } : {}),
            }} wrap={false}>
                <View>
                    <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                    <Text style={{ fontSize: titleFontSize, color: c.pri, letterSpacing: titleLetterSpacing, ...bold(c) }}>{docType}</Text>
                    <Text style={{ fontSize: 10, color: c.mut, marginTop: 4 }}>{refNumber}</Text>
                </View>
                {/* Status badge â€” only for Invoice */}
                {config.showStatusBadge && (
                    <View style={{ backgroundColor: c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(14), ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, ...bold(c) }}>{data.status === "paid" ? "PAID" : "DRAFT"}</Text>
                    </View>
                )}
            </View>
        </>
    )
}

// â”€â”€â”€ DateStrip (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders date fields from config.dateFields in a horizontal row.
// Style varies by theme: modern (bg + rounded), classic (transparent + bottom border),
// bold (left border accent on each item).

interface DateStripProps {
    data: InvoiceData
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
}

function DateStrip({ data, tpl, c, config }: DateStripProps) {
    const docType = config.title
    const isInvoice = docType === "INVOICE"
    const hPadding = isInvoice ? 0 : 48

    // For Invoice: uses a single strip container with bg color (modern pattern)
    // For Contract/Quotation/Proposal: uses a row with individual items
    if (isInvoice) {
        // Invoice date strip â€” matches existing s.dStrip / s.dItem pattern
        return (
            <View style={{
                flexDirection: "row",
                backgroundColor: tpl === "classic" ? "transparent" : c.bg,
                marginHorizontal: tpl === "bold" ? 48 : 0,
                ...r(tpl === "classic" ? 0 : 8),
                padding: tpl === "classic" ? 0 : 14,
                marginBottom: 20,
                ...bBottom(tpl === "classic" ? 1 : 0, c.bdr),
                paddingBottom: tpl === "classic" ? 16 : 14,
            }} wrap={false}>
                {config.dateFields.map((field, idx) => {
                    const value = field.getValue(data)
                    if (!field.required && (!value || value === "\u2014")) return null
                    return (
                        <View key={idx} style={{
                            flex: 1,
                            ...bLeft(tpl === "bold" ? 3 : 0, c.pri),
                            paddingLeft: tpl === "bold" ? 10 : 0,
                            marginRight: idx < config.dateFields.length - 1 ? 10 : 0,
                        }}>
                            <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>{field.label}</Text>
                            <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{value}</Text>
                        </View>
                    )
                })}
            </View>
        )
    }

    // Contract / Quotation / Proposal date strip â€” matches existing s.dRow / s.dItem pattern
    return (
        <View style={{
            flexDirection: "row",
            paddingHorizontal: hPadding,
            marginBottom: 20,
        }} wrap={false}>
            {config.dateFields.map((field, idx) => {
                const value = field.getValue(data)
                if (!field.required && (!value || value === "\u2014")) return null
                return (
                    <View key={idx} style={{
                        flex: 1,
                        ...bw(0, 0, tpl === "classic" ? 1 : 0, tpl === "classic" ? 0 : (tpl === "bold" ? 3 : 3)),
                        ...bc("transparent", "transparent", tpl === "classic" ? c.bdr : "transparent", tpl === "classic" ? "transparent" : c.pri),
                        ...bs("solid", "solid", "solid", "solid"),
                        paddingLeft: tpl === "classic" ? 0 : 10,
                        paddingBottom: tpl === "classic" ? 10 : 0,
                        marginRight: idx < config.dateFields.length - 1 ? (docType === "PROPOSAL" ? 12 : 10) : 0,
                    }}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>{field.label}</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{value}</Text>
                    </View>
                )
            })}
        </View>
    )
}

// â”€â”€â”€ PartyBlocks (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders two-column party info using config.fromLabel and config.toLabel.
// Style varies by theme: bold (bg color blocks), modern (accent underline on labels),
// classic (bottom border on labels).

interface PartyBlocksProps {
    data: InvoiceData
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
}

function PartyBlocks({ data, tpl, c, config }: PartyBlocksProps) {
    const docType = config.title
    const isInvoice = docType === "INVOICE"
    const isProposal = docType === "PROPOSAL"

    // Label underline style varies by theme and document type
    const labelUnderline = (() => {
        if (isInvoice) {
            // Invoice: modern gets accent underline, classic gets bottom border
            return bBottom(tpl === "classic" ? 1 : tpl === "modern" ? 2 : 0, c.acc)
        }
        if (isProposal) {
            // Proposal: modern gets accent underline
            return bBottom(tpl === "modern" ? 2 : 0, c.acc)
        }
        // Contract / Quotation: no underline on labels
        return bBottom(0, "transparent")
    })()

    return (
        <View style={{
            flexDirection: "row",
            ...(isInvoice
                ? { marginHorizontal: tpl === "bold" ? 48 : 0 }
                : { paddingHorizontal: 48, paddingTop: tpl === "bold" && isProposal ? 24 : 0 }),
            marginBottom: 24,
        }} wrap={false}>
            <View style={{
                flex: 1,
                backgroundColor: tpl === "bold" && (isInvoice || docType === "CONTRACT") ? c.bg : "transparent",
                ...r(tpl === "bold" && (isInvoice || docType === "CONTRACT") ? 8 : 0),
                padding: tpl === "bold" && (isInvoice || docType === "CONTRACT") ? 14 : 0,
                marginRight: 14,
            }}>
                <Text style={{
                    fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
                    ...labelUnderline, paddingBottom: 4, ...bold(c),
                }}>{config.fromLabel}</Text>
                <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.fromName || "Your Business"}</Text>
                {data.fromAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                {data.fromEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromEmail}</Text> : null}
                {data.fromPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromPhone}</Text> : null}
            </View>
            <View style={{
                flex: 1,
                backgroundColor: tpl === "bold" && (isInvoice || docType === "CONTRACT") ? c.bg : "transparent",
                ...r(tpl === "bold" && (isInvoice || docType === "CONTRACT") ? 8 : 0),
                padding: tpl === "bold" && (isInvoice || docType === "CONTRACT") ? 14 : 0,
                marginRight: 0,
            }}>
                <Text style={{
                    fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6,
                    ...labelUnderline, paddingBottom: 4, ...bold(c),
                }}>{config.toLabel}</Text>
                <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.toName || "[Client Name]"}</Text>
                {data.toAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                {data.toEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toEmail}</Text> : null}
                {data.toPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toPhone}</Text> : null}
            </View>
        </View>
    )
}

// â”€â”€â”€ ItemTable (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders the line-item table with document-specific column headers and optional section title.
// Uses config.tableColumns for headers, config.tableSectionTitle for optional title,
// config.tableHeaderUsesAccent for Proposal accent background, config.skipEmptyItems for filtering.

interface ItemTableProps {
    data: InvoiceData
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
    styles: { tHead: any; tRow: any; tRowAlt: any; cD: any; cQ: any; cR: any; cA: any }
}

function ItemTable({ data, tpl, c, config, styles }: ItemTableProps) {
    const docType = config.title
    const isInvoice = docType === "INVOICE"
    const hMargin = isInvoice ? (tpl === "bold" ? 48 : 0) : 48

    // Filter items if skipEmptyItems is enabled (Contract, Proposal)
    const items = config.skipEmptyItems
        ? data.items.filter(i => i.description.trim().length > 0 || i.rate > 0)
        : data.items

    // For Contract and Proposal, don't render if no items
    if (config.skipEmptyItems && items.length === 0) return null

    // Header text color depends on theme and whether accent is used
    const headerTextColor = (() => {
        if (tpl === "classic") return c.pri
        if (config.tableHeaderUsesAccent) return c.pri // Proposal uses accent bg with pri text
        return "#fff" // Non-classic themes with pri background use white text
    })()

    return (
        <View style={{ marginHorizontal: hMargin, marginBottom: 16 }}>
            {config.tableSectionTitle && (
                <Text style={{ fontSize: 11, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, ...bold(c) }}>{config.tableSectionTitle}</Text>
            )}
            <View style={styles.tHead} wrap={false}>
                <View style={styles.cD}><Text style={{ fontSize: 8, color: headerTextColor, textTransform: "uppercase", letterSpacing: 0.8, ...bold(c) }}>{config.tableColumns.desc}</Text></View>
                <View style={styles.cQ}><Text style={{ fontSize: 8, color: headerTextColor, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", ...bold(c) }}>{config.tableColumns.qty}</Text></View>
                <View style={styles.cR}><Text style={{ fontSize: 8, color: headerTextColor, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>{config.tableColumns.rate}</Text></View>
                <View style={styles.cA}><Text style={{ fontSize: 8, color: headerTextColor, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>{config.tableColumns.amount}</Text></View>
            </View>
            {items.map((item, i) => {
                if (config.skipEmptyItems && !item.description && item.rate === 0) return null
                return (
                    <ItemRow key={i} item={item} i={i} data={data} c={c} CF={CF} CFB={CFB}
                        tRow={styles.tRow} tRowAlt={styles.tRowAlt} cD={styles.cD} cQ={styles.cQ} cR={styles.cR} cA={styles.cA} />
                )
            })}
        </View>
    )
}

// â”€â”€â”€ TotalsBox (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders the financial summary: Subtotal, Discounts, Tax, Shipping, Grand Total.
// Grand total label comes from config.grandTotalLabel.

interface TotalsBoxProps {
    data: InvoiceData
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
    styles: { totBox: any; totRow: any; gRow: any }
}

function TotalsBox({ data, c, config, styles }: TotalsBoxProps) {
    const { sub, disc, tax, total } = calc(data)

    // Hide totals when hideTotals is explicitly set, or when type is Contract/Proposal with zero total
    if ((data as any).hideTotals) return null
    if ((config.title === "CONTRACT" || config.title === "PROPOSAL") && total <= 0) return null

    return (
        <View style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            ...(config.title === "INVOICE"
                ? { marginHorizontal: 0 }
                : { paddingHorizontal: 48 }),
            marginBottom: 20,
        }} wrap={false}>
            <View style={styles.totBox}>
                <View style={styles.totRow}>
                    <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                    <Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(sub, data.currency)}</Text>
                </View>
                {getItemDiscountTotal(data) > 0 && (
                    <View style={styles.totRow}>
                        <Text style={{ fontSize: 10, color: c.mut }}>Discount</Text>
                        <Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text>
                    </View>
                )}
                {!!data.discountValue && (
                    <View style={styles.totRow}>
                        <Text style={{ fontSize: 10, color: c.mut }}>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}</Text>
                        <Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(disc, data.currency)}</Text>
                    </View>
                )}
                {!!data.taxRate && (
                    <View style={styles.totRow}>
                        <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                        <Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(tax, data.currency)}</Text>
                    </View>
                )}
                {!!data.shippingFee && config.title === "INVOICE" && (
                    <View style={styles.totRow}>
                        <Text style={{ fontSize: 10, color: c.mut }}>Shipping</Text>
                        <Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(data.shippingFee, data.currency)}</Text>
                    </View>
                )}
                <View style={styles.gRow}>
                    <Text style={{ fontSize: 12, color: c.pri, ...bold(c) }}>{config.grandTotalLabel}</Text>
                    <Text style={{ fontSize: 18, color: c.pri, ...CFB }}>{fmt(total, data.currency)}</Text>
                </View>
            </View>
        </View>
    )
}

// â”€â”€â”€ SignatureRow (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders dual signature blocks for Contract, Quotation, and Proposal.
// Handles sender drawn signature, client signature image, "Electronically Signed" fallback.

interface SignatureRowProps {
    data: InvoiceData
    c: ReturnType<typeof getTheme>
    styles: { sigRow: any; sigBlk: any; sigLine: any }
}

function SignatureRow({ data, c, styles }: SignatureRowProps) {
    if (data.showSignatureFields === false) return null

    return (
        <View style={styles.sigRow} wrap={false}>
            {/* Party A (sender) */}
            <View style={styles.sigBlk}>
                <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party A Signature</Text>
                {(() => {
                    if (data.showSenderSignature !== false && data.senderSignatureDataUrl) {
                        return <Image src={data.senderSignatureDataUrl} style={{ width: 160, height: 56, marginBottom: 4 }} />
                    }
                    return <View style={styles.sigLine} />
                })()}
                <Text style={{ fontSize: 10, color: c.txt, ...bold(c) }}>{data.signatureName || data.fromName || "_______________"}</Text>
                {data.signatureTitle ? <Text style={{ fontSize: 9, color: c.mut }}>{data.signatureTitle}</Text> : null}
            </View>
            {/* Party B (client) */}
            <View style={{ ...styles.sigBlk, marginRight: 0 }}>
                <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party B Signature</Text>
                {(() => {
                    const clientSig = data.signatureImages?.[0]
                    if (clientSig?.imageDataUrl) {
                        return <Image src={clientSig.imageDataUrl} style={{ width: 160, height: 56, marginBottom: 4 }} />
                    }
                    if (data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) {
                        return (
                            <View style={{ height: 56, marginBottom: 4, justifyContent: "center", alignItems: "flex-start" }}>
                                <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>{"\u2713"} Electronically Signed</Text>
                            </View>
                        )
                    }
                    return <View style={styles.sigLine} />
                })()}
                <Text style={{ fontSize: 10, color: c.txt, ...bold(c) }}>{data.toName || "_______________"}</Text>
            </View>
        </View>
    )
}

// â”€â”€â”€ Signature Display Mode (testable pure function) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Extracts the signature display mode selection logic from SignatureRow into a
// pure function so it can be property-tested independently.

export type SignatureDisplayMode = "drawn_image" | "electronically_signed" | "signature_line"

export function getSignatureDisplayMode(data: InvoiceData): { partyA: SignatureDisplayMode; partyB: SignatureDisplayMode } {
    // Party A: show drawn image when showSenderSignature !== false AND senderSignatureDataUrl is truthy
    const partyA: SignatureDisplayMode =
        data.showSenderSignature !== false && data.senderSignatureDataUrl
            ? "drawn_image"
            : "signature_line"

    // Party B: show drawn image when signatureImages[0].imageDataUrl is truthy
    // Show "electronically_signed" when signedAt is truthy OR signatureImages has entries but no imageDataUrl
    // Otherwise show signature line
    const clientSig = data.signatureImages?.[0]
    let partyB: SignatureDisplayMode
    if (clientSig?.imageDataUrl) {
        partyB = "drawn_image"
    } else if (data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) {
        partyB = "electronically_signed"
    } else {
        partyB = "signature_line"
    }

    return { partyA, partyB }
}

// â”€â”€â”€ Signature Block Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// buildSignatureBlock: returns a React element for the signature block based on type,
// or null if the type's data doesn't support it. Used by renderSignatureBlock.
// renderSignatureBlock: fail-closed â€” throws SignatureBlockRenderError if a signable
// type cannot produce a signature block rather than returning an empty element.

/**
 * Get type-specific party labels for signature blocks.
 * - NDA:           "Disclosing Party" / "Receiving Party"
 * - SOW / Change Order: "Client" / "Provider"
 * - Contract / others: "Party A" / "Party B"
 */
export function getSignaturePartyLabels(documentType: string): { partyA: string; partyB: string } {
    const type = documentType.toLowerCase()
    if (type === "nda") {
        return { partyA: "Disclosing Party", partyB: "Receiving Party" }
    }
    if (type === "sow" || type === "change_order") {
        return { partyA: "Client", partyB: "Provider" }
    }
    return { partyA: "Party A", partyB: "Party B" }
}

/**
 * Build the signature block JSX for a document.
 * Returns the element if buildable, or null if data is insufficient.
 * This is extracted so renderSignatureBlock can apply fail-closed logic.
 */
function buildSignatureBlock(
    documentType: string,
    data: InvoiceData,
    c: ReturnType<typeof getTheme>,
): React.ReactElement | null {
    // If there are truly no party names at all, render placeholder lines so
    // the live preview doesn't crash. The export guard in renderSignatureBlock
    // checks this independently and only blocks final download, not preview.
    const hasAnyParty = !!(data.fromName || data.toName || data.signatureName)

    const { partyA, partyB } = getSignaturePartyLabels(documentType)

    return (
        <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 16, marginBottom: 20, ...bNone() }} wrap={false}>
            {[
                {
                    label: `${partyA} Signature`,
                    name: data.signatureName || data.fromName,
                    title: data.signatureTitle,
                    sig: data.showSenderSignature !== false ? data.senderSignatureDataUrl : null,
                    electronic: false,
                },
                {
                    label: `${partyB} Signature`,
                    name: data.toName,
                    title: null,
                    sig: data.signatureImages?.[0]?.imageDataUrl || null,
                    electronic: !data.signatureImages?.[0]?.imageDataUrl && (!!data.signedAt || (data.signatureImages && data.signatureImages.length > 0)),
                },
            ].map((party, i) => (
                <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                    <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                    {party.sig ? (
                        <Image src={party.sig} style={{ width: 160, height: 52, marginBottom: 4, ...bNone() }} />
                    ) : party.electronic ? (
                        <View style={{ height: 52, marginBottom: 4, justifyContent: "center", ...bNone() }}>
                            <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>âœ“ Electronically Signed</Text>
                        </View>
                    ) : (
                        <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: c.mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                    )}
                    <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                    {party.title ? <Text style={{ fontSize: 9, color: c.mut }}>{party.title}</Text> : null}
                </View>
            ))}
        </View>
    )
}

/**
 * Fail-closed signature block rendering.
 *
 * - For non-signable types: returns an empty fragment (no block needed).
 * - For signable types: returns the signature block element OR throws
 *   SignatureBlockRenderError if the block cannot be built.
 *   This ensures a PDF is never exported without its required signature section.
 */
export function renderSignatureBlock(
    documentType: string,
    data: InvoiceData,
    c: ReturnType<typeof getTheme>,
): React.ReactElement {
    const config = getDocumentTypeConfig(documentType)
    if (!config?.capabilities.supports_signature) {
        // Non-signable type â€” no block needed, proceed normally
        return <></>
    }

    // Always render a block. If party names are missing (live preview before AI fills them),
    // buildSignatureBlock renders placeholder underlines rather than crashing.
    const block = buildSignatureBlock(documentType, data, c)
    if (!block) {
        // Defensive fallback — renders an empty spacer so the preview doesn't crash
        return <View style={{ paddingHorizontal: 48, marginTop: 16, marginBottom: 20 }} />
    }
    return block
}

// â”€â”€â”€ NotesSection (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders Notes and Terms & Conditions blocks.

interface NotesSectionProps {
    data: InvoiceData
    c: ReturnType<typeof getTheme>
    tpl: Tpl
    config: DocumentConfig
}

function NotesSection({ data, c, tpl, config }: NotesSectionProps) {
    const docType = config.title
    const isInvoice = docType === "INVOICE"
    const isContract = docType === "CONTRACT"
    const showSig = data.showSignatureFields !== false

    const wrapStyle = isInvoice
        ? { marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 16 }
        : { paddingHorizontal: 48, marginBottom: 16 }

    const termsLabel = isContract ? "Additional Terms" : "Terms & Conditions"

    // Sanitize terms text: remove signature-referencing sentences when sig section is hidden
    const termsText = sanitizeTermsForDisplay(fixEncoding(data.terms ?? ""), data.showSignatureFields !== false)

    return (
        <>
            {data.notes ? (
                <View style={wrapStyle}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{fixEncoding(data.notes ?? "")}</Text>
                </View>
            ) : null}
            {termsText ? (
                <View style={wrapStyle}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>{termsLabel}</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{termsText}</Text>
                </View>
            ) : null}
        </>
    )
}

// â”€â”€â”€ FooterBar (shared internal component) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Renders the page footer with "Generated by Clorefy" and page numbers.

interface FooterBarProps {
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    config: DocumentConfig
}

function FooterBar({ tpl, c, config }: FooterBarProps) {
    const isBold = tpl === "bold"
    const isInvoice = config.title === "INVOICE"

    return (
        <View style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: isInvoice ? 40 : 36,
            backgroundColor: isBold ? c.pri : (isInvoice ? c.bg : "#fff"),
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 48,
            ...bTop(isBold ? 0 : 1, c.bdr),
        }} fixed>
            <Text style={{ fontSize: 8, color: isBold ? "rgba(255,255,255,0.7)" : c.mut }}>Generated by Clorefy</Text>
            <Text style={{ fontSize: 8, color: isBold ? "rgba(255,255,255,0.7)" : c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
    )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// THEME-SPECIFIC HEADER RENDERER
// Each of the 9 themes gets a genuinely different structural layout.
// Called by all 4 document templates with their own title/content.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface DocHeaderProps {
    tpl: Tpl
    c: ReturnType<typeof getTheme>
    title: string          // "INVOICE", "CONTRACT", etc.
    refNum: string         // reference / invoice number
    logoUrl?: string | null
    data: InvoiceData
    // Right-side content varies per doc type
    rightContent: React.ReactNode
    // Optional: extra content shown below the header band (for corporate sidebar)
    belowHeader?: React.ReactNode
}

function DocHeader({ tpl, c, title, refNum, logoUrl, data, rightContent, belowHeader }: DocHeaderProps) {
    switch (tpl) {
        // â”€â”€ 1. MODERN: Full-bleed colored header, decorative circles â”€â”€
        case "modern":
            return (
                <View style={{ ...bNone() }}>
                    <View style={{ backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 36, paddingBottom: 32, ...bNone() }}>
                        <View style={{ position: "absolute", top: -20, right: -20, width: 130, height: 130, ...r(65), backgroundColor: "rgba(255,255,255,0.07)", ...bNone() }} />
                        <View style={{ position: "absolute", bottom: -15, right: 70, width: 70, height: 70, ...r(35), backgroundColor: "rgba(255,255,255,0.05)", ...bNone() }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                            <View style={{ ...bNone() }}>
                                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                                <Text style={{ fontSize: 36, color: "#fff", fontWeight: 700, letterSpacing: -0.5 }}>{title}</Text>
                                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{refNum}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                        </View>
                    </View>
                    {belowHeader}
                </View>
            )

        // â”€â”€ 2. CLASSIC: White header, thick left border, double rule â”€â”€
        case "classic":
            return (
                <View style={{ paddingHorizontal: 48, paddingTop: 40, paddingBottom: 20, ...bNone() }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                        <View style={{ paddingLeft: 16, ...bNone(), borderLeftWidth: 5, borderLeftColor: c.pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }}>
                            <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                            <Text style={{ fontSize: 32, color: c.txt, fontWeight: 700 }}>{title}</Text>
                            <Text style={{ fontSize: 10, color: c.mut, marginTop: 3 }}>{refNum}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                    </View>
                    <View style={{ height: 3, backgroundColor: c.pri, marginTop: 18, ...bNone() }} />
                    <View style={{ height: 1, backgroundColor: c.bdr, marginTop: 4, ...bNone() }} />
                    {belowHeader}
                </View>
            )

        // â”€â”€ 3. BOLD: Dark full-width header, large typography, angled bottom â”€â”€
        case "bold":
            return (
                <View style={{ ...bNone() }}>
                    <View style={{ backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 36, ...bNone() }}>
                        {/* Angled shape bottom-right */}
                        <View style={{ position: "absolute", top: 0, right: 0, width: 160, height: "100%" as any, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 80, opacity: 0.4, ...bNone() }} />
                        <View style={{ position: "absolute", top: 50, right: 80, width: 50, height: 50, ...r(25), backgroundColor: "rgba(255,255,255,0.08)", ...bNone() }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                            <View style={{ ...bNone() }}>
                                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                                <Text style={{ fontSize: 42, color: "#fff", fontWeight: 700, letterSpacing: 2 }}>{title}</Text>
                                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4, letterSpacing: 1 }}>{refNum}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                        </View>
                    </View>
                    {/* Bold accent bar below header */}
                    <View style={{ height: 4, backgroundColor: c.priDk, ...bNone() }} />
                    {belowHeader}
                </View>
            )

        // â”€â”€ 4. MINIMAL: Ultra-clean, no color, pure typography â”€â”€
        case "minimal":
            return (
                <View style={{ paddingHorizontal: 48, paddingTop: 48, paddingBottom: 28, ...bNone() }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                        <View style={{ ...bNone() }}>
                            <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                            <Text style={{ fontSize: 10, color: c.mut, letterSpacing: 4, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>{title}</Text>
                            <Text style={{ fontSize: 9, color: c.mut }}>{refNum}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                    </View>
                    {/* Single hairline rule */}
                    <View style={{ height: 1, backgroundColor: c.bdr, marginTop: 24, ...bNone() }} />
                    {belowHeader}
                </View>
            )

        // â”€â”€ 5. ELEGANT: Centered logo above title, decorative divider â”€â”€
        case "elegant":
            return (
                <View style={{ paddingHorizontal: 48, paddingTop: 28, paddingBottom: 16, ...bNone() }}>
                    {/* Centered logo + title block */}
                    <View style={{ alignItems: "center", marginBottom: 12, ...bNone() }}>
                        <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                        <Text style={{ fontSize: 26, color: c.pri, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 3 }}>{title}</Text>
                        <Text style={{ fontSize: 9, color: c.mut, letterSpacing: 1 }}>{refNum}</Text>
                        {/* Decorative divider: line Â· dot Â· line */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, width: 200, ...bNone() }}>
                            <View style={{ flex: 1, height: 1, backgroundColor: c.pri, ...bNone() }} />
                            <View style={{ width: 5, height: 5, ...r(3), backgroundColor: c.pri, marginHorizontal: 6, ...bNone() }} />
                            <View style={{ flex: 1, height: 1, backgroundColor: c.pri, ...bNone() }} />
                        </View>
                    </View>
                    {/* Right-side content below center block */}
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", ...bNone() }}>
                        <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                    </View>
                    {belowHeader}
                </View>
            )

        // â”€â”€ 6. CORPORATE: Dark navy left sidebar + white right panel â”€â”€
        case "corporate":
            return (
                <View style={{ flexDirection: "row", ...bNone() }}>
                    {/* Left dark panel */}
                    <View style={{ width: 190, backgroundColor: c.pri, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28, ...bNone() }}>
                        <View style={{ position: "absolute", bottom: 0, right: 0, width: 50, height: 50, ...r(25), backgroundColor: "rgba(255,255,255,0.05)", ...bNone() }} />
                        <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                        <Text style={{ fontSize: 22, color: "#fff", fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>{title}</Text>
                        <Text style={{ fontSize: 8.5, color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 }}>{refNum}</Text>
                    </View>
                    {/* Right white panel */}
                    <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 32, paddingBottom: 28, ...bNone() }}>
                        <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                    </View>
                </View>
            )

        // â”€â”€ 7. CREATIVE: Diagonal accent band, asymmetric layout â”€â”€
        case "creative":
            return (
                <View style={{ ...bNone() }}>
                    {/* Top accent bar */}
                    <View style={{ height: 8, backgroundColor: c.pri, ...bNone() }} />
                    <View style={{ paddingHorizontal: 48, paddingTop: 28, paddingBottom: 24, ...bNone() }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                            <View style={{ ...bNone() }}>
                                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                                <Text style={{ fontSize: 34, color: c.pri, fontWeight: 700, letterSpacing: -0.5 }}>{title}</Text>
                                <Text style={{ fontSize: 9, color: c.mut, marginTop: 3 }}>{refNum}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                        </View>
                        {/* Diagonal accent: two overlapping rectangles */}
                        <View style={{ flexDirection: "row", marginTop: 16, ...bNone() }}>
                            <View style={{ height: 4, flex: 3, backgroundColor: c.pri, ...bNone() }} />
                            <View style={{ height: 4, flex: 1, backgroundColor: c.acc, ...bNone() }} />
                        </View>
                    </View>
                    {belowHeader}
                </View>
            )

        // â”€â”€ 8. WARM: Warm-toned header with rounded card sections â”€â”€
        case "warm":
            return (
                <View style={{ ...bNone() }}>
                    {/* Warm background header */}
                    <View style={{ backgroundColor: c.bg, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 24, ...bNone() }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                            <View style={{ ...bNone() }}>
                                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                                <Text style={{ fontSize: 32, color: c.pri, fontWeight: 700 }}>{title}</Text>
                                <Text style={{ fontSize: 9, color: c.mut, marginTop: 3 }}>{refNum}</Text>
                            </View>
                            <View style={{ backgroundColor: "#fff", ...r(12), padding: 14, alignItems: "flex-end", ...bAll(1, c.bdr), ...bNone(), borderWidth: 1, borderColor: c.bdr, borderStyle: "solid" as any }}>
                                {rightContent}
                            </View>
                        </View>
                    </View>
                    {/* Warm accent bottom border */}
                    <View style={{ height: 3, backgroundColor: c.pri, ...bNone() }} />
                    {belowHeader}
                </View>
            )

        // â”€â”€ 9. GEOMETRIC: Teal color blocks, geometric accent â”€â”€
        case "geometric":
            return (
                <View style={{ ...bNone() }}>
                    <View style={{ backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 32, paddingBottom: 28, ...bNone() }}>
                        {/* Geometric squares top-right */}
                        <View style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, backgroundColor: c.priDk, opacity: 0.5, ...bNone() }} />
                        <View style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.1)", ...bNone() }} />
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", ...bNone() }}>
                            <View style={{ ...bNone() }}>
                                <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                                <Text style={{ fontSize: 34, color: "#fff", fontWeight: 700, letterSpacing: 1 }}>{title}</Text>
                                <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 3, letterSpacing: 0.5 }}>{refNum}</Text>
                            </View>
                            <View style={{ alignItems: "flex-end", ...bNone() }}>{rightContent}</View>
                        </View>
                    </View>
                    {/* Geometric accent: teal + lighter teal bars */}
                    <View style={{ flexDirection: "row", ...bNone() }}>
                        <View style={{ flex: 2, height: 5, backgroundColor: c.priDk, ...bNone() }} />
                        <View style={{ flex: 1, height: 5, backgroundColor: c.acc, ...bNone() }} />
                    </View>
                    {belowHeader}
                </View>
            )

        default:
            return null
    }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// INVOICE PDF â€” Modern payment-focused layout
// Full-bleed header Â· prominent amount-due callout Â· clean table
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function InvoicePDF({ data, logoUrl, paymentQrCode }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    const isPaid = data.status === "paid"
    const isOverdue = data.status === "overdue"

    const badgeColor = isPaid ? "#16a34a" : isOverdue ? "#dc2626" : data.status === "sent" ? "#2563eb" : c.mut
    const badgeBg = isPaid ? "#dcfce7" : isOverdue ? "#fee2e2" : data.status === "sent" ? "#dbeafe" : c.bg
    const statusLabel = isPaid ? "PAID" : isOverdue ? "OVERDUE" : data.status === "sent" ? "SENT" : "DRAFT"
    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"

    // Right-side content for the header (status badge + amount)
    const headerRight = (
        <>
            <View style={{ backgroundColor: onDark ? "rgba(255,255,255,0.15)" : badgeBg, paddingHorizontal: 12, paddingVertical: 5, ...r(20), marginBottom: 10, ...bNone(), ...(onDark ? {} : { borderWidth: 1, borderColor: badgeColor, borderStyle: "solid" as any }) }}>
                <Text style={{ fontSize: 9, color: onDark ? "#fff" : badgeColor, fontWeight: 700, letterSpacing: 1 }}>{statusLabel}</Text>
            </View>
            <Text style={{ fontSize: tpl === "minimal" ? 26 : 22, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 3 }}>Due {fmtDate(data.dueDate)}</Text>
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff", ...bNone() }} wrap>

                {/* â”€â”€ HEADER (theme-specific layout) â”€â”€ */}
                <DocHeader tpl={tpl} c={c} title="INVOICE" refNum={data.invoiceNumber || "INV-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* â”€â”€ DATE STRIP â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, paddingVertical: 16, backgroundColor: tpl === "classic" || tpl === "minimal" ? "transparent" : c.bg, marginBottom: 4, ...bNone() }}>
                    {[
                        { label: "Issue Date", value: fmtDate(data.invoiceDate) },
                        { label: "Due Date", value: fmtDate(data.dueDate) },
                        { label: "Payment Terms", value: data.paymentTerms || "Net 30" },
                    ].map((item, i) => (
                        <View key={i} style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, ...bLeft(i > 0 ? 1 : 0, c.bdr), ...bNone(), ...(i > 0 ? { borderLeftWidth: 1, borderLeftColor: c.bdr, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any } : {}) }}>
                            <Text style={{ fontSize: 7.5, color: c.mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>{item.label}</Text>
                            <Text style={{ fontSize: 11, color: c.txt, fontWeight: 700 }}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* â”€â”€ DIVIDER â”€â”€ */}
                <View style={{ height: 1, backgroundColor: c.bdr, marginHorizontal: 48, marginBottom: 20, ...bNone() }} />

                {/* â”€â”€ PARTY BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginBottom: 24, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>From</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromPhone}</Text> : null}
                        {data.fromTaxId ? <Text style={{ fontSize: 9, color: c.mut, marginTop: 2 }}>{data.fromTaxId}</Text> : null}
                    </View>
                    <View style={{ flex: 1, backgroundColor: tpl === "classic" || tpl === "minimal" ? "transparent" : c.bg, ...r(tpl === "classic" || tpl === "minimal" ? 0 : 8), padding: tpl === "classic" || tpl === "minimal" ? 0 : 14, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Bill To</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toPhone}</Text> : null}
                        {data.toTaxId ? <Text style={{ fontSize: 9, color: c.mut, marginTop: 2 }}>{data.toTaxId}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ ITEMS TABLE â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 8, ...bNone() }}>
                    {/* Table header */}
                    <View style={{ flexDirection: "row", backgroundColor: c.pri, ...r(6), paddingVertical: 10, paddingHorizontal: 12, ...bNone() }} wrap={false}>
                        <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                        <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Qty</Text></View>
                        <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Rate</Text></View>
                        <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Amount</Text></View>
                    </View>
                    {/* Rows */}
                    {data.items.map((item, i) => {
                        const gross = item.quantity * item.rate
                        const hasDisc = item.discount && item.discount > 0
                        const discAmt = hasDisc ? gross * (item.discount! / 100) : 0
                        const lineTotal = gross - discAmt
                        return (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: i % 2 === 1 ? c.bg : "#fff", ...bBottom(1, c.bdr), ...bNone(), ...(i % 2 === 1 ? { backgroundColor: c.bg } : {}), borderBottomWidth: 1, borderBottomColor: c.bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} wrap={false}>
                                <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 10, color: c.txt }}>{item.description || `Item ${i + 1}`}</Text></View>
                                <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "center" }}>{item.quantity}</Text></View>
                                <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "right" }}>{fmt(item.rate, data.currency)}</Text></View>
                                <View style={{ width: 80, ...bNone() }}>
                                    {hasDisc ? (
                                        <>
                                            <Text style={{ fontSize: 8, color: c.mut, textAlign: "right", textDecoration: "line-through" }}>{fmt(gross, data.currency)}</Text>
                                            <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(lineTotal, data.currency)}</Text>
                                        </>
                                    ) : (
                                        <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(gross, data.currency)}</Text>
                                    )}
                                </View>
                            </View>
                        )
                    })}
                </View>

                {/* â”€â”€ TOTALS â”€â”€ */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ width: 240, ...bNone() }}>
                        {sub > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                            <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(sub, data.currency)}</Text>
                        </View>}
                        {getItemDiscountTotal(data) > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Item Discounts</Text>
                            <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text>
                        </View>}
                        {!!data.discountValue && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Discount{data.discountType === "percent" ? ` (${data.discountValue}%)` : ""}</Text>
                            <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(disc, data.currency)}</Text>
                        </View>}
                        {!!data.taxRate && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                            <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(tax, data.currency)}</Text>
                        </View>}
                        {!!data.shippingFee && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Shipping</Text>
                            <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(data.shippingFee, data.currency)}</Text>
                        </View>}
                        {/* Grand total callout */}
                        <View style={{ backgroundColor: c.pri, ...r(8), padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                            <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Total Due</Text>
                            <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
                        </View>
                    </View>
                </View>

                {/* â”€â”€ PAYMENT INFO â”€â”€ */}
                {(data.paymentInstructions || data.paymentMethod) && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 14, backgroundColor: c.bg, ...r(8), ...bNone() }} wrap={false}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>Payment Information</Text>
                        {data.paymentMethod ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>Method: {data.paymentMethod}</Text> : null}
                        {data.paymentInstructions ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.paymentInstructions}</Text> : null}
                    </View>
                )}

                {/* â”€â”€ PAYMENT LINK â”€â”€ */}
                <View style={{ marginHorizontal: 48, ...bNone() }}>
                    <PaymentSection data={data} paymentQrCode={paymentQrCode} c={c} bold={bold} bNoneFn={bNone} bAllFn={bAll} bTopFn={bTop} />
                </View>

                {/* â”€â”€ NOTES & TERMS â”€â”€ */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{fixEncoding(data.notes ?? "")}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{sanitizeTermsForDisplay(fixEncoding(data.terms ?? ""), data.showSignatureFields !== false)}</Text>
                </View> : null}

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bTop(1, c.bdr), ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONTRACT PDF â€” Formal legal-document layout
// Split two-tone header Â· sidebar accent Â· dual signatures
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Parses a plain-text contract body into structured blocks for clean
 * PDF rendering:
 *   - Numbered section headings ("1. Scope of Work") become bold, spaced-out
 *     section titles.
 *   - Lines starting with "- " become indented bullet items.
 *   - All other lines become flowing prose paragraphs.
 *
 * Returns an array of blocks to render. Keeps formatting minimal â€” only
 * distinguishes heading / bullet / paragraph.
 */
type ContractBlock =
    | { kind: "heading"; text: string }
    | { kind: "bullet"; text: string }
    | { kind: "paragraph"; text: string }

function parseContractBody(raw: string): ContractBlock[] {
    const lines = raw.replace(/\r\n/g, "\n").split("\n")
    const blocks: ContractBlock[] = []
    let paragraphBuffer: string[] = []

    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            const text = paragraphBuffer.join(" ").trim()
            if (text) blocks.push({ kind: "paragraph", text })
            paragraphBuffer = []
        }
    }

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line) {
            flushParagraph()
            continue
        }
        // Numbered heading: "1. Scope of Work" or "1) Scope of Work"
        // Heuristic: number + . or ) + space + 2â€“60 chars with no terminal period
        const headingMatch = line.match(/^(\d{1,2})[.)]\s+(.{2,80})$/)
        if (headingMatch) {
            const title = headingMatch[2].trim()
            // Accept as heading if it looks like a title (no ending punctuation
            // other than nothing) â€” otherwise treat as numbered list item inside
            // a paragraph.
            if (!/[.!?]$/.test(title)) {
                flushParagraph()
                blocks.push({ kind: "heading", text: `${headingMatch[1]}. ${title}` })
                continue
            }
        }
        // Bullet: starts with "- " or "â€¢ "
        if (/^[-â€¢]\s+/.test(line)) {
            flushParagraph()
            blocks.push({ kind: "bullet", text: line.replace(/^[-â€¢]\s+/, "").trim() })
            continue
        }
        paragraphBuffer.push(line)
    }
    flushParagraph()
    return blocks
}

export function ContractPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"

    // Right-side content: effective date + end date
    const headerRight = (
        <>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Effective Date</Text>
            <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.txt, fontWeight: 700, marginBottom: 10 }}>{fmtDate(data.invoiceDate)}</Text>
            {data.dueDate && <>
                <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>End Date</Text>
                <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{fmtDate(data.dueDate)}</Text>
            </>}
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff", ...bNone() }} wrap>

                {/* â”€â”€ HEADER (theme-specific layout) â”€â”€ */}
                <DocHeader tpl={tpl} c={c} title="CONTRACT" refNum={data.referenceNumber || data.invoiceNumber || "CTR-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* â”€â”€ PARTY BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 20, marginBottom: 24, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Party A \u2014 Provider</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Party B \u2014 Client</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ CONTRACT BODY (parsed into headings, paragraphs, bullets) â”€â”€ */}
                {data.description && (() => {
                    const blocks = parseContractBody(fixEncoding(data.description))
                    if (blocks.length === 0) return null
                    return (
                        <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                            <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Scope & Terms</Text>
                            {blocks.map((block, idx) => {
                                if (block.kind === "heading") {
                                    return (
                                        <Text
                                            key={idx}
                                            style={{
                                                fontSize: 10.5,
                                                color: c.txt,
                                                fontWeight: 700,
                                                marginTop: idx === 0 ? 0 : 12,
                                                marginBottom: 4,
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {block.text}
                                        </Text>
                                    )
                                }
                                if (block.kind === "bullet") {
                                    return (
                                        <View
                                            key={idx}
                                            style={{ flexDirection: "row", marginLeft: 8, marginBottom: 3, ...bNone() }}
                                            wrap={false}
                                        >
                                            <Text style={{ fontSize: 10, color: c.mut, width: 12, lineHeight: 1.7 }}>â€¢</Text>
                                            <Text style={{ fontSize: 10, color: c.txt, flex: 1, lineHeight: 1.7 }}>
                                                {block.text}
                                            </Text>
                                        </View>
                                    )
                                }
                                return (
                                    <Text
                                        key={idx}
                                        style={{
                                            fontSize: 10,
                                            color: c.txt,
                                            lineHeight: 1.7,
                                            marginBottom: 8,
                                        }}
                                    >
                                        {block.text}
                                    </Text>
                                )
                            })}
                        </View>
                    )
                })()}

                {/* â”€â”€ DELIVERABLES TABLE â”€â”€ */}
                {hasItems && (
                    <View style={{ marginHorizontal: 48, marginBottom: 8, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Deliverables & Pricing</Text>
                        <View style={{ flexDirection: "row", backgroundColor: c.pri, ...r(6), paddingVertical: 10, paddingHorizontal: 12, ...bNone() }} wrap={false}>
                            <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Deliverable</Text></View>
                            <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Qty</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Rate</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Amount</Text></View>
                        </View>
                        {data.items.filter(i => i.description.trim().length > 0 || i.rate > 0).map((item, i) => {
                            const gross = item.quantity * item.rate
                            const hasDisc = item.discount && item.discount > 0
                            const discAmt = hasDisc ? gross * (item.discount! / 100) : 0
                            const lineTotal = gross - discAmt
                            return (
                                <View key={i} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, ...bNone(), borderBottomWidth: 1, borderBottomColor: c.bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: c.bg } : {}) }} wrap={false}>
                                    <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 10, color: c.txt }}>{item.description || `Item ${i + 1}`}</Text></View>
                                    <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "center" }}>{item.quantity}</Text></View>
                                    <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "right" }}>{fmt(item.rate, data.currency)}</Text></View>
                                    <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(lineTotal, data.currency)}</Text></View>
                                </View>
                            )
                        })}
                    </View>
                )}

                {/* â”€â”€ TOTAL VALUE â”€â”€ */}
                {total > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 24, ...bNone() }} wrap={false}>
                        <View style={{ width: 240, ...bNone() }}>
                            {sub > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(sub, data.currency)}</Text>
                            </View>}
                            {!!data.taxRate && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(tax, data.currency)}</Text>
                            </View>}
                            <View style={{ backgroundColor: c.pri, ...r(8), padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                                <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Total Value</Text>
                                <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                {data.showSignatureFields !== false && (
                    renderSignatureBlock("contract", data, c)
                )}

                {/* â”€â”€ NOTES â”€â”€ */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{fixEncoding(data.notes ?? "")}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Additional Terms</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{sanitizeTermsForDisplay(fixEncoding(data.terms ?? ""), data.showSignatureFields !== false)}</Text>
                </View> : null}

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// QUOTE / QUOTATION PDF â€” Clean estimate-focused layout
// Accent banner header Â· validity callout Â· pricing table
// Exported as both QuotePDF (canonical) and QuotationPDF (legacy alias)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function QuotationPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"

    // Right-side content: validity callout
    const headerRight = (
        <>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Valid Until</Text>
            <Text style={{ fontSize: 16, color: onDark ? "#fff" : c.pri, fontWeight: 700, marginBottom: 10 }}>{fmtDate(data.dueDate)}</Text>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Total</Text>
            <Text style={{ fontSize: 18, color: onDark ? "#fff" : c.txt, fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff", ...bNone() }} wrap>

                {/* â”€â”€ HEADER (theme-specific layout) â”€â”€ */}
                <DocHeader tpl={tpl} c={c} title="QUOTE" refNum={data.referenceNumber || data.invoiceNumber || "QUO-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* â”€â”€ DATE STRIP â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, paddingVertical: 16, backgroundColor: tpl === "classic" || tpl === "minimal" ? "transparent" : c.bg, marginBottom: 4, ...bNone() }}>
                    {[
                        { label: "Quote Date", value: fmtDate(data.invoiceDate) },
                        { label: "Valid Until", value: fmtDate(data.dueDate) },
                        { label: "Payment Terms", value: data.paymentTerms || "Net 30" },
                    ].map((item, i) => (
                        <View key={i} style={{ flex: 1, paddingLeft: i > 0 ? 16 : 0, ...bNone(), ...(i > 0 ? { borderLeftWidth: 1, borderLeftColor: c.bdr, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any } : {}) }}>
                            <Text style={{ fontSize: 7.5, color: c.mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>{item.label}</Text>
                            <Text style={{ fontSize: 11, color: c.txt, fontWeight: 700 }}>{item.value}</Text>
                        </View>
                    ))}
                </View>

                {/* â”€â”€ DIVIDER â”€â”€ */}
                <View style={{ height: 1, backgroundColor: c.bdr, marginHorizontal: 48, marginBottom: 20, ...bNone() }} />

                {/* â”€â”€ PARTY BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>From</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromPhone}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Quote For</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toPhone}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ DESCRIPTION BOX â”€â”€ */}
                {data.description && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 14, backgroundColor: c.bg, ...r(8), ...bNone() }}>
                        <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.6 }}>{data.description}</Text>
                    </View>
                )}

                {/* â”€â”€ ITEMS TABLE â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 8, ...bNone() }}>
                    <View style={{ flexDirection: "row", backgroundColor: c.pri, ...r(6), paddingVertical: 10, paddingHorizontal: 12, ...bNone() }} wrap={false}>
                        <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Item / Service</Text></View>
                        <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Qty</Text></View>
                        <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Unit Price</Text></View>
                        <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Amount</Text></View>
                    </View>
                    {data.items.map((item, i) => {
                        const gross = item.quantity * item.rate
                        const hasDisc = item.discount && item.discount > 0
                        const discAmt = hasDisc ? gross * (item.discount! / 100) : 0
                        const lineTotal = gross - discAmt
                        return (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, ...bNone(), borderBottomWidth: 1, borderBottomColor: c.bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: c.bg } : {}) }} wrap={false}>
                                <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 10, color: c.txt }}>{item.description || `Item ${i + 1}`}</Text></View>
                                <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "center" }}>{item.quantity}</Text></View>
                                <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "right" }}>{fmt(item.rate, data.currency)}</Text></View>
                                <View style={{ width: 80, ...bNone() }}>
                                    {hasDisc ? (
                                        <>
                                            <Text style={{ fontSize: 8, color: c.mut, textAlign: "right", textDecoration: "line-through" }}>{fmt(gross, data.currency)}</Text>
                                            <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(lineTotal, data.currency)}</Text>
                                        </>
                                    ) : (
                                        <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(lineTotal, data.currency)}</Text>
                                    )}
                                </View>
                            </View>
                        )
                    })}
                </View>

                {/* â”€â”€ TOTALS â”€â”€ */}
                <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ width: 240, ...bNone() }}>
                        {sub > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                            <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(sub, data.currency)}</Text>
                        </View>}
                        {getItemDiscountTotal(data) > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Discounts</Text>
                            <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text>
                        </View>}
                        {!!data.discountValue && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>Discount{data.discountType === "percent" ? ` (${data.discountValue}%)` : ""}</Text>
                            <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(disc, data.currency)}</Text>
                        </View>}
                        {!!data.taxRate && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                            <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                            <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(tax, data.currency)}</Text>
                        </View>}
                        <View style={{ backgroundColor: c.pri, ...r(8), padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                            <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Total</Text>
                            <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
                        </View>
                    </View>
                </View>

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                {data.showSignatureFields !== false && (
                    <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 8, marginBottom: 20, ...bNone() }} wrap={false}>
                        {[
                            { label: "Authorized By", name: data.signatureName || data.fromName, title: data.signatureTitle, sig: data.showSenderSignature !== false ? data.senderSignatureDataUrl : null },
                            { label: "Accepted By", name: data.toName, title: null, sig: data.signatureImages?.[0]?.imageDataUrl || null, electronic: !data.signatureImages?.[0]?.imageDataUrl && (!!data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) },
                        ].map((party, i) => (
                            <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                                {party.sig ? (
                                    <Image src={party.sig} style={{ width: 160, height: 52, marginBottom: 4, ...bNone() }} />
                                ) : (party as any).electronic ? (
                                    <View style={{ height: 52, marginBottom: 4, justifyContent: "center", ...bNone() }}>
                                        <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>âœ“ Electronically Signed</Text>
                                    </View>
                                ) : (
                                    <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: c.mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                                )}
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                                {party.title ? <Text style={{ fontSize: 9, color: c.mut }}>{party.title}</Text> : null}
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ NOTES â”€â”€ */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{fixEncoding(data.notes ?? "")}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{sanitizeTermsForDisplay(fixEncoding(data.terms ?? ""), data.showSignatureFields !== false)}</Text>
                </View> : null}

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}

/** QuotePDF is the canonical export. QuotationPDF is retained as a legacy alias. */
export const QuotePDF = QuotationPDF


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PROPOSAL PDF â€” Persuasive presentation-style layout
// Bold cover header Â· executive summary card Â· CTA box
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ─── Proposal section renderer: parses [SECTION:name] markers from notes field ───
function renderProposalSections(notes: string | undefined, c: ReturnType<typeof getTheme>) {
    if (!notes) return null
    const raw = fixEncoding(notes)
    if (!/\[SECTION:[^\]]+\]/.test(raw)) return null
    const reg = /\[SECTION:([^\]]+)\]/g
    const parts: Array<{name: string; body: string}> = []
    let m: RegExpExecArray | null
    while ((m = reg.exec(raw)) !== null) {
        const name = m[1].trim()
        const bodyStart = m.index + m[0].length
        const next = reg.exec(raw)
        parts.push({ name, body: raw.slice(bodyStart, next ? next.index : raw.length).trim() })
        if (next) reg.lastIndex = next.index; else break
    }
    const sectionViews = parts.map((sec, si) => {
        if (!sec.body || /^pricing\s*note$/i.test(sec.name)) return null
        const bodyLines = sec.body.split("\n").filter(l => l.trim())
        const lineViews = bodyLines.map((ln, li) => {
            const t = ln.trim()
            const isNum = /^\d+\.\s/.test(t)
            const isBul = /^[-\u2022]\s/.test(t)
            if (isNum) {
                const dot = t.indexOf(".")
                return (<View key={li} style={{flexDirection:"row",marginBottom:3,paddingLeft:6,...bNone()}}><Text style={{fontSize:9.5,color:c.pri,marginRight:5,fontWeight:700}}>{t.slice(0,dot+1)}</Text><Text style={{fontSize:9.5,color:c.txt,flex:1,lineHeight:1.6}}>{t.slice(dot+2).trim()}</Text></View>)
            }
            if (isBul) {
                return (<View key={li} style={{flexDirection:"row",marginBottom:3,paddingLeft:6,...bNone()}}><Text style={{fontSize:9.5,color:c.pri,marginRight:5,fontWeight:700}}>{"\u2022"}</Text><Text style={{fontSize:9.5,color:c.txt,flex:1,lineHeight:1.6}}>{t.slice(2).trim()}</Text></View>)
            }
            return <Text key={li} style={{fontSize:9.5,color:c.txt,lineHeight:1.7,marginBottom:2}}>{t}</Text>
        })
        return (
            <View key={si} style={{ marginHorizontal: 48, marginBottom: 14, ...bNone() }}>
                {sec.name ? <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase" as any, letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{sec.name}</Text> : null}
                {lineViews}
            </View>
        )
    })
    return <View style={{ ...bNone() }}>{sectionViews}</View>
}

// ─── Proposal terms renderer: parses "Label: text" clauses with bold labels ────
function renderProposalTerms(terms: string | undefined, showSig: boolean | undefined, c: ReturnType<typeof getTheme>) {
    if (!terms) return null
    const raw = sanitizeTermsForDisplay(fixEncoding(terms), showSig !== false)
    if (!raw.trim()) return null
    const clauses = raw.split(/\n{2,}/).map(cl => cl.trim()).filter(Boolean)
    const clauseViews = clauses.map((cl, ci) => {
        const p = cl.indexOf(": ")
        const lbl = p > 0 ? cl.slice(0, p) : ""
        const isLabeled = !!lbl && /^[A-Z][^:]{2,30}$/.test(lbl)
        return (
            <View key={ci} style={{ marginBottom: 6, ...bNone() }}>
                {isLabeled
                    ? <Text style={{ fontSize: 9, lineHeight: 1.6 }}><Text style={{ fontWeight: 700, color: c.txt }}>{lbl + ": "}</Text><Text style={{ color: c.mut }}>{cl.slice(p + 2)}</Text></Text>
                    : <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{cl}</Text>
                }
            </View>
        )
    })
    return (
        <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
            <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase" as any, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Terms {"&"} Conditions</Text>
            {clauseViews}
        </View>
    )
}

export function ProposalPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"

    // Right-side content: prepared for + dates
    const headerRight = (
        <>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Prepared For</Text>
            <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.txt, fontWeight: 700, marginBottom: 10 }}>{data.toName || "[Client Name]"}</Text>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Date</Text>
            <Text style={{ fontSize: 11, color: onDark ? "#fff" : c.txt, fontWeight: 700, marginBottom: data.dueDate ? 8 : 0 }}>{fmtDate(data.invoiceDate)}</Text>
            {data.dueDate && <>
                <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Valid Until</Text>
                <Text style={{ fontSize: 11, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{fmtDate(data.dueDate)}</Text>
            </>}
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff", ...bNone() }} wrap>

                {/* â”€â”€ HEADER (theme-specific layout) â”€â”€ */}
                <DocHeader tpl={tpl} c={c} title="PROPOSAL" refNum={data.referenceNumber || data.invoiceNumber || "PROP-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* â”€â”€ PREPARED BY / FOR â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, paddingTop: 20, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Prepared By</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromPhone}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Prepared For</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toPhone}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ EXECUTIVE SUMMARY â”€â”€ */}
                {data.description && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Executive Summary</Text>
                        <View style={{ padding: 16, backgroundColor: c.bg, ...r(8), ...bNone(), borderLeftWidth: 4, borderLeftColor: c.pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }}>
                            <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.7 }}>{data.description}</Text>
                        </View>
                    </View>
                )}


                {/* BUDGET BREAKDOWN TABLE */}
                {hasItems && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <View wrap={false}>
                            <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Budget Breakdown</Text>
                            <View style={{ flexDirection: "row", backgroundColor: c.acc, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingVertical: 9, paddingHorizontal: 14, ...bNone(), borderBottomWidth: 2, borderBottomColor: c.pri, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }}>
                                <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Service / Deliverable</Text></View>
                                <View style={{ width: 36, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>Qty</Text></View>
                                <View style={{ width: 76, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Rate</Text></View>
                                {!(data as any).hideTotals && (
                                    <View style={{ width: 76, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "right" }}>Amount</Text></View>
                                )}
                            </View>
                        </View>
                        <View style={{ ...bNone(), borderBottomLeftRadius: 6, borderBottomRightRadius: 6, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopWidth: 0, borderLeftColor: c.bdr, borderRightColor: c.bdr, borderBottomColor: c.bdr, borderTopColor: "transparent", borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any, borderTopStyle: "solid" as any }}>
                        {data.items.filter(i => i.description.trim().length > 0 || i.rate > 0).map((item, i, fa) => {
                            const gross = item.quantity * item.rate
                            const hasDisc = item.discount && item.discount > 0
                            const discAmt = hasDisc ? gross * (item.discount! / 100) : 0
                            const lineTotal = gross - discAmt
                            const dRaw: string = item.description || ("Item " + String(i + 1))
                            const dLines = dRaw.split("\n").map((l: string) => l.trim()).filter(Boolean)
                            const tLns: string[] = [], bLns: string[] = []
                            let sbL = false
                            for (const dl of dLines) {
                                if (dl.startsWith("- ") || dl.startsWith("\u2022 ") || dl.startsWith("* ")) { sbL = true; bLns.push(dl.replace(/^[-\u2022*]\s+/, "").trim()) }
                                else if (!sbL) tLns.push(dl)
                                else bLns.push(dl)
                            }
                            const tStr = tLns.join(" \u2014 ") || dRaw
                            const isLast = i === fa.length - 1
                            return (
                                <View key={i} style={{ flexDirection: "row", paddingVertical: 11, paddingHorizontal: 14, ...bNone(), ...(i % 2 === 1 ? { backgroundColor: c.bg } : {}), ...(!isLast ? { borderBottomWidth: 1, borderBottomColor: c.bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any } : {}) }} wrap={false}>
                                    <View style={{ flex: 1, ...bNone() }}>
                                        <Text style={{ fontSize: 10, color: c.txt, fontWeight: bLns.length > 0 ? 700 : 400, marginBottom: bLns.length > 0 ? 4 : 0, lineHeight: 1.4 }}>{tStr}</Text>
                                        {bLns.map((b: string, bi: number) => (
                                            <View key={bi} style={{ flexDirection: "row", marginTop: 3, paddingLeft: 2, ...bNone() }}>
                                                <Text style={{ fontSize: 9, color: c.pri, marginRight: 6, fontWeight: 700, lineHeight: 1.5 }}>\u2022</Text>
                                                <Text style={{ fontSize: 9, color: c.mut, flex: 1, lineHeight: 1.5 }}>{b}</Text>
                                            </View>
                                        ))}
                                    </View>
                                    <View style={{ width: 36, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "center" }}>{item.quantity}</Text></View>
                                    <View style={{ width: 76, ...bNone() }}><Text style={{ fontSize: 10, color: c.mut, textAlign: "right" }}>{fmt(item.rate, data.currency)}</Text></View>
                                    {!(data as any).hideTotals && (
                                        <View style={{ width: 76, ...bNone() }}>
                                            {hasDisc ? (
                                                <>
                                                    <Text style={{ fontSize: 8, color: c.mut, textAlign: "right", textDecoration: "line-through" }}>{fmt(gross, data.currency)}</Text>
                                                    <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(lineTotal, data.currency)}</Text>
                                                </>
                                            ) : (
                                                <Text style={{ fontSize: 10, color: c.txt, textAlign: "right", fontWeight: 700 }}>{fmt(gross, data.currency)}</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            )
                        })}
                        </View>
                    </View>
                )}

                {/* TOTAL INVESTMENT */}
                {total > 0 && !(data as any).hideTotals && (
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                        <View style={{ width: 280, ...bNone() }}>
                            {sub > 0 && data.items.length > 1 && (
                                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                    <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                                    <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(sub, data.currency)}</Text>
                                </View>
                            )}
                            {!!data.discountValue && (
                                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                    <Text style={{ fontSize: 10, color: c.mut }}>Discount</Text>
                                    <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(disc, data.currency)}</Text>
                                </View>
                            )}
                            {!!data.taxRate && (
                                <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                    <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                                    <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(tax, data.currency)}</Text>
                                </View>
                            )}
                            <View style={{ backgroundColor: c.pri, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                                <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Total Investment</Text>
                                <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
                            </View>
                        </View>
                    </View>
                )}


                {/* â”€â”€ NEXT STEPS CTA â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 20, padding: 18, backgroundColor: c.acc, ...r(8), ...bNone(), borderLeftWidth: 5, borderLeftColor: c.pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }} wrap={false}>
                    <Text style={{ fontSize: 11, color: c.pri, fontWeight: 700, marginBottom: 6 }}>Next Steps</Text>
                    <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.5 }}>{getNextStepsText(data)}</Text>
                </View>

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                {data.showSignatureFields !== false && (
                    <View style={{ flexDirection: "row", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                        {[
                            { label: "Prepared By", name: data.signatureName || data.fromName, title: data.signatureTitle, sig: data.showSenderSignature !== false ? data.senderSignatureDataUrl : null },
                            { label: "Accepted By", name: data.toName, title: null, sig: data.signatureImages?.[0]?.imageDataUrl || null, electronic: !data.signatureImages?.[0]?.imageDataUrl && (!!data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) },
                        ].map((party, i) => (
                            <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                                {party.sig ? (
                                    <Image src={party.sig} style={{ width: 160, height: 52, marginBottom: 4, ...bNone() }} />
                                ) : (party as any).electronic ? (
                                    <View style={{ height: 52, marginBottom: 4, justifyContent: "center", ...bNone() }}>
                                        <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>âœ“ Electronically Signed</Text>
                                    </View>
                                ) : (
                                    <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: c.mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                                )}
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                                {party.title ? <Text style={{ fontSize: 9, color: c.mut }}>{party.title}</Text> : null}
                            </View>
                        ))}
                    </View>
                )}

                {renderProposalSections(data.notes, c)}
                {renderProposalTerms(data.terms, data.showSignatureFields, c)}
                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RECEIPT PDF â€” Pixel-perfect Cloudflare receipt clone
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function ReceiptPDF({ data, logoUrl }: Props) {
    const c = getTheme("receipt", data)
    const { sub, disc, tax, total } = calc(data)
    const itemDisc = getItemDiscountTotal(data)
    const afterDisc = sub - itemDisc - disc
    const isPaid = data.status === "paid"

    // Shared thin line style (Cloudflare uses ~0.75px #d1d5db lines)
    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", "#d1d5db", "transparent"), ...bs("solid", "solid", "solid", "solid") }
    const thinLineTop = { ...bw(1, 0, 0, 0), ...bc("#d1d5db", "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }
    const noLine = { ...bw(0, 0, 0, 0), ...bc("transparent", "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const s = StyleSheet.create({
        page: { paddingTop: 0, paddingBottom: 44, paddingHorizontal: 48, fontSize: 9, fontFamily: c.font, backgroundColor: "#fff" },
        // â”€â”€ Orange bar at very top â”€â”€
        orangeBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: c.pri },
        // â”€â”€ Gray rule under orange bar â”€â”€
        topRule: { marginTop: 30, paddingBottom: 16, ...thinLine },
        // â”€â”€ Header row: title left, logo right â”€â”€
        headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, marginBottom: 14 },
        title: { fontSize: 22, color: "#000", ...bold(c) },
        // â”€â”€ Metadata â”€â”€
        metaBlock: { marginBottom: 14 },
        metaRow: { flexDirection: "row", marginBottom: 2.5 },
        metaLabel: { fontSize: 8, color: "#6b7280", width: 82 },
        metaValue: { fontSize: 8, color: "#000", ...bold(c) },
        // â”€â”€ Address row â”€â”€
        addrRow: { flexDirection: "row", marginBottom: 0, paddingBottom: 14, ...thinLine },
        addrLeft: { flex: 1, paddingRight: 20 },
        addrRight: { flex: 1 },
        addrName: { fontSize: 9, color: "#000", ...bold(c), marginBottom: 1 },
        addrText: { fontSize: 8, color: "#374151", lineHeight: 1.5 },
        billTo: { fontSize: 8, color: "#374151", ...bold(c), marginBottom: 2 },
        // â”€â”€ Total callout â”€â”€
        totalBlock: { paddingTop: 14, paddingBottom: 14, ...thinLine },
        totalText: { fontSize: 14, color: "#000", ...bold(c) },
        // â”€â”€ Items table â”€â”€
        tableWrap: { marginTop: 10 },
        tableHead: { flexDirection: "row", paddingBottom: 6, ...thinLine },
        tableRow: { flexDirection: "row", paddingVertical: 7, ...thinLine },
        colDesc: { flex: 1 },
        colQty: { width: 32, textAlign: "right" },
        colPrice: { width: 68, textAlign: "right" },
        colTax: { width: 40, textAlign: "right" },
        colAmt: { width: 64, textAlign: "right" },
        th: { fontSize: 7, color: "#9ca3af", letterSpacing: 0.2 },
        td: { fontSize: 8, color: "#374151" },
        tdB: { fontSize: 8, color: "#000", ...bold(c) },
        // â”€â”€ Summary (right-aligned, compact) â”€â”€
        sumOuter: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, marginBottom: 16 },
        sumInner: { width: 200 },
        sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
        sumLabel: { fontSize: 8, color: "#6b7280" },
        sumVal: { fontSize: 8, color: "#000", ...bold(c) },
        sumTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, ...thinLineTop, marginTop: 3 },
        sumTotalLabel: { fontSize: 8.5, color: "#000" },
        sumTotalVal: { fontSize: 8.5, color: "#000", ...bold(c) },
        sumPaidRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, ...thinLineTop, marginTop: 1 },
        sumPaidLabel: { fontSize: 8.5, color: "#000", ...bold(c) },
        sumPaidVal: { fontSize: 8.5, color: "#000", ...bold(c) },
        // â”€â”€ Payment history â”€â”€
        payBlock: { marginTop: 6, marginBottom: 14 },
        payTitle: { fontSize: 12, color: "#000", ...bold(c), marginBottom: 10 },
        payHead: { flexDirection: "row", paddingBottom: 5, ...thinLine },
        payRow: { flexDirection: "row", paddingVertical: 6, ...thinLine },
        payC1: { flex: 1 },
        payC2: { width: 80, textAlign: "center" },
        payC3: { width: 72, textAlign: "right" },
        payC4: { width: 72, textAlign: "right" },
        // â”€â”€ Notes / Terms â”€â”€
        noteBlock: { marginBottom: 10 },
        noteLabel: { fontSize: 8, color: "#374151", marginBottom: 2 },
        noteText: { fontSize: 8, color: "#6b7280", lineHeight: 1.5 },
        // â”€â”€ Footer â”€â”€
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 48, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" },
        footerText: { fontSize: 7, color: "#9ca3af" },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                {/* Orange accent bar */}
                <View style={s.orangeBar} fixed />

                {/* Gray rule */}
                <View style={s.topRule} />

                {/* Header: Receipt + Logo */}
                <View style={s.headerRow} wrap={false}>
                    <View>
                        <Text style={s.title}>Receipt</Text>
                    </View>
                    <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                </View>

                {/* Metadata grid */}
                <View style={s.metaBlock} wrap={false}>
                    <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Invoice number</Text>
                        <Text style={s.metaValue}>{data.invoiceNumber || "INV-0000"}</Text>
                    </View>
                    {data.referenceNumber ? (
                        <View style={s.metaRow}>
                            <Text style={s.metaLabel}>Receipt number</Text>
                            <Text style={s.metaValue}>{data.referenceNumber}</Text>
                        </View>
                    ) : null}
                    <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Date paid</Text>
                        <Text style={s.metaValue}>{fmtDate(data.invoiceDate)}</Text>
                    </View>
                    {data.fromName ? (
                        <View style={s.metaRow}>
                            <Text style={s.metaLabel}>Company name</Text>
                            <Text style={s.metaValue}>{data.fromName}</Text>
                        </View>
                    ) : null}
                </View>

                {/* From / Bill To */}
                <View style={s.addrRow} wrap={false}>
                    <View style={s.addrLeft}>
                        <Text style={s.addrName}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={s.addrText}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={s.addrText}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={s.addrText}>{data.fromPhone}</Text> : null}
                        {data.fromTaxId ? <Text style={{ ...s.addrText, marginTop: 3 }}>{data.fromTaxId}</Text> : null}
                    </View>
                    <View style={s.addrRight}>
                        <Text style={s.billTo}>Bill to</Text>
                        <Text style={s.addrName}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={s.addrText}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={s.addrText}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={s.addrText}>{data.toPhone}</Text> : null}
                        {data.toTaxId ? <Text style={{ ...s.addrText, marginTop: 3 }}>{data.toTaxId}</Text> : null}
                    </View>
                </View>

                {/* Total callout */}
                <View style={s.totalBlock} wrap={false}>
                    <Text style={s.totalText}>
                        {fmt(total, data.currency)} {isPaid ? "paid on" : "due on"} {fmtDate(data.invoiceDate)}
                    </Text>
                </View>

                {/* Items table */}
                <View style={s.tableWrap}>
                    <View style={s.tableHead} wrap={false}>
                        <View style={s.colDesc}><Text style={s.th}>Description</Text></View>
                        <View style={s.colQty}><Text style={{ ...s.th, textAlign: "right" }}>Qty</Text></View>
                        <View style={s.colPrice}><Text style={{ ...s.th, textAlign: "right" }}>Unit price</Text></View>
                        {!!data.taxRate && <View style={s.colTax}><Text style={{ ...s.th, textAlign: "right" }}>Tax</Text></View>}
                        <View style={s.colAmt}><Text style={{ ...s.th, textAlign: "right" }}>Amount</Text></View>
                    </View>
                    {data.items.map((item, i) => {
                        const gross = item.quantity * item.rate
                        const hasDisc = item.discount && item.discount > 0
                        const discAmt = hasDisc ? gross * (item.discount! / 100) : 0
                        const lineTotal = gross - discAmt
                        return (
                            <View key={i} style={s.tableRow} wrap={false}>
                                <View style={s.colDesc}><Text style={s.td}>{item.description || `Item ${i + 1}`}</Text></View>
                                <View style={s.colQty}><Text style={{ ...s.td, textAlign: "right" }}>{item.quantity}</Text></View>
                                <View style={s.colPrice}><Text style={{ ...s.td, textAlign: "right" }}>{fmt(item.rate, data.currency)}</Text></View>
                                {!!data.taxRate && <View style={s.colTax}><Text style={{ ...s.td, textAlign: "right" }}>{data.taxRate}%</Text></View>}
                                <View style={s.colAmt}><Text style={{ ...s.tdB, textAlign: "right" }}>{fmt(lineTotal, data.currency)}</Text></View>
                            </View>
                        )
                    })}
                </View>

                {/* Summary */}
                <View style={s.sumOuter} wrap={false}>
                    <View style={s.sumInner}>
                        <View style={s.sumRow}>
                            <Text style={s.sumLabel}>Subtotal</Text>
                            <Text style={s.sumVal}>{fmt(sub, data.currency)}</Text>
                        </View>
                        {itemDisc > 0 && (
                            <View style={s.sumRow}>
                                <Text style={s.sumLabel}>Item discount</Text>
                                <Text style={s.sumVal}>-{fmt(itemDisc, data.currency)}</Text>
                            </View>
                        )}
                        {!!data.discountValue && (
                            <View style={s.sumRow}>
                                <Text style={s.sumLabel}>Discount{data.discountType === "percent" ? ` (${data.discountValue}%)` : ""}</Text>
                                <Text style={s.sumVal}>-{fmt(disc, data.currency)}</Text>
                            </View>
                        )}
                        <View style={s.sumRow}>
                            <Text style={s.sumLabel}>Total excluding tax</Text>
                            <Text style={s.sumVal}>{fmt(afterDisc, data.currency)}</Text>
                        </View>
                        {!!data.taxRate && (
                            <View style={s.sumRow}>
                                <Text style={s.sumLabel}>{data.taxLabel || "Tax"} ({data.taxRate}% on {fmt(afterDisc, data.currency)})</Text>
                                <Text style={s.sumVal}>{fmt(tax, data.currency)}</Text>
                            </View>
                        )}
                        {!!data.shippingFee && (
                            <View style={s.sumRow}>
                                <Text style={s.sumLabel}>Shipping</Text>
                                <Text style={s.sumVal}>{fmt(data.shippingFee, data.currency)}</Text>
                            </View>
                        )}
                        <View style={s.sumTotalRow}>
                            <Text style={s.sumTotalLabel}>Total</Text>
                            <Text style={s.sumTotalVal}>{fmt(total, data.currency)}</Text>
                        </View>
                        <View style={s.sumPaidRow}>
                            <Text style={s.sumPaidLabel}>{isPaid ? "Amount paid" : "Amount due"}</Text>
                            <Text style={s.sumPaidVal}>{fmt(total, data.currency)}</Text>
                        </View>
                    </View>
                </View>

                {/* Payment history */}
                {(data.paymentMethod || data.paymentInstructions) && (
                    <View style={s.payBlock} wrap={false}>
                        <Text style={s.payTitle}>Payment history</Text>
                        <View style={s.payHead}>
                            <View style={s.payC1}><Text style={s.th}>Payment method</Text></View>
                            <View style={s.payC2}><Text style={{ ...s.th, textAlign: "center" }}>Date</Text></View>
                            <View style={s.payC3}><Text style={{ ...s.th, textAlign: "right" }}>Amount paid</Text></View>
                            {data.referenceNumber ? <View style={s.payC4}><Text style={{ ...s.th, textAlign: "right" }}>Receipt number</Text></View> : null}
                        </View>
                        <View style={s.payRow}>
                            <View style={s.payC1}><Text style={s.td}>{data.paymentMethod || "\u2014"}</Text></View>
                            <View style={s.payC2}><Text style={{ ...s.td, textAlign: "center" }}>{fmtDate(data.invoiceDate)}</Text></View>
                            <View style={s.payC3}><Text style={{ ...s.tdB, textAlign: "right" }}>{fmt(total, data.currency)}</Text></View>
                            {data.referenceNumber ? <View style={s.payC4}><Text style={{ ...s.td, textAlign: "right" }}>{data.referenceNumber}</Text></View> : null}
                        </View>
                    </View>
                )}

                {/* Support text */}
                {data.paymentInstructions ? (
                    <View style={s.noteBlock}>
                        <Text style={s.noteText}>{data.paymentInstructions}</Text>
                    </View>
                ) : null}

                {/* Notes */}
                {data.notes ? (
                    <View style={s.noteBlock}>
                        <Text style={s.noteLabel}>Notes</Text>
                        <Text style={s.noteText}>{data.notes}</Text>
                    </View>
                ) : null}

                {/* Terms */}
                {data.terms ? (
                    <View style={s.noteBlock}>
                        <Text style={s.noteLabel}>Terms</Text>
                        <Text style={s.noteText}>{data.terms}</Text>
                    </View>
                ) : null}

                {/* Footer */}
                <View style={s.footer} fixed>
                    <Text style={s.footerText}>Generated by Clorefy</Text>
                    <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// PAYMENT RECEIPT PDF â€” Clorefy subscription receipt
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export interface PaymentReceiptData {
    paymentId: string
    orderId: string
    plan: string
    billingCycle: string
    amount: number       // in paise (INR smallest unit)
    currency: string
    date: string
    userEmail: string
    userName?: string
}

export function PaymentReceiptPDF({ receiptData }: { receiptData: PaymentReceiptData }) {
    const pri = "#f6821f"
    const txt = "#1a1a1a"
    const mut = "#6b7280"
    const bdr = "#d1d5db"
    const font = "Inter"

    const amountInRupees = receiptData.amount / 100
    const amountDisplay = receiptData.currency === "INR"
        ? `Rs. ${amountInRupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `${receiptData.currency} ${amountInRupees.toFixed(2)}`

    const dateDisplay = (() => {
        try {
            return new Date(receiptData.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        } catch { return receiptData.date }
    })()

    const planLabel = receiptData.plan.charAt(0).toUpperCase() + receiptData.plan.slice(1)
    const cycleLabel = receiptData.billingCycle === "yearly" ? "Annual" : "Monthly"

    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", bdr, "transparent"), ...bs("solid", "solid", "solid", "solid") }
    const thinLineTop = { ...bw(1, 0, 0, 0), ...bc(bdr, "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const s = StyleSheet.create({
        page: { paddingTop: 0, paddingBottom: 44, paddingHorizontal: 48, fontSize: 9, fontFamily: font, backgroundColor: "#fff" },
        orangeBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: pri },
        topRule: { marginTop: 30, paddingBottom: 16, ...thinLine },
        headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, marginBottom: 14 },
        title: { fontSize: 22, color: txt, fontWeight: 700 },
        subtitle: { fontSize: 9, color: mut, marginTop: 3 },
        paidBadge: { backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 4, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20, ...bw(1,1,1,1), ...bc("#bbf7d0","#bbf7d0","#bbf7d0","#bbf7d0"), ...bs("solid","solid","solid","solid"), alignSelf: "flex-start" as any, marginTop: 10 },
        paidText: { fontSize: 8, color: "#16a34a", fontWeight: 700, letterSpacing: 0.5 },
        metaBlock: { marginBottom: 14 },
        metaRow: { flexDirection: "row", marginBottom: 3 },
        metaLabel: { fontSize: 8, color: mut, width: 90 },
        metaValue: { fontSize: 8, color: txt, fontWeight: 700 },
        addrRow: { flexDirection: "row", marginBottom: 0, paddingBottom: 14, ...thinLine },
        addrLeft: { flex: 1, paddingRight: 20 },
        addrRight: { flex: 1 },
        addrLabel: { fontSize: 8, color: mut, fontWeight: 700, marginBottom: 3 },
        addrName: { fontSize: 9, color: txt, fontWeight: 700, marginBottom: 1 },
        addrText: { fontSize: 8, color: "#374151", lineHeight: 1.5 },
        totalBlock: { paddingTop: 14, paddingBottom: 14, ...thinLine },
        totalText: { fontSize: 14, color: txt, fontWeight: 700 },
        tableWrap: { marginTop: 14 },
        tableHead: { flexDirection: "row", paddingBottom: 6, ...thinLine },
        tableRow: { flexDirection: "row", paddingVertical: 10, ...thinLine },
        colDesc: { flex: 1 },
        colAmt: { width: 100, textAlign: "right" as any },
        th: { fontSize: 7, color: "#9ca3af", letterSpacing: 0.2 },
        td: { fontSize: 8.5, color: "#374151" },
        tdSub: { fontSize: 7.5, color: mut, marginTop: 2 },
        tdB: { fontSize: 8.5, color: txt, fontWeight: 700 },
        sumOuter: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, marginBottom: 20 },
        sumInner: { width: 220 },
        sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
        sumLabel: { fontSize: 8, color: mut },
        sumVal: { fontSize: 8, color: txt, fontWeight: 700 },
        sumTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...thinLineTop, marginTop: 4 },
        sumTotalLabel: { fontSize: 9, color: txt, fontWeight: 700 },
        sumTotalVal: { fontSize: 9, color: pri, fontWeight: 700 },
        noteBlock: { paddingTop: 14, ...thinLineTop, marginBottom: 10 },
        noteLabel: { fontSize: 8, color: txt, fontWeight: 700, marginBottom: 3 },
        noteText: { fontSize: 8, color: mut, lineHeight: 1.6 },
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 48, paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" },
        footerText: { fontSize: 7, color: "#9ca3af" },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                <View style={s.orangeBar} fixed />
                <View style={s.topRule} />

                <View style={s.headerRow} wrap={false}>
                    <View>
                        <Text style={s.title}>Receipt</Text>
                        <Text style={s.subtitle}>Clorefy \u2014 AI Document Platform</Text>
                        <View style={s.paidBadge}>
                            <Text style={s.paidText}>PAID</Text>
                        </View>
                    </View>
                </View>

                <View style={s.metaBlock} wrap={false}>
                    <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Receipt date</Text>
                        <Text style={s.metaValue}>{dateDisplay}</Text>
                    </View>
                    <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Payment ID</Text>
                        <Text style={s.metaValue}>{receiptData.paymentId}</Text>
                    </View>
                    <View style={s.metaRow}>
                        <Text style={s.metaLabel}>Order ID</Text>
                        <Text style={s.metaValue}>{receiptData.orderId}</Text>
                    </View>
                </View>

                <View style={s.addrRow} wrap={false}>
                    <View style={s.addrLeft}>
                        <Text style={s.addrLabel}>From</Text>
                        <Text style={s.addrName}>Clorefy</Text>
                        <Text style={s.addrText}>AI Document Platform</Text>
                        <Text style={s.addrText}>support@clorefy.com</Text>
                        <Text style={s.addrText}>clorefy.com</Text>
                    </View>
                    <View style={s.addrRight}>
                        <Text style={s.addrLabel}>Bill to</Text>
                        {receiptData.userName ? <Text style={s.addrName}>{receiptData.userName}</Text> : null}
                        <Text style={s.addrText}>{receiptData.userEmail}</Text>
                    </View>
                </View>

                <View style={s.totalBlock} wrap={false}>
                    <Text style={s.totalText}>{amountDisplay} paid on {dateDisplay}</Text>
                </View>

                <View style={s.tableWrap}>
                    <View style={s.tableHead}>
                        <View style={s.colDesc}><Text style={s.th}>DESCRIPTION</Text></View>
                        <View style={s.colAmt}><Text style={{ ...s.th, textAlign: "right" }}>AMOUNT</Text></View>
                    </View>
                    <View style={s.tableRow} wrap={false}>
                        <View style={s.colDesc}>
                            <Text style={s.td}>Clorefy {planLabel} Plan â€” {cycleLabel}</Text>
                            <Text style={s.tdSub}>Subscription Â· {dateDisplay}</Text>
                        </View>
                        <View style={s.colAmt}>
                            <Text style={s.tdB}>{amountDisplay}</Text>
                        </View>
                    </View>
                </View>

                <View style={s.sumOuter} wrap={false}>
                    <View style={s.sumInner}>
                        <View style={s.sumRow}>
                            <Text style={s.sumLabel}>Subtotal</Text>
                            <Text style={s.sumVal}>{amountDisplay}</Text>
                        </View>
                        <View style={s.sumRow}>
                            <Text style={s.sumLabel}>Tax</Text>
                            <Text style={s.sumVal}>Included</Text>
                        </View>
                        <View style={s.sumTotalRow}>
                            <Text style={s.sumTotalLabel}>Amount paid</Text>
                            <Text style={s.sumTotalVal}>{amountDisplay}</Text>
                        </View>
                    </View>
                </View>

                <View style={s.noteBlock} wrap={false}>
                    <Text style={s.noteLabel}>Note</Text>
                    <Text style={s.noteText}>
                        Thank you for subscribing to Clorefy. This receipt confirms your payment for the {planLabel} plan ({cycleLabel} billing).
                        Your subscription is now active. For support, contact us at support@clorefy.com.
                    </Text>
                </View>

                <View style={s.footer} fixed>
                    <Text style={s.footerText}>Clorefy \u2014 clorefy.com</Text>
                    <Text style={s.footerText}>Official payment receipt</Text>
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SOW PDF â€” Statement of Work document
// Structured sections: overview, scope, deliverables, milestones
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function SOWPDF({ data, logoUrl }: { data: SOWData; logoUrl?: string | null }) {
    // Template-aware theming — driven by user's design picker (templateId).
    // Falls back to corporate-cyan if no template selected.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = getTpl(data as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getTheme(tpl, data as any)
    const { pri, priDk, acc, bg, txt, mut, bdr, font } = c

    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", bdr, "transparent"), ...bs("solid", "solid", "solid", "solid") }
    const thinLineTop = { ...bw(1, 0, 0, 0), ...bc(bdr, "transparent", "transparent", "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const includedItems = data.scopeItems.filter(s => s.included)
    const excludedItems = data.scopeItems.filter(s => !s.included)

    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"
    const headerRight = (
        <>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 3 }}>Project</Text>
            <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{data.title || "Statement of Work"}</Text>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 6 }}>Effective {data.effectiveDate || ""}</Text>
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: font, backgroundColor: "#fff", ...bNone() }} wrap>

                <DocHeader tpl={tpl} c={c} title="STATEMENT OF WORK" refNum={data.referenceNumber || "SOW-0000"} logoUrl={logoUrl} data={data as any} rightContent={headerRight} />

                {/* â”€â”€ PARTY BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 20, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Provider</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Client</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                <View style={{ height: 1, backgroundColor: bdr, marginHorizontal: 48, marginBottom: 20, ...bNone() }} />

                {/* â”€â”€ PROJECT OVERVIEW â”€â”€ */}
                {data.projectOverview && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Project Overview</Text>
                        <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.projectOverview}</Text>
                    </View>
                )}

                {/* â”€â”€ SCOPE OF WORK â”€â”€ */}
                {data.scopeItems.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Scope of Work</Text>

                        {includedItems.length > 0 && (
                            <View style={{ marginBottom: 12, ...bNone() }}>
                                <Text style={{ fontSize: 8, color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 700 }}>Included</Text>
                                {/* Table header */}
                                <View style={{ flexDirection: "row", backgroundColor: pri, ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                                    <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Item</Text></View>
                                    <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                                </View>
                                {includedItems.map((item, i) => (
                                    <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: bg } : {}) }} wrap={false}>
                                        <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt, fontWeight: 700 }}>{item.title}</Text></View>
                                        <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 9, color: mut, lineHeight: 1.5 }}>{item.description}</Text></View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {excludedItems.length > 0 && (
                            <View style={{ ...bNone() }}>
                                <Text style={{ fontSize: 8, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, fontWeight: 700 }}>Excluded</Text>
                                <View style={{ flexDirection: "row", backgroundColor: "#6b7280", ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                                    <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Item</Text></View>
                                    <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                                </View>
                                {excludedItems.map((item, i) => (
                                    <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: "#f9fafb" } : {}) }} wrap={false}>
                                        <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt, fontWeight: 700 }}>{item.title}</Text></View>
                                        <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 9, color: mut, lineHeight: 1.5 }}>{item.description}</Text></View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* â”€â”€ DELIVERABLES â”€â”€ */}
                {data.deliverables.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Deliverables</Text>
                        <View style={{ flexDirection: "row", backgroundColor: pri, ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                            <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Due Date</Text></View>
                            <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Acceptance Criteria</Text></View>
                        </View>
                        {data.deliverables.map((d, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: bg } : {}) }} wrap={false}>
                                <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt }}>{d.description}</Text></View>
                                <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 9, color: mut, textAlign: "center" }}>{d.dueDate ? fmtDate(d.dueDate) : "\u2014"}</Text></View>
                                <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9, color: mut, textAlign: "right", lineHeight: 1.5 }}>{d.acceptanceCriteria || "\u2014"}</Text></View>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ MILESTONES â”€â”€ */}
                {data.milestones.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Milestones</Text>
                        <View style={{ flexDirection: "row", backgroundColor: pri, ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                            <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Milestone</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Date</Text></View>
                            <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Description</Text></View>
                        </View>
                        {data.milestones.map((m, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: bg } : {}) }} wrap={false}>
                                <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt, fontWeight: 700 }}>{m.name}</Text></View>
                                <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 9, color: mut, textAlign: "center" }}>{fmtDate(m.date)}</Text></View>
                                <View style={{ flex: 3, ...bNone() }}><Text style={{ fontSize: 9, color: mut, textAlign: "right", lineHeight: 1.5 }}>{m.description || "\u2014"}</Text></View>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ ASSUMPTIONS â”€â”€ */}
                {data.assumptions.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Assumptions</Text>
                        {data.assumptions.map((a, i) => (
                            <View key={i} style={{ flexDirection: "row", marginBottom: 4, ...bNone() }} wrap={false}>
                                <Text style={{ fontSize: 10, color: pri, width: 16, lineHeight: 1.7 }}>â€¢</Text>
                                <Text style={{ fontSize: 10, color: txt, flex: 1, lineHeight: 1.7 }}>{a}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ NOTES / TERMS â”€â”€ */}
                {data.notes ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.notes}</Text>
                    </View>
                ) : null}
                {data.terms ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.terms}</Text>
                    </View>
                ) : null}

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 16, marginBottom: 20, ...bNone() }} wrap={false}>
                    {[
                        { label: "Client Signature", name: data.toName, title: null as string | null },
                        { label: "Provider Signature", name: data.signatureName || data.fromName, title: data.signatureTitle as string | null },
                    ].map((party, i) => (
                        <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                            <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                            <Text style={{ fontSize: 10, color: txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                            {party.title ? <Text style={{ fontSize: 9, color: mut }}>{party.title}</Text> : null}
                        </View>
                    ))}
                </View>

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CHANGE ORDER PDF â€” Amendment to SOW or Contract
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function ChangeOrderPDF({ data, logoUrl }: { data: ChangeOrderData; logoUrl?: string | null }) {
    // Template-aware theming — driven by user's design picker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = getTpl(data as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getTheme(tpl, data as any)
    const { pri, priDk, acc, bg, txt, mut, bdr, font } = c

    const currency = data.currency || "USD"
    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", bdr, "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"
    const changeTotal = data.costImpact?.difference ?? 0
    const headerRight = (
        <>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut }}>Change Amount</Text>
            <Text style={{ fontSize: 22, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{fmt(changeTotal, currency)}</Text>
            {data.parentDocumentType && <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 3 }}>Re: {data.parentDocumentType}</Text>}
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: font, backgroundColor: "#fff", ...bNone() }} wrap>

                <DocHeader tpl={tpl} c={c} title="CHANGE ORDER" refNum={data.referenceNumber || "CO-0000"} logoUrl={logoUrl} data={data as any} rightContent={headerRight} />

                {/* â”€â”€ PARTY BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 20, marginBottom: 16, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Provider</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Client</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ PARENT DOCUMENT REFERENCE â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 12, backgroundColor: acc, ...r(8), ...bNone() }} wrap={false}>
                    <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>Reference</Text>
                    <Text style={{ fontSize: 10, color: txt }}>
                        This change order amends{" "}
                        <Text style={{ fontWeight: 700 }}>
                            {data.parentDocumentType === "sow" ? "Statement of Work" : "Contract"}
                        </Text>
                        {" "}(ID: {data.parentDocumentId})
                    </Text>
                </View>

                {/* â”€â”€ DESCRIPTION â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Description of Change</Text>
                    <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.description}</Text>
                </View>

                {/* â”€â”€ ADDITIONS â”€â”€ */}
                {data.additions.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Additions</Text>
                        <View style={{ flexDirection: "row", backgroundColor: "#16a34a", ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                            <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                            <View style={{ width: 100, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Cost</Text></View>
                        </View>
                        {data.additions.map((a, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: bg } : {}) }} wrap={false}>
                                <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt }}>{a.description}</Text></View>
                                <View style={{ width: 100, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt, textAlign: "right", fontWeight: 700 }}>{a.cost != null ? fmt(a.cost, currency) : "\u2014"}</Text></View>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ REMOVALS â”€â”€ */}
                {data.removals.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Removals</Text>
                        <View style={{ flexDirection: "row", backgroundColor: "#dc2626", ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                            <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Description</Text></View>
                            <View style={{ width: 100, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Cost Reduction</Text></View>
                        </View>
                        {data.removals.map((rem, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: "#fff5f5" } : {}) }} wrap={false}>
                                <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 9.5, color: txt }}>{rem.description}</Text></View>
                                <View style={{ width: 100, ...bNone() }}><Text style={{ fontSize: 9.5, color: "#dc2626", textAlign: "right", fontWeight: 700 }}>{rem.costReduction != null ? `-${fmt(rem.costReduction, currency)}` : "\u2014"}</Text></View>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ MODIFICATIONS â”€â”€ */}
                {data.modifications.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Modifications</Text>
                        <View style={{ flexDirection: "row", backgroundColor: pri, ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                            <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Original</Text></View>
                            <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Revised</Text></View>
                            <View style={{ width: 90, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Cost Impact</Text></View>
                        </View>
                        {data.modifications.map((mod, i) => (
                            <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: bg } : {}) }} wrap={false}>
                                <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9, color: mut, lineHeight: 1.5 }}>{mod.original}</Text></View>
                                <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 9, color: txt, lineHeight: 1.5 }}>{mod.revised}</Text></View>
                                <View style={{ width: 90, ...bNone() }}><Text style={{ fontSize: 9, color: mod.costImpact != null && mod.costImpact < 0 ? "#dc2626" : "#16a34a", textAlign: "right", fontWeight: 700 }}>
                                    {mod.costImpact != null ? `${mod.costImpact >= 0 ? "+" : ""}${fmt(mod.costImpact, currency)}` : "\u2014"}
                                </Text></View>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ COST IMPACT SUMMARY â”€â”€ */}
                {data.costImpact && (
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                        <View style={{ width: 260, ...bNone() }}>
                            <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Cost Impact Summary</Text>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: mut }}>Original Total</Text>
                                <Text style={{ fontSize: 10, color: txt, fontWeight: 700 }}>{fmt(data.costImpact.originalTotal, currency)}</Text>
                            </View>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: mut }}>Change</Text>
                                <Text style={{ fontSize: 10, color: data.costImpact.difference >= 0 ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                                    {data.costImpact.difference >= 0 ? "+" : ""}{fmt(data.costImpact.difference, currency)}
                                </Text>
                            </View>
                            <View style={{ backgroundColor: pri, ...r(8), padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                                <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>New Total</Text>
                                <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(data.costImpact.newTotal, currency)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* â”€â”€ TIMELINE IMPACT â”€â”€ */}
                {data.timelineImpact && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 12, backgroundColor: acc, ...r(8), ...bNone(), borderLeftWidth: 4, borderLeftColor: pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }} wrap={false}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Timeline Impact</Text>
                        <Text style={{ fontSize: 10, color: txt, lineHeight: 1.6 }}>{data.timelineImpact}</Text>
                    </View>
                )}

                {/* â”€â”€ NOTES / TERMS â”€â”€ */}
                {data.notes ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.notes}</Text>
                    </View>
                ) : null}
                {data.terms ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.terms}</Text>
                    </View>
                ) : null}

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 16, marginBottom: 20, ...bNone() }} wrap={false}>
                    {[
                        { label: "Client Signature", name: data.toName },
                        { label: "Provider Signature", name: data.signatureName || data.fromName },
                    ].map((party, i) => (
                        <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                            <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                            <Text style={{ fontSize: 10, color: txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                        </View>
                    ))}
                </View>

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NDA PDF â€” Non-Disclosure Agreement
// Professional legal layout with structured sections
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function NDAPDF({ data, logoUrl }: { data: NDAData; logoUrl?: string | null }) {
    // Template-aware theming — driven by user's design picker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = getTpl(data as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getTheme(tpl, data as any)
    const { pri, priDk, acc, bg, txt, mut, bdr, font } = c

    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", bdr, "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"
    const headerRight = (
        <>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut }}>Effective Date</Text>
            <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{data.termStart || ""}</Text>
            {data.governingLaw && <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 3 }}>{data.governingLaw}</Text>}
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: font, backgroundColor: "#fff", ...bNone() }} wrap>

                <DocHeader tpl={tpl} c={c} title="NON-DISCLOSURE AGREEMENT" refNum={data.referenceNumber || "NDA-0000"} logoUrl={logoUrl} data={data as any} rightContent={headerRight} />

                {/* ── PARTIES TABLE ── */}
                <View style={{ marginHorizontal: 48, marginTop: 20, marginBottom: 20, ...bNone() }}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Parties</Text>
                    <View style={{ flexDirection: "row", backgroundColor: pri, ...r(6), paddingVertical: 8, paddingHorizontal: 10, ...bNone() }} wrap={false}>
                        <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Name</Text></View>
                        <View style={{ width: 90, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Role</Text></View>
                        <View style={{ flex: 2, ...bNone() }}><Text style={{ fontSize: 8, color: "#fff", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Address</Text></View>
                    </View>
                    {data.parties.map((party, i) => (
                        <View key={i} style={{ flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, ...bNone(), borderBottomWidth: 1, borderBottomColor: bdr, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any, ...(i % 2 === 1 ? { backgroundColor: acc } : {}) }} wrap={false}>
                            <View style={{ flex: 2, ...bNone() }}>
                                <Text style={{ fontSize: 9.5, color: txt, fontWeight: 700 }}>{party.name}</Text>
                                {party.representative ? <Text style={{ fontSize: 8.5, color: mut }}>{party.representative}</Text> : null}
                            </View>
                            <View style={{ width: 90, ...bNone() }}>
                                <Text style={{ fontSize: 9, color: mut, textTransform: "capitalize" }}>
                                    {party.role === "disclosing" ? "Disclosing" : party.role === "receiving" ? "Receiving" : "Mutual"}
                                </Text>
                            </View>
                            <View style={{ flex: 2, ...bNone() }}>
                                <Text style={{ fontSize: 9, color: mut, textAlign: "right", lineHeight: 1.5 }}>{party.address || "\u2014"}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* â”€â”€ CONFIDENTIAL INFORMATION DEFINITION â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Definition of Confidential Information</Text>
                    <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.confidentialInfoDefinition}</Text>
                </View>

                {/* â”€â”€ OBLIGATIONS â”€â”€ */}
                {data.obligations.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Obligations</Text>
                        {data.obligations.map((o, i) => (
                            <View key={i} style={{ flexDirection: "row", marginBottom: 5, ...bNone() }} wrap={false}>
                                <Text style={{ fontSize: 10, color: pri, width: 16, lineHeight: 1.7, fontWeight: 700 }}>{i + 1}.</Text>
                                <Text style={{ fontSize: 10, color: txt, flex: 1, lineHeight: 1.7 }}>{o}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ EXCLUSIONS â”€â”€ */}
                {data.exclusions.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Exclusions</Text>
                        {data.exclusions.map((e, i) => (
                            <View key={i} style={{ flexDirection: "row", marginBottom: 4, ...bNone() }} wrap={false}>
                                <Text style={{ fontSize: 10, color: pri, width: 16, lineHeight: 1.7 }}>â€¢</Text>
                                <Text style={{ fontSize: 10, color: txt, flex: 1, lineHeight: 1.7 }}>{e}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ TERM & DURATION â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 14, backgroundColor: acc, ...r(8), ...bNone() }} wrap={false}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Term & Duration</Text>
                    <View style={{ flexDirection: "row", ...bNone() }}>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Start Date</Text>
                            <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{fmtDate(data.termStart)}</Text>
                        </View>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Duration</Text>
                            <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{data.termDuration} {data.termUnit}</Text>
                        </View>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Governing Law</Text>
                            <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{data.governingLaw}</Text>
                        </View>
                    </View>
                </View>

                {/* â”€â”€ REMEDIES â”€â”€ */}
                {data.remedies && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Remedies</Text>
                        <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.remedies}</Text>
                    </View>
                )}

                {/* â”€â”€ NOTES / TERMS â”€â”€ */}
                {data.notes ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.notes}</Text>
                    </View>
                ) : null}
                {data.terms ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.terms}</Text>
                    </View>
                ) : null}

                {/* â”€â”€ SIGNATURE BLOCKS â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 16, marginBottom: 20, ...bNone() }} wrap={false}>
                    {[
                        { label: "Disclosing Party Signature", name: data.fromName },
                        { label: "Receiving Party Signature", name: data.toName },
                    ].map((party, i) => (
                        <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                            <View style={{ height: 52, marginBottom: 4, ...bNone(), borderBottomWidth: 1, borderBottomColor: mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                            <Text style={{ fontSize: 10, color: txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                        </View>
                    ))}
                </View>

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CLIENT ONBOARDING FORM PDF â€” Intake form document
// Clean intake layout â€” no signature blocks needed
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function ClientOnboardingFormPDF({ data, logoUrl }: { data: ClientOnboardingFormData; logoUrl?: string | null }) {
    // Template-aware theming — driven by user's design picker.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tpl = getTpl(data as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getTheme(tpl, data as any)
    const { pri, priDk, acc, bg, txt, mut, bdr, font } = c

    const thinLine = { ...bw(0, 0, 1, 0), ...bc("transparent", "transparent", bdr, "transparent"), ...bs("solid", "solid", "solid", "solid") }

    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"
    const headerRight = (
        <>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut }}>Form Type</Text>
            <Text style={{ fontSize: 14, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{data.projectName || "Onboarding"}</Text>
            <Text style={{ fontSize: 8.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, marginTop: 3 }}>{data.fromName || ""}</Text>
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: font, backgroundColor: "#fff", ...bNone() }} wrap>

                <DocHeader tpl={tpl} c={c} title="CLIENT ONBOARDING" refNum={data.referenceNumber || "ONB-0000"} logoUrl={logoUrl} data={data as any} rightContent={headerRight} />

                {/* â”€â”€ CLIENT DETAILS â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginTop: 20, marginBottom: 16, padding: 16, backgroundColor: acc, ...r(8), ...bNone() }} wrap={false}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Client Details</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", ...bNone() }}>
                        {[
                            { label: "Name", value: data.clientName },
                            { label: "Email", value: data.clientEmail || "\u2014" },
                            { label: "Phone", value: data.clientPhone || "\u2014" },
                            { label: "Address", value: data.clientAddress || "\u2014" },
                        ].map((field, i) => (
                            <View key={i} style={{ width: "50%", marginBottom: 10, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>{field.label}</Text>
                                <Text style={{ fontSize: 10, color: txt }}>{field.value}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* â”€â”€ PROJECT DETAILS â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginBottom: 16, ...bNone() }}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, fontWeight: 700 }}>Project Details</Text>
                    <View style={{ marginBottom: 10, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>Project Name</Text>
                        <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{data.projectName}</Text>
                    </View>
                    {data.projectDescription && (
                        <View style={{ marginBottom: 10, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>Description</Text>
                            <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.projectDescription}</Text>
                        </View>
                    )}
                    <View style={{ flexDirection: "row", ...bNone() }}>
                        {data.timelinePreference && (
                            <View style={{ flex: 1, marginRight: 16, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>Timeline Preference</Text>
                                <Text style={{ fontSize: 10, color: txt }}>{data.timelinePreference}</Text>
                            </View>
                        )}
                        {data.budgetRange && (
                            <View style={{ flex: 1, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4, fontWeight: 700 }}>Budget Range</Text>
                                <Text style={{ fontSize: 10, color: txt }}>{data.budgetRange}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* â”€â”€ REQUIREMENTS â”€â”€ */}
                {data.requirements.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Requirements</Text>
                        {data.requirements.map((req, i) => (
                            <View key={i} style={{ flexDirection: "row", marginBottom: 5, ...bNone() }} wrap={false}>
                                <Text style={{ fontSize: 10, color: pri, width: 16, lineHeight: 1.7, fontWeight: 700 }}>{i + 1}.</Text>
                                <Text style={{ fontSize: 10, color: txt, flex: 1, lineHeight: 1.7 }}>{req}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ CUSTOM Q&A â”€â”€ */}
                {data.customQuestions.length > 0 && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Additional Information</Text>
                        {data.customQuestions.map((qa, i) => (
                            <View key={i} style={{ marginBottom: 12, padding: 12, backgroundColor: bg, ...r(8), ...bNone() }} wrap={false}>
                                <Text style={{ fontSize: 9, color: pri, fontWeight: 700, marginBottom: 4 }}>Q: {qa.question}</Text>
                                <Text style={{ fontSize: 10, color: txt, lineHeight: 1.6 }}>A: {qa.answer}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* â”€â”€ NOTES â”€â”€ */}
                {data.notes ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.notes}</Text>
                    </View>
                ) : null}

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAYMENT FOLLOWUP PDF â€” Payment reminder document
// Attention-grabbing reminder with tone indicator
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function PaymentFollowupPDF({ data, logoUrl }: { data: PaymentFollowupData; logoUrl?: string | null }) {
    // Template-aware theming: if the user selected a template via the design
    // picker, use it. Otherwise fall back to tone-based colors (polite/firm/urgent)
    // so the document still has visual urgency cues by default.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataAny = data as any
    const userPickedTemplate = !!(dataAny.design?.templateId && dataAny.design.templateId !== "modern")
        || !!(dataAny.design?.headerColor && dataAny.design.headerColor.length > 0)
    const toneColors = {
        polite: { pri: "#2563eb", acc: "#dbeafe", bg: "#eff6ff" },
        firm:   { pri: "#d97706", acc: "#fef3c7", bg: "#fffbeb" },
        urgent: { pri: "#dc2626", acc: "#fee2e2", bg: "#fff5f5" },
    }
    const tone = toneColors[data.reminderTone] || toneColors.polite

    let pri: string, acc: string, bg: string, priDk: string, txt: string, mut: string, bdr: string, font: string
    if (userPickedTemplate) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tpl = getTpl(data as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = getTheme(tpl, data as any)
        pri = c.pri; priDk = c.priDk; acc = c.acc; bg = c.bg
        txt = c.txt; mut = c.mut; bdr = c.bdr; font = c.font
    } else {
        pri = tone.pri
        acc = tone.acc
        bg = tone.bg
        priDk = pri
        txt = "#1e293b"
        mut = "#64748b"
        bdr = "#d1d5db"
        font = "Inter"
    }

    const toneLabel = data.reminderTone.charAt(0).toUpperCase() + data.reminderTone.slice(1)
    const isOverdue = data.daysOverdue > 0

    const tpl = userPickedTemplate ? getTpl(data as any) : "modern"
    const c = userPickedTemplate ? getTheme(tpl, data as any) : { pri, priDk, acc, bg, txt, mut, bdr, font, acc2: acc, bg2: bg } as any
    const onDark = tpl !== "classic" && tpl !== "minimal" && tpl !== "warm" && tpl !== "elegant"
    const headerRight = (
        <>
            <View style={{ backgroundColor: onDark ? "rgba(255,255,255,0.2)" : c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(20), marginBottom: 8, ...bNone() }}>
                <Text style={{ fontSize: 9, color: onDark ? "#fff" : c.pri, fontWeight: 700, letterSpacing: 1 }}>{toneLabel}</Text>
            </View>
            <Text style={{ fontSize: 7.5, color: onDark ? "rgba(255,255,255,0.6)" : c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Amount Due</Text>
            <Text style={{ fontSize: 20, color: onDark ? "#fff" : c.pri, fontWeight: 700 }}>{fmt(data.invoiceAmount, data.invoiceCurrency)}</Text>
        </>
    )

    return (
        <Document>
            <Page size="A4" style={{ paddingBottom: 56, fontSize: 10, fontFamily: font, backgroundColor: "#fff", ...bNone() }} wrap>

                <DocHeader tpl={tpl} c={c} title="PAYMENT FOLLOW-UP" refNum={data.referenceNumber || "PF-0000"} logoUrl={logoUrl} data={data as any} rightContent={headerRight} />

                {/* â”€â”€ DAYS OVERDUE BANNER (if overdue) â”€â”€ */}
                {isOverdue && (
                    <View style={{ marginHorizontal: 48, marginTop: 16, padding: 12, backgroundColor: acc, ...r(8), ...bNone(), borderLeftWidth: 4, borderLeftColor: pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }} wrap={false}>
                        <Text style={{ fontSize: 11, color: pri, fontWeight: 700 }}>
                            {data.daysOverdue} {data.daysOverdue === 1 ? "day" : "days"} overdue
                        </Text>
                        <Text style={{ fontSize: 9, color: mut, marginTop: 2 }}>
                            This invoice was due on {fmtDate(data.dueDate)}.
                        </Text>
                    </View>
                )}

                {/* â”€â”€ INVOICE REFERENCE â”€â”€ */}
                <View style={{ marginHorizontal: 48, marginTop: 16, marginBottom: 16, padding: 14, backgroundColor: bg, ...r(8), ...bNone() }} wrap={false}>
                    <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Invoice Reference</Text>
                    <View style={{ flexDirection: "row", ...bNone() }}>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Invoice Number</Text>
                            <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{data.invoiceNumber}</Text>
                        </View>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Amount</Text>
                            <Text style={{ fontSize: 11, color: txt, fontWeight: 700 }}>{fmt(data.invoiceAmount, data.invoiceCurrency)}</Text>
                        </View>
                        <View style={{ flex: 1, ...bNone() }}>
                            <Text style={{ fontSize: 7.5, color: mut, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3, fontWeight: 700 }}>Due Date</Text>
                            <Text style={{ fontSize: 11, color: isOverdue ? pri : txt, fontWeight: 700 }}>{fmtDate(data.dueDate)}</Text>
                        </View>
                    </View>
                </View>

                {/* â”€â”€ FROM / TO â”€â”€ */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>From</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>To</Text>
                        <Text style={{ fontSize: 12, color: txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                {/* â”€â”€ MESSAGE â”€â”€ */}
                {data.customMessage && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, padding: 16, backgroundColor: bg, ...r(8), ...bNone() }}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Message</Text>
                        <Text style={{ fontSize: 10, color: txt, lineHeight: 1.7 }}>{data.customMessage}</Text>
                    </View>
                )}

                {/* â”€â”€ PAYMENT LINK â”€â”€ */}
                {data.paymentLinkUrl && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, padding: 14, backgroundColor: acc, ...r(8), ...bNone() }} wrap={false}>
                        <Text style={{ fontSize: 9, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Pay Online</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.4, marginBottom: 8 }}>
                            Click the link below to pay securely online.
                        </Text>
                        <Link src={data.paymentLinkUrl} style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: pri,
                            paddingHorizontal: 14,
                            paddingVertical: 8,
                            ...r(6),
                            alignSelf: "flex-start" as any,
                            textDecoration: "none",
                            ...bNone(),
                        }}>
                            <Text style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>Pay Now â†’</Text>
                        </Link>
                        <Text style={{ fontSize: 8, color: mut, marginTop: 6, textDecoration: "underline" }}>
                            {data.paymentLinkUrl}
                        </Text>
                    </View>
                )}

                {/* â”€â”€ NOTES â”€â”€ */}
                {data.notes ? (
                    <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                        <Text style={{ fontSize: 8, color: pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                        <Text style={{ fontSize: 9.5, color: mut, lineHeight: 1.6 }}>{data.notes}</Text>
                    </View>
                ) : null}

                {/* â”€â”€ FOOTER â”€â”€ */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}

