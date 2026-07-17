"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mail, Loader2, X, Send, AlertTriangle, CheckCircle2, XCircle, Calendar, Bell, BellOff, Repeat2, FileText, Sparkles, CreditCard, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { toMinorUnits, type InvoiceData } from "@/lib/invoice-types"
import { cn } from "@/lib/utils"

interface SendEmailDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string
  invoiceData: InvoiceData
  documentType: string
  defaultEmail?: string
  onEmailSent?: (info?: { onboardUrl?: string | null }) => void
  /** Flushes the current editor context before the server confirms the payment amount. */
  onBeforeSend?: () => Promise<void>
  isRecurring?: boolean
  onRecurringChange?: (active: boolean, frequency: string) => void
  userTier?: "free" | "starter" | "pro" | "agency"
}

const MAX_MESSAGE_LENGTH = 500

function generateSubject(invoiceData: InvoiceData, documentType: string): string {
  const sender = invoiceData.fromName?.trim() || ""
  // Onboarding forms are a fillable link, not an attached document — use the
  // same phrasing as the invitation email rather than "Client_onboarding_form
  // INV-XXXX" (raw type name + an invoice-style ref that doesn't apply here).
  if (documentType.toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form") {
    return sender ? `Please complete this form for ${sender}` : "Please complete this onboarding form"
  }
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
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
  onBeforeSend,
  isRecurring: initialRecurring = false,
  onRecurringChange,
  userTier = "free",
}: SendEmailDialogProps) {
  const isContract = documentType.toLowerCase() === "contract"
  const isInvoice = documentType.toLowerCase() === "invoice"
  const isOnboardingForm = documentType.toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form"
  const isPaidTier = userTier !== "free"

  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [scheduleFollowUps, setScheduleFollowUps] = useState(userTier !== "free")
  const [paymentLinkExpiryDays, setPaymentLinkExpiryDays] = useState(30)
  // Payment collection is explicit; editor intent may preselect it, but never gateway presence alone.
  const [includePaymentLink, setIncludePaymentLink] = useState(invoiceData.collectOnlinePayment === true)
  const [gatewayConnected, setGatewayConnected] = useState<boolean | null>(null) // null = loading
  // Recurring state (invoices only)
  const [makeRecurring, setMakeRecurring] = useState(initialRecurring)
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "quarterly">("monthly")
  // Auto-invoice on sign (contracts only) — on by default for paid tiers
  const [autoInvoiceOnSign, setAutoInvoiceOnSign] = useState(isContract && isPaidTier)

  // Email validation state
  const [emailValidating, setEmailValidating] = useState(false)
  const [emailValid, setEmailValid] = useState<boolean | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const emailValidationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)
  // Every draft request owns an incrementing id. Manual typing or closing the
  // dialog invalidates the current id so a late AI response cannot overwrite it.
  const draftRequestIdRef = useRef(0)
  const messageEditedRef = useRef(false)

  // ── Check payment gateway on mount (invoices only) ───────────────────────────
  useEffect(() => {
    if (!open || !isInvoice) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch("/api/payments/settings")
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const s = data.settings
          const hasGateway = Boolean(
            s?.razorpay?.credentialsVerified
            || s?.stripe?.credentialsVerified
            || s?.cashfree?.credentialsVerified,
          )
          setGatewayConnected(hasGateway)
          setIncludePaymentLink(hasGateway && invoiceData.collectOnlinePayment === true)
        } else {
          setGatewayConnected(false)
          setIncludePaymentLink(false)
        }
      } catch {
        setGatewayConnected(false)
        setIncludePaymentLink(false)
      }
    })()
    return () => { cancelled = true }
  }, [open, isInvoice, invoiceData.collectOnlinePayment])

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

  // ── AI message assist ───────────────────────────────────────────────────────
  const generateMessage = useCallback(async (force = false) => {
    const requestId = ++draftRequestIdRef.current
    if (force) messageEditedRef.current = false
    setIsGenerating(true)
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
          description: invoiceData.projectDescription || invoiceData.description || "",
          projectName: invoiceData.projectName || "",
          items: invoiceData.items?.slice(0, 5) || [],
        }),
      })
      const nextMessage = res.ok
        ? ((await res.json()).message || localFallback(invoiceData, documentType))
        : localFallback(invoiceData, documentType)
      if (draftRequestIdRef.current === requestId && !messageEditedRef.current) {
        setMessage(String(nextMessage).slice(0, MAX_MESSAGE_LENGTH))
      }
    } catch {
      if (draftRequestIdRef.current === requestId && !messageEditedRef.current) {
        setMessage(localFallback(invoiceData, documentType).slice(0, MAX_MESSAGE_LENGTH))
      }
    } finally {
      if (draftRequestIdRef.current === requestId) setIsGenerating(false)
    }
  }, [invoiceData, documentType])

  // ── Reset and draft once when the dialog opens ───────────────────────────────
  useEffect(() => {
    if (!open) {
      draftRequestIdRef.current += 1
      setIsGenerating(false)
      return
    }

    setEmail(defaultEmail || invoiceData.toEmail || "")
    setSubject(generateSubject(invoiceData, documentType))
    setEmailValid(null)
    setEmailError(null)
    setMessage("")
    setAutoInvoiceOnSign(isContract && isPaidTier)
    messageEditedRef.current = false
    void generateMessage()

    return () => {
      draftRequestIdRef.current += 1
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus email input on open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => emailInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [open])

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSending) onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, isSending, onClose])

  if (!open) return null

  const docTypeLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const { formatted: confirmedTotal } = calcTotal(invoiceData)
  const isEmailFormatValid = /^[^\s@]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email.trim())
  const canSend =
    isEmailFormatValid &&
    !emailValidating &&
    emailValid !== false &&
    subject.trim().length > 0 &&
    message.length <= MAX_MESSAGE_LENGTH &&
    !isSending &&
    !isGenerating

  const handleSend = async () => {
    if (isSending || isGenerating) return
    if (!isEmailFormatValid) return
    setIsSending(true)
    try {
      // Onboarding forms are client-fillable: create a tokenized fill link and
      // email it, instead of sending a static document.
      if (documentType.toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form") {
        const res = await authFetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            clientEmail: email.trim(),
            clientName: invoiceData.toName || undefined,
            personalMessage: message.trim() || undefined,
          }),
        })
        if (res.ok) {
          const resData = await res.json().catch(() => ({}))
          onClose()
          toast.success(`Onboarding form sent to ${email.trim()}`)
          onEmailSent?.({ onboardUrl: typeof resData.onboardUrl === "string" ? resData.onboardUrl : null })
        } else {
          let errorMessage = "Failed to send the form"
          try { const d = await res.json(); errorMessage = d.error || errorMessage } catch { /* ignore */ }
          toast.error(errorMessage)
        }
        return
      }

      // Persist the exact editor state the user just confirmed before the server
      // derives the canonical payment amount and creates a provider link.
      await onBeforeSend?.()

      const collectOnlinePayment = isInvoice && includePaymentLink
      const { raw: confirmedTotalRaw } = calcTotal(invoiceData)
      const confirmedCurrency = (invoiceData.currency || "USD").toUpperCase()
      const confirmedPaymentAmount = collectOnlinePayment
        ? toMinorUnits(confirmedTotalRaw, confirmedCurrency)
        : undefined

      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: email.trim(),
          subject: subject.trim() || undefined,
          personalMessage: message.trim() || undefined,
          scheduleFollowUps: scheduleFollowUps && isInvoice,
          paymentLinkExpiryDays: isInvoice ? paymentLinkExpiryDays : undefined,
          collectOnlinePayment,
          confirmedPaymentAmount,
          confirmedPaymentCurrency: collectOnlinePayment ? confirmedCurrency : undefined,
        }),
      })

      if (res.ok) {
        if (collectOnlinePayment) {
          window.dispatchEvent(new CustomEvent("clorefy:payment-link-created", { detail: { sessionId } }))
        }
        // Save recurring settings if invoice
        if (isInvoice) {
          if (makeRecurring) {
            await authFetch("/api/recurring", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId,
                frequency: recurringFrequency,
                autoSend: false,
                recipientEmail: email.trim(),
              }),
            }).catch(() => {}) // non-fatal
          }
          onRecurringChange?.(makeRecurring, recurringFrequency)
        }
        // Save auto-invoice setting for contracts
        if (isContract) {
          await authFetch("/api/sessions/auto-invoice", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              autoInvoiceOnSign,
              invoiceRecipientEmail: email.trim(),
            }),
          }).catch(() => {}) // non-fatal
        }
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
      }
    } catch {
      toast.error("Network error. Please check your connection.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => !isSending && onClose()}
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

        <div className="flex items-center justify-between px-5 pt-3 pb-3 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <h2 id="send-email-title" className="text-base font-semibold text-foreground">
              Send {docTypeLabel}
            </h2>
          </div>
          <button type="button" onClick={onClose} disabled={isSending} aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4 min-h-0">

          {/* Recipient email */}
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
                aria-label="Recipient email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => email.trim().length > 5 && validateEmail(email)}
                disabled={isSending}
                placeholder="client@company.com"
                className={cn(
                  "w-full px-3.5 py-2.5 pr-10 rounded-xl text-sm bg-background border",
                  "placeholder:text-muted-foreground text-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors",
                  "disabled:opacity-60",
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
              aria-label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              placeholder="Email subject..."
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-background border border-border placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors disabled:opacity-60"
            />
          </div>

          {/* Personal message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="email-message" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Personal message
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void generateMessage(true)}
                  disabled={isGenerating || isSending}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isGenerating ? "Writing..." : "Rewrite with AI"}
                </button>
                <span className={cn("text-[11px] tabular-nums", message.length > MAX_MESSAGE_LENGTH ? "text-red-500" : "text-muted-foreground")}>
                  {message.length}/{MAX_MESSAGE_LENGTH}
                </span>
              </div>
            </div>
            <textarea
              id="email-message"
              aria-label="Personal message"
              value={message}
              onChange={(e) => {
                messageEditedRef.current = true
                draftRequestIdRef.current += 1
                setIsGenerating(false)
                setMessage(e.target.value)
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={5}
              disabled={isSending}
              placeholder={isOnboardingForm ? "Add a personal note for your client (optional)..." : "Add an optional note for your client..."}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm resize-none leading-relaxed bg-background border border-border placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60 transition-colors disabled:opacity-60"
            />
          </div>

          {/* Lock notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Once sent, this {documentType.toLowerCase()} will be locked and can no longer be edited. You can still view and download it.
            </p>
          </div>

          {/* Include payment link toggle — invoices only */}
          {isInvoice && (
            <div className={cn(
              "rounded-2xl border bg-card overflow-hidden",
              includePaymentLink && gatewayConnected ? "border-emerald-200 dark:border-emerald-800/50" : "border-border"
            )}>
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <CreditCard className={cn("w-4 h-4 shrink-0 mt-0.5", includePaymentLink && gatewayConnected ? "text-emerald-600" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Collect online payment</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {gatewayConnected === null
                        ? "Checking payment provider..."
                        : gatewayConnected
                        ? includePaymentLink
                          ? `${confirmedTotal || "The final amount"} will be confirmed. The link is created and saved only after you click Send.`
                          : "No payment link will be created or included."
                        : (
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            Connect a payment provider to use this.{" "}
                            <a
                              href="/integrations/payments/razorpay"
                              className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium"
                            >
                              Connect now <ExternalLink className="w-3 h-3" />
                            </a>
                          </span>
                        )
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle include payment link"
                  onClick={() => gatewayConnected && setIncludePaymentLink(v => !v)}
                  disabled={!gatewayConnected}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer mt-0.5",
                    includePaymentLink && gatewayConnected ? "bg-emerald-500" : "bg-muted",
                    !gatewayConnected && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    includePaymentLink && gatewayConnected ? "translate-x-[18px]" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </div>
          )}

          {/* Auto follow-up toggle — invoices only, paid tiers only */}
          {isInvoice && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {scheduleFollowUps && isPaidTier
                    ? <Bell className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    : <BellOff className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Auto follow-up reminders</p>
                      {!isPaidTier && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Paid
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {!isPaidTier
                        ? "Upgrade to Starter to auto-send payment reminders."
                        : scheduleFollowUps
                        ? "Reminders sent automatically if unpaid. Stops when paid."
                        : "No automatic reminders. Send manually anytime."
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle auto follow-up reminders"
                  onClick={() => isPaidTier && setScheduleFollowUps(v => !v)}
                  disabled={!isPaidTier}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer mt-0.5",
                    scheduleFollowUps && isPaidTier ? "bg-primary" : "bg-muted",
                    !isPaidTier && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    scheduleFollowUps && isPaidTier ? "translate-x-[18px]" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </div>
          )}

          {/* Auto-invoice on sign — contracts only */}
          {isContract && (
            <div className={cn(
              "rounded-2xl border bg-card overflow-hidden",
              autoInvoiceOnSign ? "border-emerald-200 dark:border-emerald-800/50" : "border-border"
            )}>
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <FileText className={cn("w-4 h-4 shrink-0 mt-0.5", autoInvoiceOnSign ? "text-emerald-600" : "text-muted-foreground")} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Auto-send invoice on signing</p>
                      {!isPaidTier && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Paid
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {autoInvoiceOnSign
                        ? "An invoice will be automatically created and sent when the contract is signed."
                        : isPaidTier
                        ? "Enable to auto-send an invoice when the client signs."
                        : "Upgrade to automatically send invoices after contract signing."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle auto-send invoice on signing"
                  onClick={() => isPaidTier && setAutoInvoiceOnSign(v => !v)}
                  disabled={!isPaidTier}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer mt-0.5",
                    autoInvoiceOnSign ? "bg-emerald-500" : "bg-muted",
                    !isPaidTier && "opacity-40 cursor-not-allowed"
                  )}
                  title={!isPaidTier ? "Upgrade to enable auto-invoice" : undefined}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    autoInvoiceOnSign ? "translate-x-[18px]" : "translate-x-0.5"
                  )} />
                </button>
              </div>
            </div>
          )}

          {/* Recurring invoice toggle — invoices only */}
          {isInvoice && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Repeat2 className={cn("w-4 h-4 shrink-0 mt-0.5", makeRecurring ? "text-violet-500" : "text-muted-foreground")} />
                  <div>
                    <p className="text-sm font-medium text-foreground">Make recurring</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {makeRecurring
                        ? `Auto-generate a new invoice every ${recurringFrequency === "quarterly" ? "quarter" : recurringFrequency.replace("ly", "")}.`
                        : "Automatically create this invoice on a schedule."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Toggle recurring invoice"
                  onClick={() => setMakeRecurring(v => !v)}
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer mt-0.5",
                    makeRecurring ? "bg-violet-500" : "bg-muted"
                  )}
                >
                  <span className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
                    makeRecurring ? "translate-x-[18px]" : "translate-x-0.5"
                  )} />
                </button>
              </div>
              {makeRecurring && (
                <div className="px-4 pb-3 border-t border-border/40">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-2.5 mb-1.5">Frequency</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["weekly", "monthly", "quarterly"] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setRecurringFrequency(f)}
                        className={cn(
                          "py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 capitalize",
                          recurringFrequency === f
                            ? "bg-violet-500 text-white"
                            : "bg-muted/60 text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment link expiry — invoices only, when payment link is enabled */}
          {isInvoice && includePaymentLink && gatewayConnected && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium text-foreground">Payment link expiry</p>
                </div>
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
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-border/50 flex gap-2.5">
          <button type="button" onClick={onClose} disabled={isSending}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border border-border hover:bg-muted/60 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
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
              <><Send className="w-4 h-4" />{isInvoice && includePaymentLink ? "Confirm amount & send" : "Send"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Local fallback if AI message generation is unavailable ─────────────────────
function localFallback(invoiceData: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const clientName = invoiceData.toName?.trim() || ""
  const senderName = invoiceData.fromName?.trim() || "our team"
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const refText = ref ? ` ${ref}` : ""
  const { formatted } = calcTotal(invoiceData)
  const greeting = clientName ? `Hi ${clientName},` : "Hi,"
  const dueText = invoiceData.dueDate ? ` due on ${invoiceData.dueDate}` : ""
  const normalizedType = documentType.toLowerCase().replace(/[\s-]+/g, "_")

  if (normalizedType === "client_onboarding_form") {
    const projectText = invoiceData.projectName?.trim()
      ? ` for ${invoiceData.projectName.trim()}`
      : ""
    return `${greeting}\n\nPlease complete the secure onboarding form${projectText} using the link in this email. Your answers and any project files you choose to share will help us prepare for the engagement.\n\nIf you have any questions, please let us know.\n\nBest regards,\n${senderName}`
  }

  switch (normalizedType) {
    case "invoice":
      return `${greeting}\n\nPlease find your invoice${refText}${formatted ? ` for ${formatted}` : ""}${dueText} attached.\n\nKindly review the details and process the payment at your earliest convenience. Please don't hesitate to reach out if you have any questions.\n\nThank you for your business.\n\nBest regards,\n${senderName}`
    case "quote":
    case "quotation":
      return `${greeting}\n\nPlease find your quote${refText}${formatted ? ` totalling ${formatted}` : ""} attached.\n\nThis quote is valid for 30 days. Let us know if you'd like to proceed or have any questions.\n\nBest regards,\n${senderName}`
    case "contract":
      return `${greeting}\n\nPlease find the contract${refText} attached for your review.\n\nKindly review the terms and sign at your earliest convenience. Feel free to reach out with any questions.\n\nBest regards,\n${senderName}`
    default:
      return `${greeting}\n\nPlease find the ${docLabel.toLowerCase()}${refText} attached for your review.\n\nFeel free to reach out if you have any questions.\n\nBest regards,\n${senderName}`
  }
}
