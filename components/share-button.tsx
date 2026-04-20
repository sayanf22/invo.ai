"use client"

import { useState, useCallback, useEffect } from "react"
import { Share2, Copy, Check, Mail, Download, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

interface ShareButtonProps {
  data: InvoiceData
  className?: string
}

function cleanDataForShare(data: InvoiceData): InvoiceData {
  const cleaned = { ...data }
  if (Array.isArray(cleaned.items)) {
    cleaned.items = cleaned.items.map((item: any) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      rate: Number(item.rate) || 0,
      discount: Number(item.discount) || 0,
    }))
  }
  return cleaned
}

async function generatePdfBlob(data: InvoiceData): Promise<Blob> {
  const cleaned = cleanDataForShare(data)
  const templates = await import("@/lib/pdf-templates")
  const docType = (cleaned.documentType || "").toLowerCase()
  const logoUrl = await resolveLogoUrl(cleaned.fromLogo)

  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    case "receipt": PdfComponent = templates.ReceiptPDF; break
    default: PdfComponent = (cleaned.design?.layout === "receipt" || cleaned.design?.templateId === "receipt")
      ? templates.ReceiptPDF
      : templates.InvoicePDF; break
  }

  return pdf(<PdfComponent data={cleaned} logoUrl={logoUrl} />).toBlob()
}

function getFileName(data: InvoiceData): string {
  const type = (data.documentType || "document").toLowerCase()
  const client = data.toName || "document"
  const safe = client.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 30)
  return `${type}-${safe}.pdf`
}

export function ShareButton({ data, className }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const hasContent = data.documentType || data.fromName || data.toName

  // Check native share support after mount (avoids hydration mismatch)
  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [])

  // Share as PDF — uses native share on supported devices, download fallback otherwise
  const handleSharePdf = useCallback(async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      const blob = await generatePdfBlob(data)
      const file = new File([blob], getFileName(data), { type: "application/pdf" })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${data.documentType || "Document"} — ${data.toName || ""}`.trim(),
          files: [file],
        })
        toast.success("Shared successfully")
      } else if (navigator.share) {
        await navigator.share({
          title: `${data.documentType || "Document"} for ${data.toName || "client"}`,
          text: `Here's your ${(data.documentType || "document").toLowerCase()} from ${data.fromName || "us"}.`,
        })
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = getFileName(data)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("PDF downloaded")
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Share error:", err)
        toast.error("Failed to share")
      }
    } finally {
      setIsSharing(false)
    }
  }, [data, isSharing])

  // Email share
  const handleEmailShare = useCallback(() => {
    const type = (data.documentType || "Document").toLowerCase()
    const client = data.toName || ""
    const from = data.fromName || ""
    const subject = encodeURIComponent(`${data.documentType || "Document"} from ${from}`.trim())
    const body = encodeURIComponent(`Hi ${client},\n\nPlease find the attached ${type}.\n\nBest regards,\n${from}`)
    window.location.href = `mailto:${data.toEmail || ""}?subject=${subject}&body=${body}`
  }, [data])

  // Copy summary
  const handleCopy = useCallback(async () => {
    const type = data.documentType || "Document"
    const lines = [
      `${type} from ${data.fromName || "—"}`,
      data.toName ? `To: ${data.toName}` : null,
      data.items?.length ? `Total: ${data.currency || "$"}${data.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0).toFixed(2)}` : null,
    ].filter(Boolean).join("\n")

    try {
      await navigator.clipboard.writeText(lines)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }, [data])

  if (!hasContent) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isSharing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm transition-all duration-200 disabled:opacity-50 ${className || ""}`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          <span className="sr-only sm:not-sr-only">Share</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-52 rounded-2xl p-1.5 shadow-xl border border-border/60"
        style={{ boxShadow: "0 8px 32px -4px rgba(0,0,0,0.14), 0 2px 8px -2px rgba(0,0,0,0.08)" }}
      >
        <DropdownMenuItem onClick={handleSharePdf} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          {canNativeShare
            ? <Share2 className="w-4 h-4 text-muted-foreground" />
            : <Download className="w-4 h-4 text-muted-foreground" />
          }
          <span>{canNativeShare ? "Share as PDF" : "Download PDF"}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmailShare} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span>Send via Email</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1 bg-border/50" />
        <DropdownMenuItem onClick={handleCopy} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          <span>{copied ? "Copied!" : "Copy Summary"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
