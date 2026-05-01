"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Send, X, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { validateSupportMessage } from "@/lib/onboarding-utils"
import type { OnboardingPhase } from "@/lib/onboarding-utils"
import { authFetch } from "@/lib/auth-fetch"

interface SupportFormProps {
  currentPhase: OnboardingPhase
  userEmail: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SupportForm({
  currentPhase,
  userEmail,
  open,
  onOpenChange,
}: SupportFormProps) {
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmedLength = message.trim().length
  const isValid = validateSupportMessage(message)

  // Focus textarea when opened
  useEffect(() => {
    if (open && !sent) {
      const timer = setTimeout(() => textareaRef.current?.focus(), 350)
      return () => clearTimeout(timer)
    }
  }, [open, sent])

  // Reset sent state when reopened
  useEffect(() => {
    if (open) setSent(false)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    try {
      const response = await authFetch("/api/support/submit", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          onboarding_phase: currentPhase,
          metadata: { email: userEmail, submitted_from: "onboarding" },
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to send message")
      }

      setSent(true)
      setMessage("")
      setTimeout(() => onOpenChange(false), 2500)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centered card on desktop */}
      <div className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:w-full animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in duration-300">
        <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Need help?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                We&apos;ll get back to you as soon as possible.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Success state */}
          {sent ? (
            <div className="px-5 pb-6 pt-4 flex flex-col items-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Message sent</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;ll review your message and respond to {userEmail}
                </p>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 px-5 pb-5 gap-4">
              {/* Email — compact read-only pill */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground shrink-0">From:</span>
                <span className="text-foreground font-medium truncate">{userEmail}</span>
              </div>

              {/* Message textarea */}
              <div className="flex-1 flex flex-col gap-1.5">
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe what you need help with..."
                  maxLength={2000}
                  disabled={isSubmitting}
                  rows={5}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 transition-shadow"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>
                    {trimmedLength > 0 && trimmedLength < 3
                      ? `${3 - trimmedLength} more character${3 - trimmedLength === 1 ? "" : "s"} needed`
                      : "\u00A0"}
                  </span>
                  <span>{trimmedLength}/2000</span>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Message
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
