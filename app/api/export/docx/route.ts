/**
 * DOCX Export API
 * Per project.md: "DOCX Export - Edge Function converts invoice data to Word format"
 * 
 * Note: Full DOCX generation typically requires server-side libraries like docx.js
 * This endpoint provides the structure; for production, use Supabase Edge Functions
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

interface ExportRequest {
    documentType: "invoice" | "contract" | "nda" | "agreement"
    documentData: Record<string, unknown>
    includeDisclaimer?: boolean
}

interface ExportResult {
    success: boolean
    format: "docx"
    downloadUrl?: string
    base64?: string
    error?: string
    disclaimer: string
}

const AI_DISCLAIMER = `This document was generated using AI technology. While validated for compliance, we recommend review by qualified professionals before use.`

export async function POST(request: NextRequest) {
    try {
        // SECURITY: Authenticate user
        const auth = await authenticateRequest()
        if (auth.error) return auth.error

        // SECURITY: Rate limit (20 req/min for export routes)
        const rateLimitError = await checkRateLimit(auth.user.id, "export")
        if (rateLimitError) return rateLimitError

        const body: ExportRequest = await request.json()

        // SECURITY: Input size limit (500KB for document data)
        const sizeError = validateBodySize(body, 500 * 1024)
        if (sizeError) return sizeError

        const { documentType, documentData, includeDisclaimer = true } = body

        if (!documentType || !documentData) {
            return NextResponse.json(
                { error: "Missing required fields: documentType, documentData" },
                { status: 400 }
            )
        }

        // SECURITY: Validate document type
        const validTypes = ["invoice", "contract", "nda", "agreement"]
        if (!validTypes.includes(documentType)) {
            return NextResponse.json(
                { error: "Invalid document type" },
                { status: 400 }
            )
        }

        // Generate DOCX content structure
        const docxStructure = generateDocxStructure(documentType, documentData, includeDisclaimer)

        return NextResponse.json({
            success: true,
            format: "docx",
            structure: docxStructure,
            disclaimer: includeDisclaimer ? AI_DISCLAIMER : "",
            message: "DOCX structure generated. For binary DOCX file, use Supabase Edge Function.",
            base64: null,
            downloadUrl: null
        })

    } catch (error) {
        console.error("DOCX export error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * Generate DOCX document structure
 */
function generateDocxStructure(
    documentType: string,
    data: Record<string, unknown>,
    includeDisclaimer: boolean
): Record<string, unknown> {
    if (documentType === "invoice") {
        return generateInvoiceDocx(data, includeDisclaimer)
    }

    // Generic document structure
    return {
        sections: [
            {
                properties: {},
                children: [
                    { type: "heading", level: 1, text: documentType.toUpperCase() },
                    { type: "paragraph", text: JSON.stringify(data, null, 2) },
                    ...(includeDisclaimer ? [
                        { type: "paragraph", text: "" },
                        { type: "paragraph", text: AI_DISCLAIMER, style: "disclaimer" }
                    ] : [])
                ]
            }
        ]
    }
}

function generateInvoiceDocx(data: Record<string, unknown>, includeDisclaimer: boolean) {
    const seller = (data.seller || {}) as Record<string, unknown>
    const buyer = (data.buyer || {}) as Record<string, unknown>
    const lineItems = (data.line_items || []) as Array<Record<string, unknown>>

    return {
        sections: [
            {
                properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
                children: [
                    // Header
                    { type: "heading", level: 1, text: "INVOICE", alignment: "center" },
                    { type: "paragraph", text: `Invoice #: ${data.document_number || ""}` },
                    { type: "paragraph", text: `Date: ${data.issue_date || ""}` },
                    { type: "paragraph", text: `Due Date: ${data.due_date || ""}` },
                    { type: "paragraph", text: "" },

                    // Seller info
                    { type: "heading", level: 2, text: "From:" },
                    { type: "paragraph", text: String(seller.name || "") },
                    { type: "paragraph", text: formatAddress(seller.address as Record<string, unknown>) },
                    { type: "paragraph", text: `Email: ${seller.email || ""}` },
                    { type: "paragraph", text: "" },

                    // Buyer info
                    { type: "heading", level: 2, text: "Bill To:" },
                    { type: "paragraph", text: String(buyer.name || "") },
                    { type: "paragraph", text: formatAddress(buyer.address as Record<string, unknown>) },
                    { type: "paragraph", text: "" },

                    // Line items table
                    {
                        type: "table",
                        headers: ["Description", "Quantity", "Unit Price", "Total"],
                        rows: lineItems.map(item => [
                            String(item.description || ""),
                            String(item.quantity || 0),
                            formatCurrency(Number(item.unit_price) || 0, String(data.currency || "USD")),
                            formatCurrency(Number(item.total) || 0, String(data.currency || "USD"))
                        ])
                    },
                    { type: "paragraph", text: "" },

                    // Totals
                    { type: "paragraph", text: `Subtotal: ${formatCurrency(Number(data.subtotal) || 0, String(data.currency || "USD"))}`, alignment: "right" },
                    ...(data.tax_amount ? [
                        { type: "paragraph", text: `Tax (${data.tax_rate || 0}%): ${formatCurrency(Number(data.tax_amount) || 0, String(data.currency || "USD"))}`, alignment: "right" }
                    ] : []),
                    { type: "paragraph", text: `Total: ${formatCurrency(Number(data.total) || 0, String(data.currency || "USD"))}`, alignment: "right", bold: true },
                    { type: "paragraph", text: "" },

                    // Payment info
                    ...(data.payment_instructions ? [
                        { type: "heading", level: 2, text: "Payment Instructions:" },
                        { type: "paragraph", text: String(data.payment_instructions) }
                    ] : []),

                    // Notes
                    ...(data.notes ? [
                        { type: "heading", level: 2, text: "Notes:" },
                        { type: "paragraph", text: String(data.notes) }
                    ] : []),

                    // Disclaimer
                    ...(includeDisclaimer ? [
                        { type: "paragraph", text: "" },
                        { type: "paragraph", text: "─".repeat(50) },
                        { type: "paragraph", text: AI_DISCLAIMER, style: "disclaimer", fontSize: 8, color: "#888888" }
                    ] : [])
                ]
            }
        ]
    }
}

function formatAddress(address: Record<string, unknown> | undefined): string {
    if (!address) return ""
    const parts = [
        address.street,
        address.city,
        address.state,
        address.postal_code,
        address.country
    ].filter(Boolean)
    return parts.join(", ")
}

function formatCurrency(amount: number, currency: string): string {
    const symbols: Record<string, string> = {
        USD: "$", INR: "₹", EUR: "€", GBP: "£",
        CAD: "C$", AUD: "A$", SGD: "S$", AED: "د.إ"
    }
    const symbol = symbols[currency] || currency + " "
    return `${symbol}${amount.toFixed(2)}`
}
