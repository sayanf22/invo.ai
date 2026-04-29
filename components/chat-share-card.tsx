"use client"

/**
 * ChatShareCard — Inline share options card in chat.
 * Shows when user types "share" without specifying a method.
 * Displays options: Send via Email, Share on WhatsApp, Copy Link.
 */

import { useState } from "react"
import { Mail, MessageCircle, Link2, Copy, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1).toLowerCase()
  const platformLink = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${sessionId}`

  // Animate in
  useState(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  })

  const handleWhatsApp = () => {
    const ref = referenceNumber || ""
    const msg = `Hi ${clientName || ""},\n\nPlease find the ${docLabel.toLowerCase()} ${ref}.\n\n${platformLink}\n\nThank you,\n${fromName || ""}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
    onLockDocument?.()
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(platformLink)
      setCopied(true)
      toast.success("Link copied to clipboard!")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleEmail = () => {
    onSelectEmail(toEmail || "")
  }

  return (
    <div className={cn(
      "flex justify-start w-full transition-all",
      mounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.96]",
      "duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)]"
    )}>
      <div className="w-full max-w-[88%] rounded-2xl bg-card border border-border/40 overflow-hidden"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/8">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">Share {docLabel}</p>
              {referenceNumber && <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{referenceNumber}</p>}
            </div>
          </div>
          <button onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Options */}
        <div className="px-4 pb-4 space-y-2">
          {/* Send via Email */}
          <button
            type="button"
            onClick={handleEmail}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-background border border-border/50 hover:border-primary/40 hover:bg-secondary/30 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Send via Email</p>
              <p className="text-[11px] text-muted-foreground">Send document with payment link</p>
            </div>
          </button>

          {/* Share on WhatsApp */}
          <button
            type="button"
            onClick={handleWhatsApp}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-background border border-border/50 hover:border-[#25D366]/40 hover:bg-[#25D366]/5 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MessageCircle className="w-4 h-4 text-[#128C7E]" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">Share on WhatsApp</p>
              <p className="text-[11px] text-muted-foreground">Open WhatsApp with pre-filled message</p>
            </div>
          </button>

          {/* Copy Link */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl bg-background border border-border/50 hover:border-primary/40 hover:bg-secondary/30 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              {copied
                ? <Check className="w-4 h-4 text-emerald-600" />
                : <Copy className="w-4 h-4 text-foreground/60" />
              }
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-foreground">{copied ? "Copied!" : "Copy Link"}</p>
              <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{platformLink}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
