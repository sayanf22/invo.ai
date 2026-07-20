"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import {
  History, FileText, FileCheck, FileQuestion, Presentation, ClipboardList,
  GitMerge, Shield, ClipboardCheck, Bell, RefreshCw,
  Link2, ChevronRight, ArrowRight, ChevronDown, ArrowLeft, Trash2, MessageSquare
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { useSafeBack } from "@/hooks/use-safe-back"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth-fetch"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { getDocumentTypeConfig, normalizeDocumentType, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"
import { motion } from "framer-motion"
import { PageHeaderSkeleton, FilterPillsSkeleton, ListItemSkeleton } from "@/components/ui/skeletons"

// ── Icon lookup map (icon name string → Lucide component) ─────────────────────
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  FileText, FileCheck, FileQuestion, Presentation, ClipboardList,
  GitMerge, Shield, ClipboardCheck, Bell, RefreshCw,
}

// ── Doc config helper ─────────────────────────────────────────────────────────
// "chat" is not in the registry; all other types go through it.
const CHAT_CFG  = { label: "Chat",     icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted" }
const FALLBACK  = { label: "Document", icon: FileText,       color: "text-muted-foreground", bg: "bg-muted" }

function getDocCfg(type: string) {
  if (type === "chat") return CHAT_CFG
  const reg = getDocumentTypeConfig(type)      // handles "quotation" → "quote" internally
  if (!reg) return FALLBACK
  const icon = ICON_MAP[reg.icon] ?? FileText
  return { label: reg.label, icon, color: reg.color, bg: reg.bgColor }
}

// ── Filter definitions ────────────────────────────────────────────────────────
const PRIMARY_FILTER_TYPES = ["invoice", "contract", "quote", "proposal", "sow"] as const
const MORE_FILTER_TYPES    = ["nda", "change_order", "client_onboarding_form", "payment_followup"] as const

type DocTypeFilter = typeof PRIMARY_FILTER_TYPES[number] | typeof MORE_FILTER_TYPES[number]
type FilterValue   = "all" | "chat" | DocTypeFilter

// Human-readable label for a filter value
function filterLabel(f: FilterValue): string {
  if (f === "all")  return "All"
  if (f === "chat") return "Chat"
  return getDocumentTypeConfig(f)?.label ?? f
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Session {
  id: string
  document_type: string
  title: string | null
  status: string
  created_at: string | null
  updated_at: string | null
  chain_id: string | null
  client_name: string | null
  context: any
}

interface SessionGroup {
  chainId: string | null
  clientName: string | null
  sessions: Session[]
  latestDate: string
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function HistoryPage() {
  const router   = useRouter()
  const goBack   = useSafeBack("/")
  const supabase = useSupabase()
  const user     = useUser()
  const [groups, setGroups]   = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FilterValue>("all")

  // Delete state — lifted to page level so one dialog serves all cards
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleteWarnings, setDeleteWarnings] = useState<string[]>([])
  const [loadingWarnings, setLoadingWarnings] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return }
    loadSessions()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    try {
      if (!user?.id) { setLoading(false); return }
      const { data, error } = await supabase
        .from("document_sessions").select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100)
      if (error) throw error

      const sessions = (data || []) as Session[]
      const chainMap = new Map<string, Session[]>()
      const standalone: Session[] = []

      for (const s of sessions) {
        if (s.chain_id) {
          const arr = chainMap.get(s.chain_id) || []
          arr.push(s)
          chainMap.set(s.chain_id, arr)
        } else {
          standalone.push(s)
        }
      }

      const grouped: SessionGroup[] = []
      for (const [chainId, chainSessions] of chainMap) {
        // Newest first — consistent with the My Documents linked-docs ordering.
        chainSessions.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
        const clientName = chainSessions.find(s => s.client_name)?.client_name || null
        const latestDate = chainSessions.reduce((l, s) => { const d = s.updated_at || s.created_at || ""; return d > l ? d : l }, "")
        grouped.push({ chainId, clientName, sessions: chainSessions, latestDate })
      }
      for (const s of standalone) {
        const displayName = s.document_type === "chat"
          ? (s.title || "Chat conversation")
          : (s.client_name || s.context?.toName || s.title || null)
        grouped.push({ chainId: null, clientName: displayName, sessions: [s], latestDate: s.updated_at || s.created_at || "" })
      }
      grouped.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())
      setGroups(grouped)
    } catch {
      toast.error("Failed to load history")
    } finally { setLoading(false) }
  }

  // A locked/sent document is a finished record — open it in the document
  // viewer (read-only PDF UI), the same as clicking it in My Documents. Drafts
  // and chat sessions still reopen the chat/editor so they can be continued.
  const openSession = (session: Session) => {
    const locked = ["finalized", "signed", "paid"].includes((session.status || "").toLowerCase())
    if (session.document_type !== "chat" && locked) {
      router.push(`/view/${session.id}`)
    } else {
      router.push(`/?sessionId=${session.id}`)
    }
  }

  /**
   * Called when user clicks the trash icon.
   * Looks up the session's live state from Supabase and computes
   * a list of consequences (warnings) to show in the confirm dialog.
   */
  const handleRequestDelete = useCallback(async (sessionId: string) => {
    // Find the session in current state to get its document type + status
    const session = groups.flatMap(g => g.sessions).find(s => s.id === sessionId)
    if (!session) return

    setLoadingWarnings(true)
    setPendingDeleteId(sessionId)

    try {
      const warnings: string[] = []
      const docType = session.document_type?.toLowerCase() || ""
      const status = session.status

      // 1. Sent/finalized: client has already received the document
      if (status === "finalized") {
        warnings.push("The document has been sent — the client's link will stop working")
      }

      // 2. Pending signature requests
      const { data: sigs } = await supabase
        .from("signatures")
        .select("id, signed_at, signer_action")
        .eq("session_id", sessionId)
        .is("signed_at", null)
        .is("signer_action", null)

      if (sigs && sigs.length > 0) {
        warnings.push(`${sigs.length} pending e-signature request${sigs.length > 1 ? "s" : ""} will be cancelled`)
      }

      // 3. Pending quotation/proposal responses
      if (docType === "quote" || docType === "quotation" || docType === "proposal") {
        if (status === "finalized") {
          warnings.push("The client can no longer accept, decline, or request changes on this document")
        }
      }

      // 4. Scheduled email reminders (future emails that won't send)
      const { data: schedules } = await (supabase as any)
        .from("email_schedules")
        .select("id")
        .eq("session_id", sessionId)
        .eq("status", "pending")

      if (schedules && schedules.length > 0) {
        warnings.push(`${schedules.length} scheduled email reminder${schedules.length > 1 ? "s" : ""} will be cancelled`)
      }

      // 5. Active recurring invoice
      const { data: recurring } = await (supabase as any)
        .from("recurring_invoices")
        .select("id, is_active, frequency")
        .eq("source_session_id", sessionId)
        .eq("is_active", true)
        .limit(1)

      if (recurring && recurring.length > 0) {
        const freq = recurring[0].frequency || "recurring"
        warnings.push(`${freq.charAt(0).toUpperCase() + freq.slice(1)} auto-invoice schedule will stop`)
      }

      // 6. Active payment link
      const payLink = session.context?.paymentLink
      const payStatus = session.context?.paymentLinkStatus
      if (payLink && payStatus === "created") {
        warnings.push("The active payment link will become inaccessible to the client")
      }

      setDeleteWarnings(warnings)
    } catch {
      // Non-fatal — if we can't load warnings, still allow delete with base dialog
      setDeleteWarnings([])
    } finally {
      setLoadingWarnings(false)
    }
  }, [groups, supabase])

  const handleDeleteConfirm = useCallback(async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    try {
      const res = await authFetch(`/api/sessions/delete?sessionId=${pendingDeleteId}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error || "Failed to delete")
        return
      }
      setGroups(prev =>
        prev
          .map(g => ({ ...g, sessions: g.sessions.filter(s => s.id !== pendingDeleteId) }))
          .filter(g => g.sessions.length > 0)
      )
      toast.success("Document deleted")
      setPendingDeleteId(null)
      setDeleteWarnings([])
    } catch {
      toast.error("Failed to delete")
    } finally {
      setDeleting(false)
    }
  }, [pendingDeleteId])

  // ── Compute available filter types from actual loaded data (only show non-empty types) ──
  const availableFilters = useMemo((): FilterValue[] => {
    const result: FilterValue[] = ["all"]
    const hasChat = groups.some(g => g.sessions.some(s => s.document_type === "chat"))
    if (hasChat) result.push("chat")
    const allDocTypes = [...PRIMARY_FILTER_TYPES, ...MORE_FILTER_TYPES] as const
    for (const type of allDocTypes) {
      const exists = groups.some(g => g.sessions.some(s => normalizeDocumentType(s.document_type) === type))
      if (exists) result.push(type)
    }
    return result
  }, [groups])

  // ── Filtering logic ─────────────────────────────────────────────────────────
  const sessionMatchesFilter = (s: Session): boolean => {
    if (filter === "all")  return true  // show everything: docs + chats
    if (filter === "chat") return s.document_type === "chat"
    // Use normalizeDocumentType so "quotation" is treated as "quote"
    const normalized = normalizeDocumentType(s.document_type)
    return normalized === filter
  }

  const filteredGroups = groups.filter(g => g.sessions.some(sessionMatchesFilter))

  const docCount = filteredGroups.length

  const countLabel = filter === "chat"
    ? `${docCount} conversation${docCount !== 1 ? "s" : ""}`
    : filter === "all"
      ? `${docCount} item${docCount !== 1 ? "s" : ""}`
      : `${docCount} document${docCount !== 1 ? "s" : ""}`

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <PageHeaderSkeleton titleWidth={16} />
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-20 space-y-5">
          <div className="space-y-2">
            <div className="h-7 w-28 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded-md bg-muted/60 animate-pulse" />
          </div>
          <FilterPillsSkeleton />
          <ListItemSkeleton count={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => goBack()} className="w-8 h-8 flex items-center justify-center rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <ClorefyLogo size={22} />
              <span className="font-semibold text-sm">History</span>
            </div>
          </div>
          <HamburgerMenu />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{countLabel}</p>
        </div>

        {/* Filter bar — one smooth scrollable row, active pill slides */}
        <div className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {availableFilters.map(f => (
              <FilterPill key={f} label={filterLabel(f)} active={filter === f} onClick={() => setFilter(f)} />
            ))}
          </div>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted/60 flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1">No history yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">Start a chat or create a document and it will show up here</p>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ boxShadow: "0 2px 8px hsl(var(--primary)/0.3)" }}
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredGroups.map((group, gi) => (
              <div key={group.chainId || `s-${gi}`} className="animate-in fade-in duration-200">
                {group.sessions.length > 1 ? (
                  <ChainGroup group={group} onOpen={openSession} onRequestDelete={handleRequestDelete} />
                ) : (
                  <SingleCard
                    session={group.sessions[0]}
                    clientName={group.clientName}
                    onOpen={openSession}
                    onRequestDelete={handleRequestDelete}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Single delete dialog for the whole page */}
      <DeleteConfirmDialog
        open={!!pendingDeleteId}
        loading={deleting || loadingWarnings}
        warnings={deleteWarnings}
        onCancel={() => { if (!deleting && !loadingWarnings) { setPendingDeleteId(null); setDeleteWarnings([]) } }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

// ── Filter Pill — Framer Motion sliding background ────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-3.5 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-colors duration-200 shrink-0",
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {active && (
        <motion.span
          layoutId="history-filter-pill"
          className="absolute inset-0 rounded-2xl bg-primary shadow-sm"
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
        />
      )}
      <span className="relative z-10">{label}</span>
    </button>
  )
}

// ── Chain Group ───────────────────────────────────────────────────────────────
function ChainGroup({ group, onOpen, onRequestDelete }: {
  group: SessionGroup
  onOpen: (s: Session) => void
  onRequestDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  // Distinct human-readable type labels for the header sub-line (plain muted
  // text — matches the My Documents chain design and avoids the overflowing
  // row of coloured badges that looked broken on multi-type chains).
  const docTypeLabels = [...new Set(group.sessions.map(s => getDocCfg(s.document_type).label))]

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04),0_5px_14px_-6px_rgba(0,0,0,0.12)]">
      {/* Group header — clean monochromatic (mirrors My Documents) */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/20 transition-colors active:bg-muted/30"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Link2 size={15} className="text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">{group.clientName || "Linked Documents"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {group.sessions.length} documents · {docTypeLabels.join(", ")}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Expandable thread-connected list — mirrors My Documents linked docs */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative pl-3 pr-3 pb-3 pt-1">
            {/* Vertical thread line */}
            <div className="absolute left-[22px] top-0 bottom-3 w-px bg-border/50" />
            <div className="space-y-2">
              {group.sessions.map((session) => {
                const cfg = getDocCfg(session.document_type)
                const Icon = cfg.icon
                const isProtected = session.status === "paid" || session.status === "signed"
                const rowTitle = session.context?.toName || session.client_name || session.title || "Untitled"
                return (
                  <div key={session.id} className="relative pl-5">
                    {/* Connector + dot on the thread line */}
                    <div className="absolute left-0 top-[22px] w-5 h-px bg-border/50" />
                    <div className="absolute left-[-3px] top-[18px] w-[7px] h-[7px] rounded-full bg-muted-foreground/30 border-2 border-card" />
                    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden group">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => onOpen(session)}
                          className="flex items-center gap-3 flex-1 min-w-0 px-3.5 py-3 text-left hover:bg-muted/20 transition-colors"
                        >
                          <span className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0", cfg.bg, cfg.color)}>
                            <Icon size={11} className="shrink-0" strokeWidth={1.75} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{rowTitle}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {cfg.label} · {session.created_at ? format(new Date(session.created_at), "MMM d, h:mm a") : ""}
                            </p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                        </button>
                        {!isProtected && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onRequestDelete(session.id) }}
                            className="w-9 h-9 flex items-center justify-center mr-1.5 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors shrink-0"
                            aria-label="Delete document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Single Card ───────────────────────────────────────────────────────────────
function SingleCard({ session, clientName, onOpen, onRequestDelete }: {
  session: Session
  clientName: string | null
  onOpen: (s: Session) => void
  onRequestDelete: (id: string) => void
}) {
  const cfg  = getDocCfg(session.document_type)
  const Icon = cfg.icon
  const title = session.document_type === "chat"
    ? (session.title || "Chat conversation")
    : (clientName || session.context?.toName || session.title || "Untitled")
  const date = session.updated_at || session.created_at
  const isProtected = session.status === "paid" || session.status === "signed"

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden group shadow-[0_1px_2px_rgba(0,0,0,0.04),0_5px_14px_-6px_rgba(0,0,0,0.12)]">
      <div className="px-4 py-3.5">
        {/* Row 1: type badge (left) + open/delete actions (right) — mirrors the
            My Documents card so long type labels never squeeze the title. */}
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider min-w-0 max-w-full", cfg.bg, cfg.color)}>
            <Icon size={11} className="shrink-0" strokeWidth={1.75} />
            <span className="truncate">{cfg.label}</span>
          </span>

          {/* Status chip */}
          {(session.status === "signed" || session.status === "paid") && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-foreground/5 text-foreground border border-foreground/20 shrink-0">
              {session.status === "signed" ? "✓ Signed" : "✓ Paid"}
            </span>
          )}
          {session.status === "finalized" && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground border border-border/50 shrink-0">
              Sent
            </span>
          )}

          <div className="flex items-center gap-0.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => onOpen(session)}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Open"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!isProtected && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRequestDelete(session.id) }}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 transition-colors [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                aria-label="Delete document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: title + metadata — full width */}
        <button
          type="button"
          onClick={() => onOpen(session)}
          className="mt-2 block w-full text-left min-w-0"
        >
          <p className="font-semibold text-sm text-foreground leading-tight truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {cfg.label}{date ? ` · ${formatDistanceToNow(new Date(date), { addSuffix: true })}` : ""}
          </p>
        </button>
      </div>
    </div>
  )
}
