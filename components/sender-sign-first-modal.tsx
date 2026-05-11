"use client"

/**
 * SenderSignFirstModal
 *
 * Shown before sending a contract for signature — only for contracts,
 * only when the sender hasn't already self-signed.
 *
 * Simple two-option prompt:
 *   • Add your signature → inline pad → self-sign → proceed
 *   • Skip → proceed without signing
 */

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Loader2, PenLine, CheckCircle2, X, ChevronRight } from "lucide-react"
import { SignaturePad } from "@/components/signature-pad"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"

interface SenderSignFirstModalProps {
  open: boolean
  sessionId: string
  /** true if user already has a saved signature on their business profile */
  hasSavedSignature?: boolean
  onSkip: () => void
  onSigned: () => void
  onCancel: () => void
}

type View = "prompt" | "pad" | "done"

export function SenderSignFirstModal({
  open,
  sessionId,
  hasSavedSignature = false,
  onSkip,
  onSigned,
  onCancel,
}: SenderSignFirstModalProps) {
  const [mounted, setMounted] = useState(false)
  const [view, setView] = useState<View>("prompt")
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setView("prompt")
      setSignatureDataUrl(null)
      setSigning(false)
    }
  }, [open])

  // Escape to cancel
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signing) onCancel()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, signing, onCancel])

  const handleSign = useCallback(async () => {
    if (!signatureDataUrl || signing) return
    setSigning(true)
    try {
      const res = await authFetch("/api/signatures/self-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, signatureDataUrl }),
      })
      if (res.ok || res.status === 409) {
        // 409 = already signed — treat as success
        setView("done")
        setTimeout(() => onSigned(), 700)
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Failed to sign. Please try again.")
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setSigning(false)
    }
  }, [signatureDataUrl, signing, sessionId, onSigned])

  /**
   * One-click self-sign using the user's saved signature
   * (from businesses.signature_url in their profile).
   */
  const handleSignWithSaved = useCallback(async () => {
    if (signing) return
    setSigning(true)
    try {
      const res = await authFetch("/api/signatures/self-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, useSaved: true }),
      })
      if (res.ok || res.status === 409) {
        setView("done")
        setTimeout(() => onSigned(), 700)
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Could not use saved signature. Draw one below instead.")
        // Fall back to draw view so the user can still proceed
        setView("pad")
      }
    } catch {
      toast.error("Something went wrong.")
    } finally {
      setSigning(false)
    }
  }, [signing, sessionId, onSigned])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => { if (!signing) onCancel() }}
      />

      {/* Sheet — monochromatic, matches card style */}
      <div
        className="relative w-full bg-card border border-border shadow-2xl flex flex-col rounded-t-2xl sm:rounded-2xl sm:max-w-sm overflow-hidden animate-in fade-in slide-in-from-bottom-3 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden shrink-0">
          <div className="w-8 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
          <p className="text-sm font-semibold text-foreground">
            {view === "done" ? "Signature added" : "Add your signature?"}
          </p>
          <button
            type="button"
            onClick={() => { if (!signing) onCancel() }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-4 space-y-3">

          {view === "prompt" && (
            <>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {hasSavedSignature
                  ? "For contracts, both parties should sign. Use the signature on your profile, or draw a new one."
                  : "For contracts, both parties should sign. Add your signature now to make the agreement fully enforceable by both sides."}
              </p>
              <div className="flex flex-col gap-2">
                {/* Primary: use saved signature (only when available) */}
                {hasSavedSignature && (
                  <button
                    type="button"
                    onClick={handleSignWithSaved}
                    disabled={signing}
                    className="flex items-center justify-between w-full px-3.5 py-3 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-colors text-left disabled:opacity-60"
                  >
                    <div className="flex items-center gap-2.5">
                      {signing
                        ? <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                      <span className="text-sm font-medium">
                        {signing ? "Signing…" : "Sign with my saved signature"}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-60" />
                  </button>
                )}
                {/* Draw a new signature */}
                <button
                  type="button"
                  onClick={() => setView("pad")}
                  disabled={signing}
                  className="flex items-center justify-between w-full px-3.5 py-3 rounded-xl border border-border bg-background hover:bg-muted/40 transition-colors text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-2.5">
                    <PenLine className="w-4 h-4 text-foreground/70 shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {hasSavedSignature ? "Draw a new signature" : "Add my signature"}
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </button>
                {/* Skip */}
                <button
                  type="button"
                  onClick={onSkip}
                  disabled={signing}
                  className="flex items-center justify-between w-full px-3.5 py-3 rounded-xl border border-border/50 bg-transparent hover:bg-muted/30 transition-colors text-left disabled:opacity-60"
                >
                  <span className="text-sm text-muted-foreground">Skip — send without my signature</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/30" />
                </button>
              </div>
            </>
          )}

          {view === "pad" && (
            <>
              <p className="text-xs text-muted-foreground">Draw your signature below</p>
              <SignaturePad onSignature={setSignatureDataUrl} />
              {signatureDataUrl && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Signature captured
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setView("prompt")}
                  disabled={signing}
                  className="flex-1 h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSign}
                  disabled={!signatureDataUrl || signing}
                  className="flex-1 h-10 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {signing
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Signing…</>
                    : "Sign & Send"
                  }
                </button>
              </div>
            </>
          )}

          {view === "done" && (
            <div className="flex items-center gap-2.5 py-2">
              <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">Sending contract to client…</p>
            </div>
          )}

        </div>
      </div>
    </div>,
    document.body
  )
}
