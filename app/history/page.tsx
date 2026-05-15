"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import {
  History, FileText, FileCheck, FileQuestion, Presentation, ClipboardList,
  GitMerge, Shield, ClipboardCheck, Bell, RefreshCw,
  Link2, ChevronRight, ArrowRight, ChevronDown, ArrowLeft, Trash2, MessageSquare, ChevronUp
} from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { useSafeBack } from "@/hooks/use-safe-back"
import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/auth-fetch"
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog"
import { getDocumentTypeConfig, normalizeDocumentType, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"

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
// Top 6 visible types + "All" + optional "Chat"; remaining 4 under "More".
const PRIMARY_FILTER_TYPES = ["invoice", "contract", "quote", "proposal", "sow", "nda"] as const
const MORE_FILTER_TYPES    = ["change_order", "client_onboarding_form", "payment_followup", "recurring_invoice"] as const

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
  const [showMore, setShowMore] = useState(false)

  // Delete state — lifted to page level so one dialog serves all cards
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
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
        chainSessions.sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
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

  const openSession = (session: Session) => router.push(`/?sessionId=${session.id}`)

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
    } catch {
      toast.error("Failed to delete")
    } finally {
      setDeleting(false)
    }
  }, [pendingDeleteId])

  // ── Filtering logic ─────────────────────────────────────────────────────────
  const sessionMatchesFilter = (s: Session): boolean => {
    if (filter === "all")  return s.document_type !== "chat"
    if (filter === "chat") return s.document_type === "chat"
    // Use normalizeDocumentType so "quotation" is treated as "quote"
    const normalized = normalizeDocumentType(s.document_type)
    return normalized === filter
  }

  const filteredGroups = groups.filter(g => g.sessions.some(sessionMatchesFilter))

  const docCount = filter === "all"
    ? groups.filter(g => g.sessions.some(s => s.document_type !== "chat")).length
    : filteredGroups.length

  const countLabel = filter === "chat"
    ? `${docCount} conversation${docCount !== 1 ? "s" : ""}`
    : `${docCount} document${docCount !== 1 ? "s" : ""}`

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 pt-12 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-3">
          <div className="h-7 bg-muted rounded-xl w-40" />
          <div className="h-4 bg-muted rounded w-52" />
          <div className="h-16 bg-muted rounded-2xl mt-6" />
          <div className="h-16 bg-muted rounded-2xl" />
          <div className="h-16 bg-muted rounded-2xl" />
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
              <ClorefyLogo size={24} />
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

        {/* Filter pills — top 6 types + All + More expandable section */}
        <div className="mb-5 space-y-2">
          {/* Primary row */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {/* "All" pill */}
            <FilterPill label="All" active={filter === "all"} onClick={() => setFilter("all")} />

            {/* Top 6 type pills */}
            {PRIMARY_FILTER_TYPES.map(type => (
              <FilterPill
                key={type}
                label={filterLabel(type)}
                active={filter === type}
                onClick={() => setFilter(type)}
              />
            ))}

            {/* More toggle */}
            <button
              onClick={() => setShowMore(v => !v)}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all duration-200 border shrink-0",
                showMore
                  ? "bg-secondary text-foreground border-border"
                  : "bg-card text-muted-foreground border-border hover:bg-secondary shadow-sm"
              )}
              style={{ boxShadow: showMore ? undefined : "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              More
              {showMore ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Expanded row — remaining 4 types */}
          {showMore && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5 pl-0 animate-in fade-in slide-in-from-top-1 duration-200">
              {MORE_FILTER_TYPES.map(type => (
                <FilterPill
                  key={type}
                  label={filterLabel(type)}
                  active={filter === type}
                  onClick={() => setFilter(type)}
                />
              ))}
              {/* Chat pill lives here since it's not a document type */}
              <FilterPill label="Chat" active={filter === "chat"} onClick={() => setFilter("chat")} />
            </div>
          )}
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-3xl bg-muted/60 flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs">Create your first document and it will show up here</p>
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
              <div key={group.chainId || `s-${gi}`} className="animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: `${gi * 30}ms` }}>
                {group.sessions.length > 1 ? (
                  <ChainGroup group={group} onOpen={openSession} onRequestDelete={setPendingDeleteId} />
                ) : (
                  <SingleCard
                    session={group.sessions[0]}
                    clientName={group.clientName}
                    onOpen={openSession}
                    onRequestDelete={setPendingDeleteId}
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
        loading={deleting}
        onCancel={() => { if (!deleting) setPendingDeleteId(null) }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all duration-200 border shrink-0",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md"
          : "bg-card text-foreground border-border hover:bg-secondary shadow-sm"
      )}
      style={active ? { boxShadow: "0 2px 8px hsl(var(--primary)/0.3)" } : { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {label}
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
  const docTypes = [...new Set(group.sessions.map(s => s.document_type))]

  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.08)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors active:bg-secondary/50"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
          <Link2 className="w-4 h-4 text-primary" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{group.clientName || "Linked Documents"}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(group.latestDate), { addSuffix: true })}
            </span>
            <span className="text-muted-foreground/30 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{group.sessions.length} docs</span>
            <div className="flex items-center gap-0.5 ml-0.5">
              {docTypes.map(t => {
                const cfg = getDocCfg(t)
                return <span key={t} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", cfg.bg, cfg.color)}>{cfg.label}</span>
              })}
            </div>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0", expanded && "rotate-180")} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("transition-opacity duration-200 border-t border-border/50", expanded ? "opacity-100" : "opacity-0")}>
            {group.sessions.map((session) => {
              const cfg = getDocCfg(session.document_type)
              const Icon = cfg.icon
              const isProtected = session.status === "paid" || session.status === "signed"

              return (
                <div key={session.id} className="flex items-center border-b border-border/30 last:border-0 group">
                  <button
                    type="button"
                    onClick={() => onOpen(session)}
                    className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3 hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                      <Icon className={cn("w-4 h-4", cfg.color)} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.context?.toName || session.client_name || session.title || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {cfg.label} · {session.created_at ? format(new Date(session.created_at), "MMM dd, h:mm a") : ""}
                      </p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </button>

                  {!isProtected && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRequestDelete(session.id) }}
                      className="w-9 h-9 flex items-center justify-center mr-2 rounded-xl text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
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
    <div
      className="flex items-center rounded-2xl border border-border bg-card overflow-hidden group"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.07)" }}
    >
      <button
        type="button"
        onClick={() => onOpen(session)}
        className="flex items-center gap-3.5 flex-1 min-w-0 px-4 py-3.5 text-left active:scale-[0.99] transition-all duration-150 hover:bg-secondary/20"
      >
        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0", cfg.bg)}
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
        >
          <Icon className={cn("w-5 h-5", cfg.color)} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-[11px] font-semibold px-1.5 py-0.5 rounded-md", cfg.bg, cfg.color)}>{cfg.label}</span>
            <span className="text-xs text-muted-foreground">
              {date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : ""}
            </span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>

      {!isProtected && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRequestDelete(session.id) }}
          className="w-10 h-10 flex items-center justify-center mr-2 rounded-xl text-muted-foreground/30 hover:text-muted-foreground hover:bg-muted transition-all [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          aria-label="Delete document"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
