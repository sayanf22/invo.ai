"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  CheckCircle2, Loader2, RotateCcw, Banknote,
  Building2, FileCheck, Smartphone, CreditCard, MoreHorizontal, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { format } from "date-fns"

type PaymentMethod = "cash" | "bank_transfer" | "check" | "upi" | "wire" | "other"

interface MarkAsPaidButtonProps {
  sessionId: string
  isPaid?: boolean
  isGatewayPaid?: boolean
  paidAt?: string | null
  paymentMethod?: string | null
  onStatusChange?: (paid: boolean) => void
  compact?: boolean
}

const METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: "cash",          label: "Cash",           icon: Banknote },
  { id: "bank_transfer", label: "Bank Transfer",  icon: Building2 },
  { id: "upi",           label: "UPI / Wallet",   icon: Smartphone },
  { id: "check",         label: "Check / Cheque",  icon: FileCheck },
  { id: "wire",          label: "Wire Transfer",  icon: CreditCard },
  { id: "other",         label: "Other",          icon: MoreHorizontal },
]

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", bank_transfer: "Bank Transfer", upi: "UPI / Wallet",
  check: "Check", wire: "Wire Transfer", other: "Other",
}

// ── Portal Dialog ─────────────────────────────────────────────────────────────

function MarkAsPaidDialog({
  onConfirm, onCancel, isLoading,
}: {
  onConfirm: (method: PaymentMethod, note: string) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer")
  const [note, setNote] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Escape key closes
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !isLoading) onCancel() }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [onCancel, isLoading])

  if (!mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      onClick={(e) => { e.stopPropagation(); if (!isLoading) onCancel() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full sm:max-w-[400px] bg-card rounded-t-[24px] sm:rounded-2xl border border-border/60 flex flex-col max-h-[90dvh] sm:max-h-[85vh] animate-in fade-in slide-in-from-bottom-4 duration-300"
        style={{ boxShadow: "0 16px 64px -12px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto overscroll-contain px-5 pb-6 pt-4 sm:pt-5 space-y-4"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">Mark as Paid</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Record an offline payment</p>
            </div>
            <button type="button" onClick={onCancel} disabled={isLoading}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Payment methods — monochrome */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment method</p>
            <div className="grid grid-cols-3 gap-1.5">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setMethod(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-center transition-all duration-150 active:scale-[0.97]",
                    method === id
                      ? "border-foreground/30 bg-foreground/[0.06]"
                      : "border-border/50 bg-background hover:bg-muted/40"
                  )}
                >
                  <Icon size={16} className={method === id ? "text-foreground" : "text-muted-foreground"} />
                  <span className={cn("text-[10px] font-semibold leading-tight",
                    method === id ? "text-foreground" : "text-muted-foreground"
                  )}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Note <span className="normal-case font-normal">(optional)</span>
            </p>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="e.g. Ref #12345, received on 28 Apr"
              rows={2} maxLength={200}
              className="w-full px-3 py-2 rounded-xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30 resize-none transition-all"
            />
          </div>

          {/* Info */}
          <p className="text-[11px] text-muted-foreground leading-relaxed px-1">
            Email reminders will be stopped automatically.
          </p>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onCancel} disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-border/60 bg-background hover:bg-muted/40 transition-all disabled:opacity-50 active:scale-[0.98]">
              Cancel
            </button>
            <button type="button" onClick={() => onConfirm(method, note)} disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-foreground text-background hover:bg-foreground/90 transition-all disabled:opacity-60 active:scale-[0.98]"
              style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.08)" }}
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isLoading ? "Saving..." : "Mark Paid"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Revert Confirm Dialog ─────────────────────────────────────────────────────

function RevertDialog({
  onConfirm, onCancel, isLoading,
}: {
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { e.stopPropagation(); if (!isLoading) onCancel() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card rounded-2xl border border-border/60 p-5 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-200"
        style={{ boxShadow: "0 16px 64px -12px rgba(0,0,0,0.3)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-bold text-base text-foreground">Revert to Unpaid?</h3>
          <p className="text-sm text-muted-foreground mt-1">Email reminders will not be restarted.</p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel} disabled={isLoading}
            className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-semibold hover:bg-muted/40 transition-colors disabled:opacity-50">
            Keep Paid
          </button>
          <button type="button" onClick={onConfirm} disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors disabled:opacity-60">
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            Revert
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MarkAsPaidButton({
  sessionId, isPaid = false, isGatewayPaid = false,
  paidAt, paymentMethod, onStatusChange, compact = false,
}: MarkAsPaidButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showRevert, setShowRevert] = useState(false)

  const handleMarkPaid = async (method: PaymentMethod, note: string) => {
    setIsLoading(true)
    try {
      const res = await authFetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, paymentMethod: method, note: note || undefined }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Marked as paid")
        setShowDialog(false)
        onStatusChange?.(true)
      } else {
        toast.error(data.error || "Failed to mark as paid")
      }
    } catch { toast.error("Failed to mark as paid") }
    finally { setIsLoading(false) }
  }

  const handleUnmark = async () => {
    setIsLoading(true)
    try {
      const res = await authFetch(`/api/payments/mark-paid?sessionId=${sessionId}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        toast.success("Reverted to unpaid")
        setShowRevert(false)
        onStatusChange?.(false)
      } else { toast.error(data.error || "Failed to revert") }
    } catch { toast.error("Failed to revert") }
    finally { setIsLoading(false) }
  }

  // Gateway-paid badge
  if (isGatewayPaid) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-xl shrink-0",
        "bg-foreground/[0.06] text-foreground/70",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      )}>
        <CheckCircle2 size={compact ? 10 : 11} />
        <span className="font-semibold">Paid via Gateway</span>
      </span>
    )
  }

  // Already paid badge + revert
  if (isPaid) {
    return (
      <>
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-xl shrink-0",
          "bg-foreground/[0.06] text-foreground/70",
          compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
        )}>
          <CheckCircle2 size={compact ? 10 : 11} className="shrink-0" />
          <span className="font-semibold">
            Paid{paymentMethod ? ` · ${METHOD_LABELS[paymentMethod] || paymentMethod}` : ""}
          </span>
          {paidAt && !compact && (
            <span className="text-foreground/40 ml-0.5">{format(new Date(paidAt), "MMM d")}</span>
          )}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setShowRevert(true) }}
            title="Revert to unpaid"
            className="ml-0.5 rounded-md text-foreground/30 hover:text-foreground/60 transition-colors p-0.5">
            <RotateCcw size={compact ? 9 : 10} />
          </button>
        </span>
        {showRevert && (
          <RevertDialog onConfirm={handleUnmark} onCancel={() => setShowRevert(false)} isLoading={isLoading} />
        )}
      </>
    )
  }

  // Not paid — button
  return (
    <>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); setShowDialog(true) }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl transition-all duration-150",
          "active:scale-[0.96] shrink-0 touch-manipulation select-none",
          "bg-foreground/[0.07] text-foreground hover:bg-foreground/[0.12]",
          compact ? "px-2.5 py-1 text-[10px] font-semibold" : "px-3 py-1.5 text-[12px] font-semibold"
        )}
        style={{
          boxShadow: "0 1px 2px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.04)"
        }}
      >
        <CheckCircle2 size={compact ? 10 : 12} className="shrink-0" />
        <span>Mark Paid</span>
      </button>
      {showDialog && (
        <MarkAsPaidDialog
          onConfirm={handleMarkPaid}
          onCancel={() => setShowDialog(false)}
          isLoading={isLoading}
        />
      )}
    </>
  )
}
