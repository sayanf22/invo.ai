"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mail, Loader2, X, Send, Sparkles, RefreshCw, AlertTriangle, Lock } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import type { InvoiceData } from "@/lib/invoice-types"
import { cn } from "@/lib/utils"

interface SendEmailDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string
  invoiceData: InvoiceData
  documentType: string
  defaultEmail?: string
  onEmailSent?: () => void
}

type Step = "compose" | "confirm"

function generateSubject(invoiceData: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const sender = invoiceData.fromName?.trim() || ""
  return [docLabel, ref, sender ? `from ${sender}` : ""].filter(Boolean).join(" ")
}

function calcTotal(invoiceData: InvoiceData): { formatted: string; raw: number } {
  const subtotal = invoiceData.items?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const disc = Number(item.discount) || 0
    return sum + qty * rate * (1 - disc / 100)
  }, 0) ?? 0
  const taxRate = Number(invoiceData.taxRate) || 0
  const discountValue = Number(invoiceData.discountValue) || 0
  const shippingFee = Number(invoiceData.shippingFee) || 0
  const discountAmount = invoiceData.discountType === "percent"
    ? subtotal * (discountValue / 100)
    : discountValue
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
  const raw = subtotal - discountAmount + taxAmount + shippingFee
  const currency = invoiceData.currency || "USD"
  let formatted = ""
  if (raw > 0) {
    try {
      formatted = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(raw)
    } catch {
      formatted = `${currency} ${raw.toFixed(2)}`
    }
  }
  return { formatted, raw }
}

export function SendEmailDialog({
  open,
  onClose,
  sessionId,
  invoiceData,
  documentType,
  defaultEmail,
  onEmailSent,
}: SendEmailDialogProps) {
  const [step, setStep] = useState<Step>("compose")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const generateMessage = useCallback(async () => {
    setIsGenerating(true)
    setMessage("")
    try {
      const { formatted } = calcTotal(invoiceData)
      const res = await authFetch("/api/emails/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          clientName: invoiceData.toName || "",
          senderName: invoiceData.fromName || "",
          referenceNumber: invoiceData.invoiceNumber || invoiceData.referenceNumber || "",
          totalAmount: formatted || "",
          currency: invoiceData.currency || "",
          dueDate: invoiceData.dueDate || "",
          description: invoiceData.description || "",
          items: invoiceData.items?.slice(0, 5) || [],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessage(data.message || "")
      } else {
        // Fallback to local template if API fails
        setMessage(localFallback(invoiceData, documentType))
      }
    } catch {
      setMessage(localFallback(invoiceData, documentType))
    } finally {
      setIsGenerating(false)
    }
  }, [invoiceData, documentType])

  // Reset and populate when dialog opens
  useEffect(() => {
    if (open) {
      setStep("compose")
      setEmail(defaultEmail || invoiceData.toEmail || "")
      setSubject(generateSubject(invoiceData, documentType))
      generateMessage()
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus email input when dialog opens
  useEffect(() => {
    if (open && step === "compose") {
      const timer = setTimeout(() => emailInputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open, step])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) {
        if (step === "confirm") setStep("compose")
        else onClose()
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, isSending, step, onClose])

  if (!open) return null

  const docTypeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canProceed = isEmailValid && !isGenerating && subject.trim().length > 0

  const handleSend = async () => {
    if (isSending) return
    setIsSending(true)
    try {
      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: email.trim(),
          subject: subject.trim() || undefined,
          personalMessage: message.trim() || undefined,
        }),
      })

      if (res.ok) {
        onClose()
        toast.success(`${docTypeLabel} sent to ${email.trim()}`)
        onEmailSent?.()
      } else {
        let errorMessage = "Failed to send email"
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch { /* ignore */ }
        toast.error(errorMessage)
        setStep("compose")
      }
    } catch {
      toast.error("Network error. Please check your connection.")
      setStep("compose")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSending && (step === "confirm" ? setStep("compose") : onClose())}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-title"
        className={cn(
          "relative w-full bg-card border border-border shadow-2xl flex flex-col",
          "rounded-t-3xl max-h-[92dvh]",
          "sm:rounded-3xl sm:max-w-lg sm:max-h-[88dvh]"
        )}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* ── STEP 1: COMPOSE ── */}
        {step === "compose" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <h2 id="send-email-title" className="text-base font-semibold text-foreground">
                  Send {docTypeLabel}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0">

              {/* To */}
              <div className="space-y-1.5">
                <label htmlFor="email-to" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  To
                </label>
                <input
                  ref={emailInputRef}
                  id="email-to"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="client@example.com"
                  className={cn(
                    "w-full px-3.5 py-2.5 rounded-xl text-sm bg-background border border-border",
                    "placeholder:text-muted-foreground text-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors",
                    email.length > 0 && !isEmailValid && "border-red-400 focus:ring-red-400/40"
                  )}
                />
                {email.length > 0 && !isEmailValid && (
                  <p className="text-xs text-red-500">Enter a valid email address</p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label htmlFor="email-subject" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Subject
                </label>
                <input
                  id="email-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-background border border-border placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors"
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="email-message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Message
                  </label>
                  <button
                    type="button"
                    onClick={generateMessage}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
                  >
                    {isGenerating
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <RefreshCw className="w-3 h-3" />
                    }
                    {isGenerating ? "Writing..." : "Regenerate"}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 w-fit">
                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[11px] font-medium text-primary">AI-written by DeepSeek · edit freely</span>
                </div>

                <div className="relative">
                  {isGenerating && (
                    <div className="absolute inset-0 rounded-xl bg-background/70 backdrop-blur-[2px] flex items-center justify-center z-10 pointer-events-none">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card px-3 py-2 rounded-lg border border-border shadow-sm">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        Writing your message...
                      </div>
                    </div>
                  )}
                  <textarea
                    id="email-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isGenerating}
                    rows={10}
                    placeholder="Your message will appear here..."
                    className={cn(
                      "w-full px-3.5 py-3 rounded-xl text-sm resize-none leading-relaxed",
                      "bg-background border border-border",
                      "placeholder:text-muted-foreground text-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors",
                      "disabled:opacity-60 font-[inherit]"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep("confirm")}
                disabled={!canProceed}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2",
                  "py-2.5 px-4 rounded-xl text-sm font-semibold",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <Send className="w-4 h-4" />
                Review & Send
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: CONFIRM ── */}
        {step === "confirm" && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 id="send-email-title" className="text-base font-semibold text-foreground">
                  Confirm Send
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStep("compose")}
                disabled={isSending}
                aria-label="Back"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Confirm body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4 min-h-0">

              {/* Lock warning */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Document will be locked after sending
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Once sent, this {documentType.toLowerCase()} cannot be edited. This prevents fraud and ensures your client receives the exact document you approved. You can still view and download it.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sending to</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{email}</p>
                </div>
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">{subject}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message preview</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed whitespace-pre-line">
                    {message.slice(0, 150)}{message.length > 150 ? "..." : ""}
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep("compose")}
                disabled={isSending}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2",
                  "py-2.5 px-4 rounded-xl text-sm font-semibold",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                ) : (
                  <><Send className="w-4 h-4" />Send & Lock</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Local fallback if DeepSeek API is unavailable ──────────────────────────────
function localFallback(invoiceData: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const clientName = invoiceData.toName?.trim() || ""
  const senderName = invoiceData.fromName?.trim() || "our team"
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const refText = ref ? ` ${ref}` : ""
  const { formatted } = calcTotal(invoiceData)
  const greeting = clientName ? `Hi ${clientName},` : "Hi,"
  const dueText = invoiceData.dueDate ? ` due on ${invoiceData.dueDate}` : ""

  switch (documentType.toLowerCase()) {
    case "invoice":
      return `${greeting}

Please find your invoice${refText}${formatted ? ` for ${formatted}` : ""}${dueText} attached.

Kindly review the details and process the payment at your earliest convenience. Please don't hesitate to reach out if you have any questions.

Thank you for your business.

Best regards,
${senderName}`
    case "quotation":
      return `${greeting}

Please find your quotation${refText}${formatted ? ` totalling ${formatted}` : ""} attached.

This quote is valid for 30 days. Let us know if you'd like to proceed or have any questions.

Best regards,
${senderName}`
    case "contract":
      return `${greeting}

Please find the contract${refText} attached for your review.

Kindly review the terms and sign at your earliest convenience. Feel free to reach out with any questions.

Best regards,
${senderName}`
    default:
      return `${greeting}

Please find the ${docLabel.toLowerCase()}${refText} attached for your review.

Feel free to reach out if you have any questions.

Best regards,
${senderName}`
  }
}
