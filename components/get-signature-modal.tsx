"use client"

import { useState, useEffect } from "react"
import { Loader2, Copy, CheckCircle2, Link2, MessageCircle, Mail, PenLine, X, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"

interface GetSignatureModalProps {
  sessionId: string
  documentType: string
  /** Pre-fill from document data */
  defaultEmail?: string
  defaultName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function GetSignatureModal({
  sessionId,
  documentType,
  defaultEmail = "",
  defaultName = "",
  open,
  onOpenChange,
}: GetSignatureModalProps) {
  const [signerName, setSignerName] = useState(defaultName)
  const [signerEmail, setSignerEmail] = useState(defaultEmail)
  const [loading, setLoading] = useState(false)
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Pre-fill when defaults change
  useEffect(() => {
    if (defaultEmail && !signerEmail) setSignerEmail(defaultEmail)
    if (defaultName && !signerName) setSignerName(defaultName)
  }, [defaultEmail, defaultName])

  const canSubmit = signerName.trim().length > 0 && isValidEmail(signerEmail) && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await authFetch("/api/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          signerEmail: signerEmail.trim(),
          signerName: signerName.trim(),
          party: "Client",
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to create signing request.")
        return
      }
      setSigningUrl(data.signingUrl)
      if (data.emailWarning) setEmailWarning(data.emailWarning)
      else toast.success("Signing request sent!")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (!signingUrl) return
    navigator.clipboard.writeText(signingUrl).then(() => {
      setCopied(true)
      toast.success("Signing link copied!")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleWhatsApp() {
    if (!signingUrl) return
    const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1)
    const msg = `Hi ${signerName},\n\nPlease review and sign the ${docLabel} using the link below:\n\n${signingUrl}\n\nYou can sign it directly from your phone — no account needed.\n\nThank you!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
  }

  function handleEmailShare() {
    if (!signingUrl) return
    const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1)
    const subject = encodeURIComponent(`Please sign: ${docLabel}`)
    const body = encodeURIComponent(`Hi ${signerName},\n\nPlease review and sign the ${docLabel} using the link below:\n\n${signingUrl}\n\nYou can sign it directly from your phone or computer.\n\nThank you!`)
    window.open(`mailto:${signerEmail}?subject=${subject}&body=${body}`, "_blank")
  }

  function handleClose() {
    if (!open) return
    setSignerName(defaultName)
    setSignerEmail(defaultEmail)
    setSigningUrl(null)
    setEmailWarning(null)
    setError(null)
    setLoading(false)
    setCopied(false)
    onOpenChange(false)
  }

  if (!open) return null

  const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Bottom sheet — slides up from bottom on mobile, centered on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div
          className="relative w-full bg-card border border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-3xl sm:max-w-md max-h-[92dvh] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-4 shrink-0 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                <PenLine className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Request Signature</h2>
                <p className="text-xs text-muted-foreground">{docLabel}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            {signingUrl ? (
              /* ── Success state ── */
              <div className="space-y-4">
                {emailWarning ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Signing link created</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{emailWarning}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-medium">Signing request sent to {signerEmail}</p>
                  </div>
                )}

                {/* Signing link */}
                <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-xs text-muted-foreground truncate">{signingUrl}</span>
                </div>

                {/* Share options */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-xs font-medium min-h-[64px]"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5 text-muted-foreground" />}
                    <span>{copied ? "Copied!" : "Copy Link"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors text-xs font-medium text-[#128C7E] dark:text-[#25D366] min-h-[64px]"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleEmailShare}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-xs font-medium min-h-[64px]"
                  >
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <span>Email App</span>
                  </button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  The signer can open this link on any device — no account needed.
                </p>
              </div>
            ) : (
              /* ── Form state ── */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Signer Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Signer Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Jane Smith"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-12 px-4 rounded-xl border border-border/80 bg-white dark:bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors disabled:opacity-50 shadow-sm"
                  />
                </div>

                {/* Signer Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Signer Email <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="jane@example.com"
                    value={signerEmail}
                    onChange={e => setSignerEmail(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-12 px-4 rounded-xl border border-border/80 bg-white dark:bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors disabled:opacity-50 shadow-sm"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  A signing link will be sent via email. You can also share it via WhatsApp after.
                </p>
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-border/50">
            {signingUrl ? (
              <button
                type="button"
                onClick={handleClose}
                className="w-full h-11 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-secondary/60 transition-colors"
              >
                Done
              </button>
            ) : (
              <button
                type="submit"
                form="signature-form"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className="w-full h-11 rounded-xl bg-foreground text-background text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  <><PenLine className="w-4 h-4" /> Send Signing Request</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
