"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mail, Loader2, X, Send, Sparkles, RefreshCw } from "lucide-react"
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

// Generate a professional AI message based on document context
function generateAIMessage(invoiceData: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const clientName = invoiceData.toName?.trim() || ""
  const senderName = invoiceData.fromName?.trim() || "our team"
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const refText = ref ? ` (${ref})` : ""

  // Calculate total for invoices/quotations
  const total = invoiceData.items?.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const disc = Number(item.discount) || 0
    return sum + qty * rate * (1 - disc / 100)
  }, 0) ?? 0
  const taxRate = Number(invoiceData.taxRate) || 0
  const discountValue = Number(invoiceData.discountValue) || 0
  const shippingFee = Number(invoiceData.shippingFee) || 0
  const discountAmount = invoiceData.discountType === "percent"
    ? total * (discountValue / 100)
    : discountValue
  const taxAmount = (total - discountAmount) * (taxRate / 100)
  const grandTotal = total - discountAmount + taxAmount + shippingFee

  const currency = invoiceData.currency || "USD"
  const formattedTotal = grandTotal > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(grandTotal)
    : ""

  const greeting = clientName ? `Hi ${clientName},` : "Hi,"
  const dueDate = invoiceData.dueDate ? ` due on ${invoiceData.dueDate}` : ""

  switch (documentType.toLowerCase()) {
    case "invoice":
      return `${greeting}

Please find attached your invoice${refText}${formattedTotal ? ` for ${formattedTotal}` : ""}${dueDate}.

Kindly review the details and process the payment at your earliest convenience. If you have any questions or need clarification, please don't hesitate to reach out.

Thank you for your business — we truly appreciate it.

Warm regards,
${senderName}`

    case "quotation":
      return `${greeting}

Please find attached your quotation${refText}${formattedTotal ? ` totalling ${formattedTotal}` : ""}.

This quote is valid for 30 days. Please review the details and let us know if you'd like to proceed or if you have any questions.

We look forward to working with you.

Best regards,
${senderName}`

    case "contract":
      return `${greeting}

Please find attached the contract${refText} for your review.

Kindly go through the terms and conditions carefully. Once you're satisfied, please sign and return a copy at your earliest convenience.

Feel free to reach out if you have any questions or require any amendments.

Best regards,
${senderName}`

    case "proposal":
      return `${greeting}

Please find attached our proposal${refText} for your consideration.

We've tailored this proposal to address your specific needs. We'd love the opportunity to discuss it further and answer any questions you may have.

Looking forward to your feedback.

Best regards,
${senderName}`

    default:
      return `${greeting}

Please find the attached document${refText} for your review.

Feel free to reach out if you have any questions.

Best regards,
${senderName}`
  }
}

function generateSubject(invoiceData: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const sender = invoiceData.fromName?.trim() || ""
  const refPart = ref ? ` ${ref}` : ""
  const fromPart = sender ? ` from ${sender}` : ""
  return `${docLabel}${refPart}${fromPart}`
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
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const regenerateMessage = useCallback(() => {
    setIsGenerating(true)
    // Small delay for UX feedback
    setTimeout(() => {
      setMessage(generateAIMessage(invoiceData, documentType))
      setIsGenerating(false)
    }, 400)
  }, [invoiceData, documentType])

  // Reset and populate when dialog opens
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || invoiceData.toEmail || "")
      setSubject(generateSubject(invoiceData, documentType))
      setIsGenerating(true)
      setTimeout(() => {
        setMessage(generateAIMessage(invoiceData, documentType))
        setIsGenerating(false)
      }, 300)
    }
  }, [open, defaultEmail, invoiceData, documentType])

  // Focus email input when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => emailInputRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape key closes dialog
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose, isSending])

  if (!open) return null

  const docTypeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const isEmailValid = email.trim().length > 0 && email.includes("@") && email.includes(".")
  const isSendDisabled = !isEmailValid || isSending || isGenerating

  const handleSend = async () => {
    if (isSendDisabled) return
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
        toast.success("Email sent successfully!")
        onEmailSent?.()
      } else {
        let errorMessage = "Failed to send email"
        try {
          const data = await res.json()
          errorMessage = data.error || errorMessage
        } catch { /* ignore */ }
        toast.error(errorMessage)
      }
    } catch {
      toast.error("Network error. Please check your connection.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSending && onClose()}
        aria-hidden="true"
      />

      {/* Dialog panel — full height on mobile with scroll */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-dialog-title"
        className={cn(
          "relative w-full bg-card border border-border shadow-2xl flex flex-col",
          // Mobile: bottom sheet, max 90vh with scroll
          "rounded-t-3xl max-h-[90dvh]",
          // Desktop: centered modal, fixed max width
          "sm:rounded-3xl sm:max-w-lg sm:max-h-[85dvh]"
        )}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header — sticky */}
        <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <h2 id="send-email-dialog-title" className="text-base font-semibold text-foreground">
              Send {docTypeLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            aria-label="Close dialog"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">

          {/* To */}
          <div className="space-y-1.5">
            <label htmlFor="send-email-to" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              To
            </label>
            <input
              ref={emailInputRef}
              id="send-email-to"
              type="email"
              required
              aria-required="true"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSending}
              placeholder="client@example.com"
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-sm",
                "bg-background border border-border",
                "placeholder:text-muted-foreground text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
                "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              )}
            />
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <label htmlFor="send-email-subject" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Subject
            </label>
            <input
              id="send-email-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              placeholder="Email subject..."
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-sm",
                "bg-background border border-border",
                "placeholder:text-muted-foreground text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
                "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              )}
            />
          </div>

          {/* Message — AI generated */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="send-email-message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Message
              </label>
              <button
                type="button"
                onClick={regenerateMessage}
                disabled={isGenerating || isSending}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
              >
                {isGenerating
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />
                }
                {isGenerating ? "Writing..." : "Regenerate"}
              </button>
            </div>

            {/* AI badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10 w-fit">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-medium text-primary">AI-written — edit freely</span>
            </div>

            <div className="relative">
              {isGenerating && (
                <div className="absolute inset-0 rounded-xl bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Writing message...
                  </div>
                </div>
              )}
              <textarea
                id="send-email-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSending || isGenerating}
                rows={9}
                placeholder="Your message will appear here..."
                className={cn(
                  "w-full px-3.5 py-3 rounded-xl text-sm resize-none leading-relaxed",
                  "bg-background border border-border",
                  "placeholder:text-muted-foreground text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
                  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                  "font-[inherit]"
                )}
              />
            </div>
          </div>
        </div>

        {/* Footer — sticky actions */}
        <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSending}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSendDisabled}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-2",
              "py-2.5 px-4 rounded-xl text-sm font-semibold",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isSending ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
            ) : (
              <><Send className="w-4 h-4" />Send Email</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
