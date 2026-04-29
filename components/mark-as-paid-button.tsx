"use client"

import { useState } from "react"
import {
  CheckCircle2, Loader2, RotateCcw, Banknote,
  Building2, FileCheck, Smartphone, CreditCard, MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { authFetch } from "@/lib/auth-fetch"
import { format } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentMethod = "cash" | "bank_transfer" | "check" | "upi" | "wire" | "other"

interface MarkAsPaidButtonProps {
  sessionId: string
  /** Whether the invoice is already manually marked as paid */
  isPaid?: boolean
  /** Whether it was paid via a real gateway (cannot be reverted) */
  isGatewayPaid?: boolean
  /** Timestamp when it was manually marked */
  paidAt?: string | null
  /** Payment method used */
  paymentMethod?: string | null
  /** Called after successful mark/unmark */
  onStatusChange?: (paid: boolean) => void
  /** Compact mode for use inside document cards */
  compact?: boolean
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: "cash",          label: "Cash",          icon: Banknote },
  { id: "bank_transfer", label: "Bank Transfer",  icon: Building2 },
  { id: "upi",           label: "UPI / Wallet",   icon: Smartphone },
  { id: "check",         label: "Check / Cheque", icon: FileCheck },
  { id: "wire",          label: "Wire Transfer",  icon: CreditCard },
  { id: "other",         label: "Other",          icon: MoreHorizontal },
]

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  upi: "UPI / Wallet",
  check: "Check",
  wire: "Wire Transfer",
  other: "Other",
}

// ── Mark as Paid Dialog ───────────────────────────────────────────────────────

function MarkAsPaidDialog({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: (method: PaymentMethod, note: string) => void
  onCancel: () => void
  isLoading: boolean
}) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("bank_transfer")
  const [note, setNote] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[6px]" onClick={onCancel} />
      <div className="relative w-full sm:max-w-[420px] bg-card rounded-t-[28px] sm:rounded-[24px] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] border border-border/60 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Mobile handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        <div className="overflow-y-auto overscroll-contain px-6 pb-7 pt-4 sm:pt-6 space-y-5" style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}>
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Mark as Paid</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Record a payment received outside the platform
              </p>
            </div>
          </div>

          {/* Payment method selector */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              How was it paid?
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedMethod(id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border text-center transition-all duration-150 active:scale-[0.97]",
                    selectedMethod === id
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700 shadow-sm"
                      : "border-border bg-muted/30 hover:bg-muted/60 hover:border-border/80"
                  )}
                >
                  <Icon
                    size={18}
                    className={cn(
                      selectedMethod === id
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px] font-semibold leading-tight",
                      selectedMethod === id
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional note */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Note <span className="normal-case font-normal">(optional)</span>
            </p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Ref #12345, received on 28 Apr"
              rows={2}
              maxLength={200}
              className={cn(
                "w-full px-3.5 py-2.5 rounded-xl border border-border bg-background",
                "text-sm text-foreground placeholder:text-muted-foreground/40",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50",
                "resize-none transition-all duration-150"
              )}
            />
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
            <span className="text-sm shrink-0 mt-0.5">ℹ️</span>
            <p className="text-[12px] text-blue-700 dark:text-blue-400 leading-relaxed">
              All pending email reminders will be stopped automatically.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-3 px-4 rounded-2xl text-sm font-semibold border border-border bg-card hover:bg-muted/60 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedMethod, note)}
              disabled={isLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-60 active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? "Saving..." : "Mark as Paid"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function MarkAsPaidButton({
  sessionId,
  isPaid = false,
  isGatewayPaid = false,
  paidAt,
  paymentMethod,
  onStatusChange,
  compact = false,
}: MarkAsPaidButtonProps) {
  const [showDialog, setShowDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showUnmarkConfirm, setShowUnmarkConfirm] = useState(false)

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
        toast.success("Invoice marked as paid", {
          description: "Email reminders have been stopped.",
        })
        setShowDialog(false)
        onStatusChange?.(true)
      } else {
        toast.error(data.error || "Failed to mark as paid")
      }
    } catch {
      toast.error("Failed to mark as paid")
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnmark = async () => {
    setIsLoading(true)
    try {
      const res = await authFetch(`/api/payments/mark-paid?sessionId=${sessionId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Payment status reverted to unpaid")
        setShowUnmarkConfirm(false)
        onStatusChange?.(false)
      } else {
        toast.error(data.error || "Failed to revert payment status")
      }
    } catch {
      toast.error("Failed to revert payment status")
    } finally {
      setIsLoading(false)
    }
  }

  // Gateway-paid: show read-only badge
  if (isGatewayPaid) {
    return (
      <div className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800",
        "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
      )}>
        <CheckCircle2 size={compact ? 11 : 13} />
        <span className="font-semibold">Paid via Gateway</span>
      </div>
    )
  }

  // Already manually paid
  if (isPaid) {
    return (
      <>
        <div className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border shrink-0",
          "border-foreground/10 bg-foreground/[0.06] dark:bg-foreground/10",
          compact ? "px-2 py-1" : "px-3 py-1.5"
        )}>
          <CheckCircle2 size={compact ? 11 : 12} className="text-foreground/70 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className={cn(
              "font-semibold text-foreground/80 leading-tight",
              compact ? "text-[11px]" : "text-xs"
            )}>
              Paid
              {paymentMethod && (
                <span className="font-normal text-foreground/50 ml-1">
                  · {METHOD_LABELS[paymentMethod] || paymentMethod}
                </span>
              )}
            </span>
            {paidAt && !compact && (
              <span className="text-[10px] text-foreground/40 leading-tight">
                {format(new Date(paidAt), "MMM d, yyyy")}
              </span>
            )}
          </div>
          {/* Unmark button */}
          <button
            type="button"
            onClick={() => setShowUnmarkConfirm(true)}
            title="Revert to unpaid"
            className={cn(
              "ml-0.5 rounded-lg text-foreground/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors",
              compact ? "p-0.5" : "p-1"
            )}
          >
            <RotateCcw size={compact ? 10 : 11} />
          </button>
        </div>

        {/* Unmark confirm */}
        {showUnmarkConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]" onClick={() => setShowUnmarkConfirm(false)} />
            <div className="relative bg-card rounded-2xl border border-border shadow-xl p-6 max-w-sm w-full space-y-4">
              <h3 className="font-bold text-base">Revert to Unpaid?</h3>
              <p className="text-sm text-muted-foreground">
                This will mark the invoice as unpaid again. Email reminders will not be automatically restarted.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnmarkConfirm(false)}
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  Keep Paid
                </button>
                <button
                  type="button"
                  onClick={handleUnmark}
                  disabled={isLoading}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {isLoading && <Loader2 size={14} className="animate-spin" />}
                  Revert
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Not paid — show "Mark as Paid" button
  return (
    <>
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border-0 transition-all duration-150",
          "active:scale-[0.96] active:bg-foreground/80 shrink-0",
          "bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.13]",
          "touch-manipulation select-none",
          compact
            ? "px-2.5 py-1 text-[11px] font-semibold h-7"
            : "px-3 py-1.5 text-[13px] font-semibold h-9"
        )}
        style={{
          boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 2px 6px -1px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.06)"
        }}
      >
        <CheckCircle2 size={compact ? 11 : 13} className="shrink-0" />
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
