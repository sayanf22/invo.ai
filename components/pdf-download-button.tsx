"use client"

import { useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import type { InvoiceData } from "@/lib/invoice-types"
import { toast } from "sonner"

interface PDFDownloadButtonProps {
    data: InvoiceData
    filename?: string
    variant?: "default" | "outline" | "ghost"
    size?: "default" | "sm" | "lg" | "icon"
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
            // Dynamically import the template to ensure we get the latest version
            const { InvoicePDF } = await import("@/lib/pdf-templates")

            // Generate the PDF blob
            const blob = await pdf(<InvoicePDF data={data} />).toBlob()

            // Create download link with timestamp to avoid caching
            const url = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download =
                filename ||
                `${data.invoiceNumber || "invoice"}_${new Date().toISOString().split("T")[0]}.pdf`
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
        >
            {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                </>
            )}
        </Button>
    )
}
