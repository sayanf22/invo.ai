"use client"

/**
 * ChatAssetLinkCard — pre-send step for Client Onboarding Forms.
 *
 * Lets the owner attach a client asset-upload link (Google Drive / Dropbox /
 * etc.) before sending the form. The client will see a "Drop your assets here"
 * button that opens this link. Optional — the owner can skip it. On Continue/
 * Skip the parent swaps this card for the normal send/share card.
 */

import { useState } from "react"
import { CloudUpload, ArrowRight, X, AlertTriangle, CheckCircle2, FolderOpen, ShieldCheck } from "lucide-react"
import { safeExternalUrl } from "@/lib/sanitize"

interface ChatAssetLinkCardProps {
  initialLink: string
  onContinue: (link: string) => void
  onSkip: () => void
  onDismiss: () => void
}

export function ChatAssetLinkCard({ initialLink, onContinue, onSkip, onDismiss }: ChatAssetLinkCardProps) {
  const [link, setLink] = useState(initialLink || "")
  const [error, setError] = useState<string | null>(null)

  const handleContinue = () => {
    const trimmed = link.trim()
    if (!trimmed) {
      // Empty is allowed → treat as skip.
      onSkip()
      return
    }
    const safe = safeExternalUrl(trimmed)
    if (!safe) {
      setError("Enter a valid link starting with https://")
      return
    }
    onContinue(safe)
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <CloudUpload className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Add an asset upload link</p>
          <p className="text-[11px] text-muted-foreground">Optional — where your client uploads files</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3.5 space-y-3.5">
        <div className="rounded-xl border border-border/60 bg-muted/25 p-3 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <FolderOpen className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Prepare a shared upload folder</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                Use an HTTPS Google Drive or Dropbox folder and give this client permission to add or upload files.
              </p>
            </div>
          </div>
          <div className="grid gap-1.5 text-[11px] text-muted-foreground">
            <p className="flex items-start gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />Test the link in a private/incognito window before sending.</p>
            <p className="flex items-start gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />Do not include passwords, API keys, or other secrets in the URL.</p>
          </div>
        </div>

        <div>
          <label htmlFor="onboarding-asset-link" className="text-xs font-medium text-foreground mb-1.5 block">
            Shared folder link
          </label>
          <input
            id="onboarding-asset-link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => { setLink(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") handleContinue() }}
            placeholder="https://drive.google.com/… or https://dropbox.com/…"
            className={`w-full px-3.5 py-2.5 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/10 transition-all ${error ? "border-destructive focus:border-destructive" : "border-border focus:border-primary/40"}`}
            autoFocus
          />
          {error && (
            <p className="text-[11px] text-destructive mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {error}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            The client gets a button that opens this folder. Starter, Pro, and Agency forms also provide native image/PDF upload directly in the form.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center justify-center gap-1.5"
          >
            Continue <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
