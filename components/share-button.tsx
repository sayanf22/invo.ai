"use client"

import { useState, useCallback, useEffect } from "react"
import { Share2, Copy, Check, Mail, Download, Loader2, MessageCircle, Link2, QrCode } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { pdf } from "@react-pdf/renderer"
import type { InvoiceData } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"

interface ShareButtonProps {
  data: InvoiceData
  className?: string
  sessionId?: string | null
  onOpenSendDialog?: () => void
}

async function generateQRDataUrl(url: string): Promise<string | null> {
  try {
    const QRCode = await import("qrcode")
    return await QRCode.default.toDataURL(url, {
      width: 200, margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    })
  } catch { return null }
}

async function generatePdfBlob(data: InvoiceData, paymentQrCode?: string | null): Promise<Blob> {
  const templates = await import("@/lib/pdf-templates")
  const docType = (data.documentType || "").toLowerCase()
  const logoUrl = await resolveLogoUrl(data.fromLogo)

  let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null; paymentQrCode?: string | null }>
  switch (docType) {
    case "contract": PdfComponent = templates.ContractPDF; break
    case "quotation": PdfComponent = templates.QuotationPDF; break
    case "proposal": PdfComponent = templates.ProposalPDF; break
    case "receipt": PdfComponent = templates.ReceiptPDF; break
    default: PdfComponent = (data.design?.layout === "receipt" || data.design?.templateId === "receipt")
      ? templates.ReceiptPDF : templates.InvoicePDF; break
  }

  return pdf(<PdfComponent data={data} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />).toBlob()
}

function getFileName(data: InvoiceData): string {
  const type = (data.documentType || "document").toLowerCase()
  const ref = data.invoiceNumber || data.referenceNumber || ""
  const client = data.toName || ""
  const safe = `${ref}-${client}`.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)
  return `${type}-${safe}.pdf`
}

export function ShareButton({ data, className, sessionId, onOpenSendDialog }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [canNativeShare, setCanNativeShare] = useState(false)

  const hasContent = data.documentType || data.fromName || data.toName
  const hasPaymentLink = !!data.paymentLink && data.paymentLinkStatus !== "paid" && data.paymentLinkStatus !== "expired" && data.paymentLinkStatus !== "cancelled"

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share)
  }, [])

  const copy = useCallback(async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      toast.success("Copied!")
      setTimeout(() => setCopied(null), 2000)
    } catch { toast.error("Failed to copy") }
  }, [])

  // Build the WhatsApp / share message
  const buildMessage = useCallback(() => {
    const type = (data.documentType || "Invoice").charAt(0).toUpperCase() + (data.documentType || "invoice").slice(1)
    const ref = data.invoiceNumber || data.referenceNumber || type
    const total = data.items?.reduce((s, i) => s + i.quantity * i.rate, 0) ?? 0
    const currency = data.currency || "INR"
    const lines = [
      `Hi ${data.toName || ""},`,
      ``,
      `Please find your ${type} ${ref} for ${currency} ${total.toFixed(2)}.`,
    ]
    if (hasPaymentLink && data.paymentLink) {
      lines.push(``, `Pay here: ${data.paymentLink}`)
    }
    lines.push(``, `Thank you,`, data.fromName || "")
    return lines.join("\n")
  }, [data, hasPaymentLink])

  // Share PDF (with QR embedded if payment link exists)
  const handleSharePdf = useCallback(async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      let qr: string | null = null
      if (hasPaymentLink && data.paymentLink) {
        qr = await generateQRDataUrl(data.paymentLink)
      }
      const blob = await generatePdfBlob(data, qr)
      const file = new File([blob], getFileName(data), { type: "application/pdf" })

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: data.invoiceNumber || "Document", files: [file] })
        toast.success("Shared!")
      } else if (navigator.share) {
        await navigator.share({
          title: `${data.documentType || "Document"} for ${data.toName || "client"}`,
          text: buildMessage(),
        })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url; a.download = getFileName(data)
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
        toast.success("PDF downloaded")
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Failed to share")
    } finally {
      setIsSharing(false)
    }
  }, [data, isSharing, hasPaymentLink, buildMessage])

  const handleWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildMessage())}`, "_blank")
  }, [buildMessage])

  const handleEmail = useCallback(() => {
    const type = data.documentType || "Document"
    const ref = data.invoiceNumber || data.referenceNumber || type
    const subject = encodeURIComponent(`${type} ${ref} from ${data.fromName || ""}`.trim())
    const body = encodeURIComponent(buildMessage())
    window.location.href = `mailto:${data.toEmail || ""}?subject=${subject}&body=${body}`
  }, [data, buildMessage])

  if (!hasContent) return null

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isSharing}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium border border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm transition-colors disabled:opacity-50 outline-none focus-visible:ring-0 ${className || ""}`}
          style={{ WebkitTapHighlightColor: "transparent", minWidth: "max-content" }}
        >
          {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
          <span className="sr-only sm:not-sr-only">Share</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 rounded-2xl p-1.5 shadow-xl border border-border/60"
        style={{ boxShadow: "0 8px 32px -4px rgba(0,0,0,0.14), 0 2px 8px -2px rgba(0,0,0,0.08)" }}
      >
        {/* PDF sharing */}
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
          Share Document
        </DropdownMenuLabel>
        {sessionId && onOpenSendDialog && (
          <DropdownMenuItem onClick={onOpenSendDialog} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
            <Mail className="w-4 h-4 text-primary" />
            <span>Send via Clorefy Email</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSharePdf} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          {canNativeShare
            ? <Share2 className="w-4 h-4 text-muted-foreground" />
            : <Download className="w-4 h-4 text-muted-foreground" />
          }
          <span>{canNativeShare ? "Share as PDF" : "Download PDF"}</span>
          {hasPaymentLink && <span className="ml-auto text-[10px] text-muted-foreground">+ QR</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span>Open in Email App</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
          <span>Send via WhatsApp</span>
        </DropdownMenuItem>

        {/* Payment link section */}
        {hasPaymentLink && data.paymentLink && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/50" />
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
              Payment Link
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => copy(data.paymentLink!, "link")}
              className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
            >
              {copied === "link" ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4 text-muted-foreground" />}
              <span>{copied === "link" ? "Copied!" : "Copy Payment Link"}</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-border/50" />
        <DropdownMenuItem
          onClick={() => copy(buildMessage(), "msg")}
          className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
        >
          {copied === "msg" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          <span>{copied === "msg" ? "Copied!" : "Copy Message"}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
