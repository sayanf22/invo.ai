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
  Bell, Repeat2, BellOff, Link as LinkIcon, Lock,
} from "lucide-react"
import { authFetch } from "@/lib/auth-fetch"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { InvoiceData } from "@/lib/invoice-types"
import { getDocumentTypeConfig, normalizeDocumentType } from "@/lib/document-type-registry"
import { SenderSignFirstModal } from "@/components/sender-sign-first-modal"
import { usePaymentMethods } from "@/hooks/use-payment-methods"

interface ChatSendCardProps {
  sessionId: string
  invoiceData: InvoiceData
  documentType: string
  detectedEmail: string
  onDismiss: () => void
  onSent: () => void
  onLockDocument?: () => void
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

function localFallbackMessage(data: InvoiceData, documentType: string): string {
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const clientName = data.toName?.trim() || "there"
  const senderName = data.fromName?.trim() || ""
  const ref = data.invoiceNumber || data.referenceNumber || ""
  const refText = ref ? ` ${ref}` : ""
  return `Hi ${clientName},\n\nPlease find your ${docLabel}${refText} attached. Let me know if you have any questions.\n\nThank you,\n${senderName}`
}

export function ChatSendCard({
  sessionId, invoiceData, documentType, detectedEmail, onDismiss, onSent, onLockDocument, userTier = "free",
}: ChatSendCardProps) {
  // Check if user has any payment gateway connected
  const { hasAnyGateway, loading: gatewayLoading } = usePaymentMethods()

  // Always start at compose so the user can review / edit the email
  const [step, setStep] = useState<Step>("compose")
  const [slideDir, setSlideDir] = useState<SlideDir>("right")
  const [email, setEmail] = useState(detectedEmail)
  const [message, setMessage] = useState("")
  const [includePayment, setIncludePayment] = useState(false)
  const [scheduleFollowUps, setScheduleFollowUps] = useState(userTier !== "free")
  const [makeRecurring, setMakeRecurring] = useState(false)
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "monthly" | "quarterly">("monthly")
  const [autoInvoiceOnSign, setAutoInvoiceOnSign] = useState(false)
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  // Sign-first modal — shown before sending a contract
  const [showSignFirst, setShowSignFirst] = useState(false)
  // Lock confirmation — shown before sending any document (warns it will be locked)
  const [showLockConfirm, setShowLockConfirm] = useState(false)
  // Track if sender already self-signed (skip modal if so)
  const [senderAlreadySigned, setSenderAlreadySigned] = useState(false)
  // Track if sender has a saved signature on their profile (auto-sign without modal)
  const [hasSavedSignature, setHasSavedSignature] = useState(false)
  const [isAutoSigning, setIsAutoSigning] = useState(false)

  // Auto-sign using saved profile signature — no modal needed
  const autoSignWithSaved = useCallback(async () => {
    if (isAutoSigning) return
    setIsAutoSigning(true)
    setError(null)
    try {
      const res = await authFetch("/api/signatures/self-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, useSaved: true }),
      })
      if (res.ok || res.status === 409) {
        // Signed successfully (409 = already signed) — proceed to send
        setSenderAlreadySigned(true)
        await handleSend()
      } else {
        // Auto-sign failed — fall back to showing the modal
        setIsAutoSigning(false)
        setShowSignFirst(true)
      }
    } catch {
      setIsAutoSigning(false)
      setShowSignFirst(true)
    }
  }, [isAutoSigning, sessionId])

  // Default includePayment to true ONLY if user has a gateway connected
  useEffect(() => {
    if (!gatewayLoading && hasAnyGateway) {
      setIncludePayment(true)
    } else if (!gatewayLoading && !hasAnyGateway) {
      setIncludePayment(false)
    }
  }, [hasAnyGateway, gatewayLoading])

  const isOnboardingForm = documentType.toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form"
  const isInvoice = documentType.toLowerCase() === "invoice"
  // Use the registry to determine if this document type supports signatures
  // AND check if the user has kept the signature section enabled (showSignatureFields !== false).
  // This is the single source of truth — changing the registry automatically propagates here.
  const docTypeConfig = getDocumentTypeConfig(documentType)
  const typeSupportsSignatures = docTypeConfig?.capabilities.supports_signature === true
  const signatureFieldsOn = invoiceData.showSignatureFields !== false
  // isSignable = the document CAN have signatures AND the user wants them
  const isSignable = typeSupportsSignatures && signatureFieldsOn
  const isContract = documentType.toLowerCase() === "contract"
  // Tier-based feature gates (read from prop)
  const isPaidTier = userTier !== "free"           // starter, pro, agency
  // E-signatures available on all tiers (free, starter, pro, agency)
  const canUseSignatures = isSignable
  // Recurring invoices require Starter+
  const canUseRecurring = isPaidTier
  // Auto-invoice on sign is a Pro+ feature
  const canUseAutoInvoice = userTier === "pro" || userTier === "agency"
  const docLabel = docTypeConfig?.label || (documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase())
  // Action label: onboarding forms send a fillable link, not a signable PDF.
  const actionLabel = isOnboardingForm
    ? "Send Onboarding Form"
    : canUseSignatures ? `Send & Sign ${docLabel}` : `Send ${docLabel}`
  const ref = invoiceData.invoiceNumber || invoiceData.referenceNumber || ""
  const total = calcTotal(invoiceData)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // For contracts: check if sender already self-signed AND if they have a saved signature
  useEffect(() => {
    if (!isContract || !sessionId) return
    authFetch(`/api/signatures?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => {
        const sigs = d.signatures ?? []
        const hasSenderSig = sigs.some((s: any) => s.party === "Sender" && s.signed_at)
        if (hasSenderSig) setSenderAlreadySigned(true)
        if (d.hasSavedSignature === true) setHasSavedSignature(true)
      })
      .catch(() => {})
  }, [isContract, sessionId])

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
        if (data.message) {
          setMessage(data.message)
        } else {
          setMessage(localFallbackMessage(invoiceData, documentType))
        }
      } else {
        setMessage(localFallbackMessage(invoiceData, documentType))
      }
    } catch {
      setMessage(localFallbackMessage(invoiceData, documentType))
    }
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
    // Onboarding forms never have a static "attached" document — they send a
    // fillable link — so the generic AI/fallback message ("Please find your
    // ... attached") is factually wrong for this type and duplicates the
    // invitation email's own built-in greeting. Leave the field blank/optional;
    // the invitation already has proper default copy when no message is set.
    if (!message && !isOnboardingForm) generateMessage()
  }, [email, message, generateMessage, isOnboardingForm])

  const goBackToCompose = useCallback(() => {
    setSlideDir("left")
    setStep("compose")
  }, [])

  const handleSend = useCallback(async () => {
    if (isSending) return
    setIsSending(true)
    setError(null)
    try {
      // Client Onboarding Forms are client-fillable: create a tokenized fill
      // link and email it, instead of the static-PDF "attached" email.
      if (isOnboardingForm) {
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
          setSlideDir("right")
          setStep("sent")
          onLockDocument?.()
          onSent()
        } else {
          const data = await res.json().catch(() => ({}))
          setError(data.error || "Failed to send the form. Please try again.")
        }
        return
      }

      const supportsSignatures = typeSupportsSignatures
      // Only create a signature request when the document type supports it AND
      // the user hasn't turned off the signature section via the editor toggle
      // AND the user's tier allows signatures (Pro+).
      const shouldRequestSignature = supportsSignatures && signatureFieldsOn && canUseSignatures

      // For signature-supporting documents, create a signature request first
      if (shouldRequestSignature) {
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
          onLockDocument?.()
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
        onLockDocument?.()
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
  }, [isSending, sessionId, email, message, isInvoice, isContract, isOnboardingForm, invoiceData.toName, includePayment, scheduleFollowUps, makeRecurring, recurringFrequency, autoInvoiceOnSign, onSent, onLockDocument, typeSupportsSignatures, signatureFieldsOn, canUseSignatures])

  const slideIn = slideDir === "right"
    ? "animate-in fade-in slide-in-from-right-3 duration-300"
    : "animate-in fade-in slide-in-from-left-3 duration-300"

  // ── Step 3: Sent — compact confirmation with document link ──
  if (step === "sent") {
    const shortId = sessionId.split("-")[0] // First 8 chars of UUID
    const docLink = `${typeof window !== "undefined" ? window.location.origin : ""}/d/${shortId}`
    return (
      <div className={cn(
        "flex justify-start w-full",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "transition-all duration-300"
      )}>
        <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 px-4 py-3.5 space-y-2.5"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {isOnboardingForm ? "Onboarding form sent" : isSignable ? "Signing request sent" : `${docLabel} sent`}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{email.trim()}</p>
            </div>
            {isInvoice && scheduleFollowUps && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                Reminders on
              </span>
            )}
            {isSignable && autoInvoiceOnSign && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                Auto-invoice on
              </span>
            )}
          </div>
          {/* Document link */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
            <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{docLink}</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(docLink)
                  toast.success("Link copied!")
                } catch {
                  toast.error("Failed to copy")
                }
              }}
              className="text-xs font-medium text-foreground hover:text-foreground/80 transition-colors shrink-0 px-1.5 py-0.5 rounded-md hover:bg-muted/60"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={cn(
        "flex justify-start w-full transition-all",
        mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.96]",
        "duration-500 ease-out"
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
                {actionLabel}
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

            {/* Payment toggle — invoices only, ONLY if gateway is connected */}
            {isInvoice && hasAnyGateway && (
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

            {/* No gateway connected — show connect prompt (invoices only) */}
            {isInvoice && !gatewayLoading && !hasAnyGateway && (
              <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">No payment link</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    Connect a payment gateway in{" "}
                    <a href="/settings" className="underline hover:text-foreground">Settings</a>
                    {" "}to include a Pay Now link.
                  </p>
                </div>
              </div>
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
                <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] font-semibold text-muted-foreground shrink-0">
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
                  placeholder={isOnboardingForm
                    ? "Add a personal note for your client (optional)…"
                    : "Add a personal message (optional)…"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/50 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all duration-200 leading-relaxed" />
              )}
            </div>

            {/* Auto follow-up reminders — invoices only, paid tiers only */}
            {isInvoice && (
              isPaidTier ? (
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
              ) : (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/30 opacity-60">
                <div className="flex items-center gap-2.5">
                  <BellOff className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-foreground block">Auto follow-up reminders <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ml-1">Paid</span></span>
                    <span className="text-[11px] text-muted-foreground">Upgrade to send payment reminders automatically</span>
                  </div>
                </div>
                <div className="relative w-9 h-5 rounded-full bg-muted-foreground/20 shrink-0 cursor-not-allowed">
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow" />
                </div>
              </div>
              )
            )}

            {/* Recurring invoice — invoices only, paid tier only */}
            {isInvoice && (
              canUseRecurring ? (
              <div className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden">
                <label className="flex items-center justify-between px-3.5 py-2.5 cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Repeat2 className={cn("w-4 h-4", makeRecurring ? "text-foreground" : "text-muted-foreground")} />
                    <span className="text-xs font-medium text-foreground">Make recurring</span>
                  </div>
                  <div className={cn(
                    "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                    makeRecurring ? "bg-foreground" : "bg-muted-foreground/20"
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
                              ? "bg-foreground text-background"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              ) : (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-muted/20 border border-border/30 opacity-70">
                <Repeat2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground block">Make recurring</span>
                  <span className="text-[10px] text-muted-foreground">Starter plan required</span>
                </div>
                <a href="/pricing" className="text-[10px] font-semibold text-primary hover:underline shrink-0">Upgrade</a>
              </div>
              )
            )}

            {/* Auto-invoice on sign — contracts only, Pro+ */}
            {isContract && (
              <label className={cn(
                "flex items-center justify-between px-3.5 py-2.5 rounded-xl border cursor-pointer",
                autoInvoiceOnSign
                  ? "bg-muted/40 border-border/50"
                  : "bg-muted/30 border-border/30",
                !canUseAutoInvoice && "opacity-60 cursor-not-allowed"
              )}>
                <div className="flex items-center gap-2.5">
                  <FileText className={cn("w-4 h-4", autoInvoiceOnSign ? "text-foreground" : "text-muted-foreground")} />
                  <div>
                    <span className="text-xs font-medium text-foreground block">Auto-send invoice on signing</span>
                    {!canUseAutoInvoice && <span className="text-[10px] text-muted-foreground">Pro plan required</span>}
                  </div>
                </div>
                <div className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0",
                  autoInvoiceOnSign ? "bg-foreground" : "bg-muted-foreground/20"
                )}>
                  <input type="checkbox" checked={autoInvoiceOnSign}
                    onChange={e => canUseAutoInvoice && setAutoInvoiceOnSign(e.target.checked)}
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

            <button
              onClick={() => {
                // Step 1: Show lock confirmation dialog before any signing or sending
                setShowLockConfirm(true)
              }}
              disabled={isSending || isGeneratingMsg || isAutoSigning}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20">
              {(isSending || isAutoSigning)
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {isAutoSigning ? "Signing…" : "Sending…"}</>
                : <><Send className="w-4 h-4" /> {actionLabel}</>
              }
            </button>

            {/* Lock confirmation — fixed overlay so it doesn't require scrolling on mobile */}
            {showLockConfirm && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
                role="dialog" aria-modal="true"
              >
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                  onClick={() => setShowLockConfirm(false)}
                />
                {/* Card — bottom sheet on mobile, centered modal on desktop */}
                <div className="relative w-full sm:max-w-sm rounded-2xl sm:rounded-2xl rounded-b-2xl bg-card border border-border/60 overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 duration-200"
                  style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)" }}
                >
                  {/* Handle (mobile) */}
                  <div className="flex justify-center pt-3 pb-0 sm:hidden">
                    <div className="w-8 h-1 rounded-full bg-border/70" />
                  </div>
                  <div className="px-5 pt-4 pb-5 space-y-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-foreground/6 dark:bg-foreground/10 border border-border/40 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="w-4 h-4 text-foreground/70" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {isOnboardingForm ? "Send Onboarding Form" : "Lock & Send"}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                          {isOnboardingForm
                            ? "Your client gets a link to fill out this form online. Once they submit, their answers can never be edited."
                            : "Once sent, this document will be locked. You can unlock it from the chat at any time to make edits."}
                        </p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-border/40" />

                    {/* Actions */}
                    <div className="flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowLockConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border/60 bg-background text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-150 active:scale-[0.97]"
                      >
                        Go back
                      </button>
                      <button
                        type="button"
                        disabled={isSending || isAutoSigning}
                        onClick={() => {
                          setShowLockConfirm(false)
                          if (isContract && !senderAlreadySigned && signatureFieldsOn) {
                            if (hasSavedSignature) {
                              autoSignWithSaved()
                            } else {
                              setShowSignFirst(true)
                            }
                          } else {
                            handleSend()
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
                        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" }}
                      >
                        <Send className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{actionLabel}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Sign-first modal — contracts only */}
    <SenderSignFirstModal
      open={showSignFirst}
      sessionId={sessionId}
      hasSavedSignature={hasSavedSignature}
      onCancel={() => setShowSignFirst(false)}
      onSkip={() => { setShowSignFirst(false); handleSend() }}
      onSigned={() => { setShowSignFirst(false); handleSend() }}
    />
    </>
  )
}
