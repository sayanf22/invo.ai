"use client"

/**
 * SenderSignFirstModal
 *
 * Shown before sending a contract for signature.
 * Asks the sender if they want to add their own signature first (Party A).
 * This is best practice for contracts — both parties should sign.
 *
 * The sender can:
 *   1. Sign inline → self-sign is recorded → proceed to send
 *   2. Skip → send without sender signature
 *   3. Cancel → go back
 */

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Loader2, PenLine, CheckCircle2, X, ArrowRight, Info } from "lucide-react"
import { SignaturePad } from "@/components/signature-pad"
import { authFetch } from "@/lib/auth-fetch"
import { toast } from "sonner"

interface SenderSignFirstModalProps {
  open: boolean
  sessionId: string
  onSkip: () => void          // proceed without signing
  onSigned: () => void        // signed successfully, proceed to send
  onCancel: () => void        // go back
}

export function SenderSignFirstModal({
  open,
  sessionId,
  onSkip,
  onSigned,
  onCancel,
}: SenderSignFirstModalProps) {
  const [mounted, setMounted] = useState(false)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSignatureDataUrl(null)
      setSigned(false)
      setSigning(false)
    }
  }, [open])

  // Close on Escape
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
      if (res.ok) {
        setSigned(true)
        toast.success("Your signature has been recorded")
        // Brief pause so user sees the success state, then proceed
        setTimeout(() => onSigned(), 800)
      } else {
        const d = await res.json().catch(() => ({}))
        // If already signed, just proceed
        if (res.status === 409) {
          onSigned()
        } else {
          toast.error(d.error || "Failed to sign. Please try again.")
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSigning(false)
    }
  }, [signatureDataUrl, signing, sessionId, onSigned])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={() => { if (!signing) onCancel() }}
      />

      {/* Sheet */}
      <div
        className="relative w-full bg-background border border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-2xl sm:max-w-md max-h-[92dvh] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <PenLine className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Sign before sending?</h2>
              <p className="text-xs text-muted-foreground">Recommended for contracts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { if (!signing) onCancel() }}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {/* Info banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/60">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              For contracts, both parties should sign. Adding your signature now makes the agreement fully enforceable by both sides.
            </p>
          </div>

          {signed ? (
            /* Success state */
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Signature recorded</p>
              <p className="text-xs text-muted-foreground">Sending contract to client…</p>
            </div>
          ) : (
            <>
              {/* Signature pad */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your signature
                </p>
                <SignaturePad onSignature={setSignatureDataUrl} />
                {signatureDataUrl && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Signature captured
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        {!signed && (
          <div className="px-5 pb-5 pt-3 border-t border-border/50 space-y-2.5 shrink-0">
            {/* Primary: Sign & Send */}
            <button
              type="button"
              onClick={handleSign}
              disabled={!signatureDataUrl || signing}
              className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {signing ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing…</>
              ) : (
                <><PenLine className="w-4 h-4" /> Sign & Send Contract</>
              )}
            </button>

            {/* Secondary: Skip */}
            <button
              type="button"
              onClick={onSkip}
              disabled={signing}
              className="w-full h-10 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              Skip — send without my signature
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
