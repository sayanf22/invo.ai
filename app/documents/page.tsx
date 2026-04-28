"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import {
  FileText, Download, Eye, Calendar, Loader2, ArrowLeft, Plus,
  CheckCircle2, Clock, AlertCircle, XCircle, Link2, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, CreditCard, Send, Mail,
  BellOff, Repeat2, Bell, MessageSquare, PenLine,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { authFetch } from "@/lib/auth-fetch"
import { useSafeBack } from "@/hooks/use-safe-back"
import { MarkAsPaidButton } from "@/components/mark-as-paid-button"

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
}

const slideVariants = {
  enter: { opacity: 0, x: 15 },
  center: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -15, transition: { duration: 0.2, ease: "easeIn" } }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaymentRecord {
  id: string
  short_url: string
  amount: number
  currency: string
  status: "created" | "paid" | "partially_paid" | "expired" | "cancelled"
  amount_paid: number | null
  paid_at: string | null
  expires_at: string | null
  created_at: string
  view_count: number
  link_viewed_at: string | null
  reference_id: string | null
  customer_name: string | null
  gateway: string
  razorpay_payment_link_id: string | null
  is_manual?: boolean
  manual_payment_method?: string | null
  manual_payment_note?: string | null
  manually_marked_at?: string | null
}

interface EmailRecord {
  id: string
  session_id: string
  recipient_email: string
  status: "sent" | "delivered" | "opened" | "bounced" | "failed"
  created_at: string
}

interface EmailStats {
  totalSent: number
  opened: number
  delivered: number
  bounced: number
  lastSentAt: string | null
  emails: EmailRecord[]
  nextReminderAt: string | null       // next pending schedule
  pendingCount: number                // how many reminders still queued
}

interface EmailSchedule {
  id: string
  sequence_step: number
  sequence_type: string
  scheduled_for: string
  status: "pending" | "sent" | "cancelled" | "failed" | "skipped"
  sent_at: string | null
  cancelled_reason: string | null
}

interface SignatureRecord {
  id: string
  signer_name: string
  signer_email: string
  signed_at: string | null
  signer_action: string | null
  created_at: string
}

interface DocSession {
  id: string
  document_type: string
  status: string
  client_name: string | null
  created_at: string
  updated_at: string | null
  sent_at: string | null
  context: any
  chain_id?: string | null
  payment?: PaymentRecord | null
  email?: EmailRecord | null          // most recent email (for badge)
  emailStats?: EmailStats | null
  schedules?: EmailSchedule[]         // upcoming reminder schedule
  quotationResponse?: { response_type: string } | null
  recurring?: RecurringRecord | null
  signatures?: SignatureRecord[]
  chainCount?: number                 // number of linked documents in the chain
}

interface RecurringRecord {
  id: string
  frequency: "weekly" | "monthly" | "quarterly"
  is_active: boolean
  auto_send: boolean
  recipient_email: string | null
  next_run_at: string
  last_run_at: string | null
  run_count: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contract: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  quotation: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  proposal: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

const PAYMENT_STATUS_CONFIG = {
  paid: {
    label: "Paid",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  partially_paid: {
    label: "Partial",
    icon: Clock,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  created: {
    label: "Pending",
    icon: Clock,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  expired: {
    label: "Expired",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    dot: "bg-red-500",
  },
}

// ── Payment Status Badge ──────────────────────────────────────────────────────

function PaymentBadge({ payment }: { payment: PaymentRecord }) {
  const cfg = PAYMENT_STATUS_CONFIG[payment.status] ?? PAYMENT_STATUS_CONFIG.created
  const Icon = cfg.icon
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0", cfg.className)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  )
}

// ── Email Status Badge ────────────────────────────────────────────────────────

function EmailBadge({ email }: { email: EmailRecord }) {
  const config = {
    sent: { label: "Sent", className: "bg-muted text-muted-foreground" },
    delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    opened: { label: "Opened", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    bounced: { label: "Bounced", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  }
  const { label, className } = config[email.status] || config.sent
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0", className)}
      title={email.recipient_email ? `Sent to ${email.recipient_email}` : undefined}>
      <Mail size={10} />
      {label}
    </span>
  )
}

// ── Quotation Response Badge ──────────────────────────────────────────────────

function QuotationResponseBadge({ responseType }: { responseType: string }) {
  const config: Record<string, { label: string; className: string }> = {
    accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700" },
    declined: { label: "Declined", className: "bg-red-100 text-red-700" },
    changes_requested: { label: "Changes Requested", className: "bg-orange-100 text-orange-700" },
  }
  const { label, className } = config[responseType] ?? config.accepted
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0", className)}>
      {label}
    </span>
  )
}

// ── Signature Status Badge ─────────────────────────────────────────────────────

function SignatureBadge({ signature }: { signature: SignatureRecord }) {
  // Declined takes priority
  if (signature.signer_action === "declined") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 shrink-0">
        <XCircle size={10} />
        {signature.signer_name}
      </span>
    )
  }
  // Revision requested
  if (signature.signer_action === "revision_requested") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
        <MessageSquare size={10} />
        {signature.signer_name}
      </span>
    )
  }
  // Signed
  if (signature.signed_at) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
        <CheckCircle2 size={10} />
        {signature.signer_name}
      </span>
    )
  }
  // Pending (signed_at null, signer_action null)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 shrink-0">
      <Clock size={10} />
      {signature.signer_name}
    </span>
  )
}

// ── Payment Detail Panel ──────────────────────────────────────────────────────

function PaymentPanel({ payment, currency, sessionId, onCancelled }: { payment: PaymentRecord; currency: string; sessionId: string; onCancelled?: () => void }) {
  const [cancelling, setCancelling] = useState(false)
  const [cancelled, setCancelled] = useState(false)

  const fmt = (paise: number) => {
    const amount = paise / 100
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency || currency, maximumFractionDigits: 2 }).format(amount)
  }

  const isOverdue = payment.status === "created" && payment.expires_at && new Date(payment.expires_at) < new Date()

  const handleCancelPaymentLink = async () => {
    if (!payment.razorpay_payment_link_id) { toast.error("No payment link ID found"); return }
    setCancelling(true)
    try {
      const res = await authFetch("/api/payments/cancel-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, razorpayPaymentLinkId: payment.razorpay_payment_link_id }),
      })
      if (res.ok) {
        setCancelled(true)
        // Also stop follow-up reminders
        await authFetch(`/api/emails/schedules?sessionId=${sessionId}`, { method: "DELETE" }).catch(() => {})
        toast.success("Payment link cancelled and reminders stopped")
        onCancelled?.()
      } else {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Failed to cancel payment link")
      }
    } catch {
      toast.error("Failed to cancel payment link")
    } finally {
      setCancelling(false)
    }
  }

  const isActive = (payment.status === "created" || payment.status === "partially_paid") && !cancelled

  return (
    <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      {/* Amount row */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <CreditCard size={13} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">{fmt(payment.amount)}</span>
          {payment.status === "partially_paid" && payment.amount_paid && (
            <span className="text-xs text-muted-foreground">({fmt(payment.amount_paid)} paid)</span>
          )}
        </div>
        <PaymentBadge payment={payment} />
      </div>

      {/* Tracking info */}
      <div className="px-3 py-2 space-y-1.5">
        {/* View tracking */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1.5">
            <Eye size={11} />
            {payment.view_count > 0
              ? `Viewed ${payment.view_count} time${payment.view_count > 1 ? "s" : ""}`
              : "Not yet viewed"}
          </span>
          {payment.link_viewed_at && (
            <span className="text-muted-foreground">
              Last: {formatDistanceToNow(new Date(payment.link_viewed_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Paid at */}
        {payment.paid_at && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} />
            Paid {format(new Date(payment.paid_at), "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}

        {/* Expiry */}
        {payment.expires_at && payment.status === "created" && (
          <div className={cn("flex items-center gap-1.5 text-xs", isOverdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
            <Clock size={11} />
            {isOverdue
              ? `Expired ${formatDistanceToNow(new Date(payment.expires_at), { addSuffix: true })}`
              : `Expires ${format(new Date(payment.expires_at), "MMM d, yyyy")}`}
          </div>
        )}

        {/* Payment link */}
        {isActive && (
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <a
              href={payment.short_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            >
              <Link2 size={11} />
              Open payment link
              <ExternalLink size={10} />
            </a>
            <button
              type="button"
              onClick={handleCancelPaymentLink}
              disabled={cancelling}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800/50 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
              Cancel Link
            </button>
          </div>
        )}

        {/* Cancelled state */}
        {cancelled && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
            <XCircle size={11} />
            Payment link cancelled
          </div>
        )}
      </div>
    </div>
  )
}

// ── Email History Panel ───────────────────────────────────────────────────────

function EmailHistoryPanel({ stats, sessionId }: { stats: EmailStats; sessionId: string }) {
  const [stopping, setStopping] = useState(false)
  const [stopped, setStopped] = useState(false)

  const statusConfig: Record<string, { label: string; dot: string }> = {
    sent:      { label: "Sent",      dot: "bg-muted-foreground/40" },
    delivered: { label: "Delivered", dot: "bg-emerald-500" },
    opened:    { label: "Opened",    dot: "bg-blue-500" },
    bounced:   { label: "Bounced",   dot: "bg-red-500" },
    failed:    { label: "Failed",    dot: "bg-red-500" },
  }

  const handleStopFollowUps = async () => {
    setStopping(true)
    try {
      const res = await authFetch(`/api/emails/schedules?sessionId=${sessionId}`, { method: "DELETE" })
      if (res.ok) { setStopped(true); toast.success("Follow-up reminders stopped") }
      else toast.error("Failed to stop reminders")
    } catch { toast.error("Failed to stop reminders") }
    finally { setStopping(false) }
  }

  const nextReminder = !stopped && stats.nextReminderAt ? new Date(stats.nextReminderAt) : null

  return (
    <div className="mt-1.5 rounded-xl border border-border/40 bg-background overflow-hidden"
      style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

      {/* Next reminder row — clean, no colored background */}
      {nextReminder && !stopped && (
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <Bell size={13} className="text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-medium text-foreground">
                Next reminder {formatDistanceToNow(nextReminder, { addSuffix: true })}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {format(nextReminder, "MMM d, yyyy 'at' h:mm a")}
                {stats.pendingCount > 1 && ` · ${stats.pendingCount} queued`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStopFollowUps}
            disabled={stopping}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors disabled:opacity-50 shrink-0"
          >
            {stopping ? <Loader2 size={11} className="animate-spin" /> : <BellOff size={11} />}
            Stop
          </button>
        </div>
      )}

      {/* Stats summary */}
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-b border-border/30">
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{stats.totalSent}</span> sent
        </span>
        {stats.opened > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span className="font-semibold text-foreground">{stats.opened}</span> opened
          </span>
        )}
        {stats.delivered > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="font-semibold text-foreground">{stats.delivered}</span> delivered
          </span>
        )}
        {stats.bounced > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
            <span className="font-semibold text-foreground">{stats.bounced}</span> bounced
          </span>
        )}
        {/* Stop button when no reminder banner */}
        {(!nextReminder || stopped) && stats.pendingCount > 0 && !stopped && (
          <button
            type="button"
            onClick={handleStopFollowUps}
            disabled={stopping}
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors disabled:opacity-50"
          >
            {stopping ? <Loader2 size={11} className="animate-spin" /> : <BellOff size={11} />}
            Stop reminders
          </button>
        )}
        {stopped && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <BellOff size={11} /> Stopped
          </span>
        )}
      </div>

      {/* Email rows */}
      {stats.emails.length > 0 && (
        <div>
          {stats.emails.map((e, i) => {
            const cfg = statusConfig[e.status] || statusConfig.sent
            return (
              <div key={e.id} className={cn(
                "flex items-center justify-between px-3.5 py-2.5",
                i < stats.emails.length - 1 && "border-b border-border/20"
              )}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[11px] text-muted-foreground/60 shrink-0 tabular-nums">#{i + 1}</span>
                  <span className="text-xs text-foreground truncate max-w-[180px]">{e.recipient_email}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                    <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                    {format(new Date(e.created_at), "MMM d")}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Recurring Panel ───────────────────────────────────────────────────────────

function RecurringPanel({ session, onRefresh }: { session: DocSession; onRefresh?: () => void }) {
  const rec = session.recurring
  const [saving, setSaving] = useState(false)
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly">(rec?.frequency ?? "monthly")
  const [isActive, setIsActive] = useState(rec?.is_active ?? false)

  const FREQ_LABELS: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  }

  async function handleToggle() {
    setSaving(true)
    try {
      if (isActive) {
        // Turn off
        const res = await authFetch(`/api/recurring?sessionId=${session.id}`, { method: "DELETE" })
        if (res.ok) { setIsActive(false); toast.success("Recurring invoicing paused"); onRefresh?.() }
        else toast.error("Failed to pause")
      } else {
        // Turn on
        const res = await authFetch("/api/recurring", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.id, frequency }),
        })
        if (res.ok) { setIsActive(true); toast.success(`Recurring ${frequency} invoicing enabled`); onRefresh?.() }
        else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Failed to enable") }
      }
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  async function handleFrequencyChange(f: "weekly" | "monthly" | "quarterly") {
    setFrequency(f)
    if (!isActive) return
    setSaving(true)
    try {
      const res = await authFetch("/api/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id, frequency: f }),
      })
      if (res.ok) { toast.success(`Frequency updated to ${f}`); onRefresh?.() }
      else toast.error("Failed to update frequency")
    } catch { toast.error("Network error") }
    finally { setSaving(false) }
  }

  return (
    <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      {/* Header row with toggle */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Repeat2 size={13} className={cn("shrink-0", isActive ? "text-violet-500" : "text-muted-foreground")} />
          <span className="text-xs font-semibold text-foreground">
            {isActive ? `Recurring · ${FREQ_LABELS[frequency]}` : "Recurring invoicing"}
          </span>
          {isActive && rec?.next_run_at && (
            <span className="text-[10px] text-muted-foreground">
              · next {format(new Date(rec.next_run_at), "MMM d")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 shrink-0 cursor-pointer",
            isActive ? "bg-violet-500" : "bg-muted",
            saving && "opacity-50 pointer-events-none"
          )}
          aria-label={isActive ? "Pause recurring" : "Enable recurring"}
        >
          <span className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200",
            isActive ? "translate-x-[18px]" : "translate-x-0.5"
          )} />
        </button>
      </div>

      {/* Frequency selector — shown when active or when turning on */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        "grid-rows-[1fr]"
      )}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["weekly", "monthly", "quarterly"] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFrequencyChange(f)}
                  disabled={saving}
                  className={cn(
                    "py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 capitalize",
                    frequency === f
                      ? "bg-violet-500 text-white shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
            {isActive && rec && (
              <p className="text-[10px] text-muted-foreground">
                {rec.run_count > 0
                  ? `${rec.run_count} invoice${rec.run_count > 1 ? "s" : ""} generated · last ${format(new Date(rec.last_run_at!), "MMM d, yyyy")}`
                  : "First invoice will be generated on the next run date"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Signature Details Panel ────────────────────────────────────────────────────

interface SignatureDetailRecord extends SignatureRecord {
  party?: string
  ip_address?: string | null
  verification_url?: string | null
  signer_reason?: string | null
  user_agent?: string | null
  document_hash?: string | null
}

function SignatureDetailsPanel({ sessionId, expanded }: { sessionId: string; expanded: boolean }) {
  const [signatures, setSignatures] = useState<SignatureDetailRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!expanded || fetched) return
    let cancelled = false
    async function fetchDetails() {
      setLoading(true)
      try {
        const res = await authFetch(`/api/signatures?sessionId=${sessionId}`)
        if (!res.ok) throw new Error("Failed to fetch")
        const data = await res.json()
        if (!cancelled) {
          setSignatures(data.signatures ?? [])
          setFetched(true)
        }
      } catch {
        if (!cancelled) setFetched(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetails()
    return () => { cancelled = true }
  }, [expanded, sessionId, fetched])

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 flex items-center justify-center">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (signatures.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">No signature details available.</p>
      </div>
    )
  }

  const getStatusBadge = (sig: SignatureDetailRecord) => {
    if (sig.signer_action === "declined") return { icon: "❌", label: "Declined" }
    if (sig.signer_action === "revision_requested") return { icon: "📝", label: "Revision Requested" }
    if (sig.signed_at) return { icon: "✅", label: "Signed" }
    return { icon: "⏳", label: "Pending" }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
      {signatures.filter(sig => sig.signer_action !== "cancelled").map(sig => {
        const status = getStatusBadge(sig)
        return (
          <div key={sig.id} className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {sig.signer_name}
                {sig.party && <span className="text-muted-foreground font-normal"> ({sig.party})</span>}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground">
                {status.icon} {status.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{sig.signer_email}</p>
            {sig.signed_at && (
              <p className="text-xs text-muted-foreground">
                Signed: {format(new Date(sig.signed_at), "MMM d, yyyy h:mm a")} UTC
              </p>
            )}
            {sig.ip_address && (
              <p className="text-xs text-muted-foreground">IP: {sig.ip_address}</p>
            )}
            {sig.user_agent && (
              <p className="text-xs text-muted-foreground/70 truncate max-w-[280px]" title={sig.user_agent}>
                Device: {sig.user_agent.includes("Mobile") ? "Mobile" : "Desktop"} · {
                  sig.user_agent.includes("Chrome") ? "Chrome" :
                  sig.user_agent.includes("Firefox") ? "Firefox" :
                  sig.user_agent.includes("Safari") ? "Safari" : "Browser"
                }
              </p>
            )}
            {sig.document_hash && (
              <p className="text-xs text-muted-foreground/70 font-mono truncate max-w-[280px]" title={sig.document_hash}>
                Hash: {sig.document_hash.slice(0, 16)}…
              </p>
            )}
            {sig.verification_url && (
              <a
                href={sig.verification_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
              >
                <ExternalLink size={10} />
                Verify signature
              </a>
            )}
            {(sig.signer_action === "declined" || sig.signer_action === "revision_requested") && sig.signer_reason && (
              <p className="text-xs text-red-600 dark:text-red-400 italic">
                Reason: &ldquo;{sig.signer_reason}&rdquo;
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Chain Group Card ──────────────────────────────────────────────────────────

function ChainGroupCard({
  clientName,
  sessions,
  onDownload,
  downloadingId,
  onRefresh,
}: {
  clientName: string | null
  sessions: DocSession[]
  onDownload: (s: DocSession) => void
  downloadingId: string | null
  onRefresh?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const docTypes = [...new Set(sessions.map(s => s.document_type))].map(t => t.charAt(0).toUpperCase() + t.slice(1))
  const latestSession = sessions[0]
  const latestCtx = latestSession.context || {}
  const latestRef = latestCtx.invoiceNumber || latestCtx.referenceNumber || ""

  return (
    <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-all duration-300 hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)]">
      {/* Group header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/8 dark:bg-primary/15 flex items-center justify-center shrink-0">
          <Link2 size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{clientName || latestRef || "Linked Documents"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sessions.length} documents · {docTypes.join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Doc type pills */}
          {docTypes.map(t => (
            <span key={t} className={cn(
              "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider",
              TYPE_COLORS[t.toLowerCase()] || "bg-muted text-muted-foreground"
            )}>
              {t}
            </span>
          ))}
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable list of DocCards */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3 space-y-2">
            {sessions.map(s => (
              <DocCard
                key={s.id}
                session={s}
                onDownload={onDownload}
                downloading={downloadingId === s.id}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocCard({
  session,
  onDownload,
  downloading,
  onRefresh,
}: {
  session: DocSession
  onDownload: (s: DocSession) => void
  downloading: boolean
  onRefresh?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [recurringExpanded, setRecurringExpanded] = useState(false)
  const [signatureExpanded, setSignatureExpanded] = useState(false)
  const [localPayment, setLocalPayment] = useState<PaymentRecord | null>(session.payment ?? null)
  const [localStatus, setLocalStatus] = useState(session.status)
  const docType = (session.document_type || "invoice").toLowerCase()
  const ctx = session.context || {}

  const title = ctx.invoiceNumber || ctx.referenceNumber || session.client_name ||
    `${docType.charAt(0).toUpperCase() + docType.slice(1)}`

  const total = (() => {
    if (!ctx.items || !Array.isArray(ctx.items) || ctx.items.length === 0) return null
    const subtotal = ctx.items.reduce((sum: number, item: any) =>
      sum + (Number(item.quantity) || 1) * (Number(item.rate) || 0), 0)
    return `${ctx.currency || "₹"}${subtotal.toLocaleString()}`
  })()

  const payment = localPayment
  const hasPayment = !!payment
  const emailStats = session.emailStats
  const hasEmails = !!emailStats && (emailStats.totalSent > 0 || emailStats.pendingCount > 0)
  const hasRecurring = docType === "invoice" // show recurring option for all invoices
  const hasSignatures = !!(session.signatures && session.signatures.length > 0)

  // Determine if this invoice is manually paid (no gateway)
  const isManuallyPaid = payment?.is_manual === true || payment?.gateway === "manual"
  const isGatewayPaid = payment?.status === "paid" && !isManuallyPaid
  // Show mark-as-paid for invoices that are NOT paid via gateway and NOT already manually paid
  const showMarkAsPaid = docType === "invoice" && !isGatewayPaid && localStatus !== "paid"
  const showManualPaidBadge = docType === "invoice" && (isManuallyPaid || localStatus === "paid") && !isGatewayPaid

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-all duration-300",
        "shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] hover:border-border/80 hover:-translate-y-1",
        payment?.status === "paid" ? "border-emerald-200/50 dark:border-emerald-800/40" : "border-border/50",
      )}
    >
      {/* Main row */}
      <div className="px-3.5 pt-4 pb-3 sm:px-4">
        {/* Header row: type pill + title | action icons */}
        <div className="flex items-center gap-3">
          <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0", TYPE_COLORS[docType] || "bg-muted text-muted-foreground")}>
            {docType}
          </div>
          <p className="font-semibold text-sm leading-tight truncate flex-1 min-w-0">{title}</p>
          {/* Action icons — only Eye, Download, Recurring (for invoices without active recurring) */}
          <div className="flex items-center gap-0.5 shrink-0">
            <a
              href={`/view/${session.id}`}
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="View document"
            >
              <Eye size={15} />
            </a>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
              disabled={downloading}
              onClick={() => onDownload(session)}
              aria-label="Download PDF"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            </button>
            {/* Recurring toggle — only for invoices that don't have active recurring yet */}
            {hasRecurring && !session.recurring?.is_active && (
              <button
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl transition-colors",
                  recurringExpanded
                    ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                    : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setRecurringExpanded(v => !v)}
                aria-label="Recurring settings"
                title="Recurring invoice settings"
              >
                <Repeat2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Metadata row: client · date · total */}
        <div className="flex items-center gap-0 text-xs text-muted-foreground mt-1 pl-[calc(2.5rem+0.75rem)] truncate">
          {[
            session.client_name && session.client_name !== title ? session.client_name : null,
            format(new Date(session.created_at), "MMM d, yyyy"),
            total,
          ].filter(Boolean).map((item, i, arr) => (
            <span key={i} className="truncate">
              {item}{i < arr.length - 1 && <span className="mx-1.5 text-muted-foreground/40">·</span>}
            </span>
          ))}
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {/* Email pill */}
          {(hasEmails || session.sent_at) && (
            <button onClick={() => setEmailExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                emailExpanded
                  ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"
                  : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
              )}>
              <Mail size={11} />
              {emailStats ? `${emailStats.totalSent} sent` : "Sent"}
              {emailStats?.opened ? ` · ${emailStats.opened} opened` : ""}
            </button>
          )}

          {/* Payment pill — invoices only */}
          {docType === "invoice" && (
            <button onClick={() => setExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                expanded
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                  : payment
                    ? payment.status === "paid"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
                    : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
              )}>
              <CreditCard size={11} />
              {payment
                ? payment.status === "paid" ? "Paid"
                  : payment.status === "partially_paid" ? "Partial"
                  : "Awaiting"
                : session.status === "paid" ? "Paid" : "No link"
              }
            </button>
          )}

          {/* Signature pill — for contracts/quotations/proposals */}
          {hasSignatures && (
            <button onClick={() => setSignatureExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                signatureExpanded
                  ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"
                  : session.status === "signed"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                    : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
              )}>
              <PenLine size={11} />
              {session.status === "signed" ? "Signed" : "Pending"}
            </button>
          )}

          {/* Recurring pill */}
          {session.recurring?.is_active && (
            <button onClick={() => setRecurringExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                recurringExpanded
                  ? "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800"
                  : "bg-card text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
              )}>
              <Repeat2 size={11} />
              {session.recurring.frequency}
            </button>
          )}

          {/* Mark as Paid — for invoices without a connected gateway payment */}
          {showMarkAsPaid && (
            <MarkAsPaidButton
              sessionId={session.id}
              isPaid={false}
              compact
              onStatusChange={(paid) => {
                if (paid) {
                  setLocalStatus("paid")
                  setLocalPayment(prev => prev
                    ? { ...prev, status: "paid", is_manual: true, manually_marked_at: new Date().toISOString() }
                    : {
                        id: "manual",
                        short_url: "",
                        amount: 0,
                        currency: "USD",
                        status: "paid",
                        amount_paid: null,
                        paid_at: new Date().toISOString(),
                        expires_at: null,
                        created_at: new Date().toISOString(),
                        view_count: 0,
                        link_viewed_at: null,
                        reference_id: null,
                        customer_name: null,
                        gateway: "manual",
                        razorpay_payment_link_id: null,
                        is_manual: true,
                        manually_marked_at: new Date().toISOString(),
                      }
                  )
                }
              }}
            />
          )}

          {/* Manual paid badge */}
          {showManualPaidBadge && (
            <MarkAsPaidButton
              sessionId={session.id}
              isPaid
              isGatewayPaid={false}
              paidAt={payment?.paid_at || payment?.manually_marked_at}
              paymentMethod={payment?.manual_payment_method}
              compact
              onStatusChange={(paid) => {
                if (!paid) {
                  setLocalStatus("active")
                  setLocalPayment(null)
                }
              }}
            />
          )}

          {/* Download pills for signed docs */}
          {session.status === "signed" && (
            <>
              <button
                onClick={() => onDownload(session)}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all duration-200 disabled:opacity-50">
                {downloading ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Signed PDF
              </button>
              <a href={`/view/${session.id}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground transition-all duration-200">
                <FileText size={11} /> View Signed
              </a>
              <a href={`/api/signatures/certificate?sessionId=${session.id}`}
                download
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/20 dark:border-violet-800 dark:text-violet-400 transition-all duration-200">
                <Download size={11} /> Certificate
              </a>
            </>
          )}
        </div>
      </div>

      {/* Expandable recurring panel */}
      {hasRecurring && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          recurringExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <RecurringPanel session={session} onRefresh={onRefresh} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable signature details panel */}
      {hasSignatures && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          signatureExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <SignatureDetailsPanel sessionId={session.id} expanded={signatureExpanded} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable payment panel */}
      {hasPayment && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <PaymentPanel payment={payment!} currency={ctx.currency || "INR"} sessionId={session.id} onCancelled={onRefresh} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable email history panel */}
      {hasEmails && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          emailExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <EmailHistoryPanel stats={emailStats!} sessionId={session.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyDocumentsPage() {
  const router = useRouter()
  const goBack = useSafeBack("/")
  const supabase = useSupabase()
  const user = useUser()
  const [sessions, setSessions] = useState<DocSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  const loadSessions = useCallback(async (silent = false) => {
    if (!user?.id) { setLoading(false); return }
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      // Load sessions
      const { data: rawSessions, error } = await supabase
        .from("document_sessions")
        .select("id, document_type, status, client_name, created_at, updated_at, sent_at, context, chain_id")
        .eq("user_id", user.id)
        .not("context", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      const withContent = (rawSessions || []).filter((s: any) => {
        const ctx = s.context
        if (!ctx || typeof ctx !== "object") return false
        return ctx.documentType || ctx.fromName || ctx.toName || (Array.isArray(ctx.items) && ctx.items.length > 0)
      })

      // Load payment records for all sessions
      const sessionIds = withContent.map((s: any) => s.id)
      let paymentMap: Record<string, PaymentRecord> = {}

      if (sessionIds.length > 0) {
        const { data: payments } = await (supabase as any)
          .from("invoice_payments")
          .select("id, session_id, short_url, amount, currency, status, amount_paid, paid_at, expires_at, created_at, view_count, link_viewed_at, reference_id, customer_name, gateway, razorpay_payment_link_id, is_manual, manual_payment_method, manual_payment_note, manually_marked_at")
          .in("session_id", sessionIds)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        // Keep only the most recent payment per session
        for (const p of (payments || [])) {
          if (!paymentMap[p.session_id]) {
            paymentMap[p.session_id] = p as PaymentRecord
          }
        }
      }

      // Load all emails per session for stats
      let emailMap: Record<string, EmailRecord> = {}
      let emailStatsMap: Record<string, EmailStats> = {}
      if (sessionIds.length > 0) {
        const { data: emails } = await (supabase as any)
          .from("document_emails")
          .select("id, session_id, recipient_email, status, created_at")
          .in("session_id", sessionIds)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        // Load pending email schedules for all sessions
        const { data: scheduleRows } = await (supabase as any)
          .from("email_schedules")
          .select("id, session_id, sequence_step, sequence_type, scheduled_for, status, sent_at, cancelled_reason")
          .in("session_id", sessionIds)
          .eq("user_id", user.id)
          .order("scheduled_for", { ascending: true })

        // Group schedules by session
        const schedulesBySession: Record<string, EmailSchedule[]> = {}
        for (const s of (scheduleRows || [])) {
          if (!schedulesBySession[s.session_id]) schedulesBySession[s.session_id] = []
          schedulesBySession[s.session_id].push(s as EmailSchedule)
        }

        // Group all emails by session
        const emailsBySession: Record<string, EmailRecord[]> = {}
        for (const e of (emails || [])) {
          if (!emailsBySession[e.session_id]) emailsBySession[e.session_id] = []
          emailsBySession[e.session_id].push(e as EmailRecord)
        }

        // Build stats and most-recent map
        for (const [sid, list] of Object.entries(emailsBySession)) {
          emailMap[sid] = list[0] // most recent (already sorted desc)
          const pending = (schedulesBySession[sid] || []).filter(s => s.status === "pending")
          emailStatsMap[sid] = {
            totalSent: list.length,
            opened: list.filter(e => e.status === "opened").length,
            delivered: list.filter(e => e.status === "delivered").length,
            bounced: list.filter(e => e.status === "bounced").length,
            lastSentAt: list[0]?.created_at ?? null,
            emails: list,
            nextReminderAt: pending[0]?.scheduled_for ?? null,
            pendingCount: pending.length,
          }
        }

        // Also attach schedules to sessions that have schedules but no sent emails yet
        for (const [sid, scheds] of Object.entries(schedulesBySession)) {
          if (!emailStatsMap[sid]) {
            const pending = scheds.filter(s => s.status === "pending")
            if (pending.length > 0) {
              emailStatsMap[sid] = {
                totalSent: 0,
                opened: 0,
                delivered: 0,
                bounced: 0,
                lastSentAt: null,
                emails: [],
                nextReminderAt: pending[0].scheduled_for,
                pendingCount: pending.length,
              }
            }
          }
        }

        // Attach schedules map for use in DocCard
        for (const s of withContent as any[]) {
          s._schedules = schedulesBySession[s.id] ?? []
        }
      }

      const merged: DocSession[] = withContent.map((s: any) => ({
        ...s,
        payment: paymentMap[s.id] ?? null,
        email: emailMap[s.id] ?? null,
        emailStats: emailStatsMap[s.id] ?? null,
        schedules: s._schedules ?? [],
      }))

      // Fetch quotation responses for quotation sessions
      const quotationSessionIds = withContent
        .filter((s: any) => s.document_type === "quotation")
        .map((s: any) => s.id)

      let quotationResponseMap: Record<string, { response_type: string }> = {}
      if (quotationSessionIds.length > 0) {
        const { data: qResponses } = await (supabase as any)
          .from("quotation_responses")
          .select("session_id, response_type")
          .in("session_id", quotationSessionIds)
          .order("created_at", { ascending: false })

        for (const r of (qResponses || [])) {
          if (!quotationResponseMap[r.session_id]) {
            quotationResponseMap[r.session_id] = { response_type: r.response_type }
          }
        }
      }

      const mergedWithQuotations: DocSession[] = merged.map((s) => ({
        ...s,
        quotationResponse: quotationResponseMap[s.id] ?? null,
      }))

      // Fetch recurring schedules for invoice sessions
      const invoiceSessionIds = withContent
        .filter((s: any) => s.document_type === "invoice")
        .map((s: any) => s.id)

      let recurringMap: Record<string, RecurringRecord> = {}
      if (invoiceSessionIds.length > 0) {
        const { data: recurringRows } = await (supabase as any)
          .from("recurring_invoices")
          .select("source_session_id, id, frequency, is_active, auto_send, recipient_email, next_run_at, last_run_at, run_count")
          .in("source_session_id", invoiceSessionIds)
          .eq("user_id", user.id)

        for (const r of (recurringRows ?? [])) {
          recurringMap[r.source_session_id] = r as RecurringRecord
        }
      }

      // Fetch signatures for signature-supporting document types
      const signatureSessionIds = withContent
        .filter((s: any) => ["contract", "quotation", "proposal"].includes(s.document_type))
        .map((s: any) => s.id)

      let signatureMap: Record<string, SignatureRecord[]> = {}
      if (signatureSessionIds.length > 0) {
        const { data: signatureRows } = await (supabase as any)
          .from("signatures")
          .select("id, session_id, signer_name, signer_email, signed_at, signer_action, created_at")
          .in("session_id", signatureSessionIds)
          .order("created_at", { ascending: false })

        for (const sig of (signatureRows ?? [])) {
          if (!signatureMap[sig.session_id]) signatureMap[sig.session_id] = []
          signatureMap[sig.session_id].push(sig as SignatureRecord)
        }
      }

      // Compute chain counts — how many documents share the same chain_id
      const chainCountMap: Record<string, number> = {}
      for (const s of withContent as any[]) {
        if (s.chain_id) {
          chainCountMap[s.chain_id] = (chainCountMap[s.chain_id] || 0) + 1
        }
      }

      const mergedFinal: DocSession[] = mergedWithQuotations.map((s) => ({
        ...s,
        recurring: recurringMap[s.id] ?? null,
        signatures: signatureMap[s.id] ?? [],
        chainCount: s.chain_id ? (chainCountMap[s.chain_id] || 1) : undefined,
      }))

      setSessions(mergedFinal)
    } catch (error: any) {
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load documents")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, supabase])

  useEffect(() => {
    if (user) loadSessions()
  }, [user, loadSessions])

  const downloadDocument = async (session: DocSession) => {
    if (!session.context) { toast.error("No document data available"); return }
    setDownloadingId(session.id)
    try {
      const cleanedData = cleanDataForExport(session.context as InvoiceData)
      const logoUrl = await resolveLogoUrl(cleanedData.fromLogo)
      const templates = await import("@/lib/pdf-templates")
      const { pdf } = await import("@react-pdf/renderer")

      let PdfComponent: React.ComponentType<{ data: InvoiceData; logoUrl?: string | null }>
      let filePrefix: string
      const docType = (session.document_type || "invoice").toLowerCase()

      switch (docType) {
        case "contract": PdfComponent = templates.ContractPDF; filePrefix = cleanedData.referenceNumber || "contract"; break
        case "quotation": PdfComponent = templates.QuotationPDF; filePrefix = cleanedData.referenceNumber || "quotation"; break
        case "proposal": PdfComponent = templates.ProposalPDF; filePrefix = cleanedData.referenceNumber || "proposal"; break
        default: PdfComponent = templates.InvoicePDF; filePrefix = cleanedData.invoiceNumber || "invoice"; break
      }

      // Load signature images for signed documents (contracts/quotations/proposals)
      if (["contract", "quotation", "proposal"].includes(docType) && session.status === "signed") {
        try {
          const { data: sigs } = await (supabase as any)
            .from("signatures")
            .select("signer_name, party, signed_at, signature_image_url")
            .eq("session_id", session.id)
            .not("signed_at", "is", null)

          if (sigs && sigs.length > 0) {
            const sigImages: Array<{ signerName: string; party: string; imageDataUrl: string; signedAt: string }> = []
            for (const sig of sigs) {
              if (sig.signature_image_url && sig.signature_image_url !== "data_url_fallback") {
                try {
                  const imgRes = await authFetch(`/api/storage/image?key=${encodeURIComponent(sig.signature_image_url)}`)
                  if (imgRes.ok) {
                    const imgData = await imgRes.json()
                    if (imgData.dataUrl) {
                      sigImages.push({
                        signerName: sig.signer_name || "Signer",
                        party: sig.party || "Client",
                        imageDataUrl: imgData.dataUrl,
                        signedAt: sig.signed_at,
                      })
                    }
                  }
                } catch { /* ignore */ }
              }
            }
            if (sigImages.length > 0) {
              cleanedData.signatureImages = sigImages
            }
            // Mark as signed even if no images loaded (data_url_fallback case)
            // This triggers the "Electronically Signed" placeholder in the PDF
            if (sigs.length > 0 && sigImages.length === 0) {
              cleanedData.signedAt = sigs[0].signed_at || new Date().toISOString()
            }
          }
        } catch { /* non-fatal — generate PDF without signatures */ }
      }

      const blob = await pdf(<PdfComponent data={cleanedData} logoUrl={logoUrl} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${filePrefix}_${new Date().toISOString().split("T")[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("PDF downloaded!")
    } catch (error) {
      console.error("PDF download error:", error)
      toast.error("Failed to generate PDF")
    } finally {
      setDownloadingId(null)
    }
  }

  // Filter options with counts
  const filterOptions = [
    { key: "all", label: "All", count: sessions.length },
    { key: "invoice", label: "Invoices", count: sessions.filter(s => s.document_type === "invoice").length },
    { key: "contract", label: "Contracts", count: sessions.filter(s => s.document_type === "contract").length },
    { key: "quotation", label: "Quotations", count: sessions.filter(s => s.document_type === "quotation").length },
    { key: "proposal", label: "Proposals", count: sessions.filter(s => s.document_type === "proposal").length },
    { key: "paid", label: "Paid", count: sessions.filter(s => s.payment?.status === "paid" || s.status === "paid").length },
    { key: "pending", label: "Pending", count: sessions.filter(s => s.payment?.status === "created" || (s.document_type === "invoice" && !s.payment && s.status !== "paid")).length },
  ].filter(f => f.key === "all" || f.count > 0)

  const filtered = sessions.filter(s => {
    if (filter === "all") return true
    if (filter === "paid") return s.payment?.status === "paid" || s.status === "paid"
    if (filter === "pending") return s.payment?.status === "created"
    return s.document_type === filter
  })

  // Group filtered sessions by chain_id
  const grouped: Array<{ chainId: string | null; clientName: string | null; sessions: DocSession[] }> = (() => {
    const chainMap = new Map<string, DocSession[]>()
    const standalone: DocSession[] = []
    for (const s of filtered) {
      if (s.chain_id) {
        const arr = chainMap.get(s.chain_id) || []
        arr.push(s)
        chainMap.set(s.chain_id, arr)
      } else {
        standalone.push(s)
      }
    }
    const result: Array<{ chainId: string | null; clientName: string | null; sessions: DocSession[] }> = []
    for (const [chainId, chainSessions] of chainMap) {
      chainSessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const clientName = chainSessions.find(s => s.client_name)?.client_name || null
      result.push({ chainId, clientName, sessions: chainSessions })
    }
    for (const s of standalone) {
      result.push({ chainId: null, clientName: s.client_name || null, sessions: [s] })
    }
    // Sort groups by most recent session
    result.sort((a, b) => new Date(b.sessions[0].created_at).getTime() - new Date(a.sessions[0].created_at).getTime())
    return result
  })()

  // Summary stats
  const totalPaid = sessions.filter(s => s.payment?.status === "paid" || s.status === "paid").length
  const totalPending = sessions.filter(s => s.payment?.status === "created").length
  const totalAmount = sessions
    .filter(s => s.payment?.status === "paid" && s.payment?.amount_paid)
    .reduce((sum, s) => sum + (s.payment!.amount_paid! / 100), 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Skeleton header — matches real header exactly */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
              <div className="h-3 w-20 rounded-md bg-muted/60 animate-pulse" />
            </div>
            <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="w-16 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
          {/* Skeleton filter pills */}
          <div className="flex gap-2 overflow-hidden">
            {[56, 72, 80, 68, 76].map((w, i) => (
              <div
                key={i}
                className="h-8 rounded-full bg-muted animate-pulse shrink-0"
                style={{ width: w, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>

          {/* Skeleton document cards */}
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-card overflow-hidden"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start gap-3 px-3.5 py-5 sm:px-4 sm:py-6">
                {/* Type badge skeleton */}
                <div className="w-14 h-6 rounded-lg bg-muted animate-pulse shrink-0 mt-0.5" />

                {/* Content skeleton */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="h-4 rounded-md bg-muted animate-pulse" style={{ width: `${45 + (i * 17) % 35}%` }} />
                    <div className="h-5 w-16 rounded-full bg-muted animate-pulse shrink-0" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-24 rounded-md bg-muted/60 animate-pulse" />
                    <div className="h-3 w-16 rounded-md bg-muted/60 animate-pulse" />
                  </div>
                </div>

                {/* Action buttons skeleton */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
                  <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => goBack()}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-display font-bold">My Documents</h1>
            <p className="text-xs text-muted-foreground">{sessions.length} document{sessions.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => loadSessions(true)}
            disabled={refreshing}
            className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-secondary/60 transition-colors shrink-0 text-muted-foreground"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity active:scale-[0.97] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* Summary stats */}
        {(totalPaid > 0 || totalPending > 0) && (
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-center shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-foreground/40" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</p>
              </div>
              <p className="text-2xl font-semibold text-foreground tracking-tight">{sessions.length}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-center shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Paid</p>
              </div>
              <p className="text-2xl font-semibold text-foreground tracking-tight">{totalPaid}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col justify-center shadow-[0_8px_24px_rgb(0,0,0,0.06)] transition-shadow hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Pending</p>
              </div>
              <p className="text-2xl font-semibold text-foreground tracking-tight">{totalPending}</p>
            </div>
          </motion.div>
        )}

        {/* Filter pills */}
        {sessions.length > 0 && (
          <motion.div variants={itemVariants} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {filterOptions.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap shrink-0 shadow-sm",
                  filter === f.key
                    ? "bg-zinc-900 text-zinc-50 shadow-md scale-105"
                    : "bg-background border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label} <span className={cn("ml-1", filter === f.key ? "opacity-70" : "opacity-60")}>({f.count})</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Document List with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="space-y-3 pt-2"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-semibold text-base mb-1">
                  {sessions.length === 0 ? "No documents yet" : "No matching documents"}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                  {sessions.length === 0
                    ? "Describe a document to the AI and it will appear here."
                    : "Try a different filter."}
                </p>
                {sessions.length === 0 && (
                  <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create your first document
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map((group, gi) => (
                  group.sessions.length === 1 ? (
                    <DocCard
                      key={group.sessions[0].id}
                      session={group.sessions[0]}
                      onDownload={downloadDocument}
                      downloading={downloadingId === group.sessions[0].id}
                      onRefresh={() => loadSessions(true)}
                    />
                  ) : (
                    <ChainGroupCard
                      key={group.chainId || `group-${gi}`}
                      clientName={group.clientName}
                      sessions={group.sessions}
                      onDownload={downloadDocument}
                      downloadingId={downloadingId}
                      onRefresh={() => loadSessions(true)}
                    />
                  )
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Read-only notice */}
        {sessions.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60 pb-4">
            Documents are read-only records. Open to view, download to export.
          </p>
        )}
      </div>
    </div>
  )
}
