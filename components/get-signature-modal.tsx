"use client"

import { useState } from "react"
import { Loader2, Copy, CheckCircle2, Link, MessageCircle, Mail } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface GetSignatureModalProps {
  sessionId: string
  documentType: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".")
}

export function GetSignatureModal({ sessionId, documentType, open, onOpenChange }: GetSignatureModalProps) {
  const [signerName, setSignerName] = useState("")
  const [signerEmail, setSignerEmail] = useState("")
  const [party, setParty] = useState("Client")
  const [personalMessage, setPersonalMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const canSubmit =
    signerName.trim().length > 0 &&
    isValidEmail(signerEmail.trim()) &&
    !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!canSubmit) return

    setLoading(true)
    try {
      const res = await fetch("/api/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          signerEmail: signerEmail.trim(),
          signerName: signerName.trim(),
          party: party.trim() || "Client",
          personalMessage: personalMessage.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Failed to create signing request.")
        return
      }

      setSigningUrl(data.signingUrl)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleCopyLink() {
    if (!signingUrl) return
    navigator.clipboard.writeText(signingUrl).then(() => {
      setCopied(true)
      toast.success("Signing link copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleWhatsApp() {
    if (!signingUrl) return
    const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1)
    const msg = `Hi ${signerName},\n\nPlease review and sign the ${docLabel} using the link below:\n\n${signingUrl}\n\nYou can sign it directly from your phone or computer — no account needed.\n\nThank you!`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
  }

  function handleEmailShare() {
    if (!signingUrl) return
    const docLabel = documentType.charAt(0).toUpperCase() + documentType.slice(1)
    const subject = encodeURIComponent(`Please sign: ${docLabel}`)
    const body = encodeURIComponent(`Hi ${signerName},\n\nPlease review and sign the ${docLabel} using the link below:\n\n${signingUrl}\n\nYou can sign it directly from your phone or computer.\n\nThank you!`)
    window.open(`mailto:${signerEmail}?subject=${subject}&body=${body}`, "_blank")
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setSignerName("")
      setSignerEmail("")
      setParty("Client")
      setPersonalMessage("")
      setSigningUrl(null)
      setError(null)
      setLoading(false)
      setCopied(false)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request Signature</DialogTitle>
        </DialogHeader>

        {signingUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Signing request sent to {signerEmail}</p>
            </div>

            {/* Signing link display */}
            <div className="space-y-2">
              <Label>Signing Link</Label>
              <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
                <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-xs text-muted-foreground">{signingUrl}</span>
              </div>
            </div>

            {/* Share options */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Share signing link via</Label>
              <div className="grid grid-cols-3 gap-2">
                {/* Copy link */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-xs font-medium"
                >
                  {copied ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Copy className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span>{copied ? "Copied!" : "Copy Link"}</span>
                </button>

                {/* WhatsApp */}
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 hover:bg-[#25D366]/10 transition-colors text-xs font-medium text-[#128C7E] dark:text-[#25D366]"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>WhatsApp</span>
                </button>

                {/* Email */}
                <button
                  type="button"
                  onClick={handleEmailShare}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-xs font-medium"
                >
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              The signer can open this link on any device — phone, tablet, or computer.
            </p>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOpenChange(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signerName">
                Signer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signerName"
                type="text"
                placeholder="Jane Smith"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signerEmail">
                Signer Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="signerEmail"
                type="email"
                placeholder="jane@example.com"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="party">Party / Role</Label>
              <Input
                id="party"
                type="text"
                placeholder="Client"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personalMessage">Personal Message <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                id="personalMessage"
                placeholder="Add a personal note to the signer..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button type="submit" className="w-full" disabled={!canSubmit}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Signing Request"
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              A signing link will be sent via email. You can also share it via WhatsApp after.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
