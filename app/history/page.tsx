"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { ClorefyLogo } from "@/components/clorefy-logo"
import { HamburgerMenu } from "@/components/hamburger-menu"
import { History, FileText, Calendar, Link2, ChevronRight, ArrowRight, ScrollText, ClipboardList, Lightbulb, ChevronDown, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
import { useSafeBack } from "@/hooks/use-safe-back"
import { cn } from "@/lib/utils"

interface Session {
  id: string
  document_type: string
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

const DOC_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  invoice:   { label: "Invoice",   icon: FileText,      color: "text-blue-600",    bg: "bg-blue-50" },
  contract:  { label: "Contract",  icon: ScrollText,    color: "text-emerald-600", bg: "bg-emerald-50" },
  quotation: { label: "Quotation", icon: ClipboardList, color: "text-amber-600",   bg: "bg-amber-50" },
  proposal:  { label: "Proposal",  icon: Lightbulb,     color: "text-purple-600",  bg: "bg-purple-50" },
}
const fallback = { label: "Document", icon: FileText, color: "text-muted-foreground", bg: "bg-muted" }

const FILTERS = ["All", "Invoice", "Contract", "Quotation", "Proposal"] as const
type Filter = typeof FILTERS[number]

export default function HistoryPage() {
  const router = useRouter()
  const goBack = useSafeBack("/")
  const supabase = useSupabase()
  const user = useUser()
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>("All")

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
        grouped.push({ chainId: null, clientName: s.client_name || s.context?.toName || null, sessions: [s], latestDate: s.updated_at || s.created_at || "" })
      }
      grouped.sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime())
      setGroups(grouped)
    } catch (error: any) {
      toast.error("Failed to load history")
    } finally { setLoading(false) }
  }

  const openSession = (session: Session) => router.push(`/?sessionId=${session.id}`)

  const filteredGroups = filter === "All"
    ? groups
    : groups.filter(g => g.sessions.some(s => s.document_type.toLowerCase() === filter.toLowerCase()))

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
          <p className="text-sm text-muted-foreground mt-0.5">
            {groups.length} document{groups.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none mb-5 pb-0.5">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all duration-200 border",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card text-foreground border-border hover:bg-secondary shadow-sm"
              )}
              style={filter === f ? { boxShadow: "0 2px 8px hsl(var(--primary)/0.3)" } : { boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
            >
              {f}
            </button>
          ))}
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
                  <ChainGroup group={group} onOpen={openSession} />
                ) : (
                  <SingleCard session={group.sessions[0]} clientName={group.clientName} onOpen={openSession} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ChainGroup({ group, onOpen }: { group: SessionGroup; onOpen: (s: Session) => void }) {
  const [expanded, setExpanded] = useState(false)
  const docTypes = [...new Set(group.sessions.map(s => s.document_type))]

  return (
    <div
      className="rounded-2xl border border-border bg-card overflow-hidden"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.08)" }}
    >
      {/* Header row */}
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
                const cfg = DOC_CONFIG[t] || fallback
                return <span key={t} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", cfg.bg, cfg.color)}>{cfg.label}</span>
              })}
            </div>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground/50 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0", expanded && "rotate-180")} />
      </button>

      {/* Expandable items */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className={cn("transition-opacity duration-200 border-t border-border/50", expanded ? "opacity-100" : "opacity-0")}>
            {group.sessions.map((session, si) => {
              const cfg = DOC_CONFIG[session.document_type] || fallback
              const Icon = cfg.icon
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onOpen(session)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-secondary/30 transition-colors text-left group border-b border-border/30 last:border-0"
                >
                  <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{session.context?.toName || session.client_name || "Untitled"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cfg.label} · {session.created_at ? format(new Date(session.created_at), "MMM dd, h:mm a") : ""}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function SingleCard({ session, clientName, onOpen }: { session: Session; clientName: string | null; onOpen: (s: Session) => void }) {
  const cfg = DOC_CONFIG[session.document_type] || fallback
  const Icon = cfg.icon
  const title = clientName || session.context?.toName || "Untitled"
  const date = session.updated_at || session.created_at

  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className="flex items-center gap-3.5 w-full px-4 py-3.5 rounded-2xl border border-border bg-card text-left group active:scale-[0.99] transition-all duration-150 hover:bg-secondary/20"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.07)" }}
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
  )
}
