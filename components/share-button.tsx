"use client"

import { useState, useCallback } from "react"
import { Share2, Copy, Check, Mail, Link2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  let PdfComponent: React.ComponentType<{ data: InvoiceData }>
  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    default: PdfComponent = templates.InvoicePDF; break
  }

  return pdf(<PdfComponent data={cleaned} />).toBlob()
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

  const hasContent = data.documentType || data.fromName || data.toName

  // Native share (mobile) — shares the PDF file directly
  const handleNativeShare = useCallback(async () => {
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
      } else if (navigator.share) {
        // Fallback: share without file (just text)
        await navigator.share({
          title: `${data.documentType || "Document"} for ${data.toName || "client"}`,
          text: `Here's your ${(data.documentType || "document").toLowerCase()} from ${data.fromName || "us"}.`,
        })
      } else {
        // Desktop fallback: download the file
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = getFileName(data)
        a.click()
        URL.revokeObjectURL(url)
        toast.success("PDF downloaded — share it from your files")
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        toast.error("Failed to share document")
      }
    } finally {
      setIsSharing(false)
    }
  }, [data, isSharing])

  // Email share — opens mailto with subject
  const handleEmailShare = useCallback(async () => {
    const type = (data.documentType || "Document").toLowerCase()
    const client = data.toName || "client"
    const from = data.fromName || ""
    const subject = encodeURIComponent(`${data.documentType || "Document"} from ${from}`.trim())
    const body = encodeURIComponent(`Hi ${client},\n\nPlease find the attached ${type}.\n\nBest regards,\n${from}`)
    window.open(`mailto:${data.toEmail || ""}?subject=${subject}&body=${body}`, "_self")
  }, [data])

  // Copy document summary to clipboard
  const handleCopyLink = useCallback(async () => {
    const type = data.documentType || "Document"
    const summary = [
      `${type} from ${data.fromName || "—"}`,
      data.toName ? `To: ${data.toName}` : null,
      data.total ? `Total: ${data.currency || "$"}${data.total}` : null,
    ].filter(Boolean).join("\n")

    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      toast.success("Document summary copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }, [data])

  if (!hasContent) return null

  // On mobile, use native share directly (no dropdown)
  const isMobile = typeof window !== "undefined" && "ontouchstart" in window

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={handleNativeShare}
        disabled={isSharing}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm transition-all duration-200 active:scale-95 ${className || ""}`}
      >
        {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        <span className="hidden sm:inline">Share</span>
      </button>
    )
  }

  // Desktop: dropdown with options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm transition-all duration-200 active:scale-95 ${className || ""}`}
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden lg:inline">Share</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg">
        <DropdownMenuItem onClick={handleNativeShare} className="gap-3 py-2.5 rounded-lg cursor-pointer">
          <Share2 className="w-4 h-4 text-muted-foreground" />
          <span>Share as PDF</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmailShare} className="gap-3 py-2.5 rounded-lg cursor-pointer">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span>Send via Email</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopyLink} className="gap-3 py-2.5 rounded-lg cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          <span>{copied ? "Copied!" : "Copy Summary"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
