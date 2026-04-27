"use client"

/**
 * ChatSendCard — Inline send card that appears in chat when user asks to send a document.
 * Shows recipient email, quick send button, and customize option.
 * Only appears when explicitly triggered by a send intent in the chat.
 */

import { useState, useCallback } from "react"
import { Mail, Send, Settings2, X, CheckCircle2, Loader2, AlertTriangle } from "lucide-react"
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
  onCustomize: (email: string) => void
  onSent: () => void
}

export function ChatSendCard({
  sessionId,
  invoiceData,
  documentType,
  detectedEmail,
  onDismiss,
  onCustomize,
  onSent,
}: ChatSendCardProps) {
  const [email, setEmail] = useState(detectedEmail)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()

  const handleSend = useCallback(async () => {
    if (isSending || sent) return
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Please enter a valid email address")
      return
    }
    setError(null)
    setIsSending(true)

    try {
      // Generate AI message in background
      let personalMessage: string | undefined
      try {
        const msgRes = await authFetch("/api/emails/generate-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentType,
            clientName: invoiceData.toName || "",
            senderName: invoiceData.fromName || "",
            referenceNumber: invoiceData.invoiceNumber || invoiceData.referenceNumber || "",
            currency: invoiceData.currency || "USD",
            dueDate: invoiceData.dueDate || "",
            description: invoiceData.description || "",
          }),
        })
        if (msgRes.ok) {
          const msgData = await msgRes.json()
          personalMessage = msgData.message || undefined
        }
      } catch { /* non-fatal — send without personal message */ }

      // Send the document
      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: trimmedEmail,
          personalMessage,
          scheduleFollowUps: documentType.toLowerCase() === "invoice",
        }),
      })

      if (res.ok) {
        setSent(true)
        toast.success(`${docLabel} sent to ${trimmedEmail}`)
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
  }, [email, isSending, sent, sessionId, invoiceData, documentType, onSent])

  if (sent) {
    return (
      <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{docLabel} sent!</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Delivered to {email.trim()}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-full max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-border/60 overflow-hidden"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Send {docLabel}</span>
          </div>
          <button
            onClick={onDismiss}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">To</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(null) }}
              placeholder="recipient@example.com"
              className={cn(
                "w-full h-9 px-3 rounded-xl border text-sm bg-background text-foreground placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors",
                error ? "border-destructive/60" : "border-border/80"
              )}
            />
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Document summary */}
          {(invoiceData.invoiceNumber || invoiceData.referenceNumber || invoiceData.toName) && (
            <div className="rounded-xl bg-muted/40 border border-border/40 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
              {(invoiceData.invoiceNumber || invoiceData.referenceNumber) && (
                <p><span className="font-medium text-foreground">{invoiceData.invoiceNumber || invoiceData.referenceNumber}</span></p>
              )}
              {invoiceData.toName && <p>To: {invoiceData.toName}</p>}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-3.5 h-3.5" /> Send Now</>
            )}
          </button>
          <button
            onClick={() => onCustomize(email.trim())}
            disabled={isSending}
            className="h-9 px-3 rounded-xl border border-border/80 bg-background text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Customize email options"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Customize</span>
          </button>
        </div>
      </div>
    </div>
  )
}
