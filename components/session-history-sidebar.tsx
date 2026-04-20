"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { History, Clock, FileText, Trash2, Loader2, ScrollText, ClipboardList, Lightbulb, Link2, ArrowRight, Pencil, Check, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useSupabase, useUser } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface Session {
    id: string
    document_type: string
    title: string | null
    status: string
    created_at: string
    updated_at: string
    last_message_at: string
    chain_id?: string | null
    client_name?: string | null
}

interface SessionHistorySidebarProps {
    currentSessionId?: string
    onSessionSelect: (sessionId: string) => void
    documentType: string
}

const DOC_ICONS: Record<string, React.ElementType> = {
    invoice: FileText,
    contract: ScrollText,
    quotation: ClipboardList,
    proposal: Lightbulb,
}

const DOC_COLORS: Record<string, string> = {
    invoice: "text-blue-600",
    contract: "text-amber-600",
    quotation: "text-emerald-600",
    proposal: "text-purple-600",
}

const DOC_BG: Record<string, string> = {
    invoice: "bg-blue-50 dark:bg-blue-950/30",
    contract: "bg-amber-50 dark:bg-amber-950/30",
    quotation: "bg-emerald-50 dark:bg-emerald-950/30",
    proposal: "bg-purple-50 dark:bg-purple-950/30",
}

export function SessionHistorySidebar({
    currentSessionId,
    onSessionSelect,
    documentType,
}: SessionHistorySidebarProps) {
    const supabase = useSupabase()
    const user = useUser()
    const [sessions, setSessions] = useState<Session[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | string>(documentType)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const editInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setFilter(documentType)
    }, [documentType])

    const loadSessions = useCallback(async () => {
        if (!user) return
        setIsLoading(true)
        try {
            let query = supabase
                .from("document_sessions")
                .select("id, document_type, title, status, created_at, updated_at, last_message_at, chain_id, client_name")
                .eq("user_id", user.id)
                .order("last_message_at", { ascending: false })
                .limit(50)

            if (filter !== "all") {
                query = query.eq("document_type", filter)
            }

            const { data, error } = await query
            if (error) throw error
            setSessions((data || []) as Session[])
        } catch (error) {
            console.error("Error loading sessions:", error)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase, filter])

    useEffect(() => {
        loadSessions()
    }, [loadSessions])

    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Delete this conversation? This cannot be undone.")) return
        try {
            await supabase.from("chat_messages").delete().eq("session_id", sessionId)
            await supabase.from("document_sessions").delete().eq("id", sessionId)
            setSessions(prev => prev.filter(s => s.id !== sessionId))
        } catch (error) {
            console.error("Error deleting session:", error)
        }
    }

    const startRename = (session: Session, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditingId(session.id)
        setEditingTitle(session.title || getSessionTitle(session))
        setTimeout(() => editInputRef.current?.select(), 50)
    }

    const commitRename = async (sessionId: string) => {
        const newTitle = editingTitle.trim()
        if (!newTitle) { setEditingId(null); return }
        try {
            await supabase.from("document_sessions").update({ title: newTitle }).eq("id", sessionId)
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: newTitle } : s))
        } catch (error) {
            console.error("Error renaming session:", error)
        }
        setEditingId(null)
    }

    const cancelRename = () => setEditingId(null)

    const getSessionTitle = (session: Session) => {
        if (session.title) return session.title
        const type = session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
        return `${type} conversation`
    }

    const getTimeLabel = (session: Session) => {
        try {
            return formatDistanceToNow(new Date(session.last_message_at || session.updated_at), { addSuffix: true })
        } catch {
            return "recently"
        }
    }

    const renderSessionItem = (session: Session, isChained: boolean, chainIndex: number, chainTotal: number) => {
        const Icon = DOC_ICONS[session.document_type] || FileText
        const colorClass = DOC_COLORS[session.document_type] || "text-muted-foreground"
        const bgClass = DOC_BG[session.document_type] || "bg-secondary/30"
        const isCurrent = currentSessionId === session.id
        const docLabel = session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
        const isEditing = editingId === session.id

        return (
            <div
                key={session.id}
                onClick={() => !isEditing && onSessionSelect(session.id)}
                className={cn(
                    "w-full text-left px-3.5 py-3.5 rounded-xl transition-all duration-150 group cursor-pointer relative",
                    isCurrent
                        ? "bg-primary/8 ring-1 ring-primary/25 shadow-md shadow-primary/5"
                        : "hover:bg-secondary/60 hover:shadow-sm active:scale-[0.98] shadow-none"
                )}
            >
                <div className="flex items-start gap-3">
                    <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 shadow-sm",
                        isCurrent ? "bg-primary/15 shadow-primary/10" : bgClass
                    )}>
                        <Icon className={cn("w-[18px] h-[18px]", isCurrent ? "text-primary" : colorClass)} />
                    </div>
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                <input
                                    ref={editInputRef}
                                    value={editingTitle}
                                    onChange={e => setEditingTitle(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") commitRename(session.id)
                                        if (e.key === "Escape") cancelRename()
                                    }}
                                    autoFocus
                                    className="flex-1 text-sm font-semibold bg-background border border-primary/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-primary/20 min-w-0"
                                />
                                <button onClick={() => commitRename(session.id)} className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors">
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={cancelRename} className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground transition-colors">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ) : (
                            <p className={cn(
                                "text-sm leading-snug line-clamp-2",
                                isCurrent ? "font-bold text-primary" : "font-semibold text-foreground"
                            )}>
                                {getSessionTitle(session)}
                            </p>
                        )}
                        {!isEditing && (
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={cn(
                                    "text-[11px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
                                    isCurrent ? "bg-primary/10 text-primary" : `${bgClass} ${colorClass}`
                                )}>
                                    {docLabel}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {getTimeLabel(session)}
                                </span>
                            </div>
                        )}
                    </div>
                    {!isEditing && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0">
                            <button
                                onClick={(e) => startRename(session, e)}
                                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                                aria-label="Rename"
                            >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                            <button
                                onClick={(e) => deleteSession(session.id, e)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                                aria-label="Delete session"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-destructive/60 hover:text-destructive" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="w-[320px] border-r border-border bg-card shadow-[2px_0_16px_-4px_rgba(0,0,0,0.08)] flex flex-col h-full">
            {/* Header */}
            <div className="p-4 pb-3.5 border-b border-border/60 bg-card/95 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shadow-sm">
                        <History className="w-4 h-4 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg">History</h3>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                    {["all", "invoice", "contract", "quotation", "proposal"].map(f => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150 active:scale-95",
                                filter === f
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                            )}
                        >
                            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sessions List */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="p-6 text-center">
                        <FileText className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">No conversations yet</p>
                    </div>
                ) : (
                    <div className="p-2.5 space-y-1.5">
                        {(() => {
                            const chainGroups = new Map<string, Session[]>()
                            const standalone: Session[] = []

                            for (const s of sessions) {
                                if (s.chain_id) {
                                    const group = chainGroups.get(s.chain_id) || []
                                    group.push(s)
                                    chainGroups.set(s.chain_id, group)
                                } else {
                                    standalone.push(s)
                                }
                            }

                            const sortedChains = Array.from(chainGroups.entries()).sort((a, b) => {
                                const aLatest = a[1][0]?.last_message_at || a[1][0]?.created_at || ""
                                const bLatest = b[1][0]?.last_message_at || b[1][0]?.created_at || ""
                                return bLatest.localeCompare(aLatest)
                            })

                            const allItems: Array<
                                | { type: "chain"; chainId: string; sessions: Session[]; clientName: string | null }
                                | { type: "single"; session: Session }
                            > = []

                            for (const [chainId, chainSessions] of sortedChains) {
                                const clientName = chainSessions.find(s => s.client_name)?.client_name || null
                                allItems.push({ type: "chain", chainId, sessions: chainSessions, clientName })
                            }
                            for (const s of standalone) {
                                allItems.push({ type: "single", session: s })
                            }

                            return allItems.map(item => {
                                if (item.type === "chain") {
                                    return (
                                        <div key={item.chainId} className="mb-3">
                                            {/* Chain header */}
                                            <div className="flex items-center gap-2.5 px-3.5 py-2.5 mb-1">
                                                <Link2 className="w-[18px] h-[18px] text-primary/60" />
                                                <span className="text-sm font-bold text-foreground truncate">
                                                    {item.clientName || "Linked Documents"}
                                                </span>
                                            </div>
                                            {/* Chain items with visual connector */}
                                            <div className="relative ml-5">
                                                {/* Vertical connector line */}
                                                <div className="absolute left-[15px] top-3 bottom-3 w-0.5 bg-primary/15 rounded-full" />
                                                <div className="space-y-1 relative">
                                                    {item.sessions.map((session, idx) => (
                                                        <div key={session.id} className="relative">
                                                            {/* Horizontal connector dot */}
                                                            <div className={cn(
                                                                "absolute left-[11px] top-5 w-2.5 h-2.5 rounded-full border-2 z-10",
                                                                currentSessionId === session.id
                                                                    ? "bg-primary border-primary"
                                                                    : "bg-card border-primary/30"
                                                            )} />
                                                            {/* Arrow between items */}
                                                            {idx < item.sessions.length - 1 && (
                                                                <div className="absolute left-[9px] top-[30px] z-10">
                                                                    <ArrowRight className="w-3 h-3 text-primary/30 rotate-90" />
                                                                </div>
                                                            )}
                                                            <div className="pl-7">
                                                                {renderSessionItem(session, true, idx, item.sessions.length)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return renderSessionItem(item.session, false, 0, 0)
                            })
                        })()}
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSessions}
                    className="w-full text-sm rounded-xl"
                >
                    Refresh
                </Button>
            </div>
        </div>
    )
}
