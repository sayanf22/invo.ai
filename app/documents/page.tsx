"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import {
  FileText, Download, Eye, Calendar, Loader2, ArrowLeft, Plus,
  CheckCircle2, Clock, AlertCircle, XCircle, Link2, ExternalLink,
  RefreshCw, ChevronDown, ChevronUp, CreditCard, Send, Mail,
  BellOff,
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import type { InvoiceData } from "@/lib/invoice-types"
import { cleanDataForExport } from "@/lib/invoice-types"
import { resolveLogoUrl } from "@/lib/resolve-logo-url"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { authFetch } from "@/lib/auth-fetch"

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
  payment?: PaymentRecord | null
  email?: EmailRecord | null          // most recent email (for badge)
  emailStats?: EmailStats | null
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

// ── Payment Detail Panel ──────────────────────────────────────────────────────

function PaymentPanel({ payment, currency }: { payment: PaymentRecord; currency: string }) {
  const fmt = (paise: number) => {
    const amount = paise / 100
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: payment.currency || currency, maximumFractionDigits: 2 }).format(amount)
  }

  const isOverdue = payment.status === "created" && payment.expires_at && new Date(payment.expires_at) < new Date()

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
        {payment.status !== "paid" && payment.status !== "cancelled" && (
          <div className="flex items-center gap-2 pt-0.5">
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

  const statusConfig = {
    sent: { label: "Sent", className: "bg-muted text-muted-foreground" },
    delivered: { label: "Delivered", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    opened: { label: "Opened", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    bounced: { label: "Bounced", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    failed: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  }

  const handleStopFollowUps = async () => {
    setStopping(true)
    try {
      const res = await authFetch(`/api/emails/schedules?sessionId=${sessionId}`, { method: "DELETE" })
      if (res.ok) {
        setStopped(true)
        toast.success("Follow-up reminders stopped")
      } else {
        toast.error("Failed to stop reminders")
      }
    } catch {
      toast.error("Failed to stop reminders")
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 overflow-hidden">
      {/* Stats summary row */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail size={11} />
          <span className="font-semibold text-foreground">{stats.totalSent}</span> sent
        </div>
        {stats.opened > 0 && (
          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <Eye size={11} />
            <span className="font-semibold">{stats.opened}</span> opened
          </div>
        )}
        {stats.delivered > 0 && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={11} />
            <span className="font-semibold">{stats.delivered}</span> delivered
          </div>
        )}
        {stats.bounced > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={11} />
            <span className="font-semibold">{stats.bounced}</span> bounced
          </div>
        )}
        {/* Stop follow-ups button — inline in the stats row */}
        <div className="ml-auto">
          {stopped ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
              <BellOff size={10} />
              Stopped
            </span>
          ) : (
            <button
              type="button"
              onClick={handleStopFollowUps}
              disabled={stopping}
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-800/50 transition-colors disabled:opacity-50"
            >
              {stopping ? <Loader2 size={10} className="animate-spin" /> : <BellOff size={10} />}
              Stop Reminders
            </button>
          )}
        </div>
      </div>

      {/* Individual email rows */}
      <div className="divide-y divide-border/30">
        {stats.emails.map((e, i) => {
          const cfg = statusConfig[e.status] || statusConfig.sent
          return (
            <div key={e.id} className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] text-muted-foreground shrink-0">#{i + 1}</span>
                <span className="text-xs text-foreground/80 truncate max-w-[160px]">{e.recipient_email}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", cfg.className)}>
                  {cfg.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(e.created_at), "MMM d")}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Document Card ─────────────────────────────────────────────────────────────

function DocCard({
  session,
  onDownload,
  downloading,
}: {
  session: DocSession
  onDownload: (s: DocSession) => void
  downloading: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [emailExpanded, setEmailExpanded] = useState(false)
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

  const payment = session.payment
  const hasPayment = !!payment
  const emailStats = session.emailStats
  const hasEmails = !!emailStats && emailStats.totalSent > 0

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden transition-all duration-300",
        "shadow-[0_8px_24px_rgb(0,0,0,0.06)] hover:shadow-[0_16px_40px_rgb(0,0,0,0.1)] hover:border-border/80 hover:-translate-y-1",
        payment?.status === "paid" ? "border-emerald-200/50 dark:border-emerald-800/40" : "border-border/50",
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 px-3.5 py-5 sm:px-4 sm:py-6">
        {/* Type badge */}
        <div className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5", TYPE_COLORS[docType] || "bg-muted text-muted-foreground")}>
          {docType}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm leading-tight truncate">{title}</p>
            {/* Payment status badge — show for invoices always */}
            {docType === "invoice" && (
              payment
                ? (session.status === "paid" && payment.status !== "paid")
                  ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 size={10} />
                      Paid
                    </span>
                  )
                  : <PaymentBadge payment={payment} />
                : session.status === "paid"
                  ? (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 size={10} />
                      Paid
                    </span>
                  )
                  : <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground shrink-0">
                      No link
                    </span>
            )}
            {/* Show Paid badge for non-invoice docs with paid session status */}
            {docType !== "invoice" && session.status === "paid" && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                <CheckCircle2 size={10} />
                Paid
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            {session.client_name && session.client_name !== title && (
              <span className="truncate max-w-[120px]">{session.client_name}</span>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <Calendar size={10} />
              {format(new Date(session.created_at), "MMM d, yyyy")}
            </span>
            {total && <span className="font-semibold text-foreground/80 shrink-0">{total}</span>}
            {session.sent_at && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 shrink-0">
                <Send size={10} />
                Sent
              </span>
            )}
            {session.email && (
              <EmailBadge email={session.email} />
            )}
            {hasEmails && (
              <button
                onClick={() => setEmailExpanded(v => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <Mail size={10} />
                {emailStats!.totalSent} sent
                {emailStats!.opened > 0 && ` · ${emailStats!.opened} opened`}
                {emailExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>

          {/* View tracking summary (compact) */}
          {payment && payment.view_count > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <Eye size={10} />
              Viewed {payment.view_count}×
              {payment.link_viewed_at && ` · ${formatDistanceToNow(new Date(payment.link_viewed_at), { addSuffix: true })}`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* View (read-only static view) */}
          <a
            href={`/view/${session.id}`}
            className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="View document"
          >
            <Eye size={15} />
          </a>

          {/* Download */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={downloading}
            onClick={() => onDownload(session)}
            aria-label="Download PDF"
          >
            {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          </button>

          {/* Expand details — show if payment or emails exist */}
          {(hasPayment || hasEmails) && (
            <button
              className="flex items-center justify-center w-8 h-8 rounded-xl hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
              onClick={() => { setExpanded(v => !v); if (!expanded && hasEmails) setEmailExpanded(true) }}
              aria-label="Toggle details"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable payment panel */}
      {hasPayment && (
        <div className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="min-h-0 overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <PaymentPanel payment={payment!} currency={ctx.currency || "INR"} />
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
        .select("id, document_type, status, client_name, created_at, updated_at, sent_at, context")
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
          .select("id, session_id, short_url, amount, currency, status, amount_paid, paid_at, expires_at, created_at, view_count, link_viewed_at, reference_id, customer_name, gateway")
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

        // Group all emails by session
        const emailsBySession: Record<string, EmailRecord[]> = {}
        for (const e of (emails || [])) {
          if (!emailsBySession[e.session_id]) emailsBySession[e.session_id] = []
          emailsBySession[e.session_id].push(e as EmailRecord)
        }

        // Build stats and most-recent map
        for (const [sid, list] of Object.entries(emailsBySession)) {
          emailMap[sid] = list[0] // most recent (already sorted desc)
          emailStatsMap[sid] = {
            totalSent: list.length,
            opened: list.filter(e => e.status === "opened").length,
            delivered: list.filter(e => e.status === "delivered").length,
            bounced: list.filter(e => e.status === "bounced").length,
            lastSentAt: list[0]?.created_at ?? null,
            emails: list,
          }
        }
      }

      const merged: DocSession[] = withContent.map((s: any) => ({
        ...s,
        payment: paymentMap[s.id] ?? null,
        email: emailMap[s.id] ?? null,
        emailStats: emailStatsMap[s.id] ?? null,
      }))

      setSessions(merged)
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
    { key: "pending", label: "Pending", count: sessions.filter(s => s.payment?.status === "created").length },
  ].filter(f => f.key === "all" || f.count > 0)

  const filtered = sessions.filter(s => {
    if (filter === "all") return true
    if (filter === "paid") return s.payment?.status === "paid" || s.status === "paid"
    if (filter === "pending") return s.payment?.status === "created"
    return s.document_type === filter
  })

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
            onClick={() => router.back()}
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
                {filtered.map(s => (
                  <DocCard
                    key={s.id}
                    session={s}
                    onDownload={downloadDocument}
                    downloading={downloadingId === s.id}
                  />
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
