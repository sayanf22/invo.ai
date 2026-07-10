"use client"

import { useState, useCallback, useEffect } from "react"
import { Share2, Copy, Check, Mail, Download, Loader2, MessageCircle, Link2, Bell, BellOff, Calendar, X, Trash2, Lock, ArrowRight, AlertTriangle } from "lucide-react"
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
import { resolvePdfComponent, resolveDocumentReference } from "@/lib/pdf-export-helpers"
import { ChatAssetLinkCard } from "@/components/chat-asset-link-card"

interface ShareButtonProps {
  data: InvoiceData
  className?: string
  sessionId?: string | null
  onOpenSendDialog?: () => void
  signingUrl?: string | null
  /**
   * Current document session status. Drives the lock-on-share confirm flow:
   *  - When the session is in a non-locked state (draft / active / cancelled,
   *    or active+sent_at after an unlock-from-chat), every share action shows
   *    a "Lock & Share" confirmation that finalizes the session before the
   *    share happens. This prevents accidentally re-sharing a stale link
   *    after cancel/unlock.
   *  - When the session is already finalized / signed / paid, share actions
   *    fire immediately. Once a recipient has a live document, the owner
   *    doesn't need to reconfirm each subsequent share. (Same UX DocuSign
   *    and Adobe Sign use after first send.)
   */
  documentStatus?: string
  /**
   * Persists an asset-upload link into the session context. Used only for
   * onboarding forms: before sending, the owner is offered an optional link
   * where the client uploads assets. Passing the full-context save keeps the
   * behavior identical to the chat pre-send step.
   */
  onSaveAssetLink?: (link: string) => void | Promise<void>
}

/** Statuses where the document is "locked" — share is safe to fire immediately. */
const LOCKED_STATUSES = new Set(["finalized", "signed", "paid"])

/** Possible share actions that go through the lock-confirm gate. */
type PendingShareAction =
  | "send-email-dialog"
  | "share-pdf"
  | "open-mail-app"
  | "whatsapp"
  | "copy-message"
  | "copy-payment-link"

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

  const PdfComponent = resolvePdfComponent(templates, docType, data) as React.ComponentType<{
    data: InvoiceData
    logoUrl?: string | null
    paymentQrCode?: string | null
  }>

  return pdf(<PdfComponent data={data} logoUrl={logoUrl} paymentQrCode={paymentQrCode} />).toBlob()
}

function getFileName(data: InvoiceData): string {
  const type = (data.documentType || "document").toLowerCase()
  const ref = resolveDocumentReference(data, type) || ""
  const client = data.toName || ""
  const safe = `${ref}-${client}`.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40)
  return `${type}-${safe}.pdf`
}

export function ShareButton({ data, className, sessionId, onOpenSendDialog, signingUrl, documentStatus = "", onSaveAssetLink }: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [showSchedulePanel, setShowSchedulePanel] = useState(false)
  // Onboarding pre-send asset-link step — shown before any share action for
  // client onboarding forms (which are always sent as a fillable link).
  const [showAssetLinkStep, setShowAssetLinkStep] = useState(false)
  const [savingAssetLink, setSavingAssetLink] = useState(false)
  // Lock-on-share confirm state — null when no confirm is pending.
  const [pendingShareAction, setPendingShareAction] = useState<PendingShareAction | null>(null)
  const [isLocking, setIsLocking] = useState(false)
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

  // Client onboarding forms are always sent as a tokenized fillable link via the
  // send dialog (never a static PDF/WhatsApp share). For these, every share
  // option first collects an optional asset-upload link, then routes to the
  // real send screen. Only active when a send dialog is wired up.
  const isOnboardingForm =
    (data.documentType || "").toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form"
  const useOnboardingShareFlow = isOnboardingForm && !!onOpenSendDialog

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

  // ── Lock-on-share decision ──────────────────────────────────────────
  // The doc is "locked" — and therefore share actions can fire immediately —
  // when it's in a finalized/signed/paid state. Otherwise (draft, active,
  // active+sent_at-after-unlock, or cancelled) the share should be gated
  // through a "Lock & Share" confirmation that calls /api/sessions/finalize
  // before the share action happens. We require a sessionId for any locking
  // to be possible — pure drafts without a session just share the PDF text.
  const isLocked = LOCKED_STATUSES.has((documentStatus || "").toLowerCase())
  const requiresLockConfirm = !!sessionId && !isLocked

  // Was this document previously cancelled or unlocked? Surfaced in the
  // confirm copy so the owner knows the previous link will be voided.
  const wasPreviouslyShared = (() => {
    const s = (documentStatus || "").toLowerCase()
    return s === "cancelled" || s === "active" // heuristic: active w/ sent_at lives here
  })()

  // Server-side lock — flips status to "finalized" and stamps sent_at.
  // Idempotent for already-finalized docs (the API blocks paid/signed).
  const lockSession = async (): Promise<boolean> => {
    if (!sessionId) return true // nothing to lock
    setIsLocking(true)
    try {
      const res = await authFetch("/api/sessions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body?.error || "Could not lock the document")
        return false
      }
      return true
    } catch {
      toast.error("Network error — could not lock the document")
      return false
    } finally {
      setIsLocking(false)
    }
  }

  // Compute the public document link for this session.
  // Convention used across the app: ${origin}/d/<first-8-chars-of-uuid>
  // The middleware resolves /d/<shortId> to /pay/<full-id> so recipients
  // see the right status-aware page (active doc / cancelled / signed).
  // We only emit the link when the document has an actual session — drafts
  // don't get a recipient URL because there's nothing to share yet.
  const platformLink = (() => {
    if (!sessionId) return null
    if (typeof window === "undefined") return null
    const shortId = sessionId.split("-")[0]
    return `${window.location.origin}/d/${shortId}`
  })()

  // Build the WhatsApp / share message
  const buildMessage = useCallback(() => {
    const docType = (data.documentType || "Invoice")
    const type = docType.charAt(0).toUpperCase() + docType.slice(1)
    const isContract = docType.toLowerCase() === "contract"
    const isProposal = docType.toLowerCase() === "proposal"
    const isQuotation = docType.toLowerCase() === "quotation" || docType.toLowerCase() === "quote"

    // Use correct reference number — contracts/proposals use referenceNumber, not invoiceNumber
    const ref = (isContract || isProposal || isQuotation)
      ? (data.referenceNumber || data.invoiceNumber || type)
      : (data.invoiceNumber || data.referenceNumber || type)

    const lines = [
      `Hi ${data.toName || ""},`,
      ``,
      `${data.fromName || "We"} ${isContract ? "has sent you a contract for review and signature" : isProposal ? "has sent you a proposal" : isQuotation ? "has sent you a quotation" : "has sent you an invoice"}.`,
    ]

    if (ref) {
      lines.push(`Reference: ${ref}`)
    }

    // For invoices/quotations with amount, show it
    if (!isContract && !isProposal) {
      const total = data.items?.reduce((s, i) => s + i.quantity * i.rate, 0) ?? 0
      if (total > 0) {
        const currency = data.currency || "INR"
        lines.push(`Amount: ${currency} ${total.toFixed(2)}`)
      }
    }

    // Always include the document link when we have a session.
    // Phrasing adapts to the document type so the recipient knows what to do.
    if (platformLink) {
      const verb = isContract
        ? "Review and sign"
        : isProposal
        ? "View proposal"
        : isQuotation
        ? "View quotation"
        : "View invoice"
      lines.push(``, `${verb}: ${platformLink}`)
    }

    if (hasPaymentLink && data.paymentLink) {
      lines.push(``, `Pay here: ${data.paymentLink}`)
    }

    // Explicit signing URL (from <GetSignatureModal>) takes precedence over the
    // generic /d/ link for signature flows when both are available.
    if (signingUrl) {
      lines.push(``, `Sign here: ${signingUrl}`)
    }

    lines.push(``, `Thank you,`, data.fromName || "")
    return lines.join("\n")
  }, [data, hasPaymentLink, platformLink, signingUrl])

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

  // ── Share-action executor ──────────────────────────────────────────
  // Runs the actual share once the lock (if any) succeeded. Each branch
  // mirrors the original direct handlers below; this single executor lets
  // us share one confirm dialog across every menu option.
  const executeShareAction = useCallback(async (action: PendingShareAction) => {
    switch (action) {
      case "send-email-dialog":
        onOpenSendDialog?.()
        return
      case "share-pdf":
        await handleSharePdf()
        return
      case "open-mail-app":
        handleEmail()
        return
      case "whatsapp":
        handleWhatsApp()
        return
      case "copy-message":
        await copy(buildMessage(), "msg")
        return
      case "copy-payment-link":
        if (data.paymentLink) await copy(data.paymentLink, "link")
        return
    }
  }, [onOpenSendDialog, handleSharePdf, handleEmail, handleWhatsApp, copy, buildMessage, data.paymentLink])

  // Gate every share menu click. If the doc is unlocked, defer to the
  // confirm dialog. If already locked, fire immediately.
  const requestShare = useCallback(
    async (action: PendingShareAction) => {
      // Onboarding forms: any share option funnels through the asset-link step,
      // then the real send screen. The payment-link copy (which never applies
      // to onboarding) is left untouched for safety.
      if (useOnboardingShareFlow && action !== "copy-payment-link") {
        // Once sent, an onboarding form is locked. To send it again the owner
        // must cancel it first (invalidating the old fill link), then resend.
        if (isLocked) {
          toast.info("This form has already been sent. Cancel it first to send again.")
          return
        }
        setShowAssetLinkStep(true)
        return
      }
      if (requiresLockConfirm) {
        setPendingShareAction(action)
        return
      }
      await executeShareAction(action)
    },
    [useOnboardingShareFlow, isLocked, requiresLockConfirm, executeShareAction]
  )

  // Continue/skip from the onboarding asset-link step → open the send screen.
  const proceedToOnboardingSend = useCallback(async (link: string | null) => {
    if (link) {
      setSavingAssetLink(true)
      try { await onSaveAssetLink?.(link) } catch { /* non-fatal */ } finally { setSavingAssetLink(false) }
    }
    setShowAssetLinkStep(false)
    onOpenSendDialog?.()
  }, [onSaveAssetLink, onOpenSendDialog])

  // Confirm handler — locks then runs the action.
  const confirmShareAction = useCallback(async () => {
    if (!pendingShareAction) return
    const action = pendingShareAction
    const ok = await lockSession()
    if (!ok) return
    setPendingShareAction(null)
    await executeShareAction(action)
  }, [pendingShareAction, executeShareAction]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {/* Onboarding forms that are already sent: show only the fillable link
            — all send options are disabled. The owner must cancel to resend. */}
        {useOnboardingShareFlow && isLocked ? (
          <>
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
              Onboarding Form Sent
            </DropdownMenuLabel>
            <div className="px-3 py-2">
              <p className="text-[11px] text-muted-foreground mb-2">This form has been sent. Cancel to resend.</p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { authFetch } = await import("@/lib/auth-fetch")
                    const res = await authFetch(`/api/onboarding?sessionId=${sessionId}`)
                    const d = await res.json().catch(() => ({}))
                    if (res.ok && d.onboardUrl) {
                      await navigator.clipboard.writeText(d.onboardUrl)
                      toast.success("Form link copied!")
                    } else {
                      toast.error("No active link found")
                    }
                  } catch { toast.error("Failed to copy link") }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/40 border border-border/30 hover:bg-muted/60 transition-colors"
              >
                <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-foreground font-medium truncate flex-1 text-left">Copy form link</span>
              </button>
            </div>
          </>
        ) : (
        <>
        {/* PDF sharing */}
        <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 py-1">
          Share Document
        </DropdownMenuLabel>
        {sessionId && onOpenSendDialog && (
          <DropdownMenuItem onClick={() => requestShare("send-email-dialog")} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
            <Mail className="w-4 h-4 text-primary" />
            <span>Send via Clorefy Email</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => requestShare("share-pdf")} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          {canNativeShare
            ? <Share2 className="w-4 h-4 text-muted-foreground" />
            : <Download className="w-4 h-4 text-muted-foreground" />
          }
          <span>{canNativeShare ? "Share as PDF" : "Download PDF"}</span>
          {hasPaymentLink && data.showPaymentLinkInPdf !== false && <span className="ml-auto text-[10px] text-muted-foreground">+ QR</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => requestShare("open-mail-app")} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
          <Mail className="w-4 h-4 text-muted-foreground" />
          <span>Open in Email App</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => requestShare("whatsapp")} className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium">
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
              onClick={() => requestShare("copy-payment-link")}
              className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
            >
              {copied === "link" ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4 text-muted-foreground" />}
              <span>{copied === "link" ? "Copied!" : "Copy Payment Link"}</span>
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator className="my-1 bg-border/50" />
        <DropdownMenuItem
          onClick={() => requestShare("copy-message")}
          className="gap-3 py-2.5 px-3 rounded-xl cursor-pointer text-sm font-medium"
        >
          {copied === "msg" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
          <span>{copied === "msg" ? "Copied!" : "Copy Message"}</span>
        </DropdownMenuItem>

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
    {/* ── Onboarding asset-link step ──────────────────────────────────
        For client onboarding forms, every share option first offers an
        optional link where the client uploads assets, then routes to the
        real send screen. Mirrors the chat pre-send card. */}
    {showAssetLinkStep && (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !savingAssetLink && setShowAssetLinkStep(false)}
        />
        <div className="relative w-full sm:w-auto flex justify-center pb-4 sm:pb-0">
          <ChatAssetLinkCard
            initialLink={data.assetUploadLink || ""}
            onDismiss={() => setShowAssetLinkStep(false)}
            onSkip={() => proceedToOnboardingSend(null)}
            onContinue={(link) => proceedToOnboardingSend(link)}
          />
        </div>
      </div>
    )}
    {/* ── Lock & Share confirmation modal ─────────────────────────────
        Shown for any share menu click while the doc is unlocked. Calling
        /api/sessions/finalize stamps sent_at and flips status → finalized
        before the share happens, so cancellation/unlock cycles produce a
        clean lifecycle transition (not a stale link reshare). */}
    {pendingShareAction && (
      <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => !isLocking && setPendingShareAction(null)}
        />
        <div className="relative w-full sm:max-w-md bg-card border border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl">
          {/* Mobile handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Body */}
          <div className="px-5 pt-3 pb-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Lock & Share</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  This will lock the document and share it via{" "}
                  <span className="font-medium text-foreground">
                    {pendingShareAction === "send-email-dialog" && "Clorefy Email"}
                    {pendingShareAction === "share-pdf" && (canNativeShare ? "PDF share" : "PDF download")}
                    {pendingShareAction === "open-mail-app" && "your email app"}
                    {pendingShareAction === "whatsapp" && "WhatsApp"}
                    {pendingShareAction === "copy-message" && "the clipboard"}
                    {pendingShareAction === "copy-payment-link" && "the clipboard"}
                  </span>
                  . You won&apos;t be able to edit it after sharing.
                </p>
              </div>
            </div>

            {wasPreviouslyShared && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  This document was previously cancelled or unlocked. Sharing now creates a fresh send — older links to recipients stay expired.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingShareAction(null)}
                disabled={isLocking}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border/60 bg-background hover:bg-muted/40 transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmShareAction}
                disabled={isLocking}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-60 active:scale-[0.98]"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)" }}
              >
                {isLocking ? (
                  <span className="w-3.5 h-3.5 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
                {isLocking ? "Locking..." : "Confirm & Share"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
