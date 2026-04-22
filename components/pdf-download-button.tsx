"use client"

import { useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { toast } from "sonner"

interface PDFDownloadButtonProps {
    data: InvoiceData
    filename?: string
    variant?: "default" | "outline" | "ghost"
    size?: "default" | "sm" | "lg" | "icon"
}

/** Generate QR code as base64 PNG data URL — client-side */
async function generateQRCode(url: string): Promise<string | null> {
    if (!url) return null
    try {
        const QRCode = await import("qrcode")
        return await QRCode.default.toDataURL(url, {
            width: 200,
            margin: 1,
            color: { dark: "#000000", light: "#FFFFFF" },
            errorCorrectionLevel: "M",
        })
    } catch {
        return null
    }
}

export function PDFDownloadButton({
    data,
    filename,
    variant = "default",
    size = "default",
}: PDFDownloadButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false)

    const handleDownload = async () => {
        setIsGenerating(true)

        try {
            // Clean placeholder text before generating PDF
            const cleanedData = cleanDataForExport(data)

            // Resolve logo URL from R2 key before PDF generation
            const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)

            // Generate QR code for payment link (invoices only)
            let paymentQrCode: string | null = null
            const isInvoice = (cleanedData.documentType || "").toLowerCase() === "invoice" ||
                (!cleanedData.documentType)
            if (isInvoice && cleanedData.paymentLink &&
                cleanedData.paymentLinkStatus !== "paid" &&
                cleanedData.paymentLinkStatus !== "expired" &&
                cleanedData.paymentLinkStatus !== "cancelled") {
                paymentQrCode = await generateQRCode(cleanedData.paymentLink)
            }

            // Dynamically import templates
            const templates = await import("@/lib/pdf-templates")

            // Select the correct PDF component based on document type
            let PdfComponent: React.ComponentType<{ data: typeof data; logoUrl?: string | null; paymentQrCode?: string | null }>
            let filePrefix: string

            switch ((cleanedData.documentType || "").toLowerCase()) {
                case "contract":
                    PdfComponent = templates.ContractPDF
                    filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "contract"
                    break
                case "quotation":
                    PdfComponent = templates.QuotationPDF
                    filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "quotation"
                    break
                case "proposal":
                    PdfComponent = templates.ProposalPDF
                    filePrefix = cleanedData.referenceNumber || cleanedData.invoiceNumber || "proposal"
                    break
                case "receipt":
                    PdfComponent = templates.ReceiptPDF
                    filePrefix = cleanedData.invoiceNumber || "receipt"
                    break
                default:
                    PdfComponent = (cleanedData.design?.layout === "receipt" || cleanedData.design?.templateId === "receipt")
                        ? templates.ReceiptPDF
                        : templates.InvoicePDF
                    filePrefix = cleanedData.invoiceNumber || "invoice"
                    break
            }

            // Generate the PDF blob
            const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />).toBlob()

            // Create download link with timestamp to avoid caching
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download =
                filename ||
                `${filePrefix}_${new Date().toISOString().split("T")[0]}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast.success("PDF downloaded successfully!")
        } catch (error) {
            console.error("PDF generation error:", error)
            toast.error("Failed to generate PDF. Please try again.")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <Button
            onClick={handleDownload}
            disabled={isGenerating}
            variant={variant}
            size={size}
            className="btn-press transition-all duration-200"
            title="Download PDF"
            aria-label="Download PDF"
        >
            {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download PDF</span>
                </>
            )}
        </Button>
    )
}
