"use client"

import { useState, useEffect, useRef } from "react"
import { Mail, Loader2, X, Send } from "lucide-react"
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

export function SendEmailDialog({
  open,
  onClose,
  sessionId,
  invoiceData,
  documentType,
  defaultEmail,
  onEmailSent,
}: SendEmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail || invoiceData.toEmail || "")
  const [personalMessage, setPersonalMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const emailInputRef = useRef<HTMLInputElement>(null)

  // Reset email when dialog opens or defaultEmail changes
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail || invoiceData.toEmail || "")
      setPersonalMessage("")
    }
  }, [open, defaultEmail, invoiceData.toEmail])

  // Focus email input when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Escape key closes dialog
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const docTypeLabel =
    documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()

  const subjectPreview = `${docTypeLabel} from your business`

  const isEmailValid = email.trim().length > 0 && email.includes("@")
  const isSendDisabled = !isEmailValid || isSending
  const charCount = personalMessage.length
  const charCountRed = charCount > 450

  const handleSend = async () => {
    if (isSendDisabled) return
    setIsSending(true)
    try {
      const res = await authFetch("/api/emails/send-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          recipientEmail: email,
          personalMessage: personalMessage || undefined,
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
        } catch {
          // ignore parse error
        }
        toast.error(errorMessage)
      }
    } catch {
      toast.error("Network error. Please check your connection.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-email-dialog-title"
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl"
      >
        {/* Mobile handle bar */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-5 pb-6 pt-3 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-4.5 h-4.5 text-primary" />
              </div>
              <h2
                id="send-email-dialog-title"
                className="text-base font-semibold text-foreground"
              >
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

          {/* Email input */}
          <div className="space-y-1.5">
            <label
              htmlFor="send-email-recipient"
              className="text-sm font-medium text-foreground"
            >
              Recipient Email
            </label>
            <input
              ref={emailInputRef}
              id="send-email-recipient"
              type="email"
              required
              aria-label="Recipient email address"
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
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            />
          </div>

          {/* Subject preview */}
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Subject</p>
            <p className="text-sm text-muted-foreground px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border">
              {subjectPreview}
            </p>
          </div>

          {/* Personal message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="send-email-message"
                className="text-sm font-medium text-foreground"
              >
                Personal Message{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  charCountRed ? "text-red-500" : "text-muted-foreground"
                )}
              >
                {charCount}/500
              </span>
            </div>
            <textarea
              id="send-email-message"
              aria-label="Personal message"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              disabled={isSending}
              maxLength={500}
              rows={3}
              placeholder="Add a personal note to your client..."
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl text-sm resize-none",
                "bg-background border border-border",
                "placeholder:text-muted-foreground text-foreground",
                "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/60",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
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
                "transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              )}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
