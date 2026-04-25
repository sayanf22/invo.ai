"use client"

import { useState } from "react"
import { Loader2, Copy, CheckCircle2, Link } from "lucide-react"
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
      toast.success("Signing link copied to clipboard")
    })
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset state when closing
      setSignerName("")
      setSignerEmail("")
      setParty("Client")
      setPersonalMessage("")
      setSigningUrl(null)
      setError(null)
      setLoading(false)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get Signature</DialogTitle>
        </DialogHeader>

        {signingUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">Signing request created successfully</p>
            </div>
            <div className="space-y-2">
              <Label>Signing Link</Label>
              <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
                <Link className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-muted-foreground">{signingUrl}</span>
              </div>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" />
              Copy Link
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
              <Label htmlFor="personalMessage">Personal Message (optional)</Label>
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
                "Send for Signature"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
