"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSupabase, useUser } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { History, FileText, Calendar, Link2, ChevronRight, ArrowRight, ScrollText, ClipboardList, Lightbulb } from "lucide-react"
import { toast } from "sonner"
import { format, formatDistanceToNow } from "date-fns"
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

const DOC_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  invoice:   { label: "Invoice",   icon: FileText,      bg: "bg-blue-50 dark:bg-blue-950/40",     text: "text-blue-600 dark:text-blue-400",     dot: "bg-blue-500" },
  contract:  { label: "Contract",  icon: ScrollText,    bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  quotation: { label: "Quotation", icon: ClipboardList, bg: "bg-amber-50 dark:bg-amber-950/40",   text: "text-amber-600 dark:text-amber-400",   dot: "bg-amber-500" },
  proposal:  { label: "Proposal",  icon: Lightbulb,     bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
}

const fallbackDoc = { label: "Document", icon: FileText, bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" }

export default function HistoryPage() {
  const router = useRouter()
  const supabase = useSupabase()
  const user = useUser()
  const [groups, setGroups] = useState<SessionGroup[]>([])
  const [loading, setLoading] = useState(true)

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
      console.error("Error loading sessions:", error?.message || error)
      toast.error("Failed to load history")
    } finally { setLoading(false) }
  }

  const openSession = (session: Session) => router.push(`/?sessionId=${session.id}`)

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded-xl w-48" />
            <div className="h-4 bg-muted rounded w-64" />
            <div className="h-20 bg-muted rounded-2xl mt-6" />
            <div className="h-20 bg-muted rounded-2xl" />
            <div className="h-20 bg-muted rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-20">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-primary/10">
              <History className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Document History</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            {groups.length > 0
              ? `${groups.length} document${groups.length === 1 ? "" : " groups"} — grouped by client`
              : "Your documents will appear here"}
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-muted/60 flex items-center justify-center mb-5">
              <History className="w-9 h-9 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold mb-1.5">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">Create your first document and it will show up here</p>
            <Button onClick={() => router.push("/")} className="rounded-xl gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, gi) => (
              <div key={group.chainId || `s-${gi}`}>
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
  const [expanded, setExpanded] = useState(true)
  const docTypes = [...new Set(group.sessions.map(s => s.document_type))]

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)]">
      {/* Chain header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="p-1.5 rounded-xl bg-primary/8">
          <Link2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold tracking-tight truncate">
            {group.clientName || "Linked Documents"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(group.latestDate), { addSuffix: true })}
            </span>
            <span className="text-muted-foreground/30">·</span>
            <div className="flex items-center gap-1">
              {docTypes.map(t => {
                const cfg = DOC_CONFIG[t] || fallbackDoc
                return <span key={t} className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              })}
            </div>
            <span className="text-xs text-muted-foreground">{group.sessions.length} docs</span>
          </div>
        </div>
        <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", expanded && "rotate-90")} />
      </button>

      {/* Chain items */}
      {expanded && (
        <div className="border-t border-border/40 px-3 pb-2">
          {group.sessions.map((session, si) => {
            const cfg = DOC_CONFIG[session.document_type] || fallbackDoc
            const Icon = cfg.icon
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onOpen(session)}
                className="flex items-center gap-3 w-full pl-4 pr-3 py-3 rounded-xl hover:bg-secondary/40 transition-all duration-150 text-left group active:scale-[0.99]"
              >
                {/* Timeline */}
                <div className="flex flex-col items-center w-4 shrink-0 self-stretch">
                  {si > 0 && <div className="w-px flex-1 bg-border/60" />}
                  <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-background", cfg.dot)} />
                  {si < group.sessions.length - 1 && <div className="w-px flex-1 bg-border/60" />}
                </div>

                <div className={cn("p-1.5 rounded-lg shrink-0", cfg.bg)}>
                  <Icon className={cn("w-3.5 h-3.5", cfg.text)} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">
                    {session.context?.toName || session.client_name || "Untitled"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {cfg.label} · {session.created_at ? format(new Date(session.created_at), "MMM dd, h:mm a") : ""}
                  </p>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SingleCard({ session, clientName, onOpen }: { session: Session; clientName: string | null; onOpen: (s: Session) => void }) {
  const cfg = DOC_CONFIG[session.document_type] || fallbackDoc
  const Icon = cfg.icon
  const title = clientName || session.context?.toName || "Untitled"
  const date = session.updated_at || session.created_at

  return (
    <button
      type="button"
      onClick={() => onOpen(session)}
      className="flex items-center gap-4 w-full px-5 py-4 rounded-2xl border border-border/60 bg-card text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.04)] hover:-translate-y-px transition-all duration-200 group active:scale-[0.995]"
    >
      <div className={cn("p-2.5 rounded-xl shrink-0", cfg.bg)}>
        <Icon className={cn("w-5 h-5", cfg.text)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold tracking-tight truncate group-hover:text-foreground transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-[11px] font-medium capitalize", cfg.text)}>{cfg.label}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {date ? format(new Date(date), "MMM dd, yyyy") : "N/A"}
          </span>
        </div>
        {session.context?.fromName && (
          <p className="text-[11px] text-muted-foreground/70 mt-1 truncate">From: {session.context.fromName}</p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  )
}
