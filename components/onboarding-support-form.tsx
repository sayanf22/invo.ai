"use client"

import { useState, useRef, useEffect } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmedLength = message.trim().length
  const isValid = validateSupportMessage(message)

  // Focus textarea when sheet opens
  useEffect(() => {
    if (open) {
      // Small delay to let the sheet animation start
      const timer = setTimeout(() => {
        textareaRef.current?.focus()
      }, 300)
      return () => clearTimeout(timer)
    }
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
          metadata: {
            email: userEmail,
            submitted_from: "onboarding",
          },
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to send message")
      }

      toast("Support message sent!")
      setMessage("")

      // Auto-close sheet after 2 seconds
      setTimeout(() => {
        onOpenChange(false)
      }, 2000)
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message"
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Get Support</SheetTitle>
          <SheetDescription>
            Describe your issue and we&apos;ll get back to you.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1 mt-4">
          {/* Pre-filled email (read-only) */}
          <div className="space-y-1.5">
            <label
              htmlFor="support-email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="support-email"
              type="email"
              value={userEmail}
              readOnly
              aria-readonly="true"
              className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          {/* Message textarea */}
          <div className="space-y-1.5 flex-1 flex flex-col">
            <label
              htmlFor="support-message"
              className="text-sm font-medium text-foreground"
            >
              Message
            </label>
            <Textarea
              ref={textareaRef}
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what you need help with..."
              maxLength={2000}
              className="flex-1 min-h-[120px] resize-none"
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {trimmedLength < 3 && trimmedLength > 0
                  ? `${3 - trimmedLength} more character${3 - trimmedLength === 1 ? "" : "s"} needed`
                  : "\u00A0"}
              </span>
              <span>{trimmedLength}/2000</span>
            </div>
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
