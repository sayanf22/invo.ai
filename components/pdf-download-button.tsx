"use client"

import { useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { getDocumentTypeConfig } from "@/lib/document-type-registry"
import { toast } from "sonner"

/** Signable document types — PDF export must include signature blocks */
const SIGNABLE_TYPES = new Set(["contract", "nda", "sow", "change_order"])

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

            const docType = (cleanedData.documentType || "").toLowerCase()
            const typeConfig = getDocumentTypeConfig(docType) || getDocumentTypeConfig("invoice")

            // Build the document type label prefix for the filename (spaces → underscores)
            const labelPrefix = (typeConfig?.label || "Document")
                .replace(/[\s-]+/g, "_")
                .replace(/[^a-zA-Z0-9_]/g, "")

            // Generate QR code for payment-supporting types (invoice, recurring_invoice)
            let paymentQrCode: string | null = null
            const supportsPaymentLink = typeConfig?.capabilities.supports_payment_link === true
            const shouldEmbedPaymentLink = cleanedData.showPaymentLinkInPdf !== false // default true
            if (
                supportsPaymentLink &&
                shouldEmbedPaymentLink &&
                cleanedData.paymentLink &&
                cleanedData.paymentLinkStatus !== "paid" &&
                cleanedData.paymentLinkStatus !== "expired" &&
                cleanedData.paymentLinkStatus !== "cancelled"
            ) {
                paymentQrCode = await generateQRCode(cleanedData.paymentLink)
            }

            // Dynamically import all templates
            const templates = await import("@/lib/pdf-templates")

            let blob: Blob
            let nameSegment: string

            switch (docType) {
                case "contract":
                    nameSegment = cleanedData.referenceNumber || cleanedData.invoiceNumber || "contract"
                    blob = await pdf(
                        <templates.ContractPDF data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break

                case "quote":
                case "quotation":
                    nameSegment = cleanedData.referenceNumber || cleanedData.invoiceNumber || "quote"
                    blob = await pdf(
                        <templates.QuotationPDF data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break

                case "proposal":
                    nameSegment = cleanedData.referenceNumber || cleanedData.invoiceNumber || "proposal"
                    blob = await pdf(
                        <templates.ProposalPDF data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break

                case "receipt":
                    nameSegment = cleanedData.invoiceNumber || "receipt"
                    blob = await pdf(
                        <templates.ReceiptPDF data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break

                // ── New document types ──────────────────────────────────────────

                case "sow":
                    nameSegment =
                        (cleanedData as any).referenceNumber ||
                        cleanedData.toName ||
                        "sow"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.SOWPDF data={cleanedData as any} logoUrl={logoUrl} />
                    ).toBlob()
                    break

                case "change_order":
                    nameSegment =
                        (cleanedData as any).referenceNumber ||
                        cleanedData.toName ||
                        "change-order"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.ChangeOrderPDF data={cleanedData as any} logoUrl={logoUrl} />
                    ).toBlob()
                    break

                case "nda":
                    nameSegment =
                        (cleanedData as any).referenceNumber ||
                        cleanedData.toName ||
                        "nda"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.NDAPDF data={cleanedData as any} logoUrl={logoUrl} />
                    ).toBlob()
                    break

                case "client_onboarding_form":
                    nameSegment =
                        (cleanedData as any).referenceNumber ||
                        cleanedData.toName ||
                        "onboarding"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.ClientOnboardingFormPDF data={cleanedData as any} logoUrl={logoUrl} />
                    ).toBlob()
                    break

                case "payment_followup":
                    nameSegment =
                        (cleanedData as any).referenceNumber ||
                        (cleanedData as any).invoiceNumber ||
                        cleanedData.toName ||
                        "followup"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.PaymentFollowupPDF data={cleanedData as any} logoUrl={logoUrl} />
                    ).toBlob()
                    break

                case "recurring_invoice":
                    nameSegment =
                        cleanedData.invoiceNumber ||
                        (cleanedData as any).referenceNumber ||
                        "recurring-invoice"
                    blob = await pdf(
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        <templates.RecurringInvoicePDF data={cleanedData as any} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break

                // ── Default: invoice ────────────────────────────────────────────
                default: {
                    nameSegment = cleanedData.invoiceNumber || "invoice"
                    const DefaultPDF =
                        cleanedData.design?.layout === "receipt" ||
                        cleanedData.design?.templateId === "receipt"
                            ? templates.ReceiptPDF
                            : templates.InvoicePDF
                    blob = await pdf(
                        <DefaultPDF data={cleanedData} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />
                    ).toBlob()
                    break
                }
            }

            // Sanitise name segment for use in filename
            const sanitizedName = nameSegment.replace(/[/\\:*?"<>|]/g, "_")
            const dateStr = new Date().toISOString().split("T")[0]
            const downloadFilename = filename || `${labelPrefix}_${sanitizedName}_${dateStr}.pdf`

            // Trigger browser download
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = downloadFilename
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)

            toast.success("PDF downloaded successfully!")
        } catch (error) {
            console.error("PDF generation error:", error)
            const docType = (data.documentType || "").toLowerCase()
            // Fail-closed: descriptive error when signature block cannot be rendered (422 equivalent)
            if (error instanceof Error && error.name === "SignatureBlockRenderError") {
                const isSignable = SIGNABLE_TYPES.has(docType)
                const typeLabel = getDocumentTypeConfig(docType)?.label || "document"
                if (isSignable) {
                    toast.error(
                        `PDF export blocked: the ${typeLabel} signature section could not be rendered. ` +
                        `Please ensure all party names and required fields are filled in, then try again.`,
                        { duration: 7000 }
                    )
                } else {
                    toast.error(
                        `PDF export blocked: the signature section could not be rendered. ` +
                        `Please check your document data and try again.`
                    )
                }
            } else {
                toast.error("Failed to generate PDF. Please try again.")
            }
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
