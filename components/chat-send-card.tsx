"use client"

/**
 * ChatSendCard — Inline send card in chat for sending documents.
 *
 * 3-step flow with smooth slide animations:
 *   Step 1 — Compose: recipient email + include payment toggle (invoices)
 *   Step 2 — Preview: AI-generated message (editable) + options
 *   Step 3 — Sent: compact confirmation (stays visible, not dismissed)
 */

import { useState, useCallback, useEffect, useRef } from "react"
import {
  Mail, Send, X, CheckCircle2, Loader2, AlertTriangle,
  ArrowRight, ChevronLeft, Eye, User, FileText, CreditCard,
  Bell, Repeat2, BellOff,
} from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { cn } from "@/lib/utils"
import type { InvoiceData } from "@/lib/invoice-types"

interface ChatSendCardProps {
  sessionId: string
  invoiceData: InvoiceData
  documentType: string
  detectedEmail: string
  onDismiss: () => void
  onSent: () => void
  userTier?: "free" | "starter" | "pro" | "agency"
}

type Step = "compose" | "preview" | "sent"
type SlideDir = "right" | "left"

function calcTotal(data: InvoiceData): string {
  const subtotal = (data.items || []).reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const rate = Number(item.rate) || 0
    const disc = Number(item.discount) || 0
    return sum + qty * rate * (1 - disc / 100)
  }, 0)
  const taxRate = Number(data.taxRate) || 0
  const discountValue = Number(data.discountValue) || 0
  const shippingFee = Number(data.shippingFee) || 0
  const discountAmount = data.discountType === "percent"
    ? subtotal * (discountValue / 100) : discountValue
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
  const total = subtotal - discountAmount + taxAmount + shippingFee
  if (total <= 0) return ""
  const currency = data.currency || "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(total)
  } catch { return `${currency} ${total.toFixed(2)}` }
}

export function ChatSendCard({
  sessionId, invoiceData, documentType, detectedEmail, onDismiss, onSent, userTier = "free",
}: ChatSendCardProps) {
  const [step, setStep] = useState<Step>("compose")
  const [slideDir, setSlideDir] = useState<SlideDir>("right")
  const [email, setEmail] = useState(detectedEmail)
  const [message, setMessage] = useState("")
  const [includePayment, setIncludePayment] = useState(true)
  const [scheduleFollowUps, setScheduleFollowUps] = useState(true)
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "quarterly">("monthly")
  const [autoInvoiceOnSign, setAutoInvoiceOnSign] = useState(false)
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const isInvoice = documentType.toLowerCase() === "invoice"
  const isSignable = ["contract", "quotation", "proposal"].includes(documentType.toLowerCase())
  const isContract = documentType.toLowerCase() === "contract"
  const isPaidTier = userTier !== "free"
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const actionLabel = isSignable ? `Send & Sign ${docLabel}` : `Send ${docLabel}`
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const total = calcTotal(invoiceData)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    if (mounted && step === "compose") {
      setTimeout(() => emailRef.current?.focus(), 250)
    }
  }, [mounted, step])

  const generateMessage = useCallback(async () => {
    setIsGeneratingMsg(true)
    try {
      const res = await authFetch("/api/emails/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType, clientName: invoiceData.toName || "",
          senderName: invoiceData.fromName || "",
          referenceNumber: ref, currency: invoiceData.currency || "USD",
          dueDate: invoiceData.dueDate || "", description: invoiceData.description || "",
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.message) setMessage(data.message)
      }
    } catch { /* non-fatal */ }
    finally { setIsGeneratingMsg(false) }
  }, [documentType, invoiceData, ref])

  const goToPreview = useCallback(() => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address")
      return
    }
    setError(null)
    setSlideDir("right")
    setStep("preview")
    if (!message) generateMessage()
  }, [email, message, generateMessage])

  const goBackToCompose = useCallback(() => {
    setSlideDir("left")
    setStep("compose")
  }, [])

  const handleSend = useCallback(async () => {
    if (isSending) return
    setIsSending(true)
    setError(null)
    try {
      const supportsSignatures = ["contract", "quotation", "proposal"].includes(documentType.toLowerCase())

      // For signature-supporting documents, create a signature request first
      if (supportsSignatures) {
        try {
          await authFetch("/api/signatures", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              signerEmail: email.trim(),
              signerName: invoiceData.toName || email.trim().split("@")[0],
              party: "Client",
              personalMessage: message.trim() || undefined,
            }),
          })
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
            }).catch(() => {})
          }
          setSlideDir("right")
          setStep("sent")
          onSent()
          return
        } catch {
          // Fall through to regular email send if signature creation fails
        }
      }

      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: email.trim(),
          personalMessage: message.trim() || undefined,
          scheduleFollowUps: isInvoice && scheduleFollowUps,
          ...(isInvoice && !includePayment ? { skipPaymentLink: true } : {}),
        }),
      })
      if (res.ok) {
        // Save recurring settings if invoice
        if (isInvoice && makeRecurring) {
          await authFetch("/api/recurring", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              frequency: recurringFrequency,
              autoSend: false,
              recipientEmail: email.trim(),
            }),
          }).catch(() => {})
        }
        setSlideDir("right")
        setStep("sent")
        onSent()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to send. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsSending(false)
    }
  }, [isSending, sessionId, email, message, isInvoice, isContract, includePayment, scheduleFollowUps, makeRecurring, recurringFrequency, autoInvoiceOnSign, onSent])

  const slideIn = slideDir === "right"
    ? "animate-in fade-in slide-in-from-right-3 duration-300"
    : "animate-in fade-in slide-in-from-left-3 duration-300"

  // ── Step 3: Sent — compact confirmation, stays in chat ──
  if (step === "sent") {
    return (
      <div className={cn(
        "flex justify-start w-full",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "transition-all duration-300"
      )}>
        <div className="w-full max-w-[88%] rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 px-4 py-3 flex items-center gap-3"
          style={{ boxShadow: "0 2px 12px rgba(16,185,129,0.08)" }}
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {isSignable ? "Signing request sent" : `${docLabel} sent`}
            </p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 truncate mt-0.5">{email.trim()}</p>
          </div>
          {isInvoice && scheduleFollowUps && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shrink-0">
              Reminders on
            </span>
          )}
          {isSignable && autoInvoiceOnSign && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shrink-0">
              Auto-invoice on
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex justify-start w-full transition-all",
      mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.96]",
      "duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    )}>
      <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/40 overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.02)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
          <div className="flex items-center gap-2.5">
            {step === "preview" && (
              <button onClick={goBackToCompose}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors -ml-1 mr-0.5">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/8 dark:bg-primary/15">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">
                {isSignable ? `Send & Sign` : `Send ${docLabel}`}
              </p>
              {ref && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{ref}</p>}
            </div>
          </div>
          <button onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 px-5 pb-3">
          <div className={cn("h-1 rounded-full transition-all duration-300",
            step === "compose" ? "w-6 bg-primary" : "w-3 bg-primary/30")} />
          <div className={cn("h-1 rounded-full transition-all duration-300",
            step === "preview" ? "w-6 bg-primary" : "w-3 bg-muted")} />
        </div>

        {/* ── Step 1: Compose ── */}
        {step === "compose" && (
          <div className={cn("px-5 pb-5 space-y-3.5", slideIn)}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Recipient</label>
              </div>
              <input ref={emailRef} type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                onKeyDown={e => e.key === "Enter" && goToPreview()}
                placeholder="client@example.com"
                className={cn(
                  "w-full h-10 px-3.5 rounded-xl border text-sm bg-background text-foreground",
                  "placeholder:text-muted-foreground/40 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60",
                  error ? "border-destructive/50 ring-2 ring-destructive/10" : "border-border/60"
                )} />
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{error}
                </div>
              )}
            </div>

            {/* Summary chips */}
            {(invoiceData.toName || total) && (
              <div className="flex items-center gap-2 flex-wrap">
                {invoiceData.toName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs text-muted-foreground border border-border/30">
                    <User className="w-3 h-3" />{invoiceData.toName}
                  </span>
                )}
                {total && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 text-xs font-medium text-foreground border border-border/30">
                    <FileText className="w-3 h-3 text-muted-foreground" />{total}
                  </span>
                )}
              </div>
            )}

            {/* Payment toggle — invoices only */}
            {isInvoice && (
              <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30 cursor-pointer group">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="text-xs font-medium text-foreground">Include payment link</span>
                </div>
                <div className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200",
                  includePayment ? "bg-primary" : "bg-muted-foreground/20"
                )} onClick={e => e.preventDefault()}>
                  <input type="checkbox" checked={includePayment}
                    onChange={e => setIncludePayment(e.target.checked)}
                    className="sr-only" />
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    includePayment ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </label>
            )}

            <button onClick={goToPreview}
              className="w-full h-10 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 shadow-sm">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === "preview" && (
          <div className={cn("px-5 pb-5 space-y-3.5", slideIn)}>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-muted/30 border border-border/30">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-medium truncate">{email.trim()}</span>
              {isInvoice && includePayment && (
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                  <CreditCard className="w-3 h-3" /> Pay link
                </span>
              )}
            </div>

            {/* AI message */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Email message</label>
              </div>
              {isGeneratingMsg ? (
                <div className="rounded-xl border border-border/30 bg-muted/20 px-3.5 py-3 flex items-center gap-2.5 min-h-[72px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Writing message…</span>
                </div>
              ) : (
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Add a personal message (optional)…"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/50 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all duration-200 leading-relaxed" />
              )}
            </div>

            {/* Auto follow-up reminders — invoices only */}
            {isInvoice && (
              <label className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {scheduleFollowUps
                    ? <Bell className="w-4 h-4 text-primary" />
                    : <BellOff className="w-4 h-4 text-muted-foreground" />
                  }
                  <div>
                    <span className="text-xs font-medium text-foreground block">Auto follow-up reminders</span>
                    <span className="text-[11px] text-muted-foreground">Stops when paid</span>
                  </div>
                </div>
                <div className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                  scheduleFollowUps ? "bg-primary" : "bg-muted-foreground/20"
                )}>
                  <input type="checkbox" checked={scheduleFollowUps}
                    onChange={e => setScheduleFollowUps(e.target.checked)}
                    className="sr-only" />
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    scheduleFollowUps ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </label>
            )}

            {/* Recurring invoice — invoices only */}
            {isInvoice && (
              <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
                <label className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Repeat2 className={cn("w-4 h-4", makeRecurring ? "text-violet-500" : "text-muted-foreground")} />
                    <span className="text-xs font-medium text-foreground">Make recurring</span>
                  </div>
                  <div className={cn(
                    "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                    makeRecurring ? "bg-violet-500" : "bg-muted-foreground/20"
                  )}>
                    <input type="checkbox" checked={makeRecurring}
                      onChange={e => setMakeRecurring(e.target.checked)}
                      className="sr-only" />
                    <span className={cn(
                      "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                      makeRecurring ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                </label>
                {makeRecurring && (
                  <div className="px-3.5 pb-3 border-t border-border/30 pt-2.5">
                    <div className="flex gap-2">
                      {(["weekly", "monthly", "quarterly"] as const).map(f => (
                        <button key={f} type="button"
                          onClick={() => setRecurringFrequency(f)}
                          className={cn(
                            "flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors",
                            recurringFrequency === f
                              ? "bg-violet-500 text-white"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Auto-invoice on sign — contracts only */}
            {isContract && (
              <label className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl border cursor-pointer",
                autoInvoiceOnSign
                  ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40"
                  : "bg-muted/30 border-border/30",
                !isPaidTier && "opacity-60 cursor-not-allowed"
              )}>
                <div className="flex items-center gap-2.5">
                  <FileText className={cn("w-4 h-4", autoInvoiceOnSign ? "text-emerald-600" : "text-muted-foreground")} />
                  <div>
                    <span className="text-xs font-medium text-foreground block">Auto-send invoice on signing</span>
                    {!isPaidTier && <span className="text-[10px] text-amber-600 dark:text-amber-400">Paid plan required</span>}
                  </div>
                </div>
                <div className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                  autoInvoiceOnSign ? "bg-emerald-500" : "bg-muted-foreground/20"
                )}>
                  <input type="checkbox" checked={autoInvoiceOnSign}
                    onChange={e => isPaidTier && setAutoInvoiceOnSign(e.target.checked)}
                    className="sr-only" />
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    autoInvoiceOnSign ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
              </label>
            )}

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
                <AlertTriangle className="w-3 h-3 shrink-0" />{error}
              </div>
            )}

            <button onClick={handleSend} disabled={isSending || isGeneratingMsg}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20">
              {isSending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> {actionLabel}</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
