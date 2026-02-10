import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"

// Color palette matching the preview
const colors = {
    background: "#ffffff",
    foreground: "#1a1a1a",
    muted: "#6b7280",
    mutedLight: "#9ca3af",
    border: "#e5e7eb",
    borderLight: "#f3f4f6",
    primary: "#7c3aed",
    primaryBg: "#f5f3ff",
}

// Dynamic styles based on design
const getPdfStyles = (design: InvoiceData["design"]) => {
    const font = design?.font || "Helvetica"
    const headerColor = design?.headerColor
    const tableColor = design?.tableColor
    const isBold = design?.layout === "bold"
    const isMinimal = design?.layout === "minimal"
    const isClassic = design?.layout === "classic"

    // Font families for standard PDF fonts
    const fontRegular = font
    const fontBold = font === "Helvetica" ? "Helvetica-Bold" : font === "Times-Roman" ? "Times-Bold" : "Courier-Bold"

    return StyleSheet.create({
        page: {
            padding: 48,
            fontSize: 10,
            fontFamily: fontRegular,
            backgroundColor: colors.background,
        },

        // Header section
        header: {
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 24,
            padding: isBold ? 32 : 0,
            backgroundColor: isBold && headerColor ? headerColor : undefined,
            marginHorizontal: isBold ? -48 : 0,
            marginTop: isBold ? -48 : 0,
            paddingTop: isBold ? 48 : 0,
        },
        invoiceTitle: {
            fontSize: 28,
            fontFamily: fontBold,
            color: isBold ? "#ffffff" : colors.foreground,
            letterSpacing: -0.5,
        },
        invoiceNumberText: {
            fontSize: 11,
            color: isBold ? "rgba(255,255,255,0.8)" : colors.muted,
            marginTop: 4,
        },
        draftBadge: {
            backgroundColor: isBold ? "rgba(255,255,255,0.2)" : colors.primaryBg,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 12,
        },
        draftBadgeText: {
            fontSize: 9,
            color: isBold ? "#ffffff" : colors.primary,
            fontFamily: fontBold,
        },

        // Dates row
        datesRow: {
            flexDirection: "row",
            marginBottom: 24,
            gap: 32,
            paddingHorizontal: isBold ? 32 : 0,
            borderBottomWidth: isClassic ? 1 : 0,
            borderBottomColor: colors.borderLight,
            paddingBottom: isClassic ? 24 : 0,
        },
        dateBlock: {
            minWidth: 80,
        },
        dateLabel: {
            fontSize: 9,
            color: colors.muted,
            marginBottom: 4,
        },
        dateValue: {
            fontSize: 10,
            color: colors.foreground,
            fontFamily: fontBold,
        },

        // Parties section
        partiesRow: {
            flexDirection: "row",
            marginBottom: 28,
            gap: 48,
            paddingHorizontal: isBold ? 32 : 0,
        },
        partyBlock: {
            flex: 1,
        },
        partyLabel: {
            fontSize: 8,
            color: colors.mutedLight,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 8,
            fontFamily: fontBold,
        },
        partyName: {
            fontSize: 12,
            fontFamily: fontBold,
            color: colors.foreground,
            marginBottom: 4,
        },
        partyNamePlaceholder: {
            fontSize: 12,
            color: "#d1d5db",
            marginBottom: 4,
        },
        partyDetails: {
            fontSize: 10,
            color: colors.muted,
            lineHeight: 1.5,
        },

        // Items table
        table: {
            marginBottom: 24,
            paddingHorizontal: isBold ? 32 : 0,
        },
        tableHeader: {
            flexDirection: "row",
            borderBottomWidth: 2,
            borderBottomColor: isBold ? colors.foreground : colors.borderLight,
            paddingBottom: 8,
            marginBottom: 4,
            backgroundColor: tableColor || undefined,
            paddingTop: tableColor ? 8 : 0,
            paddingHorizontal: tableColor ? 8 : 0,
        },
        tableHeaderText: {
            fontSize: 8,
            fontFamily: fontBold,
            color: colors.mutedLight,
            textTransform: "uppercase",
            letterSpacing: 0.8,
        },
        tableRow: {
            flexDirection: "row",
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderLight,
            alignItems: "center",
            paddingHorizontal: tableColor ? 8 : 0,
        },
        tableCell: {
            fontSize: 10,
            color: colors.foreground,
        },
        tableCellMuted: {
            fontSize: 10,
            color: colors.muted,
        },
        tableCellBold: {
            fontSize: 10,
            color: colors.foreground,
            fontFamily: fontBold,
        },
        colDescription: {
            flex: 1,
        },
        colQty: {
            width: 50,
            textAlign: "center",
        },
        colRate: {
            width: 70,
            textAlign: "right",
        },
        colAmount: {
            width: 70,
            textAlign: "right",
        },

        // Totals section
        totalsSection: {
            flexDirection: "row",
            justifyContent: "flex-end",
            marginBottom: 24,
            paddingHorizontal: isBold ? 32 : 0,
        },
        totalsBlock: {
            width: 200,
        },
        totalRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingVertical: 6,
        },
        totalLabel: {
            fontSize: 10,
            color: colors.muted,
        },
        totalValue: {
            fontSize: 10,
            color: colors.foreground,
            fontFamily: fontBold,
        },
        grandTotalRow: {
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: 10,
            marginTop: 4,
            borderTopWidth: 2,
            borderTopColor: colors.borderLight,
        },
        grandTotalLabel: {
            fontSize: 11,
            color: colors.foreground,
            fontFamily: fontBold,
        },
        grandTotalValue: {
            fontSize: 16,
            color: colors.foreground,
            fontFamily: fontBold,
            letterSpacing: -0.5,
        },

        // Notes section
        notesSection: {
            marginTop: 16,
            paddingTop: 16,
            paddingHorizontal: isBold ? 32 : 0,
        },
        notesLabel: {
            fontSize: 8,
            color: colors.mutedLight,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 6,
            fontFamily: fontBold,
        },
        notesText: {
            fontSize: 10,
            color: colors.muted,
            lineHeight: 1.5,
        },

        // Footer
        footer: {
            position: "absolute",
            bottom: 36,
            left: 48,
            right: 48,
            flexDirection: "row",
            justifyContent: "space-between",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        footerText: {
            fontSize: 9,
            color: colors.mutedLight,
        },
    })
}

// Format currency with symbol
function formatCurrency(amount: number, currency: string = "USD"): string {
    const symbols: Record<string, string> = {
        USD: "$",
        EUR: "€",
        GBP: "£",
        INR: "₹",
        JPY: "¥",
        AUD: "A$",
        CAD: "C$",
    }
    const symbol = symbols[currency] || currency + " "
    return `${symbol}${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`
}

// Format date nicely
function formatDate(dateStr: string | undefined): string {
    if (!dateStr) return "---"
    try {
        const date = new Date(dateStr + "T00:00:00")
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    } catch {
        return dateStr
    }
}

interface InvoicePDFProps {
    data: InvoiceData
}

export function InvoicePDF({ data }: InvoicePDFProps) {
    const styles = getPdfStyles(data.design)

    // Calculate totals
    const subtotal = data.items.reduce(
        (sum, item) => sum + item.quantity * item.rate,
        0
    )
    const discountAmount =
        data.discountType === "percent"
            ? (subtotal * (data.discountValue || 0)) / 100
            : data.discountValue || 0
    const afterDiscount = subtotal - discountAmount
    const taxAmount = (afterDiscount * (data.taxRate || 0)) / 100
    const total = afterDiscount + taxAmount

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header - INVOICE title with Draft badge */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.invoiceTitle}>INVOICE</Text>
                        <Text style={styles.invoiceNumberText}>
                            {data.invoiceNumber || "INV-0000"}
                        </Text>
                    </View>
                    <View style={styles.draftBadge}>
                        <Text style={styles.draftBadgeText}>Draft</Text>
                    </View>
                </View>

                {/* Dates Row - Invoice Date, Due Date, Payment Terms */}
                <View style={styles.datesRow}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateLabel}>Invoice Date</Text>
                        <Text style={styles.dateValue}>{formatDate(data.invoiceDate)}</Text>
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateLabel}>Due Date</Text>
                        <Text style={styles.dateValue}>{formatDate(data.dueDate)}</Text>
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.dateLabel}>Payment Terms</Text>
                        <Text style={styles.dateValue}>{data.paymentTerms || "---"}</Text>
                    </View>
                </View>

                {/* From / Bill To section */}
                <View style={styles.partiesRow}>
                    <View style={styles.partyBlock}>
                        <Text style={styles.partyLabel}>From</Text>
                        {data.fromName ? (
                            <Text style={styles.partyName}>{data.fromName}</Text>
                        ) : (
                            <Text style={styles.partyNamePlaceholder}>Your name</Text>
                        )}
                        {data.fromAddress ? (
                            <Text style={styles.partyDetails}>{data.fromAddress}</Text>
                        ) : null}
                        {data.fromEmail ? (
                            <Text style={styles.partyDetails}>{data.fromEmail}</Text>
                        ) : null}
                        {data.fromPhone ? (
                            <Text style={styles.partyDetails}>{data.fromPhone}</Text>
                        ) : null}
                    </View>
                    <View style={styles.partyBlock}>
                        <Text style={styles.partyLabel}>Bill To</Text>
                        {data.toName ? (
                            <Text style={styles.partyName}>{data.toName}</Text>
                        ) : (
                            <Text style={styles.partyNamePlaceholder}>Recipient name</Text>
                        )}
                        {data.toAddress ? (
                            <Text style={styles.partyDetails}>{data.toAddress}</Text>
                        ) : null}
                        {data.toEmail ? (
                            <Text style={styles.partyDetails}>{data.toEmail}</Text>
                        ) : null}
                        {data.toPhone ? (
                            <Text style={styles.partyDetails}>{data.toPhone}</Text>
                        ) : null}
                    </View>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <View style={styles.colDescription}>
                            <Text style={styles.tableHeaderText}>Description</Text>
                        </View>
                        <View style={styles.colQty}>
                            <Text style={[styles.tableHeaderText, { textAlign: "center" }]}>Qty</Text>
                        </View>
                        <View style={styles.colRate}>
                            <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Rate</Text>
                        </View>
                        <View style={styles.colAmount}>
                            <Text style={[styles.tableHeaderText, { textAlign: "right" }]}>Amount</Text>
                        </View>
                    </View>

                    {data.items.map((item, i) => (
                        <View key={i} style={styles.tableRow}>
                            <View style={styles.colDescription}>
                                <Text style={styles.tableCell}>
                                    {item.description || "Item " + (i + 1)}
                                </Text>
                            </View>
                            <View style={styles.colQty}>
                                <Text style={[styles.colQty, { textAlign: "center", color: colors.muted, fontSize: 10 }]}>
                                    {item.quantity}
                                </Text>
                            </View>
                            <View style={styles.colRate}>
                                <Text style={[styles.colRate, { textAlign: "right", color: colors.muted, fontSize: 10 }]}>
                                    {formatCurrency(item.rate, data.currency)}
                                </Text>
                            </View>
                            <View style={styles.colAmount}>
                                <Text style={[styles.colAmount, { textAlign: "right", color: colors.foreground, fontSize: 10, fontFamily: styles.tableCellBold.fontFamily }]}>
                                    {formatCurrency(
                                        item.quantity * item.rate,
                                        data.currency
                                    )}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Totals Section */}
                <View style={styles.totalsSection}>
                    <View style={styles.totalsBlock}>
                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Subtotal</Text>
                            <Text style={styles.totalValue}>
                                {formatCurrency(subtotal, data.currency)}
                            </Text>
                        </View>
                        {!!data.discountValue && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>
                                    Discount {data.discountType === "percent" ? `(${data.discountValue}%)` : ""}
                                </Text>
                                <Text style={[styles.totalValue, { color: colors.muted }]}>
                                    -{formatCurrency(discountAmount, data.currency)}
                                </Text>
                            </View>
                        )}
                        {!!data.taxRate && (
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>
                                    {data.taxLabel || "Tax"} ({data.taxRate}%)
                                </Text>
                                <Text style={styles.totalValue}>
                                    {formatCurrency(taxAmount, data.currency)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.grandTotalRow}>
                            <Text style={styles.grandTotalLabel}>Total</Text>
                            <Text style={styles.grandTotalValue}>
                                {formatCurrency(total, data.currency)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Notes & Terms */}
                {(data.notes || data.terms) && (
                    <View style={styles.notesSection}>
                        {data.notes && (
                            <View style={{ marginBottom: 12 }}>
                                <Text style={styles.notesLabel}>Notes</Text>
                                <Text style={styles.notesText}>{data.notes}</Text>
                            </View>
                        )}
                        {data.terms && (
                            <View>
                                <Text style={styles.notesLabel}>Terms</Text>
                                <Text style={styles.notesText}>{data.terms}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Generated by Invo.ai</Text>
                    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => (
                        `${pageNumber} / ${totalPages}`
                    )} fixed />
                </View>
            </Page>
        </Document>
    )
}
