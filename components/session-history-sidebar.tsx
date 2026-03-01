"use client"

import { useState, useEffect, useCallback } from "react"
import { History, Clock, FileText, Trash2, Loader2, ScrollText, ClipboardList, Lightbulb } from "lucide-react"
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
    message_count?: number
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
    invoice: "text-blue-500",
    contract: "text-amber-500",
    quotation: "text-emerald-500",
    proposal: "text-purple-500",
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

    const loadSessions = useCallback(async () => {
        if (!user) return
        setIsLoading(true)
        try {
            let query = supabase
                .from("document_sessions")
                .select("id, document_type, title, status, created_at, updated_at, last_message_at")
                .eq("user_id", user.id)
                .order("last_message_at", { ascending: false })
                .limit(50)

            if (filter !== "all") {
                query = query.eq("document_type", filter)
            }

            const { data, error } = await query
            if (error) throw error

            // Batch get message counts
            const sessionsWithCounts = await Promise.all(
                (data || []).map(async (s) => {
                    const { count } = await supabase
                        .from("chat_messages")
                        .select("*", { count: "exact", head: true })
                        .eq("session_id", s.id)
                    return { ...s, message_count: count || 0 } as Session
                })
            )

            setSessions(sessionsWithCounts.filter(s => (s.message_count ?? 0) > 0))
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
            // Delete messages first (cascade might not be set up)
            await supabase.from("chat_messages").delete().eq("session_id", sessionId)
            await supabase.from("document_sessions").delete().eq("id", sessionId)
            setSessions(prev => prev.filter(s => s.id !== sessionId))
        } catch (error) {
            console.error("Error deleting session:", error)
        }
    }

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

    return (
        <div className="w-[280px] border-r border-border bg-card shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] flex flex-col h-full">
            {/* Header */}
            <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2.5 mb-3">
                    <History className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-base">History</h3>
                    <span className="text-xs text-muted-foreground ml-auto bg-secondary px-2 py-0.5 rounded-full font-medium">
                        {sessions.length}
                    </span>
                </div>
                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                    {["all", "invoice", "contract", "quotation", "proposal"].map(f => (
                        <button
                            key={f}
                            type="button"
                            onClick={() => setFilter(f)}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 active:scale-95",
                                filter === f
                                    ? "bg-primary text-primary-foreground"
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
                    <div className="p-2.5 space-y-1">
                        {sessions.map((session) => {
                            const Icon = DOC_ICONS[session.document_type] || FileText
                            const colorClass = DOC_COLORS[session.document_type] || "text-muted-foreground"
                            const isCurrent = currentSessionId === session.id

                            return (
                                <div
                                    key={session.id}
                                    onClick={() => onSessionSelect(session.id)}
                                    className={cn(
                                        "w-full text-left p-3.5 rounded-lg transition-all duration-150 group cursor-pointer",
                                        "hover:bg-secondary/50 active:scale-[0.98]",
                                        isCurrent
                                            ? "bg-secondary/70 border border-primary/15 shadow-sm"
                                            : "border border-transparent"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", isCurrent ? "text-primary" : colorClass)} />
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "text-sm font-medium line-clamp-2",
                                                isCurrent && "text-primary"
                                            )}>
                                                {getSessionTitle(session)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                                                <span className="text-xs text-muted-foreground">
                                                    {getTimeLabel(session)}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    · {session.message_count ?? 0} msg{(session.message_count ?? 0) !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(session.id, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 transition-all duration-150"
                                            aria-label="Delete session"
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-3.5 border-t border-border">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadSessions}
                    className="w-full text-sm btn-press"
                >
                    Refresh
                </Button>
            </div>
        </div>
    )
}
