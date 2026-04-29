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

interface ChatShareCardProps {
  sessionId: string
  documentType: string
  clientName?: string
  fromName?: string
  referenceNumber?: string
  toEmail?: string
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
  onSelectEmail,
  onDismiss,
  onLockDocument,
}: ChatShareCardProps) {
  const [mounted, setMounted] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [isLocking, setIsLocking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [whatsappMessage, setWhatsappMessage] = useState("")

  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const platformLink = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${sessionId}`

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Pre-fill WhatsApp message when that action is selected
  useEffect(() => {
    if (pendingAction === "whatsapp") {
      const ref = referenceNumber || ""
      const msg = `Hi ${clientName || ""},\n\nPlease find the ${docLabel.toLowerCase()} ${ref}.\n\n${platformLink}\n\nThank you,\n${fromName || ""}`
      setWhatsappMessage(msg)
    }
  }, [pendingAction]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lock the document server-side by setting sent_at
  const lockDocument = async () => {
    setIsLocking(true)
    try {
      // Mark the session as finalized/sent so it appears in My Documents
      await authFetch("/api/sessions/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {
        // Non-fatal — still lock client-side
      })
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
      await lockDocument()
      setPendingAction(null)
      window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, "_blank")
      return
    }
    if (pendingAction === "link") {
      try {
        await navigator.clipboard.writeText(platformLink)
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

  const actionLabels: Record<NonNullable<PendingAction>, string> = {
    email: "Send via Email",
    whatsapp: "Share on WhatsApp",
    link: "Copy Link",
  }

  // ── Confirm dialog ────────────────────────────────────────────────────
  if (pendingAction) {
    return (
      <div className={cn(
        "flex justify-start w-full transition-all",
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        "duration-300 ease-out"
      )}>
        <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/50 overflow-hidden"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)" }}
        >
          <div className="px-5 pt-5 pb-5 space-y-4">
            {/* Icon + text */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5">
                <Lock className="w-4 h-4 text-foreground/60" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Lock & Share</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  This will lock the document and share it via <span className="font-medium text-foreground">{actionLabels[pendingAction]}</span>. You won't be able to edit it after sharing.
                </p>
              </div>
            </div>

            {/* Editable WhatsApp message */}
            {pendingAction === "whatsapp" && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Message</p>
                <textarea
                  value={whatsappMessage}
                  onChange={e => setWhatsappMessage(e.target.value)}
                  rows={5}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/60 transition-all duration-150 leading-relaxed"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                disabled={isLocking}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border/60 bg-background hover:bg-muted/40 transition-colors disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
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
              <p className="text-[11px] text-muted-foreground">Send with payment link</p>
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
