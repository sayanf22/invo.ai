import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Image,
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

type Tpl = "modern" | "classic" | "bold" | "minimal" | "elegant" | "corporate" | "creative" | "warm" | "geometric"
function getTpl(data: InvoiceData): Tpl {
    const t = data.design?.templateId || data.design?.layout || "modern"
    if (t === "classic" || t === "bold" || t === "minimal" || t === "elegant" || t === "corporate" || t === "creative" || t === "warm" || t === "geometric") return t
    return "modern"
}

interface Props { data: InvoiceData; logoUrl?: string | null }

// ─── Theme palettes per template ───
function getTheme(tpl: Tpl, data: InvoiceData) {
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
function PdfLogo({ url }: { url?: string | null }) {
    if (!url) return null
    return (
        <Image
            src={url}
            style={{ height: 40, width: 100, objectFit: "contain" as any, marginBottom: 8 }}
        />
    )
}

// ═══════════════════════════════════════════════════════
// INVOICE PDF
// ═══════════════════════════════════════════════════════

export function InvoicePDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    
    const s = StyleSheet.create({
        page: { paddingTop: tpl === "bold" ? 0 : 48, paddingBottom: 60, paddingHorizontal: tpl === "bold" ? 0 : 48, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff" },
        topBar: { height: 8, backgroundColor: c.pri, marginBottom: 0 },
        cornerShape: { position: "absolute", top: 0, right: 0, width: 160, height: 100, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 },
        boldHeader: { backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 28 },
        boldShape: { position: "absolute", top: 0, right: 0, width: 140, height: 100, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 60, opacity: 0.5 },
        classicLine: { height: 2, backgroundColor: c.pri, marginBottom: 20 },
        hWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingTop: tpl === "bold" ? 0 : 24, paddingBottom: 16, marginHorizontal: tpl === "bold" ? 48 : 0 },
        badge: { backgroundColor: tpl === "bold" ? "rgba(255,255,255,0.2)" : c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(14), ...bNone() },
        dStrip: { flexDirection: "row", backgroundColor: tpl === "classic" ? "transparent" : c.bg, marginHorizontal: tpl === "bold" ? 48 : 0, ...r(tpl === "classic" ? 0 : 8), padding: tpl === "classic" ? 0 : 14, marginBottom: 20, ...bBottom(tpl === "classic" ? 1 : 0, c.bdr), paddingBottom: tpl === "classic" ? 16 : 14 },
        dItem: { flex: 1, ...bLeft(tpl === "bold" ? 3 : 0, c.pri), paddingLeft: tpl === "bold" ? 10 : 0, marginRight: 10 },
        pRow: { flexDirection: "row", marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 24 },
        pBlk: { flex: 1, backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(tpl === "bold" ? 8 : 0), padding: tpl === "bold" ? 14 : 0, marginRight: 14 },
        tWrap: { marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 16 },
        tHead: { flexDirection: "row", backgroundColor: tpl === "classic" ? "transparent" : c.pri, ...r(tpl === "classic" ? 0 : 6), paddingVertical: 9, paddingHorizontal: 10, ...bBottom(tpl === "classic" ? 2 : 0, c.pri) },
        tRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.bg) },
        tRowAlt: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.bg), backgroundColor: tpl === "classic" ? "#fafafa" : c.bg },
        cD: { flex: 1 }, cQ: { width: 50, textAlign: "center" }, cR: { width: 80, textAlign: "right" }, cA: { width: 80, textAlign: "right" },
        totWrap: { flexDirection: "row", justifyContent: "flex-end", marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 20 },
        totBox: { width: 220, backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(8), padding: tpl === "bold" ? 14 : 0, ...(tpl === "classic" ? bAll(1, c.bdr) : bAll(0, "transparent")) },
        totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
        gRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6, ...bTop(2, c.pri) },
        nWrap: { marginHorizontal: tpl === "bold" ? 48 : 0, marginBottom: 16 },
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: tpl === "bold" ? c.pri : c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bTop(tpl === "bold" ? 0 : 1, c.bdr) },
        bBar: { position: "absolute", bottom: 40, left: 0, right: 0, height: 3, backgroundColor: c.pri },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                {tpl === "modern" && <><View style={s.cornerShape} fixed /><View style={s.topBar} /></>}
                {tpl === "classic" && <View style={s.classicLine} />}
                {tpl === "bold" && (
                    <View style={s.boldHeader} fixed>
                        <View style={s.boldShape} />
                        <PdfLogo url={logoUrl} />
                        <Text style={{ fontSize: 32, color: "#fff", letterSpacing: 2, ...bold(c) }}>INVOICE</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{data.invoiceNumber || "INV-0000"}</Text>
                    </View>
                )}

                {tpl !== "bold" && (
                    <View style={s.hWrap} wrap={false}>
                        <View>
                            <PdfLogo url={logoUrl} />
                            <Text style={{ fontSize: tpl === "classic" ? 26 : 30, color: c.pri, letterSpacing: tpl === "classic" ? 0 : 2, ...bold(c) }}>INVOICE</Text>
                            <Text style={{ fontSize: 10, color: c.mut, marginTop: 4 }}>{data.invoiceNumber || "INV-0000"}</Text>
                        </View>
                        <View style={s.badge}>
                            <Text style={{ fontSize: 9, color: c.pri, ...bold(c) }}>{data.status === "paid" ? "PAID" : "DRAFT"}</Text>
                        </View>
                    </View>
                )}

                <View style={s.dStrip} wrap={false}>
                    <View style={s.dItem}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Issue Date</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.invoiceDate)}</Text>
                    </View>
                    <View style={s.dItem}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Due Date</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.dueDate)}</Text>
                    </View>
                    <View style={{ ...s.dItem, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Payment Terms</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{data.paymentTerms || "Net 30"}</Text>
                    </View>
                </View>

                <View style={s.pRow} wrap={false}>
                    <View style={s.pBlk}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bBottom(tpl === "classic" ? 1 : tpl === "modern" ? 2 : 0, c.acc), paddingBottom: 4, ...bold(c) }}>From</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromPhone}</Text> : null}
                    </View>
                    <View style={{ ...s.pBlk, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bBottom(tpl === "classic" ? 1 : tpl === "modern" ? 2 : 0, c.acc), paddingBottom: 4, ...bold(c) }}>Bill To</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toPhone}</Text> : null}
                    </View>
                </View>

                <View style={s.tWrap}>
                    <View style={s.tHead} wrap={false}>
                        <View style={s.cD}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, ...bold(c) }}>Description</Text></View>
                        <View style={s.cQ}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", ...bold(c) }}>Qty</Text></View>
                        <View style={s.cR}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Rate</Text></View>
                        <View style={s.cA}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Amount</Text></View>
                    </View>
                    {data.items.map((item, i) => (
                        <ItemRow key={i} item={item} i={i} data={data} c={c} CF={CF} CFB={CFB} tRow={s.tRow} tRowAlt={s.tRowAlt} cD={s.cD} cQ={s.cQ} cR={s.cR} cA={s.cA} />
                    ))}
                </View>

                <View style={s.totWrap} wrap={false}>
                    <View style={s.totBox}>
                        <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(sub, data.currency)}</Text></View>
                        {getItemDiscountTotal(data) > 0 && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text></View>}
                        {!!data.discountValue && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(disc, data.currency)}</Text></View>}
                        {!!data.taxRate && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(tax, data.currency)}</Text></View>}
                        {!!data.shippingFee && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Shipping</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(data.shippingFee, data.currency)}</Text></View>}
                        <View style={s.gRow}><Text style={{ fontSize: 12, color: c.pri, ...bold(c) }}>Total Due</Text><Text style={{ fontSize: 18, color: c.pri, ...CFB }}>{fmt(total, data.currency)}</Text></View>
                    </View>
                </View>

                {(data.paymentInstructions || data.paymentMethod) && (
                    <View style={s.nWrap} wrap={false}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Payment Information</Text>
                        {data.paymentMethod ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>Method: {data.paymentMethod}</Text> : null}
                        {data.paymentInstructions ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.paymentInstructions}</Text> : null}
                    </View>
                )}

                {data.notes ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text></View> : null}
                {data.terms ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Terms & Conditions</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text></View> : null}

                {tpl === "modern" && <View style={s.bBar} fixed />}
                <View style={s.footer} fixed>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// CONTRACT PDF
// ═══════════════════════════════════════════════════════

export function ContractPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
    const { sub: cSub, disc: cDisc, tax: cTax, total: cTotal } = calc(data)
    
    const s = StyleSheet.create({
        page: { paddingTop: tpl === "bold" ? 0 : 48, paddingBottom: 60, paddingHorizontal: 0, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff" },
        sidebar: { position: "absolute", top: 0, left: 0, width: 6, height: "100%" as any, backgroundColor: c.pri },
        classicLine1: { height: 3, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 4 },
        classicLine2: { height: 1, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 16 },
        boldHeader: { backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 28 },
        boldCircle: { position: "absolute", top: 20, right: 60, width: 70, height: 70, ...r(35), backgroundColor: "rgba(255,255,255,0.1)" },
        hWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 48, paddingTop: tpl === "bold" ? 0 : 20, paddingBottom: 16 },
        badge: { backgroundColor: tpl === "bold" ? "rgba(255,255,255,0.2)" : c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(14) },
        dRow: { flexDirection: "row", paddingHorizontal: 48, marginBottom: 20 },
        dBox: { flex: 1, backgroundColor: tpl === "classic" ? "transparent" : c.bg, ...r(6), padding: tpl === "classic" ? 0 : 12, ...bw(0, 0, tpl === "classic" ? 1 : 0, tpl === "modern" ? 3 : 0), ...bc("transparent", "transparent", tpl === "classic" ? c.bdr : "transparent", tpl === "modern" ? c.pri : "transparent"), ...bs("solid", "solid", "solid", "solid"), paddingBottom: tpl === "classic" ? 12 : 12, marginRight: 12 },
        pRow: { flexDirection: "row", paddingHorizontal: 48, marginBottom: 24 },
        pBlk: { flex: 1, backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(tpl === "bold" ? 8 : 0), padding: tpl === "bold" ? 14 : 0, marginRight: 14 },
        secWrap: { paddingHorizontal: 48, marginBottom: 16 },
        tWrap: { marginHorizontal: 48, marginBottom: 16 },
        tHead: { flexDirection: "row", backgroundColor: tpl === "classic" ? "transparent" : c.pri, ...r(tpl === "classic" ? 0 : 6), paddingVertical: 9, paddingHorizontal: 10, ...bBottom(tpl === "classic" ? 2 : 0, c.pri) },
        tRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.bg) },
        tRowAlt: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.bg), backgroundColor: c.bg },
        cD: { flex: 1 }, cQ: { width: 50, textAlign: "center" }, cR: { width: 80, textAlign: "right" }, cA: { width: 80, textAlign: "right" },
        totWrap: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20 },
        totBox: { width: 220, backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(8), padding: tpl === "bold" ? 14 : 0, ...(tpl === "classic" ? bAll(1, c.bdr) : bAll(0, "transparent")) },
        totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
        gRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6, ...bTop(2, c.pri) },
        sigRow: { flexDirection: "row", paddingHorizontal: 48, marginTop: 24 },
        sigBlk: { flex: 1, marginRight: 24 },
        sigLine: { ...bBottom(1, c.mut), marginTop: 36, marginBottom: 8, width: 180 },
        nWrap: { paddingHorizontal: 48, marginBottom: 16 },
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36, backgroundColor: tpl === "bold" ? c.pri : c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48 },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                {tpl === "modern" && <View style={s.sidebar} fixed />}
                {tpl === "classic" && <><View style={s.classicLine1} /><View style={s.classicLine2} /></>}
                {tpl === "bold" && (
                    <View style={s.boldHeader} fixed>
                        <View style={s.boldCircle} />
                        <PdfLogo url={logoUrl} />
                        <Text style={{ fontSize: 30, color: "#fff", letterSpacing: 1, ...bold(c) }}>CONTRACT</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "CTR-0000"}</Text>
                    </View>
                )}

                {tpl !== "bold" && (
                    <View style={s.hWrap} wrap={false}>
                        <View>
                            <PdfLogo url={logoUrl} />
                            <Text style={{ fontSize: tpl === "classic" ? 24 : 28, color: c.pri, letterSpacing: tpl === "classic" ? 0 : 1, ...bold(c) }}>CONTRACT</Text>
                            <Text style={{ fontSize: 10, color: c.mut, marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "CTR-0000"}</Text>
                        </View>
                        <View style={s.badge}><Text style={{ fontSize: 9, color: c.pri, ...bold(c) }}>DRAFT</Text></View>
                    </View>
                )}

                <View style={s.dRow} wrap={false}>
                    <View style={s.dBox}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Effective Date</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.invoiceDate)}</Text>
                    </View>
                    {data.dueDate && (
                        <View style={{ ...s.dBox, marginRight: 0 }}>
                            <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>End Date</Text>
                            <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.dueDate)}</Text>
                        </View>
                    )}
                </View>

                <View style={s.pRow} wrap={false}>
                    <View style={s.pBlk}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party A — Provider</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromEmail}</Text> : null}
                    </View>
                    <View style={{ ...s.pBlk, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party B — Client</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toEmail}</Text> : null}
                    </View>
                </View>

                {data.description && (
                    <View style={s.secWrap}>
                        <Text style={{ fontSize: 11, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, ...bBottom(1, c.acc), paddingBottom: 4, ...bold(c) }}>Scope & Terms</Text>
                        <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.7 }}>{data.description}</Text>
                    </View>
                )}

                {hasItems && (
                    <View style={s.tWrap}>
                        <Text style={{ fontSize: 11, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, ...bold(c) }}>Deliverables & Pricing</Text>
                        <View style={s.tHead} wrap={false}>
                            <View style={s.cD}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, ...bold(c) }}>Deliverable</Text></View>
                            <View style={s.cQ}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", ...bold(c) }}>Qty</Text></View>
                            <View style={s.cR}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Rate</Text></View>
                            <View style={s.cA}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Amount</Text></View>
                        </View>
                        {data.items.map((item, i) => {
                            if (!item.description && item.rate === 0) return null
                            return (
                                <ItemRow key={i} item={item} i={i} data={data} c={c} CF={CF} CFB={CFB} tRow={s.tRow} tRowAlt={s.tRowAlt} cD={s.cD} cQ={s.cQ} cR={s.cR} cA={s.cA} />
                            )
                        })}
                    </View>
                )}

                {cTotal > 0 && (
                    <View style={s.totWrap} wrap={false}>
                        <View style={s.totBox}>
                            <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(cSub, data.currency)}</Text></View>
                            {getItemDiscountTotal(data) > 0 && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text></View>}
                            {!!data.discountValue && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(cDisc, data.currency)}</Text></View>}
                            {!!data.taxRate && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(cTax, data.currency)}</Text></View>}
                            <View style={s.gRow}><Text style={{ fontSize: 12, color: c.pri, ...bold(c) }}>Total Value</Text><Text style={{ fontSize: 18, color: c.pri, ...CFB }}>{fmt(cTotal, data.currency)}</Text></View>
                        </View>
                    </View>
                )}

                <View style={s.sigRow} wrap={false}>
                    <View style={s.sigBlk}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party A Signature</Text>
                        <View style={s.sigLine} />
                        <Text style={{ fontSize: 10, color: c.txt, ...bold(c) }}>{data.signatureName || data.fromName || "_______________"}</Text>
                        {data.signatureTitle ? <Text style={{ fontSize: 9, color: c.mut }}>{data.signatureTitle}</Text> : null}
                    </View>
                    <View style={{ ...s.sigBlk, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Party B Signature</Text>
                        <View style={s.sigLine} />
                        <Text style={{ fontSize: 10, color: c.txt, ...bold(c) }}>{data.toName || "_______________"}</Text>
                    </View>
                </View>

                {data.notes ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text></View> : null}
                {data.terms ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Additional Terms</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text></View> : null}

                <View style={s.footer} fixed>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// QUOTATION PDF
// ═══════════════════════════════════════════════════════

export function QuotationPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const { sub, disc, tax, total } = calc(data)
    
    const s = StyleSheet.create({
        page: { paddingTop: tpl === "bold" ? 0 : 48, paddingBottom: 60, paddingHorizontal: 0, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff" },
        cornerAcc: { position: "absolute", top: 0, left: 0, width: 100, height: 100, backgroundColor: c.acc },
        classicBorder: { position: "absolute", top: 24, left: 24, right: 24, bottom: 24, ...bAll(1, c.bdr) },
        boldHeader: { backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 28 },
        boldShape: { position: "absolute", top: 0, right: 0, width: 120, height: 90, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 50, opacity: 0.5 },
        hWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 48, paddingTop: tpl === "bold" ? 0 : 20, paddingBottom: 16 },
        badge: { backgroundColor: tpl === "bold" ? "rgba(255,255,255,0.2)" : c.acc, paddingHorizontal: 12, paddingVertical: 5, ...r(14) },
        divider: { height: 2, backgroundColor: c.acc, marginHorizontal: 48, marginBottom: 18 },
        dRow: { flexDirection: "row", paddingHorizontal: 48, marginBottom: 20 },
        dItem: { flex: 1, ...bw(0, 0, tpl === "classic" ? 1 : 0, tpl === "classic" ? 0 : 3), ...bc("transparent", "transparent", tpl === "classic" ? c.bdr : "transparent", tpl === "classic" ? "transparent" : c.pri), ...bs("solid", "solid", "solid", "solid"), paddingLeft: tpl === "classic" ? 0 : 10, paddingBottom: tpl === "classic" ? 10 : 0, marginRight: 10 },
        pRow: { flexDirection: "row", paddingHorizontal: 48, marginBottom: 24 },
        pBlk: { flex: 1, marginRight: 14 },
        descBox: { marginHorizontal: 48, backgroundColor: c.bg, ...r(8), padding: 14, marginBottom: 16 },
        tWrap: { marginHorizontal: 48, marginBottom: 16 },
        tHead: { flexDirection: "row", backgroundColor: tpl === "classic" ? "transparent" : c.pri, ...r(tpl === "classic" ? 0 : 6), paddingVertical: 9, paddingHorizontal: 10, ...bBottom(tpl === "classic" ? 3 : 0, c.pri) },
        tRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.acc) },
        tRowAlt: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.acc), backgroundColor: c.bg },
        cD: { flex: 1 }, cQ: { width: 50, textAlign: "center" }, cR: { width: 80, textAlign: "right" }, cA: { width: 80, textAlign: "right" },
        totWrap: { flexDirection: "row", justifyContent: "flex-end", marginHorizontal: 48, marginBottom: 20 },
        totBox: { width: 220, ...(tpl === "classic" ? bAll(1, c.bdr) : bAll(0, "transparent")), backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(8), padding: 14 },
        totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
        gRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6, ...bTop(2, c.pri) },
        nWrap: { paddingHorizontal: 48, marginBottom: 16 },
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48, ...bTop(tpl === "bold" ? 0 : 1, c.bdr), backgroundColor: tpl === "bold" ? c.pri : "#fff" },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                {tpl === "modern" && <View style={s.cornerAcc} fixed />}
                {tpl === "classic" && <View style={s.classicBorder} fixed />}
                {tpl === "bold" && (
                    <View style={s.boldHeader} fixed>
                        <View style={s.boldShape} />
                        <PdfLogo url={logoUrl} />
                        <Text style={{ fontSize: 30, color: "#fff", letterSpacing: 1.5, ...bold(c) }}>QUOTATION</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "QUO-0000"}</Text>
                    </View>
                )}

                {tpl !== "bold" && (
                    <View style={s.hWrap} wrap={false}>
                        <View>
                            <PdfLogo url={logoUrl} />
                            <Text style={{ fontSize: tpl === "classic" ? 24 : 28, color: c.pri, letterSpacing: tpl === "classic" ? 0 : 1.5, ...bold(c) }}>QUOTATION</Text>
                            <Text style={{ fontSize: 10, color: c.mut, marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "QUO-0000"}</Text>
                        </View>
                        <View style={s.badge}><Text style={{ fontSize: 9, color: c.pri, ...bold(c) }}>DRAFT</Text></View>
                    </View>
                )}

                {tpl !== "bold" && <View style={s.divider} />}

                <View style={s.dRow} wrap={false}>
                    <View style={s.dItem}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Quote Date</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.invoiceDate)}</Text>
                    </View>
                    <View style={s.dItem}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Valid Until</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.dueDate)}</Text>
                    </View>
                    <View style={{ ...s.dItem, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Payment Terms</Text>
                        <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{data.paymentTerms || "Net 30"}</Text>
                    </View>
                </View>

                <View style={s.pRow} wrap={false}>
                    <View style={s.pBlk}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>From</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromPhone}</Text> : null}
                    </View>
                    <View style={{ ...s.pBlk, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bold(c) }}>Quote For</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toPhone}</Text> : null}
                    </View>
                </View>

                {data.description && <View style={s.descBox}><Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.6 }}>{data.description}</Text></View>}

                <View style={s.tWrap}>
                    <View style={s.tHead} wrap={false}>
                        <View style={s.cD}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, ...bold(c) }}>Item / Service</Text></View>
                        <View style={s.cQ}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", ...bold(c) }}>Qty</Text></View>
                        <View style={s.cR}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Unit Price</Text></View>
                        <View style={s.cA}><Text style={{ fontSize: 8, color: tpl === "classic" ? c.pri : "#fff", textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Amount</Text></View>
                    </View>
                    {data.items.map((item, i) => (
                        <ItemRow key={i} item={item} i={i} data={data} c={c} CF={CF} CFB={CFB} tRow={s.tRow} tRowAlt={s.tRowAlt} cD={s.cD} cQ={s.cQ} cR={s.cR} cA={s.cA} />
                    ))}
                </View>

                <View style={s.totWrap} wrap={false}>
                    <View style={s.totBox}>
                        <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(sub, data.currency)}</Text></View>
                        {getItemDiscountTotal(data) > 0 && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text></View>}
                        {!!data.discountValue && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(disc, data.currency)}</Text></View>}
                        {!!data.taxRate && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(tax, data.currency)}</Text></View>}
                        <View style={s.gRow}><Text style={{ fontSize: 12, color: c.pri, ...bold(c) }}>Total</Text><Text style={{ fontSize: 18, color: c.pri, ...CFB }}>{fmt(total, data.currency)}</Text></View>
                    </View>
                </View>

                {data.notes ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text></View> : null}
                {data.terms ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Terms & Conditions</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text></View> : null}

                <View style={s.footer} fixed>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}


// ═══════════════════════════════════════════════════════
// PROPOSAL PDF
// ═══════════════════════════════════════════════════════

export function ProposalPDF({ data, logoUrl }: Props) {
    const tpl = getTpl(data)
    const c = getTheme(tpl, data)
    const hasItems = data.items.some(i => i.description.trim().length > 0 || i.rate > 0)
    const { sub: pSub, disc: pDisc, tax: pTax, total: pTotal } = calc(data)
    
    const s = StyleSheet.create({
        page: { paddingTop: tpl === "bold" ? 0 : 48, paddingBottom: 60, paddingHorizontal: 0, fontSize: 10, fontFamily: c.font, backgroundColor: "#fff" },
        topBar: { height: 6, backgroundColor: c.pri },
        rightShape: { position: "absolute", top: 0, right: 0, width: 140, height: 110, backgroundColor: c.acc, ...r(0), borderBottomLeftRadius: 50 },
        classicLine: { height: 2, backgroundColor: c.pri, marginHorizontal: 48, marginBottom: 16 },
        boldHeader: { backgroundColor: c.pri, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 28 },
        boldShape: { position: "absolute", top: 0, right: 0, width: 140, height: 100, backgroundColor: c.priDk, ...r(0), borderBottomLeftRadius: 60, opacity: 0.5 },
        boldCircle: { position: "absolute", top: 55, right: 95, width: 40, height: 40, ...r(20), backgroundColor: "rgba(255,255,255,0.1)" },
        hWrap: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 48, paddingTop: tpl === "bold" ? 0 : 24, paddingBottom: 16 },
        hMeta: { flexDirection: "row", marginTop: 14, paddingHorizontal: 48 },
        metaItem: { marginRight: 28 },
        dRow: { flexDirection: "row", paddingHorizontal: 48, marginBottom: 20 },
        dItem: { flex: 1, ...bw(0, 0, tpl === "classic" ? 1 : 0, tpl === "classic" ? 0 : 3), ...bc("transparent", "transparent", tpl === "classic" ? c.bdr : "transparent", tpl === "classic" ? "transparent" : c.pri), ...bs("solid", "solid", "solid", "solid"), paddingLeft: tpl === "classic" ? 0 : 10, paddingBottom: tpl === "classic" ? 10 : 0, marginRight: 12 },
        pRow: { flexDirection: "row", paddingHorizontal: 48, paddingTop: tpl === "bold" ? 24 : 0, marginBottom: 24 },
        pBlk: { flex: 1, marginRight: 14 },
        secWrap: { paddingHorizontal: 48, marginBottom: 16 },
        tWrap: { marginHorizontal: 48, marginBottom: 16 },
        tHead: { flexDirection: "row", backgroundColor: tpl === "classic" ? "transparent" : c.acc, ...r(tpl === "classic" ? 0 : 6), paddingVertical: 9, paddingHorizontal: 10, ...bBottom(2, c.pri) },
        tRow: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.acc) },
        tRowAlt: { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 10, ...bBottom(1, c.acc), backgroundColor: c.bg },
        cD: { flex: 1 }, cQ: { width: 50, textAlign: "center" }, cR: { width: 80, textAlign: "right" }, cA: { width: 80, textAlign: "right" },
        totWrap: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 48, marginBottom: 20 },
        totBox: { width: 240, backgroundColor: tpl === "bold" ? c.bg : "transparent", ...r(10), padding: tpl === "bold" ? 16 : 0, ...(tpl === "classic" ? bAll(1, c.bdr) : bAll(0, "transparent")) },
        totRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
        gRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 10, marginTop: 6, ...bTop(2, c.pri) },
        ctaBox: { marginHorizontal: 48, backgroundColor: c.acc, ...r(8), padding: 18, ...bLeft(4, c.pri), marginBottom: 16 },
        nWrap: { paddingHorizontal: 48, marginBottom: 16 },
        footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 40, backgroundColor: tpl === "bold" ? c.pri : c.bg, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 48 },
    })

    return (
        <Document>
            <Page size="A4" style={s.page} wrap>
                {tpl === "modern" && <><View style={s.rightShape} fixed /><View style={s.topBar} /></>}
                {tpl === "classic" && <View style={s.classicLine} />}
                {tpl === "bold" && (
                    <View style={s.boldHeader} fixed>
                        <View style={s.boldShape} />
                        <View style={s.boldCircle} />
                        <PdfLogo url={logoUrl} />
                        <Text style={{ fontSize: 32, color: "#fff", letterSpacing: 2, ...bold(c) }}>PROPOSAL</Text>
                        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "PROP-0000"}</Text>
                        <View style={s.hMeta}>
                            <View style={s.metaItem}>
                                <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Date</Text>
                                <Text style={{ fontSize: 11, color: "#fff", ...bold(c) }}>{fmtDate(data.invoiceDate)}</Text>
                            </View>
                            {data.dueDate && (
                                <View style={s.metaItem}>
                                    <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Valid Until</Text>
                                    <Text style={{ fontSize: 11, color: "#fff", ...bold(c) }}>{fmtDate(data.dueDate)}</Text>
                                </View>
                            )}
                            {data.paymentTerms && (
                                <View style={s.metaItem}>
                                    <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Payment</Text>
                                    <Text style={{ fontSize: 11, color: "#fff", ...bold(c) }}>{data.paymentTerms}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {tpl !== "bold" && (
                    <View style={s.hWrap} wrap={false}>
                        <View>
                            <PdfLogo url={logoUrl} />
                            <Text style={{ fontSize: tpl === "classic" ? 26 : 30, color: c.pri, letterSpacing: tpl === "classic" ? 0 : 2, ...bold(c) }}>PROPOSAL</Text>
                            <Text style={{ fontSize: 10, color: c.mut, marginTop: 4 }}>{data.referenceNumber || data.invoiceNumber || "PROP-0000"}</Text>
                        </View>
                    </View>
                )}

                {tpl !== "bold" && (
                    <View style={s.dRow} wrap={false}>
                        <View style={s.dItem}>
                            <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Date</Text>
                            <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.invoiceDate)}</Text>
                        </View>
                        {data.dueDate && (
                            <View style={s.dItem}>
                                <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Valid Until</Text>
                                <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{fmtDate(data.dueDate)}</Text>
                            </View>
                        )}
                        {data.paymentTerms && (
                            <View style={{ ...s.dItem, marginRight: 0 }}>
                                <Text style={{ fontSize: 8, color: c.mut, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3, ...bold(c) }}>Payment</Text>
                                <Text style={{ fontSize: 11, color: c.txt, ...bold(c) }}>{data.paymentTerms}</Text>
                            </View>
                        )}
                    </View>
                )}

                <View style={s.pRow} wrap={false}>
                    <View style={s.pBlk}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bBottom(tpl === "modern" ? 2 : 0, c.acc), paddingBottom: 4, ...bold(c) }}>Prepared By</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.fromName || "Your Business"}</Text>
                        {data.fromAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.fromAddress}</Text> : null}
                        {data.fromEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromEmail}</Text> : null}
                        {data.fromPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.fromPhone}</Text> : null}
                    </View>
                    <View style={{ ...s.pBlk, marginRight: 0 }}>
                        <Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6, ...bBottom(tpl === "modern" ? 2 : 0, c.acc), paddingBottom: 4, ...bold(c) }}>Prepared For</Text>
                        <Text style={{ fontSize: 12, color: c.txt, marginBottom: 2, ...bold(c) }}>{data.toName || "[Client Name]"}</Text>
                        {data.toAddress ? <Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.toAddress}</Text> : null}
                        {data.toEmail ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toEmail}</Text> : null}
                        {data.toPhone ? <Text style={{ fontSize: 9.5, color: c.mut }}>{data.toPhone}</Text> : null}
                    </View>
                </View>

                {data.description && (
                    <View style={s.secWrap}>
                        <Text style={{ fontSize: 11, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, ...bold(c) }}>Executive Summary</Text>
                        <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.7 }}>{data.description}</Text>
                    </View>
                )}

                {hasItems && (
                    <View style={s.tWrap}>
                        <Text style={{ fontSize: 11, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, ...bold(c) }}>Budget Breakdown</Text>
                        <View style={s.tHead} wrap={false}>
                            <View style={s.cD}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 0.8, ...bold(c) }}>Deliverable / Phase</Text></View>
                            <View style={s.cQ}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "center", ...bold(c) }}>Qty</Text></View>
                            <View style={s.cR}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Rate</Text></View>
                            <View style={s.cA}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 0.8, textAlign: "right", ...bold(c) }}>Amount</Text></View>
                        </View>
                        {data.items.map((item, i) => {
                            if (!item.description && item.rate === 0) return null
                            return (
                                <ItemRow key={i} item={item} i={i} data={data} c={c} CF={CF} CFB={CFB} tRow={s.tRow} tRowAlt={s.tRowAlt} cD={s.cD} cQ={s.cQ} cR={s.cR} cA={s.cA} />
                            )
                        })}
                    </View>
                )}

                {pTotal > 0 && (
                    <View style={s.totWrap} wrap={false}>
                        <View style={s.totBox}>
                            <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Subtotal</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(pSub, data.currency)}</Text></View>
                            {getItemDiscountTotal(data) > 0 && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(getItemDiscountTotal(data), data.currency)}</Text></View>}
                            {!!data.discountValue && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>-{fmt(pDisc, data.currency)}</Text></View>}
                            {!!data.taxRate && <View style={s.totRow}><Text style={{ fontSize: 10, color: c.mut }}>{data.taxLabel || "Tax"} ({data.taxRate}%)</Text><Text style={{ fontSize: 10, color: c.txt, ...CFB }}>{fmt(pTax, data.currency)}</Text></View>}
                            <View style={s.gRow}><Text style={{ fontSize: 12, color: c.pri, ...bold(c) }}>Total Investment</Text><Text style={{ fontSize: 18, color: c.pri, ...CFB }}>{fmt(pTotal, data.currency)}</Text></View>
                        </View>
                    </View>
                )}

                <View style={s.ctaBox} wrap={false}>
                    <Text style={{ fontSize: 11, color: c.pri, marginBottom: 4, ...bold(c) }}>Next Steps</Text>
                    <Text style={{ fontSize: 10, color: c.txt, lineHeight: 1.5 }}>{data.paymentInstructions || "To proceed with this proposal, please sign and return this document. We look forward to working with you."}</Text>
                </View>

                {data.notes ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Notes</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.notes}</Text></View> : null}
                {data.terms ? <View style={s.nWrap}><Text style={{ fontSize: 8, color: c.pri, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, ...bold(c) }}>Terms & Conditions</Text><Text style={{ fontSize: 9.5, color: c.mut, lineHeight: 1.6 }}>{data.terms}</Text></View> : null}

                <View style={s.footer} fixed>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }}>Generated by Clorefy</Text>
                    <Text style={{ fontSize: 8, color: tpl === "bold" ? "rgba(255,255,255,0.7)" : c.mut }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
                </View>
            </Page>
        </Document>
    )
}
