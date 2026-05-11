import {
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

// ─── Font Registration ───
// Local static WOFF fonts from @fontsource packages (copied to public/fonts/).
// These are weight-specific static files — NOT variable fonts.
// @react-pdf/renderer embeds them into the PDF so pdfjs renders crisp text
// instead of ugly bitmap fallbacks from built-in Type1 fonts.

// Disable hyphenation for cleaner text rendering in PDFs
Font.registerHyphenationCallback(word => [word])

// Inter — clean sans-serif (default for most templates)
Font.register({
    family: "Inter",
    fonts: [
        { src: "/fonts/inter-400.woff", fontWeight: 400 },
        { src: "/fonts/inter-700.woff", fontWeight: 700 },
    ],
})

// Lora — elegant serif
Font.register({
    family: "Lora",
    fonts: [
        { src: "/fonts/lora-400.woff", fontWeight: 400 },
        { src: "/fonts/lora-700.woff", fontWeight: 700 },
    ],
})

// Roboto Mono — monospace
Font.register({
    family: "Roboto Mono",
    fonts: [
        { src: "/fonts/roboto-mono-400.woff", fontWeight: 400 },
        { src: "/fonts/roboto-mono-700.woff", fontWeight: 700 },
    ],
})

// ─── Font mapping ───
function getFontFamily(data: InvoiceData): { font: string; fontB: string } {
    const f = data.design?.font || "Inter"
    switch (f) {
        // Serif fonts → Lora
        case "Playfair":
        case "Lora":
        case "Times-Roman":
            return { font: "Lora", fontB: "Lora" }
        // Monospace fonts → Roboto Mono
        case "Roboto Mono":
        case "Courier":
            return { font: "Roboto Mono", fontB: "Roboto Mono" }
        // Sans-serif fonts → Inter
        default:
            return { font: "Inter", fontB: "Inter" }
    }
}

// ─── Shared Utilities ───

function fmt(amount: number, currency: string = "USD"): string {
    // ASCII-safe currency symbols only — avoids needing special Unicode fonts.
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

// Currency font style — no special font needed since we use ASCII-safe symbols.
// These are empty objects so the spread (...CF / ...CFB) is a no-op and the
// Text element inherits the template's own font family.
const CF = {} as const
const CFB = { fontWeight: 700 as const } as const

function fmtDate(d: string | undefined): string {
    if (!d) return "—"
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

// ─── Payment Link Section (Invoice only) ───────────────────────────────────
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
                        Pay Now →
                    </Text>
                </Link>
                {/* Short URL as text fallback */}
                <Text style={{ fontSize: 8, color: c.mut, marginTop: 6, textDecoration: "underline" }}>
                    {url}
                </Text>
                {data.paymentLinkStatus === "partially_paid" && (
                    <Text style={{ fontSize: 8, color: "#d97706", marginTop: 4, fontWeight: 700 }}>
                        Partial payment received — balance still due
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

// ─── Theme palettes per template ───
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

// Helper: safe border — always specify ALL 4 sides for width, color, AND style
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

// Shorthand helpers — always include width + color + style for all 4 sides
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

// Helper: render a single item row — Amount always shows full price (qty × rate)
function ItemRow({ item, i, data, c, CF, CFB, tRow, tRowAlt, cD, cQ, cR, cA }: {
    item: any; i: number; data: InvoiceData; c: any; CF: any; CFB: any;
    tRow: any; tRowAlt: any; cD: any; cQ: any; cR: any; cA: any;
}) {
    const gross = item.quantity * item.rate
    const hasDisc = item.discount && item.discount > 0
    const discAmt = hasDisc ? gross * (item.discount / 100) : 0
    const lineTotal = gross - discAmt
    return (
        <View key={i} style={i % 2 === 1 ? tRowAlt : tRow} wrap={false}>
            <View style={cD}>
                <Text style={{ fontSize: 10, color: c.txt }}>{item.description || `Item ${i + 1}`}</Text>
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


// ─── Logo helper for PDF headers ───
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

// ─── Document Config ───────────────────────────────────────────────────────
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
        case "quotation":
            return {
                title: "QUOTATION",
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

// ─── HeaderSection (shared internal component) ─────────────────────────────
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

    // ── Bold theme: full-width colored header ──
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
                <Text style={{ fontSize: docType === "INVOICE" || docType === "PROPOSAL" ? 32 : 30, color: "#fff", letterSpacing: docType === "INVOICE" || docType === "PROPOSAL" ? 2 : docType === "QUOTATION" ? 1.5 : 1, ...bold(c) }}>{docType}</Text>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{refNumber}</Text>
            </View>
        )
    }

    // ── Modern / Classic / Other themes: decorative accents + standard header ──

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
    const titleFontSize = tpl === "classic" ? (docType === "CONTRACT" ? 24 : 26) : (docType === "CONTRACT" || docType === "QUOTATION" ? 28 : 30)
    const titleLetterSpacing = tpl === "classic" ? 0 : (docType === "QUOTATION" ? 1.5 : docType === "CONTRACT" ? 1 : 2)

    // Header wrapper horizontal padding — Contract uses paddingHorizontal: 48 always
    const hPadding = (docType === "CONTRACT" || docType === "QUOTATION" || docType === "PROPOSAL") ? 48 : 0

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
                {/* Status badge — only for Invoice */}
                {config.showStatusBadge && (
                    <View style={{ backgroundColor: c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(14), ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, ...bold(c) }}>{data.status === "paid" ? "PAID" : "DRAFT"}</Text>
                    </View>
                )}
            </View>
        </>
    )
}

// ─── DateStrip (shared internal component) ─────────────────────────────────
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
        // Invoice date strip — matches existing s.dStrip / s.dItem pattern
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

    // Contract / Quotation / Proposal date strip — matches existing s.dRow / s.dItem pattern
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

// ─── PartyBlocks (shared internal component) ───────────────────────────────
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

// ─── ItemTable (shared internal component) ─────────────────────────────────
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

// ─── TotalsBox (shared internal component) ──────────────────────────────────
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

    // For Contract and Proposal: only render if total > 0
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

// ─── SignatureRow (shared internal component) ───────────────────────────────
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

// ─── Signature Display Mode (testable pure function) ────────────────────────
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

// ─── NotesSection (shared internal component) ───────────────────────────────
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

    const wrapStyle = isInvoice
        ? { marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 16 }
        : { paddingHorizontal: 48, marginBottom: 16 }

    const termsLabel = isContract ? "Additional Terms" : "Terms & Conditions"

    return (
        <>
            {data.notes ? (
                <View style={wrapStyle}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text>
                </View>
            ) : null}
            {data.terms ? (
                <View style={wrapStyle}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>{termsLabel}</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text>
                </View>
            ) : null}
        </>
    )
}

// ─── FooterBar (shared internal component) ──────────────────────────────────
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

// ═══════════════════════════════════════════════════════
// THEME-SPECIFIC HEADER RENDERER
// Each of the 9 themes gets a genuinely different structural layout.
// Called by all 4 document templates with their own title/content.
// ═══════════════════════════════════════════════════════

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
        // ── 1. MODERN: Full-bleed colored header, decorative circles ──
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

        // ── 2. CLASSIC: White header, thick left border, double rule ──
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

        // ── 3. BOLD: Dark full-width header, large typography, angled bottom ──
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

        // ── 4. MINIMAL: Ultra-clean, no color, pure typography ──
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

        // ── 5. ELEGANT: Centered logo above title, decorative divider ──
        case "elegant":
            return (
                <View style={{ paddingHorizontal: 48, paddingTop: 28, paddingBottom: 16, ...bNone() }}>
                    {/* Centered logo + title block */}
                    <View style={{ alignItems: "center", marginBottom: 12, ...bNone() }}>
                        <PdfLogo url={logoUrl} show={data.showLogo} shape={data.logoShape} size={data.logoSize} />
                        <Text style={{ fontSize: 26, color: c.pri, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 3 }}>{title}</Text>
                        <Text style={{ fontSize: 9, color: c.mut, letterSpacing: 1 }}>{refNum}</Text>
                        {/* Decorative divider: line · dot · line */}
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

        // ── 6. CORPORATE: Dark navy left sidebar + white right panel ──
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

        // ── 7. CREATIVE: Diagonal accent band, asymmetric layout ──
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

        // ── 8. WARM: Warm-toned header with rounded card sections ──
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

        // ── 9. GEOMETRIC: Teal color blocks, geometric accent ──
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

// ═══════════════════════════════════════════════════════
// INVOICE PDF — Modern payment-focused layout
// Full-bleed header · prominent amount-due callout · clean table
// ═══════════════════════════════════════════════════════

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

                {/* ── HEADER (theme-specific layout) ── */}
                <DocHeader tpl={tpl} c={c} title="INVOICE" refNum={data.invoiceNumber || "INV-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* ── DATE STRIP ── */}
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

                {/* ── DIVIDER ── */}
                <View style={{ height: 1, backgroundColor: c.bdr, marginHorizontal: 48, marginBottom: 20, ...bNone() }} />

                {/* ── PARTY BLOCKS ── */}
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

                {/* ── ITEMS TABLE ── */}
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

                {/* ── TOTALS ── */}
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

                {/* ── PAYMENT INFO ── */}
                {(data.paymentInstructions || data.paymentMethod) && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 14, backgroundColor: c.bg, ...r(8), ...bNone() }} wrap={false}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>Payment Information</Text>
                        {data.paymentMethod ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>Method: {data.paymentMethod}</Text> : null}
                        {data.paymentInstructions ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.paymentInstructions}</Text> : null}
                    </View>
                )}

                {/* ── PAYMENT LINK ── */}
                <View style={{ marginHorizontal: 48, ...bNone() }}>
                    <PaymentSection data={data} paymentQrCode={paymentQrCode} c={c} bold={bold} bNoneFn={bNone} bAllFn={bAll} bTopFn={bTop} />
                </View>

                {/* ── NOTES & TERMS ── */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text>
                </View> : null}

                {/* ── FOOTER ── */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bTop(1, c.bdr), ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// CONTRACT PDF — Formal legal-document layout
// Split two-tone header · sidebar accent · dual signatures
// ═══════════════════════════════════════════════════════

/**
 * Parses a plain-text contract body into structured blocks for clean
 * PDF rendering:
 *   - Numbered section headings ("1. Scope of Work") become bold, spaced-out
 *     section titles.
 *   - Lines starting with "- " become indented bullet items.
 *   - All other lines become flowing prose paragraphs.
 *
 * Returns an array of blocks to render. Keeps formatting minimal — only
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
        // Heuristic: number + . or ) + space + 2–60 chars with no terminal period
        const headingMatch = line.match(/^(\d{1,2})[.)]\s+(.{2,80})$/)
        if (headingMatch) {
            const title = headingMatch[2].trim()
            // Accept as heading if it looks like a title (no ending punctuation
            // other than nothing) — otherwise treat as numbered list item inside
            // a paragraph.
            if (!/[.!?]$/.test(title)) {
                flushParagraph()
                blocks.push({ kind: "heading", text: `${headingMatch[1]}. ${title}` })
                continue
            }
        }
        // Bullet: starts with "- " or "• "
        if (/^[-•]\s+/.test(line)) {
            flushParagraph()
            blocks.push({ kind: "bullet", text: line.replace(/^[-•]\s+/, "").trim() })
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

                {/* ── HEADER (theme-specific layout) ── */}
                <DocHeader tpl={tpl} c={c} title="CONTRACT" refNum={data.referenceNumber || data.invoiceNumber || "CTR-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* ── PARTY BLOCKS ── */}
                <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 20, marginBottom: 24, ...bNone() }} wrap={false}>
                    <View style={{ flex: 1, marginRight: 24, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Party A — Provider</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ flex: 1, ...bNone() }}>
                        <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>Party B — Client</Text>
                        <Text style={{ fontSize: 12, color: c.txt, fontWeight: 700, marginBottom: 3 }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9, color: c.mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                {/* ── CONTRACT BODY (parsed into headings, paragraphs, bullets) ── */}
                {data.description && (() => {
                    const blocks = parseContractBody(data.description)
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
                                            <Text style={{ fontSize: 10, color: c.mut, width: 12, lineHeight: 1.7 }}>•</Text>
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

                {/* ── DELIVERABLES TABLE ── */}
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

                {/* ── TOTAL VALUE ── */}
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

                {/* ── SIGNATURE BLOCKS ── */}
                {data.showSignatureFields !== false && (
                    <View style={{ flexDirection: "row", paddingHorizontal: 48, marginTop: 16, marginBottom: 20, ...bNone() }} wrap={false}>
                        {[
                            { label: "Party A Signature", name: data.signatureName || data.fromName, title: data.signatureTitle, sig: data.showSenderSignature !== false ? data.senderSignatureDataUrl : null },
                            { label: "Party B Signature", name: data.toName, title: null, sig: data.signatureImages?.[0]?.imageDataUrl || null, electronic: !data.signatureImages?.[0]?.imageDataUrl && (!!data.signedAt || (data.signatureImages && data.signatureImages.length > 0)) },
                        ].map((party, i) => (
                            <View key={i} style={{ flex: 1, marginRight: i === 0 ? 24 : 0, ...bNone() }}>
                                <Text style={{ fontSize: 7.5, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>{party.label}</Text>
                                {party.sig ? (
                                    <Image src={party.sig} style={{ width: 160, height: 52, marginBottom: 4, ...bNone() }} />
                                ) : (party as any).electronic ? (
                                    <View style={{ height: 52, marginBottom: 4, justifyContent: "center", ...bNone() }}>
                                        <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>✓ Electronically Signed</Text>
                                    </View>
                                ) : (
                                    <View style={{ height: 52, marginBottom: 4, ...bBottom(1, c.mut), ...bNone(), borderBottomWidth: 1, borderBottomColor: c.mut, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} />
                                )}
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{party.name || "_______________"}</Text>
                                {party.title ? <Text style={{ fontSize: 9, color: c.mut }}>{party.title}</Text> : null}
                            </View>
                        ))}
                    </View>
                )}

                {/* ── NOTES ── */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Additional Terms</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text>
                </View> : null}

                {/* ── FOOTER ── */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// QUOTATION PDF — Clean estimate-focused layout
// Accent banner header · validity callout · pricing table
// ═══════════════════════════════════════════════════════

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

                {/* ── HEADER (theme-specific layout) ── */}
                <DocHeader tpl={tpl} c={c} title="QUOTATION" refNum={data.referenceNumber || data.invoiceNumber || "QUO-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* ── DATE STRIP ── */}
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

                {/* ── DIVIDER ── */}
                <View style={{ height: 1, backgroundColor: c.bdr, marginHorizontal: 48, marginBottom: 20, ...bNone() }} />

                {/* ── PARTY BLOCKS ── */}
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

                {/* ── DESCRIPTION BOX ── */}
                {data.description && (
                    <View style={{ marginHorizontal: 48, marginBottom: 16, padding: 14, backgroundColor: c.bg, ...r(8), ...bNone() }}>
                        <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.6 }}>{data.description}</Text>
                    </View>
                )}

                {/* ── ITEMS TABLE ── */}
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

                {/* ── TOTALS ── */}
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

                {/* ── SIGNATURE BLOCKS ── */}
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
                                        <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>✓ Electronically Signed</Text>
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

                {/* ── NOTES ── */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text>
                </View> : null}

                {/* ── FOOTER ── */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// PROPOSAL PDF — Persuasive presentation-style layout
// Bold cover header · executive summary card · CTA box
// ═══════════════════════════════════════════════════════

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

                {/* ── HEADER (theme-specific layout) ── */}
                <DocHeader tpl={tpl} c={c} title="PROPOSAL" refNum={data.referenceNumber || data.invoiceNumber || "PROP-0000"} logoUrl={logoUrl} data={data} rightContent={headerRight} />

                {/* ── PREPARED BY / FOR ── */}
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

                {/* ── EXECUTIVE SUMMARY ── */}
                {data.description && (
                    <View style={{ marginHorizontal: 48, marginBottom: 20, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Executive Summary</Text>
                        <View style={{ padding: 16, backgroundColor: c.bg, ...r(8), ...bNone(), borderLeftWidth: 4, borderLeftColor: c.pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }}>
                            <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.7 }}>{data.description}</Text>
                        </View>
                    </View>
                )}

                {/* ── BUDGET BREAKDOWN TABLE ── */}
                {hasItems && (
                    <View style={{ marginHorizontal: 48, marginBottom: 8, ...bNone() }}>
                        <Text style={{ fontSize: 9, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 700 }}>Budget Breakdown</Text>
                        {/* Accent-colored header (Proposal uses accent, not primary) */}
                        <View style={{ flexDirection: "row", backgroundColor: c.acc, ...r(6), paddingVertical: 10, paddingHorizontal: 12, ...bNone(), borderBottomWidth: 2, borderBottomColor: c.pri, borderBottomStyle: "solid" as any, borderTopWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderTopColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderTopStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} wrap={false}>
                            <View style={{ flex: 1, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>Deliverable / Phase</Text></View>
                            <View style={{ width: 44, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>Qty</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Rate</Text></View>
                            <View style={{ width: 80, ...bNone() }}><Text style={{ fontSize: 8, color: c.pri, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>Amount</Text></View>
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

                {/* ── TOTAL INVESTMENT ── */}
                {total > 0 && (
                    <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20, ...bNone() }} wrap={false}>
                        <View style={{ width: 260, ...bNone() }}>
                            {sub > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text>
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(sub, data.currency)}</Text>
                            </View>}
                            {!!data.discountValue && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: c.mut }}>Discount</Text>
                                <Text style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>-{fmt(disc, data.currency)}</Text>
                            </View>}
                            {!!data.taxRate && <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, ...bNone() }}>
                                <Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text>
                                <Text style={{ fontSize: 10, color: c.txt, fontWeight: 700 }}>{fmt(tax, data.currency)}</Text>
                            </View>}
                            <View style={{ backgroundColor: c.pri, ...r(8), padding: 14, marginTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...bNone() }}>
                                <Text style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Total Investment</Text>
                                <Text style={{ fontSize: 20, color: "#fff", fontWeight: 700 }}>{fmt(total, data.currency)}</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ── NEXT STEPS CTA ── */}
                <View style={{ marginHorizontal: 48, marginBottom: 20, padding: 18, backgroundColor: c.acc, ...r(8), ...bNone(), borderLeftWidth: 5, borderLeftColor: c.pri, borderLeftStyle: "solid" as any, borderTopWidth: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent", borderTopStyle: "solid" as any, borderRightStyle: "solid" as any, borderBottomStyle: "solid" as any }} wrap={false}>
                    <Text style={{ fontSize: 11, color: c.pri, fontWeight: 700, marginBottom: 6 }}>Next Steps</Text>
                    <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.5 }}>{data.paymentInstructions || "To proceed with this proposal, please sign and return this document. We look forward to working with you."}</Text>
                </View>

                {/* ── SIGNATURE BLOCKS ── */}
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
                                        <Text style={{ fontSize: 11, color: c.pri, fontStyle: "italic" }}>✓ Electronically Signed</Text>
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

                {/* ── NOTES ── */}
                {data.notes ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Notes</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text>
                </View> : null}
                {data.terms ? <View style={{ marginHorizontal: 48, marginBottom: 12, ...bNone() }}>
                    <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontWeight: 700 }}>Terms & Conditions</Text>
                    <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text>
                </View> : null}

                {/* ── FOOTER ── */}
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bNone(), borderTopWidth: 1, borderTopColor: c.bdr, borderTopStyle: "solid" as any, borderBottomWidth: 0, borderLeftWidth: 0, borderRightWidth: 0, borderBottomColor: "transparent", borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomStyle: "solid" as any, borderLeftStyle: "solid" as any, borderRightStyle: "solid" as any }} fixed>
                    <Text style={{ fontSize: 8, color: c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// RECEIPT PDF — Pixel-perfect Cloudflare receipt clone
// ═══════════════════════════════════════════════════════

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
        // ── Orange bar at very top ──
        orangeBar: { position: "absolute", top: 0, left: 0, right: 0, height: 4, backgroundColor: c.pri },
        // ── Gray rule under orange bar ──
        topRule: { marginTop: 30, paddingBottom: 16, ...thinLine },
        // ── Header row: title left, logo right ──
        headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 16, marginBottom: 14 },
        title: { fontSize: 22, color: "#000", ...bold(c) },
        // ── Metadata ──
        metaBlock: { marginBottom: 14 },
        metaRow: { flexDirection: "row", marginBottom: 2.5 },
        metaLabel: { fontSize: 8, color: "#6b7280", width: 82 },
        metaValue: { fontSize: 8, color: "#000", ...bold(c) },
        // ── Address row ──
        addrRow: { flexDirection: "row", marginBottom: 0, paddingBottom: 14, ...thinLine },
        addrLeft: { flex: 1, paddingRight: 20 },
        addrRight: { flex: 1 },
        addrName: { fontSize: 9, color: "#000", ...bold(c), marginBottom: 1 },
        addrText: { fontSize: 8, color: "#374151", lineHeight: 1.5 },
        billTo: { fontSize: 8, color: "#374151", ...bold(c), marginBottom: 2 },
        // ── Total callout ──
        totalBlock: { paddingTop: 14, paddingBottom: 14, ...thinLine },
        totalText: { fontSize: 14, color: "#000", ...bold(c) },
        // ── Items table ──
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
        // ── Summary (right-aligned, compact) ──
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
        // ── Payment history ──
        payBlock: { marginTop: 6, marginBottom: 14 },
        payTitle: { fontSize: 12, color: "#000", ...bold(c), marginBottom: 10 },
        payHead: { flexDirection: "row", paddingBottom: 5, ...thinLine },
        payRow: { flexDirection: "row", paddingVertical: 6, ...thinLine },
        payC1: { flex: 1 },
        payC2: { width: 80, textAlign: "center" },
        payC3: { width: 72, textAlign: "right" },
        payC4: { width: 72, textAlign: "right" },
        // ── Notes / Terms ──
        noteBlock: { marginBottom: 10 },
        noteLabel: { fontSize: 8, color: "#374151", marginBottom: 2 },
        noteText: { fontSize: 8, color: "#6b7280", lineHeight: 1.5 },
        // ── Footer ──
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
                            <View style={s.payC1}><Text style={s.td}>{data.paymentMethod || "—"}</Text></View>
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

// ═══════════════════════════════════════════════════════

// PAYMENT RECEIPT PDF — Clorefy subscription receipt
// ═══════════════════════════════════════════════════════

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
                        <Text style={s.subtitle}>Clorefy — AI Document Platform</Text>
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
                            <Text style={s.td}>Clorefy {planLabel} Plan — {cycleLabel}</Text>
                            <Text style={s.tdSub}>Subscription · {dateDisplay}</Text>
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
                    <Text style={s.footerText}>Clorefy — clorefy.com</Text>
                    <Text style={s.footerText}>Official payment receipt</Text>
                </View>
            </Page>
        </Document>
    )
}

