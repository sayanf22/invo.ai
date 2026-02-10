/**
 * Image Export API (PNG/JPG)
 * Per project.md: "PNG/JPG Export - Edge Function renders as high-resolution image"
 * 
 * Note: For production, use Puppeteer/Playwright in Supabase Edge Function
 * This endpoint provides HTML template that can be rendered to image
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, validateBodySize } from "@/lib/api-auth"
import { checkRateLimit } from "@/lib/rate-limiter"

interface ExportRequest {
    documentType: "invoice" | "contract" | "nda" | "agreement"
    documentData: Record<string, unknown>
    format: "png" | "jpg"
    width?: number
    height?: number
    includeDisclaimer?: boolean
}

const AI_DISCLAIMER = `This document was generated using AI technology. While validated for compliance, we recommend review by qualified professionals before use.`

// ── SECURITY: HTML escape to prevent XSS ────────────────────────────────

function escapeHtml(str: unknown): string {
    const s = String(str ?? "")
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

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

        const {
            documentType,
            documentData,
            format = "png",
            width = 794,  // A4 width at 96 DPI
            height = 1123, // A4 height at 96 DPI
            includeDisclaimer = true
        } = body

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

        // SECURITY: Validate format
        if (!["png", "jpg"].includes(format)) {
            return NextResponse.json(
                { error: "Invalid format. Use png or jpg." },
                { status: 400 }
            )
        }

        // SECURITY: Validate dimensions
        const clampedWidth = Math.min(Math.max(width, 200), 3000)
        const clampedHeight = Math.min(Math.max(height, 200), 5000)

        // Generate HTML template for image rendering (ALL data is escaped)
        const html = generateImageHtml(documentType, documentData, includeDisclaimer)

        return NextResponse.json({
            success: true,
            format,
            dimensions: { width: clampedWidth, height: clampedHeight },
            html,
            disclaimer: includeDisclaimer ? AI_DISCLAIMER : "",
            message: "HTML template generated. Use Puppeteer/Playwright to render to " + format.toUpperCase(),
            renderInstructions: {
                tool: "puppeteer",
                options: {
                    width: clampedWidth,
                    height: clampedHeight,
                    type: format === "png" ? "png" : "jpeg",
                    quality: format === "jpg" ? 90 : undefined,
                    fullPage: true
                }
            }
        })

    } catch (error) {
        console.error("Image export error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}

/**
 * Generate HTML template for image rendering
 * SECURITY: All user data is HTML-escaped to prevent XSS
 */
function generateImageHtml(
    documentType: string,
    data: Record<string, unknown>,
    includeDisclaimer: boolean
): string {
    if (documentType === "invoice") {
        return generateInvoiceHtml(data, includeDisclaimer)
    }

    // Generic document HTML — all data escaped
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; padding: 40px; background: white; }
        h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .disclaimer { font-size: 10px; color: #888; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
    </style>
</head>
<body>
    <h1>${escapeHtml(documentType.toUpperCase())}</h1>
    <pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>
    ${includeDisclaimer ? `<div class="disclaimer">${escapeHtml(AI_DISCLAIMER)}</div>` : ""}
</body>
</html>`
}

function generateInvoiceHtml(data: Record<string, unknown>, includeDisclaimer: boolean): string {
    const seller = (data.seller || {}) as Record<string, unknown>
    const buyer = (data.buyer || {}) as Record<string, unknown>
    const lineItems = (data.line_items || []) as Array<Record<string, unknown>>
    const currency = String(data.currency || "USD")

    const lineItemsHtml = lineItems.map(item => `
        <tr>
            <td>${escapeHtml(item.description)}</td>
            <td style="text-align: center;">${escapeHtml(item.quantity)}</td>
            <td style="text-align: right;">${escapeHtml(formatCurrency(Number(item.unit_price) || 0, currency))}</td>
            <td style="text-align: right;">${escapeHtml(formatCurrency(Number(item.total) || 0, currency))}</td>
        </tr>
    `).join("")

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 40px; 
            background: white;
            color: #333;
            line-height: 1.5;
        }
        .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2563eb;
        }
        .logo-section h1 { 
            margin: 0; 
            font-size: 32px; 
            color: #2563eb;
            font-weight: 700;
        }
        .invoice-info { text-align: right; }
        .invoice-info h2 { margin: 0 0 10px 0; font-size: 24px; color: #666; }
        .invoice-info p { margin: 4px 0; color: #555; }
        .parties { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px;
        }
        .party { width: 45%; }
        .party h3 { 
            margin: 0 0 10px 0; 
            color: #2563eb;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .party p { margin: 4px 0; font-size: 14px; }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px;
        }
        th { 
            background: #2563eb; 
            color: white; 
            padding: 12px 15px; 
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        th:last-child { text-align: right; }
        td { 
            padding: 12px 15px; 
            border-bottom: 1px solid #eee;
            font-size: 14px;
        }
        tr:hover td { background: #f8fafc; }
        .totals { 
            margin-left: auto; 
            width: 300px; 
        }
        .totals table { margin-bottom: 0; }
        .totals td { border: none; padding: 8px 15px; }
        .totals tr:last-child td { 
            font-weight: bold; 
            font-size: 18px;
            background: #f0f9ff;
            color: #2563eb;
        }
        .payment-info { 
            margin-top: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
        }
        .payment-info h3 { margin: 0 0 10px 0; color: #2563eb; }
        .notes { margin-top: 20px; font-size: 14px; color: #666; }
        .disclaimer { 
            font-size: 10px; 
            color: #888; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo-section">
            <h1>${escapeHtml(seller.name || "INVOICE")}</h1>
        </div>
        <div class="invoice-info">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> ${escapeHtml(data.document_number || "---")}</p>
            <p><strong>Date:</strong> ${escapeHtml(data.issue_date || "---")}</p>
            <p><strong>Due Date:</strong> ${escapeHtml(data.due_date || "---")}</p>
        </div>
    </div>

    <div class="parties">
        <div class="party">
            <h3>From</h3>
            <p><strong>${escapeHtml(seller.name)}</strong></p>
            <p>${escapeHtml(formatAddress(seller.address as Record<string, unknown>))}</p>
            ${seller.email ? `<p>Email: ${escapeHtml(seller.email)}</p>` : ""}
            ${seller.phone ? `<p>Phone: ${escapeHtml(seller.phone)}</p>` : ""}
            ${seller.tax_id ? `<p>Tax ID: ${escapeHtml(seller.tax_id)}</p>` : ""}
        </div>
        <div class="party">
            <h3>Bill To</h3>
            <p><strong>${escapeHtml(buyer.name)}</strong></p>
            <p>${escapeHtml(formatAddress(buyer.address as Record<string, unknown>))}</p>
            ${buyer.email ? `<p>Email: ${escapeHtml(buyer.email)}</p>` : ""}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${lineItemsHtml}
        </tbody>
    </table>

    <div class="totals">
        <table>
            <tr>
                <td>Subtotal:</td>
                <td style="text-align: right;">${escapeHtml(formatCurrency(Number(data.subtotal) || 0, currency))}</td>
            </tr>
            ${data.tax_amount ? `
            <tr>
                <td>Tax (${escapeHtml(data.tax_rate || 0)}%):</td>
                <td style="text-align: right;">${escapeHtml(formatCurrency(Number(data.tax_amount) || 0, currency))}</td>
            </tr>
            ` : ""}
            ${data.discount ? `
            <tr>
                <td>Discount:</td>
                <td style="text-align: right;">-${escapeHtml(formatCurrency(Number(data.discount) || 0, currency))}</td>
            </tr>
            ` : ""}
            <tr>
                <td>Total:</td>
                <td style="text-align: right;">${escapeHtml(formatCurrency(Number(data.total) || 0, currency))}</td>
            </tr>
        </table>
    </div>

    ${data.payment_instructions ? `
    <div class="payment-info">
        <h3>Payment Instructions</h3>
        <p>${escapeHtml(data.payment_instructions)}</p>
    </div>
    ` : ""}

    ${data.notes ? `
    <div class="notes">
        <strong>Notes:</strong><br>
        ${escapeHtml(data.notes)}
    </div>
    ` : ""}

    ${includeDisclaimer ? `<div class="disclaimer">${escapeHtml(AI_DISCLAIMER)}</div>` : ""}
</body>
</html>`
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
