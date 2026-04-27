"use client"

/**
 * ChatSendCard — Inline send card that appears in chat when user asks to send a document.
 *
 * 2-step flow:
 *   Step 1 — Compose: editable recipient email + editable personal message
 *   Step 2 — Preview: shows what will be sent, then Send button
 *
 * Smooth pop-in animation using CSS keyframes via Tailwind.
 * Modern card design: white bg, rounded-2xl, layered shadow, clean typography.
 */

import { useState, useCallback, useEffect, useRef } from "react"
import {
  Mail, Send, X, CheckCircle2, Loader2, AlertTriangle,
  ArrowRight, ChevronLeft, Eye, User, FileText,
} from "lucide-react"
import { toast } from "sonner"
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
}

type Step = "compose" | "preview" | "sent"

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
    ? subtotal * (discountValue / 100)
    : discountValue
  const taxAmount = (subtotal - discountAmount) * (taxRate / 100)
  const total = subtotal - discountAmount + taxAmount + shippingFee
  if (total <= 0) return ""
  const currency = data.currency || "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(total)
  } catch {
    return `${currency} ${total.toFixed(2)}`
  }
}

export function ChatSendCard({
  sessionId,
  invoiceData,
  documentType,
  detectedEmail,
  onDismiss,
  onSent,
}: ChatSendCardProps) {
  const [step, setStep] = useState<Step>("compose")
  const [email, setEmail] = useState(detectedEmail)
  const [message, setMessage] = useState("")
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const total = calcTotal(invoiceData)

  // Trigger mount animation
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Auto-focus email on mount
  useEffect(() => {
    if (mounted) {
      setTimeout(() => emailRef.current?.focus(), 200)
    }
  }, [mounted])

  // Generate AI message when moving to preview
  const generateMessage = useCallback(async () => {
    setIsGeneratingMsg(true)
    try {
      const res = await authFetch("/api/emails/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType,
          clientName: invoiceData.toName || "",
          senderName: invoiceData.fromName || "",
          referenceNumber: ref,
          currency: invoiceData.currency || "USD",
          dueDate: invoiceData.dueDate || "",
          description: invoiceData.description || "",
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.message) setMessage(data.message)
      }
    } catch { /* non-fatal */ }
    finally { setIsGeneratingMsg(false) }
  }, [documentType, invoiceData, ref])

  const handleNext = useCallback(() => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address")
      return
    }
    setError(null)
    setStep("preview")
    if (!message) generateMessage()
  }, [email, message, generateMessage])

  const handleSend = useCallback(async () => {
    if (isSending) return
    setIsSending(true)
    setError(null)
    try {
      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: email.trim(),
          personalMessage: message.trim() || undefined,
          scheduleFollowUps: documentType.toLowerCase() === "invoice",
        }),
      })
      if (res.ok) {
        setStep("sent")
        toast.success(`${docLabel} sent to ${email.trim()}`)
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
  }, [isSending, sessionId, email, message, documentType, docLabel, onSent])

  // ── Sent state ────────────────────────────────────────────────────────────
  if (step === "sent") {
    return (
      <div className={cn(
        "flex justify-start w-full transition-all duration-500",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      )}>
        <div className="max-w-[88%] rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 px-5 py-4 flex items-center gap-3.5"
          style={{ boxShadow: "0 4px 24px rgba(16,185,129,0.12), 0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{docLabel} sent successfully</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Delivered to {email.trim()}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex justify-start w-full transition-all",
      // Pop-in: starts small + transparent, springs to full size
      mounted
        ? "opacity-100 translate-y-0 scale-100"
        : "opacity-0 translate-y-4 scale-[0.96]",
      "duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    )}>
      <div
        className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 overflow-hidden"
        style={{
          boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            {step === "preview" && (
              <button
                onClick={() => setStep("compose")}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors -ml-1 mr-0.5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-primary/8 dark:bg-primary/15 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Send {docLabel}</p>
              {ref && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{ref}</p>}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── Step indicator ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 px-5 pb-3">
          <div className={cn(
            "h-1 rounded-full transition-all duration-300",
            step === "compose" ? "w-6 bg-primary" : "w-3 bg-primary/30"
          )} />
          <div className={cn(
            "h-1 rounded-full transition-all duration-300",
            step === "preview" ? "w-6 bg-primary" : "w-3 bg-muted"
          )} />
        </div>

        {/* ── Step 1: Compose ────────────────────────────────────────────── */}
        {step === "compose" && (
          <div className="px-5 pb-5 space-y-4">
            {/* To field */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <User className="w-3 h-3 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Recipient</label>
              </div>
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(null) }}
                onKeyDown={e => e.key === "Enter" && handleNext()}
                placeholder="client@example.com"
                className={cn(
                  "w-full h-10 px-3.5 rounded-xl border text-sm bg-background text-foreground",
                  "placeholder:text-muted-foreground/40 transition-all duration-200",
                  "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60",
                  error ? "border-destructive/50 ring-2 ring-destructive/10" : "border-border/70"
                )}
              />
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            {/* Document summary chip */}
            {(invoiceData.toName || total) && (
              <div className="flex items-center gap-2 flex-wrap">
                {invoiceData.toName && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs text-muted-foreground border border-border/40">
                    <User className="w-3 h-3" />
                    {invoiceData.toName}
                  </span>
                )}
                {total && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 text-xs font-medium text-foreground border border-border/40">
                    <FileText className="w-3 h-3 text-muted-foreground" />
                    {total}
                  </span>
                )}
              </div>
            )}

            {/* Next button */}
            <button
              onClick={handleNext}
              className="w-full h-10 rounded-xl bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 shadow-sm"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Preview ────────────────────────────────────────────── */}
        {step === "preview" && (
          <div className="px-5 pb-5 space-y-4 animate-in fade-in slide-in-from-right-2 duration-250">
            {/* To chip */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border/40">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground font-medium truncate">{email.trim()}</span>
            </div>

            {/* Message preview */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-muted-foreground" />
                <label className="text-xs font-medium text-muted-foreground">Email message</label>
              </div>
              {isGeneratingMsg ? (
                <div className="rounded-xl border border-border/40 bg-muted/30 px-3.5 py-3 flex items-center gap-2.5 min-h-[72px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">Writing message…</span>
                </div>
              ) : (
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Add a personal message (optional)…"
                  className="w-full px-3.5 py-3 rounded-xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all duration-200 leading-relaxed"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive animate-in fade-in duration-200">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {error}
              </div>
            )}

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isSending || isGeneratingMsg}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {isSending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
              ) : (
                <><Send className="w-4 h-4" /> Send {docLabel}</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
