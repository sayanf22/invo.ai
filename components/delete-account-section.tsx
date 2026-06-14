"use client"

import { useState } from "react"
import { useSupabase } from "@/components/auth-provider"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { AlertTriangle, ChevronDown, Loader2, Trash2 } from "lucide-react"

const WILL_BE_DELETED = [
  "Your profile and business details",
  "Every document, invoice, contract, quote and proposal you created",
  "All chat history, prompts and AI generations",
  "Saved signatures, logos and uploaded files",
  "Payment links, usage records and email history",
  "Your login history and all account settings",
]

export function DeleteAccountSection() {
  const supabase = useSupabase()
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)

  function openDialog() {
    setStep(1)
    setConfirmText("")
    setOpen(true)
  }

  function closeDialog() {
    if (loading) return
    setOpen(false)
    setStep(1)
    setConfirmText("")
  }

  async function handleDelete() {
    if (confirmText.trim() !== "DELETE") {
      toast.error('Type DELETE in capital letters to confirm.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/profile/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: confirmText.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete account")
      }
      toast.success("Your account has been permanently deleted.")
      // Clear the now-invalid session and leave the app.
      await supabase.auth.signOut().catch(() => {})
      window.location.href = "/"
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account")
      setLoading(false)
    }
  }

  return (
    <Card className="rounded-[1.5rem] sm:rounded-[2rem] shadow-xl border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible actions that permanently affect your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
            Show account deletion options
          </button>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-semibold text-destructive">
                Deleting your account is permanent and cannot be undone.
              </p>
              <p className="text-sm text-muted-foreground">
                The following will be erased immediately and cannot be recovered:
              </p>
              <ul className="space-y-1.5">
                {WILL_BE_DELETED.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-destructive/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Need help instead? Email{" "}
                <a href="mailto:support@clorefy.com" className="underline hover:text-foreground">
                  support@clorefy.com
                </a>
                .
              </p>
            </div>
            <Button variant="destructive" onClick={openDialog} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete my account
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : closeDialog())}>
        <DialogContent>
          {step === 1 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Permanently delete your account?
                </DialogTitle>
                <DialogDescription>
                  This is the first of two confirmations. Once deleted, your data is gone forever —
                  there is no way for us or you to restore it.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={closeDialog}>
                  Keep my account
                </Button>
                <Button variant="destructive" onClick={() => setStep(2)}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Final confirmation
                </DialogTitle>
                <DialogDescription>
                  Type <span className="font-mono font-semibold text-foreground">DELETE</span> below
                  to permanently delete your account and all of its data.
                </DialogDescription>
              </DialogHeader>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                autoFocus
                disabled={loading}
              />
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={loading}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading || confirmText.trim() !== "DELETE"}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Permanently delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
