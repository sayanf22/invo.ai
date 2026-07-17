"use client"

/**
 * ChatShareCard — Inline share options card in chat.
 * Shows when user types "share" without specifying a method.
 * Displays options: Send via Email, Share on WhatsApp, Copy Link.
 * 
 * Flow: option click → confirm dialog → action + lock document
 */

import { useState, useEffect } from "react"
import { Mail, MessageCircle, Link2, Copy, Check, X, Lock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { usePaymentMethods } from "@/hooks/use-payment-methods"
import { usePublicDocumentLink } from "@/hooks/use-public-document-link"

interface ChatShareCardProps {
  sessionId: string
  documentType: string
  clientName?: string
  fromName?: string
  referenceNumber?: string
  toEmail?: string
  isSent?: boolean
  onSelectEmail: (email: string) => void
  onDismiss: () => void
  onLockDocument?: () => void
}

type PendingAction = "email" | "whatsapp" | "link" | null

export function ChatShareCard({
  sessionId,
  documentType,
  clientName,
  fromName,
  referenceNumber,
  toEmail,
  isSent,
  onSelectEmail,
  onDismiss,
  onLockDocument,
}: ChatShareCardProps) {
  const [mounted, setMounted] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isLocking, setIsLocking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState("")

  const { hasAnyGateway } = usePaymentMethods()
  const isInvoice = documentType.toLowerCase() === "invoice"
  const isOnboarding = documentType.toLowerCase().replace(/[\s-]+/g, "_") === "client_onboarding_form"

  const docLabel = isOnboarding
    ? "onboarding form"
    : documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const { publicUrl: platformLink } = usePublicDocumentLink(sessionId)

  // Onboarding forms are shared ONLY as the fillable /onboard/<token> link — never
  // the read-only /d/<publicId> preview. Fetch the real fill link on demand.
  const [onboardFillUrl, setOnboardFillUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!isOnboarding || !sessionId) { setOnboardFillUrl(null); return }
    let active = true
    authFetch(`/api/onboarding?sessionId=${sessionId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (active) setOnboardFillUrl(typeof d?.onboardUrl === "string" ? d.onboardUrl : null) })
      .catch(() => { if (active) setOnboardFillUrl(null) })
    return () => { active = false }
  }, [isOnboarding, sessionId])

  // The link this card shares. Onboarding uses the fill link; everything else
  // uses the platform preview link.
  const shareLink = isOnboarding ? onboardFillUrl : platformLink

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Pre-fill WhatsApp message when that action is selected
  useEffect(() => {
    if (pendingAction === "whatsapp") {
      const ref = referenceNumber || ""
      const linkLine = shareLink ? `\n\n${shareLink}` : ""
      const msg = isOnboarding
        ? `Hi ${clientName || ""},\n\nPlease complete your onboarding form using the secure link below.${linkLine}\n\nThank you,\n${fromName || ""}`
        : `Hi ${clientName || ""},\n\nPlease find the ${docLabel.toLowerCase()} ${ref}.${linkLine}\n\nThank you,\n${fromName || ""}`
      setWhatsappMessage(msg)
    }
  }, [pendingAction, shareLink, isOnboarding, clientName, docLabel, referenceNumber, fromName])

  // Lock the document server-side by setting sent_at. Onboarding forms are
  // finalized only by POST /api/onboarding (which issues the fill link), so we
  // never call the generic finalize path for them.
  const lockDocument = async () => {
    setIsLocking(true)
    try {
      if (!isOnboarding) {
        // Mark the session as finalized/sent so it appears in My Documents
        await authFetch("/api/sessions/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {
          // Non-fatal — still lock client-side
        })
      }
      onLockDocument?.()
    } finally {
      setIsLocking(false)
    }
  }

  const handleConfirm = async () => {
    if (!pendingAction) return

    if (pendingAction === "email") {
      await lockDocument()
      setPendingAction(null)
      onSelectEmail(toEmail || "")
      return
    }

    if (pendingAction === "whatsapp") {
      if (isOnboarding && !shareLink) {
        toast.error("Send this form via email first to generate its fillable link.")
        setPendingAction(null)
        return
      }
      await lockDocument()
      setPendingAction(null)
      window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, "_blank")
      return
    }
    if (pendingAction === "link") {
      if (!shareLink) {
        toast.error(isOnboarding
          ? "Send this form via email first to generate its fillable link."
          : "Public link is still loading. Please try again.")
        return
      }
      try {
        await navigator.clipboard.writeText(shareLink)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success("Link copied!")
      } catch {
        toast.error("Failed to copy link")
      }
      await lockDocument()
      setPendingAction(null)
      return
    }
  }

  // ── Confirm dialog ────────────────────────────────────────────────────
  if (pendingAction) {
    const actionVerb = pendingAction === "email"
      ? "sent via email"
      : pendingAction === "whatsapp"
        ? "shared on WhatsApp"
        : "shared via link"
    const actionLabel = pendingAction === "email"
      ? "Send via Email"
      : pendingAction === "whatsapp"
        ? "Share on WhatsApp"
        : "Copy & Share Link"

    return (
      <div className={cn(
        "flex justify-start w-full",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "transition-all duration-300 ease-out"
      )}>
        <div
          className="w-full max-w-[88%] rounded-2xl bg-card border border-border/60 overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 pt-5 pb-5 space-y-4">
            {/* Icon + headline */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-foreground/6 dark:bg-foreground/10 border border-border/40 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-foreground/70" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Lock &amp; Send
                </p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  Once {actionVerb}, this document will be locked. You can still
                  unlock it from the chat if you need to make edits later.
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/40" />

            {/* WhatsApp message preview */}
            {pendingAction === "whatsapp" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5">
                  Message preview
                </p>
                <textarea
                  value={whatsappMessage}
                  onChange={e => setWhatsappMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/50 bg-muted/20 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 transition-all duration-150 leading-relaxed placeholder:text-muted-foreground/40"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isLocking}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border/60 bg-background text-foreground/80 hover:bg-muted/40 hover:text-foreground transition-all duration-150 disabled:opacity-40 active:scale-[0.97]"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isLocking}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 transition-all duration-150 disabled:opacity-50 active:scale-[0.97]"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)" }}
              >
                {isLocking ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    <span>Locking…</span>
                  </>
                ) : (
                  <>
                    <span>{actionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Sent mode: show only the shared link ──────────────────────────────
  if (isSent) {
    return (
      <div className={cn(
        "flex justify-start w-full transition-all",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "duration-300 ease-out"
      )}>
        <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 px-4 py-3.5 space-y-2"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                <Link2 className="w-3.5 h-3.5 text-foreground/60" />
              </div>
              <p className="text-sm font-semibold text-foreground">Shared Link</p>
            </div>
            <button onClick={onDismiss}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/30">
            <span className="text-xs text-muted-foreground truncate flex-1 font-mono">{shareLink || "Link unavailable — send via email first"}</span>
            <button
              type="button"
              onClick={async () => {
                if (!shareLink) {
                  toast.error(isOnboarding
                    ? "Send this form via email first to generate its fillable link."
                    : "Public link is still loading. Please try again.")
                  return
                }
                try {
                  await navigator.clipboard.writeText(shareLink)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                  toast.success("Link copied!")
                } catch { toast.error("Failed to copy") }
              }}
              className="text-xs font-medium text-foreground hover:text-foreground/80 transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-muted/60 border border-border/40"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Options card ──────────────────────────────────────────────────────
  return (
    <div className={cn(
      "flex justify-start w-full transition-all",
      mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-3 scale-[0.97]",
      "duration-300 ease-out"
    )}>
      <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 overflow-hidden"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Share {docLabel}</p>
            {referenceNumber && <p className="text-[11px] text-muted-foreground mt-0.5">{referenceNumber}</p>}
          </div>
          <button onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options */}
        <div className="px-3 pb-3 space-y-1.5">
          {/* Send via Email */}
          <button
            type="button"
            onClick={() => setPendingAction("email")}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted/40 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-foreground/60" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Send via Email</p>
              <p className="text-[11px] text-muted-foreground">
                {isInvoice
                  ? (hasAnyGateway ? "Send with payment link" : "Send without payment link")
                  : "Send via email"}
              </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </button>

          {/* Share on WhatsApp */}
          <button
            type="button"
            onClick={() => setPendingAction("whatsapp")}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted/40 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-foreground/60" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Share on WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">Pre-filled message</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={() => setPendingAction("link")}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-muted/40 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              {copied
                ? <Check className="w-4 h-4 text-foreground/60" />
                : <Copy className="w-4 h-4 text-foreground/60" />
              }
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">{copied ? "Copied!" : "Copy Link"}</p>
              <p className="text-[11px] text-muted-foreground">Share a direct link</p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
          </button>
        </div>
      </div>
    </div>
  )
}
