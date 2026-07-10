"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import {
  FileText, Download, Eye, Loader2, ArrowLeft, Plus,
  CheckCircle2, Clock, XCircle, Link2, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, CreditCard, Mail,
  BellOff, Repeat2, Bell, PenLine, Trash2, Search, CalendarDays, X,
  FileCheck, FileQuestion, Presentation, ClipboardList, GitMerge,
  Shield, ClipboardCheck, type LucideIcon,
} from "lucide-react"
import { getDocumentTypeConfig, normalizeDocumentType, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"
import { resolvePdfComponent, resolveDocumentReference } from "@/lib/pdf-export-helpers"
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
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { OnboardingClientUploads } from "@/components/onboarding-client-uploads"

// ── Document Type Icon Map ────────────────────────────────────────────────────
// Resolves registry icon string names to Lucide React components.
const DOC_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  FileCheck,
  FileQuestion,
  Presentation,
  ClipboardList,
  GitMerge,
  Shield,
  ClipboardCheck,
  Bell,
  RefreshCw,
}

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
  expires_at?: string | null
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
  /** True when any client interaction prevents deletion (signed, submitted
   *  onboarding, accepted/declined/changes_requested quote/proposal). The
   *  delete button is hidden and the API rejects the delete regardless. */
  hasClientInteraction?: boolean
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
    <div className="rounded-xl border border-border/40 bg-muted/30 overflow-hidden">
      {/* Amount row */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <CreditCard size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold text-foreground">{fmt(payment.amount)}</span>
          {payment.status === "partially_paid" && payment.amount_paid && (
            <span className="text-xs text-muted-foreground">({fmt(payment.amount_paid)} paid)</span>
          )}
        </div>
        <span className={cn(
          "text-[11px] font-semibold px-2 py-0.5 rounded-full",
          payment.status === "paid" ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground"
        )}>
          {payment.status === "paid" ? "Paid" : payment.status === "partially_paid" ? "Partial" : payment.status === "expired" ? "Expired" : "Pending"}
        </span>
      </div>

      {/* Tracking info */}
      <div className="px-3.5 py-2.5 space-y-1.5">
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
          <div className="flex items-center gap-1.5 text-xs text-foreground">
            <CheckCircle2 size={11} />
            Paid {format(new Date(payment.paid_at), "MMM d, yyyy 'at' h:mm a")}
          </div>
        )}

        {/* Expiry */}
        {payment.expires_at && payment.status === "created" && (
          <div className={cn("flex items-center gap-1.5 text-xs", isOverdue ? "text-foreground" : "text-muted-foreground")}>
            <Clock size={11} />
            {isOverdue
              ? `Expired ${formatDistanceToNow(new Date(payment.expires_at), { addSuffix: true })}`
              : `Expires ${format(new Date(payment.expires_at), "MMM d, yyyy")}`}
          </div>
        )}

        {/* Payment link */}
        {isActive && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <a
              href={payment.short_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground hover:underline font-medium"
            >
              <Link2 size={11} />
              Open payment link
              <ExternalLink size={10} />
            </a>
            <button
              type="button"
              onClick={handleCancelPaymentLink}
              disabled={cancelling}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-colors disabled:opacity-50"
            >
              {cancelling ? <Loader2 size={10} className="animate-spin" /> : <XCircle size={10} />}
              Cancel
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
    delivered: { label: "Delivered", dot: "bg-foreground/60" },
    opened:    { label: "Opened",    dot: "bg-foreground" },
    bounced:   { label: "Bounced",   dot: "bg-muted-foreground" },
    failed:    { label: "Failed",    dot: "bg-muted-foreground" },
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
    <div className="rounded-xl border border-border/40 bg-muted/30 overflow-hidden">

      {/* Next reminder row */}
      {nextReminder && !stopped && (
        <div className="flex items-center justify-between px-3.5 py-3 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <Bell size={14} className="text-muted-foreground shrink-0" />
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
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-colors disabled:opacity-50 shrink-0"
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
            <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
            <span className="font-semibold text-foreground">{stats.opened}</span> opened
          </span>
        )}
        {stats.delivered > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/60 shrink-0" />
            <span className="font-semibold text-foreground">{stats.delivered}</span> delivered
          </span>
        )}
        {stats.bounced > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shrink-0" />
            <span className="font-semibold text-foreground">{stats.bounced}</span> bounced
          </span>
        )}
        {/* Stop button when no reminder banner */}
        {(!nextReminder || stopped) && stats.pendingCount > 0 && !stopped && (
          <button
            type="button"
            onClick={handleStopFollowUps}
            disabled={stopping}
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-colors disabled:opacity-50"
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
    <div className="rounded-xl border border-border/40 bg-muted/30 overflow-hidden">
      {/* Header row with toggle */}
      <div className="flex items-center justify-between px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <Repeat2 size={14} className={cn("shrink-0", isActive ? "text-foreground" : "text-muted-foreground")} />
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
            isActive ? "bg-foreground" : "bg-muted-foreground/30",
            saving && "opacity-50 pointer-events-none"
          )}
          aria-label={isActive ? "Pause recurring" : "Enable recurring"}
        >
          <span className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform duration-200",
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
          <div className="px-3.5 pb-3.5 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Frequency</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["weekly", "monthly", "quarterly"] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFrequencyChange(f)}
                  disabled={saving}
                  className={cn(
                    "py-1.5 rounded-lg text-[11px] font-semibold transition-all duration-150 capitalize border",
                    frequency === f
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
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
  expires_at?: string | null
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
    // Check if the signing link has expired
    if (sig.expires_at && new Date(sig.expires_at) < new Date()) return { icon: "⏱", label: "Expired" }
    return { icon: "⏳", label: "Awaiting Signature" }
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
            {!sig.signed_at && sig.expires_at && (
              <p className={cn(
                "text-xs",
                new Date(sig.expires_at) < new Date()
                  ? "text-muted-foreground"
                  : "text-muted-foreground"
              )}>
                {new Date(sig.expires_at) < new Date()
                  ? `Link expired ${formatDistanceToNow(new Date(sig.expires_at), { addSuffix: true })}`
                  : `Link expires ${format(new Date(sig.expires_at), "MMM d, yyyy")}`}
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
  onDelete,
}: {
  clientName: string | null
  sessions: DocSession[]
  onDownload: (s: DocSession) => void
  downloadingId: string | null
  onRefresh?: () => void
  onDelete?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const docTypes = [...new Set(sessions.map(s => s.document_type))].map(t => t.charAt(0).toUpperCase() + t.slice(1))
  const latestSession = sessions[0]
  const latestCtx = latestSession.context || {}
  const latestRef = latestCtx.invoiceNumber || latestCtx.referenceNumber || ""

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Group header — clean monochromatic */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors active:bg-muted/30"
      >
        <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
          <Link2 size={15} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{clientName || latestRef || "Linked Documents"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sessions.length} documents · {docTypes.join(", ")}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
          {expanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Expandable list of DocCards — thread-connected */}
      <div className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}>
        <div className="min-h-0 overflow-hidden">
          {/* Thread container: left border line + cards */}
          <div className="relative pl-3 pr-3 pb-3 pt-1">
            {/* Vertical thread line */}
            <div className="absolute left-[22px] top-0 bottom-3 w-px bg-border/50" />

            <div className="space-y-2">
              {sessions.map((s, idx) => (
                <div key={s.id} className="relative pl-5">
                  {/* Horizontal connector from thread line to card */}
                  <div className="absolute left-0 top-[22px] w-5 h-px bg-border/50" />
                  {/* Small dot on the thread line */}
                  <div className="absolute left-[-3px] top-[18px] w-[7px] h-[7px] rounded-full bg-muted-foreground/30 border-2 border-card" />
                  <DocCard
                    session={s}
                    onDownload={onDownload}
                    downloading={downloadingId === s.id}
                    onRefresh={onRefresh}
                    onDelete={onDelete}
                  />
                </div>
              ))}
            </div>
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
  onDelete,
}: {
  session: DocSession
  onDownload: (s: DocSession) => void
  downloading: boolean
  onRefresh?: () => void
  onDelete?: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [emailExpanded, setEmailExpanded] = useState(false)
  const [recurringExpanded, setRecurringExpanded] = useState(false)
  const [signatureExpanded, setSignatureExpanded] = useState(false)
  const [assetsExpanded, setAssetsExpanded] = useState(false)
  const [localPayment, setLocalPayment] = useState<PaymentRecord | null>(session.payment ?? null)
  const [localStatus, setLocalStatus] = useState(session.status)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const docType = (session.document_type || "invoice").toLowerCase()
  const ctx = session.context || {}

  // Resolve display metadata from registry (handles "quotation" → "quote")
  const normalisedType = normalizeDocumentType(docType)
  const typeConfig = normalisedType ? getDocumentTypeConfig(normalisedType) : null
  const typeLabel = typeConfig?.label ?? (docType.charAt(0).toUpperCase() + docType.slice(1))
  const typeColor = typeConfig?.color ?? "text-muted-foreground"
  const typeBgColor = typeConfig?.bgColor ?? "bg-muted/70"
  const TypeIcon = typeConfig ? (DOC_TYPE_ICON_MAP[typeConfig.icon] ?? FileText) : FileText

  const title = ctx.invoiceNumber || ctx.referenceNumber || session.client_name ||
    typeLabel

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
  const isOnboardingForm = docType === "client_onboarding_form"

  // Determine if this invoice is manually paid (no gateway)
  const isManuallyPaid = payment?.is_manual === true || payment?.gateway === "manual"
  const isGatewayPaid = payment?.status === "paid" && !isManuallyPaid
  // Show mark-as-paid for invoices that are NOT paid via gateway and NOT already manually paid
  const showMarkAsPaid = docType === "invoice" && !isGatewayPaid && localStatus !== "paid"
  const showManualPaidBadge = docType === "invoice" && (isManuallyPaid || localStatus === "paid") && !isGatewayPaid

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden group">
      {/* Main row */}
      <div className="px-4 py-3.5">
        {/* Header row: type pill + title + actions */}
        <div className="flex items-start gap-3">
          {/* Type badge — uses registry color/bg */}
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5", typeBgColor, typeColor)}>
            <TypeIcon size={11} />
            {typeLabel}
          </span>
          
          {/* Title and metadata */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight truncate">{title}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1 flex-wrap">
              {session.client_name && session.client_name !== title && (
                <span className="truncate max-w-[120px]">{session.client_name}</span>
              )}
              {session.client_name && session.client_name !== title && (
                <span className="text-muted-foreground/40">·</span>
              )}
              <span>{format(new Date(session.created_at), "MMM d, yyyy")}</span>
              {total && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-medium text-foreground">{total}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Action icons */}
          <div className="flex items-center gap-0.5 shrink-0">
            <a
              href={`/view/${session.id}`}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="View document"
            >
              <Eye size={15} />
            </a>
            <button
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
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
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                  recurringExpanded
                    ? "bg-muted text-foreground"
                    : "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setRecurringExpanded(v => !v)}
                aria-label="Recurring settings"
                title="Recurring invoice settings"
              >
                <Repeat2 size={15} />
              </button>
            )}
            {/* Delete — not shown for documents with client interaction
                (paid, signed, submitted onboarding, responded quotes/proposals) */}
            {onDelete && localStatus !== "paid" && localStatus !== "signed" && !session.hasClientInteraction && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground/40 hover:text-muted-foreground [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                aria-label="Delete document"
                title="Delete document"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation dialog */}
        <DeleteConfirmDialog
          open={confirmDelete}
          loading={deleting}
          warnings={(() => {
            const w: string[] = []
            if (localStatus === "finalized") w.push("The document has been sent — the client's link will stop working")
            // Pending signatures
            const pendingSigs = (session.signatures || []).filter(s => !s.signed_at && !s.signer_action)
            if (pendingSigs.length > 0) w.push(`${pendingSigs.length} pending e-signature request${pendingSigs.length > 1 ? "s" : ""} will be cancelled`)
            // Proposals/quotes with client response enabled
            if ((docType === "proposal" || docType === "quote" || docType === "quotation") && localStatus === "finalized") {
              w.push("The client can no longer accept, decline, or request changes on this document")
            }
            // Pending email schedules
            const pendingSchedules = (session.schedules || []).filter(s => s.status === "pending")
            if (pendingSchedules.length > 0) w.push(`${pendingSchedules.length} scheduled email reminder${pendingSchedules.length > 1 ? "s" : ""} will be cancelled`)
            // Active recurring invoice
            if (session.recurring?.is_active) {
              const freq = session.recurring.frequency || "recurring"
              w.push(`${freq.charAt(0).toUpperCase() + freq.slice(1)} auto-invoice schedule will stop`)
            }
            // Active payment link
            if (localPayment?.status === "created") w.push("The active payment link will become inaccessible to the client")
            return w
          })()}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleting(true)
            try {
              const res = await authFetch(`/api/sessions/delete?sessionId=${session.id}`, { method: "DELETE" })
              if (res.ok) {
                setConfirmDelete(false)
                onDelete!(session.id)
              } else {
                const d = await res.json().catch(() => ({}))
                toast.error(d.error || "Failed to delete")
                setConfirmDelete(false)
              }
            } catch {
              toast.error("Failed to delete")
              setConfirmDelete(false)
            } finally {
              setDeleting(false)
            }
          }}
        />

        {/* Status pills — monochromatic style */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
          {/* Email pill */}
          {(hasEmails || session.sent_at) && (
            <button onClick={() => setEmailExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                emailExpanded
                  ? "bg-muted text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
              )}>
              <Mail size={11} />
              {emailStats ? `${emailStats.totalSent} sent` : "Sent"}
            </button>
          )}

          {/* Payment pill — invoices only */}
          {docType === "invoice" && (
            <button onClick={() => setExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                expanded
                  ? "bg-muted text-foreground border-border"
                  : payment?.status === "paid"
                    ? "bg-foreground/5 text-foreground border-foreground/20"
                    : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
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


          {/* Signature pill — all states: Signed / Awaiting / Expired / Declined / Changes Requested */}
          {hasSignatures && (() => {
            const sigs = (session.signatures ?? []).filter(s => s.signer_action !== "cancelled")
            if (sigs.length === 0) return null
            const allSigned = sigs.every(s => !!s.signed_at)
            const anyDeclined = sigs.some(s => s.signer_action === "declined")
            const anyRevision = sigs.some(s => s.signer_action === "revision_requested")
            const pending = sigs.filter(s => !s.signed_at && !s.signer_action)
            const anyExpired = pending.some(s => s.expires_at && new Date(s.expires_at) < new Date())
            let sigLabel: string, sigStyle: string
            if (allSigned) { sigLabel = "\u2713 Signed"; sigStyle = "bg-foreground/5 text-foreground border-foreground/20" }
            else if (anyDeclined) { sigLabel = "\u2717 Declined"; sigStyle = "bg-muted text-muted-foreground border-border/50" }
            else if (anyRevision) { sigLabel = "\u21a9 Changes Requested"; sigStyle = "bg-muted text-muted-foreground border-border/50" }
            else if (anyExpired) { sigLabel = "\u23f1 Expired"; sigStyle = "bg-muted text-muted-foreground border-border/50" }
            else if (pending.length > 0) { sigLabel = "\u23f3 Awaiting Signature"; sigStyle = "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground" }
            else { sigLabel = "Signature"; sigStyle = "bg-transparent text-muted-foreground border-border/50" }
            return (
              <button onClick={() => setSignatureExpanded(v => !v)}
                className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                  signatureExpanded ? "bg-muted text-foreground border-border" : sigStyle)}>
                <PenLine size={11} />
                {sigLabel}
              </button>
            )
          })()}

          {/* Quote/Proposal response pill */}
          {session.quotationResponse && (normalisedType === "quote" || normalisedType === "proposal") && (
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
              session.quotationResponse.response_type === "accepted"
                ? "bg-foreground/5 text-foreground border-foreground/20"
                : "bg-muted text-muted-foreground border-border/50"
            )}>
              {session.quotationResponse.response_type === "accepted" ? "\u2713 Accepted"
                : session.quotationResponse.response_type === "declined" ? "\u2717 Declined"
                : "\u21a9 Changes Requested"}
            </span>
          )}


          {/* Recurring pill */}
          {session.recurring?.is_active && (
            <button onClick={() => setRecurringExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                recurringExpanded
                  ? "bg-muted text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
              )}>
              <Repeat2 size={11} />
              {session.recurring.frequency}
            </button>
          )}

          {/* Client uploads pill — onboarding forms only */}
          {isOnboardingForm && (
            <button onClick={() => setAssetsExpanded(v => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-200",
                assetsExpanded
                  ? "bg-muted text-foreground border-border"
                  : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
              )}>
              <Download size={11} />
              Client uploads
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
            <div className="px-4 pb-4 pt-1">
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
            <div className="px-4 pb-4 pt-1">
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
            <div className="px-4 pb-4 pt-1">
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
            <div className="px-4 pb-4 pt-1">
              <EmailHistoryPanel stats={emailStats!} sessionId={session.id} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable client-uploads panel — onboarding forms only */}
      {isOnboardingForm && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          assetsExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-4 pb-4 pt-1">
              <OnboardingClientUploads sessionId={session.id} alwaysShow />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Date Range Picker — custom dropdown, monochromatic ────────────────────────

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
] as const

type DateRangeValue = typeof DATE_RANGE_OPTIONS[number]["value"]

function DateRangePicker({ value, onChange }: {
  value: DateRangeValue
  onChange: (v: DateRangeValue) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", escHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", escHandler)
    }
  }, [open])

  const selected = DATE_RANGE_OPTIONS.find(o => o.value === value) ?? DATE_RANGE_OPTIONS[0]
  const isFiltered = value !== "all"

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 pl-2.5 pr-2 rounded-xl border text-xs font-medium transition-all duration-200 active:scale-[0.96]",
          open || isFiltered
            ? "bg-background border-foreground/30 text-foreground shadow-sm"
            : "bg-muted/40 border-border/40 text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/60"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <CalendarDays className="w-3.5 h-3.5" />
        <span className="tabular-nums">{selected.label}</span>
        <ChevronDown className={cn(
          "w-3 h-3 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[160px] rounded-xl border border-border bg-background shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 origin-top-right"
        >
          {DATE_RANGE_OPTIONS.map(opt => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-left transition-colors duration-100",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span>{opt.label}</span>
                {isActive && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  const [dateRange, setDateRange] = useState<DateRangeValue>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Tier + usage (for limit-reached banner)
  type TierUsage = {
    tier: "free" | "starter" | "pro" | "agency"
    documentsUsed: number
    documentsLimit: number // 0 = unlimited
    emailsUsed: number
    emailsLimit: number    // 0 = unlimited
  }
  const [tierUsage, setTierUsage] = useState<TierUsage | null>(null)

  // Load tier + current-month usage whenever the user is available
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const now = new Date()
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

        const [subRes, usageRes] = await Promise.all([
          supabase
            .from("subscriptions")
            .select("plan, status, current_period_end")
            .eq("user_id", user.id)
            .maybeSingle(),
          (supabase as any)
            .from("user_usage")
            .select("documents_count, emails_count")
            .eq("user_id", user.id)
            .eq("month", month)
            .maybeSingle(),
        ])

        // Resolve effective tier (mirrors lib/cost-protection.ts resolveEffectiveTier)
        const sub = subRes.data as { plan: string | null; status: string | null; current_period_end: string | null } | null
        const validStatuses = ["active", "trialing"]
        let effectiveTier: TierUsage["tier"] = "free"
        if (sub) {
          if (sub.status && !validStatuses.includes(sub.status)) effectiveTier = "free"
          else if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) effectiveTier = "free"
          else if (sub.plan && ["free", "starter", "pro", "agency"].includes(sub.plan)) effectiveTier = sub.plan as TierUsage["tier"]
        }

        // Limits must match lib/cost-protection.ts TIER_LIMITS exactly
        const LIMITS = {
          free:    { docs: 5,   emails: 5   },
          starter: { docs: 50,  emails: 100 },
          pro:     { docs: 150, emails: 250 },
          agency:  { docs: 0,   emails: 0   },
        } as const
        const tierLimits = LIMITS[effectiveTier]

        const usage = usageRes.data as { documents_count: number | null; emails_count: number | null } | null
        if (!cancelled) {
          setTierUsage({
            tier: effectiveTier,
            documentsUsed: usage?.documents_count ?? 0,
            documentsLimit: tierLimits.docs,
            emailsUsed: usage?.emails_count ?? 0,
            emailsLimit: tierLimits.emails,
          })
        }
      } catch (err) {
        console.error("[documents] usage fetch failed:", err)
      }
    })()
    return () => { cancelled = true }
  }, [user, supabase])

  const loadSessions = useCallback(async (silent = false) => {
    if (!user?.id) { setLoading(false); return }
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      // Load sessions — show documents that have been sent, finalized, or signed
      const { data: rawSessions, error } = await supabase
        .from("document_sessions")
        .select("id, document_type, status, client_name, created_at, updated_at, sent_at, context, chain_id")
        .eq("user_id", user.id)
        .or("sent_at.not.is.null,status.eq.finalized,status.eq.signed")
        .not("context", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      const withContent = (rawSessions || []).filter((s: any) => {
        const ctx = s.context
        if (!ctx || typeof ctx !== "object") return false
        return ctx.documentType || ctx.fromName || ctx.toName || (Array.isArray(ctx.items) && ctx.items.length > 0)
      })

      // Load payment records, emails, and email schedules for all sessions.
      // These three queries are independent of each other (all just need
      // sessionIds), so run them in parallel instead of one-after-another —
      // this cuts the DB wait time for this page roughly to a third.
      const sessionIds = withContent.map((s: any) => s.id)
      let paymentMap: Record<string, PaymentRecord> = {}
      let emailMap: Record<string, EmailRecord> = {}
      let emailStatsMap: Record<string, EmailStats> = {}

      if (sessionIds.length > 0) {
        const [{ data: payments }, { data: emails }, { data: scheduleRows }] = await Promise.all([
          (supabase as any)
            .from("invoice_payments")
            .select("id, session_id, short_url, amount, currency, status, amount_paid, paid_at, expires_at, created_at, view_count, link_viewed_at, reference_id, customer_name, gateway, razorpay_payment_link_id, is_manual, manual_payment_method, manual_payment_note, manually_marked_at")
            .in("session_id", sessionIds)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          (supabase as any)
            .from("document_emails")
            .select("id, session_id, recipient_email, status, created_at")
            .in("session_id", sessionIds)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          (supabase as any)
            .from("email_schedules")
            .select("id, session_id, sequence_step, sequence_type, scheduled_for, status, sent_at, cancelled_reason")
            .in("session_id", sessionIds)
            .eq("user_id", user.id)
            .order("scheduled_for", { ascending: true }),
        ])

        // Keep only the most recent payment per session
        for (const p of (payments || [])) {
          if (!paymentMap[p.session_id]) {
            paymentMap[p.session_id] = p as PaymentRecord
          }
        }

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

      // Fetch quotation responses for quote/quotation AND proposal sessions
      const quotationSessionIds = withContent
        .filter((s: any) => {
          const norm = normalizeDocumentType(s.document_type)
          return norm === "quote" || norm === "proposal"
        })
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

      // Fetch signatures for signature-supporting document types (from registry)
      const signatureSessionIds = withContent
        .filter((s: any) => {
          const cfg = getDocumentTypeConfig(normalizeDocumentType(s.document_type) ?? "")
          return cfg?.capabilities.supports_signature ?? false
        })
        .map((s: any) => s.id)

      let signatureMap: Record<string, SignatureRecord[]> = {}
      if (signatureSessionIds.length > 0) {
        const { data: signatureRows } = await (supabase as any)
          .from("signatures")
          .select("id, session_id, signer_name, signer_email, signed_at, signer_action, created_at, expires_at")
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

      const mergedFinal: DocSession[] = mergedWithQuotations.map((s) => {
        const sigs = signatureMap[s.id] ?? []
        // hasClientInteraction: any response that makes deletion inappropriate.
        const hasClientInteraction =
          // Signed documents (any non-declined/cancelled signature with signed_at)
          sigs.some(sig => !!sig.signed_at && sig.signer_action !== "declined" && sig.signer_action !== "cancelled") ||
          // Accepted/declined/changes_requested quote/proposal
          !!s.quotationResponse ||
          // Submitted onboarding form — checked via session status + document type
          // (when the client submits, the context is updated but status stays
          // finalized; we detect by checking if context has filled customQuestions)
          (s.document_type?.toLowerCase().replace(/\s+/g, "_") === "client_onboarding_form" &&
            Array.isArray((s.context as any)?.customQuestions) &&
            (s.context as any).customQuestions.some((q: any) => q.answer && q.answer.trim().length > 0))
        return {
          ...s,
          recurring: recurringMap[s.id] ?? null,
          signatures: sigs,
          chainCount: s.chain_id ? (chainCountMap[s.chain_id] || 1) : undefined,
          hasClientInteraction,
        }
      })

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

      const rawDocType = (session.document_type || "invoice").toLowerCase()
      // Normalize so legacy "quotation" and canonical "quote" share the same branch
      const docType = normalizeDocumentType(rawDocType) ?? rawDocType

      const PdfComponent = resolvePdfComponent(templates, docType, cleanedData) as React.ComponentType<{
        data: InvoiceData
        logoUrl?: string | null
      }>
      const filePrefix = resolveDocumentReference(cleanedData, docType)

      // Load signature images for signed documents (contracts/quotes/proposals)
      if (["contract", "quote", "proposal"].includes(docType) && session.status === "signed") {
        try {
          const { data: sigs } = await (supabase as any)
            .from("signatures")
            .select("signer_name, party, signed_at, signature_image_url")
            .eq("session_id", session.id)
            .not("signed_at", "is", null)

          if (sigs && sigs.length > 0) {
            const sigImages: Array<{ signerName: string; party: string; imageDataUrl: string; signedAt: string }> = []
            for (const sig of sigs) {
              const imgKey = sig.signature_image_url
              if (!imgKey || imgKey === "data_url_fallback") continue

              let imageDataUrl: string | null = null

              // Handle inline data URLs directly (fallback from failed storage uploads)
              if (imgKey.startsWith("data:image/")) {
                imageDataUrl = imgKey
              } else {
                // Fetch from storage via proxy
                try {
                  const imgRes = await authFetch(`/api/storage/image?key=${encodeURIComponent(imgKey)}`)
                  if (imgRes.ok) {
                    const imgData = await imgRes.json()
                    if (imgData.dataUrl) imageDataUrl = imgData.dataUrl
                  }
                } catch { /* ignore */ }
              }

              if (imageDataUrl) {
                if (sig.party === "Sender") {
                  // Map Sender signature to senderSignatureDataUrl for Party A in PDF
                  cleanedData.senderSignatureDataUrl = imageDataUrl
                  cleanedData.showSenderSignature = true
                } else {
                  // Map Client/other signatures to signatureImages for Party B in PDF
                  sigImages.push({
                    signerName: sig.signer_name || "Signer",
                    party: sig.party || "Client",
                    imageDataUrl,
                    signedAt: sig.signed_at,
                  })
                }
              }
            }
            if (sigImages.length > 0) {
              cleanedData.signatureImages = sigImages
            }
            // Mark as signed even if no images loaded (data_url_fallback case)
            // This triggers the "Electronically Signed" placeholder in the PDF
            if (sigs.length > 0 && sigImages.length === 0 && !cleanedData.senderSignatureDataUrl) {
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

  const deleteDocument = useCallback(async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/sessions/delete?sessionId=${sessionId}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Failed to delete")
        return
      }
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      toast.success("Document deleted")
    } catch {
      toast.error("Failed to delete")
    }
  }, [])

  // Filter options with counts — driven by registry so all 10 types appear when present
  const filterOptions = [
    { key: "all", label: "All", count: sessions.length },
    ...ALL_DOCUMENT_TYPES.map(type => {
      const cfg = getDocumentTypeConfig(type)
      const label = cfg?.label ?? (type.charAt(0).toUpperCase() + type.slice(1))
      return {
        key: type,
        label: label + "s",
        // "quotation" records are stored as the legacy type; normalise on compare
        count: sessions.filter(s => normalizeDocumentType(s.document_type) === type).length,
      }
    }),
    { key: "paid", label: "Paid", count: sessions.filter(s => s.payment?.status === "paid" || s.status === "paid").length },
    { key: "pending", label: "Pending", count: sessions.filter(s => s.payment?.status === "created" || (s.document_type === "invoice" && !s.payment && s.status !== "paid")).length },
  ].filter(f => f.key === "all" || f.count > 0)

  // Helper: check if date is in the selected range
  const isInDateRange = useCallback((dateStr: string): boolean => {
    if (dateRange === "all") return true
    const date = new Date(dateStr)
    const now = new Date()
    if (dateRange === "this_month") {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
    }
    if (dateRange === "last_month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return date.getFullYear() === lastMonth.getFullYear() && date.getMonth() === lastMonth.getMonth()
    }
    if (dateRange === "this_year") {
      return date.getFullYear() === now.getFullYear()
    }
    return true
  }, [dateRange])

  const dateRangeLabels: Record<DateRangeValue, string> = {
    all: "All time",
    this_month: "This month",
    last_month: "Last month",
    this_year: "This year",
  }

  const filtered = sessions.filter(s => {
    // Type/status filter
    if (filter !== "all") {
      if (filter === "paid") {
        if (!(s.payment?.status === "paid" || s.status === "paid")) return false
      } else if (filter === "pending") {
        if (s.payment?.status !== "created") return false
      } else {
        // Normalise the session's document_type so "quotation" matches "quote"
        const normalised = normalizeDocumentType(s.document_type)
        if (normalised !== filter) return false
      }
    }

    // Date range filter
    if (!isInDateRange(s.created_at)) return false

    // Search filter — match client name, reference/invoice number, or type
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const ctx = s.context || {}
      const haystack = [
        s.client_name,
        ctx.toName,
        ctx.invoiceNumber,
        ctx.referenceNumber,
        s.document_type,
      ].filter(Boolean).join(" ").toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
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

        {/* Tier limit banner — monochromatic, minimal, only shown when relevant */}
        {tierUsage && (() => {
          const docUsedPct = tierUsage.documentsLimit > 0 ? (tierUsage.documentsUsed / tierUsage.documentsLimit) * 100 : 0
          const emailUsedPct = tierUsage.emailsLimit > 0 ? (tierUsage.emailsUsed / tierUsage.emailsLimit) * 100 : 0
          const docLimitReached = tierUsage.documentsLimit > 0 && tierUsage.documentsUsed >= tierUsage.documentsLimit
          const emailLimitReached = tierUsage.emailsLimit > 0 && tierUsage.emailsUsed >= tierUsage.emailsLimit
          const docWarning = !docLimitReached && docUsedPct >= 80
          const emailWarning = !emailLimitReached && emailUsedPct >= 80
          const anyLimitReached = docLimitReached || emailLimitReached
          const anyWarning = docWarning || emailWarning

          if (!anyLimitReached && !anyWarning) return null

          const tierLabel = tierUsage.tier.charAt(0).toUpperCase() + tierUsage.tier.slice(1)
          const nextTierLabel = tierUsage.tier === "free" ? "Starter" : tierUsage.tier === "starter" ? "Pro" : "Agency"

          return (
            <motion.div variants={itemVariants}>
              <div className={cn(
                "rounded-xl border p-3.5 flex items-start gap-3",
                anyLimitReached
                  ? "border-foreground/30 bg-foreground text-background"
                  : "border-border bg-muted/40"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  anyLimitReached ? "bg-background/20" : "bg-foreground/10"
                )}>
                  {anyLimitReached ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4 text-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5">
                    {anyLimitReached ? `${tierLabel} plan limit reached` : `${tierLabel} plan — approaching limit`}
                  </p>
                  <p className={cn("text-xs leading-relaxed", anyLimitReached ? "text-background/80" : "text-muted-foreground")}>
                    {docLimitReached && `Documents: ${tierUsage.documentsUsed} / ${tierUsage.documentsLimit} used this month. `}
                    {emailLimitReached && `Emails: ${tierUsage.emailsUsed} / ${tierUsage.emailsLimit} used this month. `}
                    {!anyLimitReached && docWarning && `Documents: ${tierUsage.documentsUsed} / ${tierUsage.documentsLimit} used. `}
                    {!anyLimitReached && emailWarning && `Emails: ${tierUsage.emailsUsed} / ${tierUsage.emailsLimit} used. `}
                    {emailLimitReached && "Scheduled follow-up reminders will pause until next month or an upgrade. "}
                    {tierUsage.tier !== "agency" && `Upgrade to ${nextTierLabel} for higher limits.`}
                  </p>
                  {tierUsage.tier !== "agency" && (
                    <button
                      type="button"
                      onClick={() => router.push("/billing")}
                      className={cn(
                        "mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline transition-colors",
                        anyLimitReached ? "text-background" : "text-foreground"
                      )}
                    >
                      View plans
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )
        })()}

        {/* Summary stats */}
        {(totalPaid > 0 || totalPending > 0) && (
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</p>
              <p className="text-xl font-semibold text-foreground">{sessions.length}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Paid</p>
              <p className="text-xl font-semibold text-foreground">{totalPaid}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-card p-3.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Pending</p>
              <p className="text-xl font-semibold text-foreground">{totalPending}</p>
            </div>
          </motion.div>
        )}

        {/* Search + Date range */}
        {sessions.length > 0 && (
          <motion.div variants={itemVariants} className="flex gap-2 items-center">
            {/* Search input — smooth focus transition */}
            <div className="flex-1 relative group">
              <Search className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors duration-200",
                searchQuery ? "text-foreground" : "text-muted-foreground/60 group-focus-within:text-foreground"
              )} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client or number…"
                className="w-full h-9 pl-9 pr-8 rounded-xl bg-muted/40 border border-border/40 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30 focus:bg-background focus:ring-4 focus:ring-foreground/5 transition-all duration-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 active:scale-90 animate-in fade-in zoom-in-75 duration-200"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Date range — custom dropdown (no native select for better UX) */}
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </motion.div>
        )}

        {/* Filter pills — monochromatic with counts */}
        {sessions.length > 0 && (
          <motion.div variants={itemVariants} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {filterOptions.map(f => {
              const isActive = filter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "group inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap shrink-0 border active:scale-[0.96]",
                    isActive
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-transparent text-muted-foreground border-border/50 hover:border-border hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <span>{f.label}</span>
                  {f.count > 0 && (
                    <span className={cn(
                      "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums transition-colors duration-200",
                      isActive
                        ? "bg-background/20 text-background"
                        : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/20 group-hover:text-foreground"
                    )}>
                      {f.count}
                    </span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Document List with AnimatePresence */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${filter}-${dateRange}-${searchQuery}`}
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
                    : searchQuery
                      ? `No results for "${searchQuery}". Try a different search.`
                      : dateRange !== "all"
                        ? `No documents in ${dateRangeLabels[dateRange]}.`
                        : "Try a different filter."}
                </p>
                {sessions.length === 0 ? (
                  <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Create your first document
                  </button>
                ) : (searchQuery || dateRange !== "all" || filter !== "all") && (
                  <button
                    onClick={() => { setSearchQuery(""); setDateRange("all"); setFilter("all") }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground underline"
                  >
                    Clear all filters
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
                      onDelete={deleteDocument}
                    />
                  ) : (
                    <ChainGroupCard
                      key={group.chainId || `group-${gi}`}
                      clientName={group.clientName}
                      sessions={group.sessions}
                      onDownload={downloadDocument}
                      downloadingId={downloadingId}
                      onRefresh={() => loadSessions(true)}
                      onDelete={deleteDocument}
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
