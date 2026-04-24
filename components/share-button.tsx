"use client"

import { useState, useCallback, useEffect } from "react"
import { Share2, Copy, Check, Mail, Download, Loader2, MessageCircle, Link2, Bell, BellOff, Calendar, X, Trash2 } from "lucide-react"
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
import { authFetch } from "@/lib/auth-fetch"
import { cn } from "@/lib/utils"

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
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)
  const [schedules, setSchedules] = useState<Array<{
    id: string
    sequence_step: number
    sequence_type: string
    scheduled_for: string
    status: string
  }>>([])
  const [loadingSchedules, setLoadingSchedules] = useState(false)
  const [cancellingAll, setCancellingAll] = useState(false)

  const loadSchedules = useCallback(async () => {
    if (!sessionId) return
    setLoadingSchedules(true)
    try {
      const res = await authFetch(`/api/emails/schedules?sessionId=${sessionId}`)
      if (res.ok) {
        const d = await res.json()
        setSchedules((d.schedules || []).filter((s: any) => s.status === "pending"))
      }
    } catch { /* ignore */ }
    finally { setLoadingSchedules(false) }
  }, [sessionId])

  const cancelAllSchedules = async () => {
    if (!sessionId) return
    setCancellingAll(true)
    try {
      const res = await authFetch(`/api/emails/schedules?sessionId=${sessionId}`, { method: "DELETE" })
      if (res.ok) {
        setSchedules([])
        toast.success("All scheduled reminders cancelled")
      } else {
        toast.error("Failed to cancel reminders")
      }
    } catch { toast.error("Failed to cancel reminders") }
    finally { setCancellingAll(false) }
  }

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

  // Share PDF (with QR embedded if payment link exists and enabled)
  const handleSharePdf = useCallback(async () => {
    if (isSharing) return
    setIsSharing(true)
    try {
      let qr: string | null = null
      const shouldEmbedPaymentLink = data.showPaymentLinkInPdf !== false
      if (hasPaymentLink && data.paymentLink && shouldEmbedPaymentLink) {
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
    <>
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
            <span>Send via Email</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleSharePdf} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          {canNativeShare
            ? <Share2 className="w-4 h-4 text-muted-foreground" />
            : <Download className="w-4 h-4 text-muted-foreground" />
          }
          <span>{canNativeShare ? "Share as PDF" : "Download PDF"}</span>
          {hasPaymentLink && data.showPaymentLinkInPdf !== false && <span className="ml-auto text-[10px] text-muted-foreground">+ QR</span>}
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

        {/* Manage Reminders — only when sessionId exists */}
        {sessionId && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/50" />
            <DropdownMenuItem
              onClick={() => { loadSchedules(); setShowSchedulePanel(true) }}
              className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              <span>Manage Reminders</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Schedule Panel Modal */}
    {showSchedulePanel && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSchedulePanel(false)} />
        <div className="relative w-full sm:max-w-md bg-card border border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl max-h-[80dvh]">
          {/* Mobile handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">Scheduled Reminders</h2>
            </div>
            <button type="button" onClick={() => setShowSchedulePanel(false)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
            {loadingSchedules ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <BellOff className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No pending reminders</p>
                <p className="text-xs text-muted-foreground/60">Reminders are scheduled when you send an invoice</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {schedules.length} reminder{schedules.length !== 1 ? "s" : ""} scheduled. They stop automatically when payment is received.
                </p>
                <div className="space-y-2">
                  {schedules.map(s => {
                    const date = new Date(s.scheduled_for)
                    const label = s.sequence_type === "final" ? "Final notice" :
                                  s.sequence_type === "followup" ? `Reminder #${s.sequence_step - 1}` :
                                  "Reminder"
                    return (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-foreground">{label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Pending
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {schedules.length > 0 && (
            <div className="shrink-0 px-5 py-4 border-t border-border/50">
              <button
                type="button"
                onClick={cancelAllSchedules}
                disabled={cancellingAll}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
              >
                {cancellingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {cancellingAll ? "Cancelling..." : "Cancel All Reminders"}
              </button>
            </div>
          )}
        </div>
      </div>
    )}
  )
}
