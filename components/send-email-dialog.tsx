"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mail, Loader2, X, Send, RefreshCw, AlertTriangle, Lock, CheckCircle2, XCircle, Calendar, Bell, BellOff } from "lucide-react"
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

// Step 1: Compose (enter email + subject, no AI yet)
// Step 2: Confirm (AI generates message, user sees lock warning, confirms)
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
  // Message is only generated when user proceeds to confirm step
  const [message, setMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [scheduleFollowUps, setScheduleFollowUps] = useState(true)
  // Payment link expiry (days from now) — only relevant for invoices
  const [paymentLinkExpiryDays, setPaymentLinkExpiryDays] = useState(30)

  // Email validation state
  const [emailValidating, setEmailValidating] = useState(false)
  const [emailValid, setEmailValid] = useState<boolean | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const emailValidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  // ── Email validation ────────────────────────────────────────────────────────
  const validateEmail = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) { setEmailValid(null); setEmailError(null); return }

    // Immediate strict format check — must have TLD (dot after domain)
    const strictFormat = /^[^\s@]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
    if (!strictFormat.test(trimmed)) {
      setEmailValid(false)
      setEmailError("Enter a valid email address (e.g. name@company.com)")
      return
    }

    // DNS MX check via API
    setEmailValidating(true)
    setEmailValid(null)
    setEmailError(null)
    try {
      const res = await authFetch("/api/emails/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      if (res.ok) {
        const data = await res.json()
        setEmailValid(data.valid)
        setEmailError(data.valid ? null : (data.reason || "Email address is not valid"))
      } else {
        setEmailValid(true) // fail open on API error
      }
    } catch {
      setEmailValid(true) // fail open on network error
    } finally {
      setEmailValidating(false)
    }
  }, [])

  const handleEmailChange = useCallback((value: string) => {
    setEmail(value)
    setEmailValid(null)
    setEmailError(null)
    if (emailValidationTimer.current) clearTimeout(emailValidationTimer.current)
    if (value.trim().length > 5) {
      emailValidationTimer.current = setTimeout(() => validateEmail(value), 700)
    }
  }, [validateEmail])

  // ── AI message generation — only called when proceeding to confirm ──────────
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
        setMessage(localFallback(invoiceData, documentType))
      }
    } catch {
      setMessage(localFallback(invoiceData, documentType))
    } finally {
      setIsGenerating(false)
    }
  }, [invoiceData, documentType])

  // ── Reset when dialog opens — NO AI generation yet ─────────────────────────
  useEffect(() => {
    if (open) {
      setStep("compose")
      setEmail(defaultEmail || invoiceData.toEmail || "")
      setSubject(generateSubject(invoiceData, documentType))
      setEmailValid(null)
      setEmailError(null)
      setMessage("") // clear previous message
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus email input on open
  useEffect(() => {
    if (open && step === "compose") {
      const t = setTimeout(() => emailInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
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
  const isEmailFormatValid = /^[^\s@]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email.trim())
  const canProceed = isEmailFormatValid && !emailValidating && emailValid !== false && subject.trim().length > 0

  // Proceed to confirm: lock document intent + generate AI message
  const handleProceedToConfirm = () => {
    setStep("confirm")
    generateMessage() // generate NOW, only when user actually wants to send
  }

  const handleSend = async () => {
    if (isSending || isGenerating) return
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
          scheduleFollowUps: scheduleFollowUps && documentType.toLowerCase() === "invoice",
          paymentLinkExpiryDays: documentType.toLowerCase() === "invoice" ? paymentLinkExpiryDays : undefined,
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
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSending && (step === "confirm" ? setStep("compose") : onClose())}
        aria-hidden="true"
      />

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
            <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <h2 id="send-email-title" className="text-base font-semibold text-foreground">
                  Send {docTypeLabel}
                </h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0">

              {/* To */}
              <div className="space-y-1.5">
                <label htmlFor="email-to" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  To
                </label>
                <div className="relative">
                  <input
                    ref={emailInputRef}
                    id="email-to"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={() => email.trim().length > 5 && validateEmail(email)}
                    placeholder="client@company.com"
                    className={cn(
                      "w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm bg-background border",
                      "placeholder:text-muted-foreground text-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors",
                      emailValid === false ? "border-red-400 focus:ring-red-400/40" :
                      emailValid === true ? "border-emerald-400 focus:ring-emerald-400/40" :
                      "border-border"
                    )}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {emailValidating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                    {!emailValidating && emailValid === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {!emailValidating && emailValid === false && <XCircle className="w-4 h-4 text-red-500" />}
                  </div>
                </div>
                {emailError && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <XCircle className="w-3 h-3 shrink-0" />{emailError}
                  </p>
                )}
                {emailValidating && (
                  <p className="text-xs text-muted-foreground">Verifying email address...</p>
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

              {/* Info about what happens next */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/50">
                <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clicking "Review & Send" will show you the AI-written message and lock confirmation before anything is sent.
                </p>
              </div>
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedToConfirm}
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
            <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 id="send-email-title" className="text-base font-semibold text-foreground">
                  Confirm & Send
                </h2>
              </div>
              <button type="button" onClick={() => setStep("compose")} disabled={isSending}
                aria-label="Back"
                className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-4 min-h-0">

              {/* Lock warning */}
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    Document will be locked after sending
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    Once sent, this {documentType.toLowerCase()} cannot be edited. You can still view and download it.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="rounded-2xl border border-border bg-muted/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">To</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{email}</p>
                </div>
                <div className="px-4 py-3 border-b border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Subject</p>
                  <p className="text-sm font-medium text-foreground mt-0.5 truncate">{subject}</p>
                </div>
                {/* AI-generated message */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</p>
                    {!isGenerating && message && (
                      <button
                        type="button"
                        onClick={generateMessage}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Regenerate
                      </button>
                    )}
                  </div>
                  {isGenerating ? (
                    <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      Writing your message with AI...
                    </div>
                  ) : (
                    <div className="relative">
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={7}
                        className={cn(
                          "w-full px-3 py-2.5 rounded-xl text-xs resize-none leading-relaxed",
                          "bg-background border border-border",
                          "text-foreground placeholder:text-muted-foreground",
                          "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors",
                          "font-[inherit]"
                        )}
                      />
                      <div className="absolute top-2 right-2">
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">AI</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto follow-up toggle — invoices only */}
              {documentType.toLowerCase() === "invoice" && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {scheduleFollowUps
                        ? <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        : <BellOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      }
                      <div>
                        <p className="text-sm font-medium text-foreground">Auto follow-up reminders</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {scheduleFollowUps
                            ? "Reminders sent automatically if unpaid. Stops when paid."
                            : "No automatic reminders. Send manually anytime."
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScheduleFollowUps(v => !v)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer mt-0.5",
                        scheduleFollowUps ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                        scheduleFollowUps ? "translate-x-[18px]" : "translate-x-0.5"
                      )} />
                    </button>
                  </div>
                  {scheduleFollowUps && (
                    <div className="px-4 pb-3 border-t border-border/40">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-2.5 mb-1.5">Schedule</p>
                      <div className="space-y-1">
                        {[
                          { label: "Day 3 — Polite reminder" },
                          { label: "Day 7 — Follow-up" },
                          { label: "Day 14 — Urgent reminder" },
                          { label: "Day 30 — Final notice" },
                        ].map(({ label }) => (
                          <div key={label} className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">{label}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 italic">Stops automatically when payment is received.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Payment link expiry — invoices only */}
              {documentType.toLowerCase() === "invoice" && (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-sm font-medium text-foreground">Payment link expiry</p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      How long should the client be able to pay? After this period, the payment link will expire automatically.
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[7, 14, 30, 60].map(days => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setPaymentLinkExpiryDays(days)}
                          className={cn(
                            "py-2 rounded-xl text-xs font-semibold transition-colors",
                            paymentLinkExpiryDays === days
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      {paymentLinkExpiryDays === 30 ? "Recommended — matches Net 30 payment terms" :
                       paymentLinkExpiryDays === 7 ? "Short — good for urgent invoices" :
                       paymentLinkExpiryDays === 14 ? "Standard — 2 weeks to pay" :
                       "Extended — for long-term projects"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
              <button type="button" onClick={() => setStep("compose")} disabled={isSending}
                className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50">
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || isGenerating}
                className={cn(
                  "flex-1 inline-flex items-center justify-center gap-2",
                  "py-2.5 px-4 rounded-xl text-sm font-semibold",
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  "transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                {isSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Sending...</>
                ) : isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Preparing...</>
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
      return `${greeting}\n\nPlease find your invoice${refText}${formatted ? ` for ${formatted}` : ""}${dueText} attached.\n\nKindly review the details and process the payment at your earliest convenience. Please don't hesitate to reach out if you have any questions.\n\nThank you for your business.\n\nBest regards,\n${senderName}`
    case "quotation":
      return `${greeting}\n\nPlease find your quotation${refText}${formatted ? ` totalling ${formatted}` : ""} attached.\n\nThis quote is valid for 30 days. Let us know if you'd like to proceed or have any questions.\n\nBest regards,\n${senderName}`
    case "contract":
      return `${greeting}\n\nPlease find the contract${refText} attached for your review.\n\nKindly review the terms and sign at your earliest convenience. Feel free to reach out with any questions.\n\nBest regards,\n${senderName}`
    default:
      return `${greeting}\n\nPlease find the ${docLabel.toLowerCase()}${refText} attached for your review.\n\nFeel free to reach out if you have any questions.\n\nBest regards,\n${senderName}`
  }
}
