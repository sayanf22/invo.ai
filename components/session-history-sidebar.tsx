"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    FileText, Trash2, Loader2, Link2, ChevronRight, ChevronDown, Pencil, Check, X, RefreshCw, MessageSquare,
    FileCheck, FileQuestion, Presentation, ClipboardList, GitMerge, Shield, ClipboardCheck, Bell, Calculator,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSupabase, useUser } from "@/components/auth-provider"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { getDocumentTypeConfig, normalizeDocumentType, ALL_DOCUMENT_TYPES } from "@/lib/document-type-registry"

// ─── Icon map: Lucide string name → component ─────────────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
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
    Calculator,
}

/** Resolve a registry icon name to the Lucide component; fallback to FileText. */
function resolveIcon(iconName: string): React.ComponentType<{ className?: string; strokeWidth?: number }> {
    return ICON_MAP[iconName] ?? FileText
}

/** Get icon + color info for a document type string (handles legacy "quotation"). */
function getTypeVisuals(docType: string): { Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; text: string; bg: string } {
    // Special case for "chat" sessions which aren't in the registry
    if (docType === "chat") {
        return { Icon: MessageSquare, text: "text-muted-foreground", bg: "bg-muted" }
    }
    const config = getDocumentTypeConfig(docType)
    if (!config) {
        return { Icon: FileText, text: "text-gray-500", bg: "bg-gray-100" }
    }
    return { Icon: resolveIcon(config.icon), text: config.color, bg: config.bgColor }
}

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
    /** First user message content — populated for chat sessions only. */
    firstMessage?: string | null
}

interface SessionHistorySidebarProps {
    currentSessionId?: string
    onSessionSelect: (sessionId: string) => void
    documentType: string
}

// ─── Filter configuration ──────────────────────────────────────────────────────

/** Primary visible filter pills (top doc types + All + Chat) */
const PRIMARY_FILTER_TYPES = ["invoice", "contract", "quote", "estimate", "proposal", "sow", "nda"] as const

/** "More" overflow types */
const MORE_FILTER_TYPES = ["change_order", "client_onboarding_form", "payment_followup"] as const

type FilterValue = "all" | "chat" | (typeof ALL_DOCUMENT_TYPES)[number]

function getFilterLabel(value: FilterValue): string {
    if (value === "all") return "All"
    if (value === "chat") return "Chat"
    const config = getDocumentTypeConfig(value)
    return config?.label ?? value
}

/** Derive the initial filter from the documentType prop */
function deriveInitialFilter(documentType: string): FilterValue {
    if (!documentType || documentType === "all") return "all"
    if (documentType === "chat") return "chat"
    const normalized = normalizeDocumentType(documentType)
    return normalized ?? "all"
}

export function SessionHistorySidebar({ currentSessionId, onSessionSelect, documentType }: SessionHistorySidebarProps) {
    const supabase = useSupabase()
    const user = useUser()
    const [sessions, setSessions] = useState<Session[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<FilterValue>(() => deriveInitialFilter(documentType))
    const [moreOpen, setMoreOpen] = useState(false)
    const moreRef = useRef<HTMLDivElement>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingTitle, setEditingTitle] = useState("")
    const editInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        setFilter(deriveInitialFilter(documentType))
    }, [documentType])

    // Close "More" dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setMoreOpen(false)
            }
        }
        if (moreOpen) document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [moreOpen])

    const loadSessions = useCallback(async () => {
        if (!user) return
        setIsLoading(true)
        try {
            const query = supabase
                .from("document_sessions")
                .select("id, document_type, title, status, created_at, updated_at, last_message_at, chain_id, client_name")
                .eq("user_id", user.id)
                .order("last_message_at", { ascending: false })
                .limit(50)

            const { data, error } = await query
            if (error) throw error
            const loaded = (data || []) as Session[]

            // For chat sessions without a title, fetch the first user message
            // to use as a meaningful title fallback (truncated to 40 chars).
            const chatSessionIds = loaded
                .filter(s => s.document_type === "chat" && !s.title)
                .map(s => s.id)

            if (chatSessionIds.length > 0) {
                const { data: firstMsgs } = await supabase
                    .from("chat_messages")
                    .select("session_id, content")
                    .in("session_id", chatSessionIds)
                    .eq("role", "user")
                    .order("created_at", { ascending: true })

                if (firstMsgs && firstMsgs.length > 0) {
                    // Keep only the first message per session
                    const firstBySession = new Map<string, string>()
                    for (const msg of firstMsgs as { session_id: string; content: string }[]) {
                        if (!firstBySession.has(msg.session_id)) {
                            firstBySession.set(msg.session_id, msg.content)
                        }
                    }
                    setSessions(loaded.map(s =>
                        firstBySession.has(s.id)
                            ? { ...s, firstMessage: firstBySession.get(s.id) }
                            : s
                    ))
                    return
                }
            }

            setSessions(loaded)
        } catch (error) {
            console.error("Error loading sessions:", error)
        } finally {
            setIsLoading(false)
        }
    }, [user, supabase])

    useEffect(() => { loadSessions() }, [loadSessions])

    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm("Delete this conversation?")) return
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

    const getSessionTitle = (session: Session) => {
        if (session.document_type === "chat") {
            if (session.title) return session.title
            if (session.firstMessage) {
                const trimmed = session.firstMessage.trim()
                return trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed
            }
            return "Chat conversation"
        }
        if (session.title) return session.title
        const config = getDocumentTypeConfig(session.document_type)
        const label = config?.label ?? (session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1))
        return `${label} conversation`
    }

    const getTimeLabel = (session: Session) => {
        try {
            return formatDistanceToNow(new Date(session.last_message_at || session.updated_at), { addSuffix: true })
        } catch { return "recently" }
    }

    /** Match a session against the active filter, using normalizeDocumentType for "quote"/"quotation" unification. */
    const sessionMatchesFilter = (s: Session): boolean => {
        if (filter === "all") return true
        if (filter === "chat") return s.document_type === "chat"
        // Normalize both sides so "quotation" matches the "quote" filter
        const sessionNormalized = normalizeDocumentType(s.document_type)
        return sessionNormalized === filter && s.document_type !== "chat"
    }

    const filteredSessions = sessions.filter(sessionMatchesFilter)

    const chainGroups = new Map<string, Session[]>()
    const standalone: Session[] = []
    for (const s of filteredSessions) {
        if (s.chain_id) {
            const g = chainGroups.get(s.chain_id) || []
            g.push(s)
            chainGroups.set(s.chain_id, g)
        } else {
            standalone.push(s)
        }
    }

    /** Whether the active filter is one of the "More" overflow types */
    const activeFilterIsInMore = (MORE_FILTER_TYPES as readonly string[]).includes(filter as string)

    return (
        <div className="w-[300px] flex flex-col h-full bg-background border-r border-border"
            style={{ boxShadow: "2px 0 16px -4px rgba(0,0,0,0.08)" }}
        >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-foreground">History</h3>
                    <button
                        onClick={loadSessions}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </button>
                </div>

                {/* Filter pills: All + Chat + top 6 doc types + "More" dropdown */}
                <div className="flex gap-1.5 flex-wrap">
                    {/* "All" pill */}
                    <FilterPill value="all" active={filter === "all"} label="All" onClick={() => setFilter("all")} />

                    {/* Primary doc type pills */}
                    {PRIMARY_FILTER_TYPES.map(type => (
                        <FilterPill
                            key={type}
                            value={type}
                            active={filter === type}
                            label={getDocumentTypeConfig(type)?.label ?? type}
                            onClick={() => setFilter(type)}
                        />
                    ))}

                    {/* Chat pill */}
                    <FilterPill value="chat" active={filter === "chat"} label="Chat" onClick={() => setFilter("chat")} />

                    {/* "More" dropdown for remaining 4 types */}
                    <div ref={moreRef} className="relative">
                        <button
                            onClick={() => setMoreOpen(prev => !prev)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border shrink-0 flex items-center gap-1",
                                activeFilterIsInMore
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card text-foreground border-border hover:bg-secondary"
                            )}
                            style={activeFilterIsInMore
                                ? { boxShadow: "0 1px 4px hsl(var(--primary)/0.3)" }
                                : { boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
                            }
                        >
                            {activeFilterIsInMore ? getFilterLabel(filter) : "More"}
                            <ChevronDown className={cn("w-3 h-3 transition-transform", moreOpen && "rotate-180")} />
                        </button>

                        {moreOpen && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
                                {MORE_FILTER_TYPES.map(type => {
                                    const config = getDocumentTypeConfig(type)
                                    const label = config?.label ?? type
                                    return (
                                        <button
                                            key={type}
                                            onClick={() => { setFilter(type); setMoreOpen(false) }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary",
                                                filter === type ? "text-primary bg-primary/5" : "text-foreground"
                                            )}
                                        >
                                            {label}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* List */}
            <ScrollArea className="flex-1">
                {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="p-6 text-center">
                        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1.5} />
                        <p className="text-sm text-muted-foreground">No conversations yet</p>
                    </div>
                ) : (
                    <div className="p-3 space-y-2">
                        {/* Chain groups */}
                        {Array.from(chainGroups.entries()).map(([chainId, chainSessions]) => (
                            <ChainGroup
                                key={chainId}
                                sessions={chainSessions}
                                currentSessionId={currentSessionId}
                                onSelect={onSessionSelect}
                                onDelete={deleteSession}
                                onRename={startRename}
                                editingId={editingId}
                                editingTitle={editingTitle}
                                setEditingTitle={setEditingTitle}
                                editInputRef={editInputRef}
                                commitRename={commitRename}
                                cancelRename={() => setEditingId(null)}
                                getSessionTitle={getSessionTitle}
                                getTimeLabel={getTimeLabel}
                            />
                        ))}
                        {/* Standalone */}
                        {standalone.map(session => (
                            <SessionCard
                                key={session.id}
                                session={session}
                                isCurrent={currentSessionId === session.id}
                                onSelect={() => onSessionSelect(session.id)}
                                onDelete={deleteSession}
                                onRename={startRename}
                                editingId={editingId}
                                editingTitle={editingTitle}
                                setEditingTitle={setEditingTitle}
                                editInputRef={editInputRef}
                                commitRename={commitRename}
                                cancelRename={() => setEditingId(null)}
                                getSessionTitle={getSessionTitle}
                                getTimeLabel={getTimeLabel}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}

// ─── FilterPill ────────────────────────────────────────────────────────────────

interface FilterPillProps {
    value: FilterValue
    active: boolean
    label: string
    onClick: () => void
}

function FilterPill({ active, label, onClick }: FilterPillProps) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border shrink-0",
                active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-secondary"
            )}
            style={active
                ? { boxShadow: "0 1px 4px hsl(var(--primary)/0.3)" }
                : { boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }
            }
        >
            {label}
        </button>
    )
}

// ─── SessionCard ───────────────────────────────────────────────────────────────

interface SessionCardProps {
    session: Session
    isCurrent: boolean
    onSelect: () => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onRename: (session: Session, e: React.MouseEvent) => void
    editingId: string | null
    editingTitle: string
    setEditingTitle: (v: string) => void
    editInputRef: React.RefObject<HTMLInputElement | null>
    commitRename: (id: string) => void
    cancelRename: () => void
    getSessionTitle: (s: Session) => string
    getTimeLabel: (s: Session) => string
}

function SessionCard({ session, isCurrent, onSelect, onDelete, onRename, editingId, editingTitle, setEditingTitle, editInputRef, commitRename, cancelRename, getSessionTitle, getTimeLabel }: SessionCardProps) {
    const { Icon, text, bg } = getTypeVisuals(session.document_type)
    const isEditing = editingId === session.id
    const config = getDocumentTypeConfig(session.document_type)
    const typeLabel = session.document_type === "chat"
        ? "Chat"
        : (config?.label ?? session.document_type)

    return (
        <div
            onClick={() => !isEditing && onSelect()}
            className={cn(
                "group rounded-2xl border transition-all duration-150 cursor-pointer",
                isCurrent
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-card hover:bg-secondary/30"
            )}
            style={{ boxShadow: isCurrent ? "0 1px 4px hsl(var(--primary)/0.12)" : "0 1px 3px rgba(0,0,0,0.05)" }}
        >
            <div className="flex items-start gap-3 px-3.5 py-3">
                {/* Icon */}
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", bg)}
                    style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                >
                    <Icon className={cn("w-4 h-4", text)} strokeWidth={1.5} />
                </div>

                {/* Content */}
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
                            <button onClick={() => commitRename(session.id)} className="p-1 rounded-md hover:bg-primary/10 text-primary">
                                <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={cancelRename} className="p-1 rounded-md hover:bg-secondary text-muted-foreground">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <p className={cn("text-sm font-semibold leading-snug line-clamp-1", isCurrent ? "text-primary" : "text-foreground")}>
                            {getSessionTitle(session)}
                        </p>
                    )}
                    {!isEditing && (
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md", bg, text)}>
                                {typeLabel}
                            </span>
                            <span className="text-[11px] text-muted-foreground">{getTimeLabel(session)}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {!isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={(e) => onRename(session, e)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
                            <Pencil className="w-3 h-3 text-muted-foreground" strokeWidth={1.5} />
                        </button>
                        <button onClick={(e) => onDelete(session.id, e)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                            <Trash2 className="w-3 h-3 text-destructive/60" strokeWidth={1.5} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── ChainGroup ────────────────────────────────────────────────────────────────

interface ChainGroupProps {
    sessions: Session[]
    currentSessionId?: string
    onSelect: (id: string) => void
    onDelete: (id: string, e: React.MouseEvent) => void
    onRename: (session: Session, e: React.MouseEvent) => void
    editingId: string | null
    editingTitle: string
    setEditingTitle: (v: string) => void
    editInputRef: React.RefObject<HTMLInputElement | null>
    commitRename: (id: string) => void
    cancelRename: () => void
    getSessionTitle: (s: Session) => string
    getTimeLabel: (s: Session) => string
}

function ChainGroup({ sessions, currentSessionId, onSelect, onDelete, onRename, editingId, editingTitle, setEditingTitle, editInputRef, commitRename, cancelRename, getSessionTitle, getTimeLabel }: ChainGroupProps) {
    const [expanded, setExpanded] = useState(true)
    const clientName = sessions.find(s => s.client_name)?.client_name || null
    const hasActive = sessions.some(s => s.id === currentSessionId)

    return (
        <div
            className={cn("rounded-2xl border overflow-hidden", hasActive ? "border-primary/30" : "border-border")}
            style={{ boxShadow: hasActive ? "0 1px 4px hsl(var(--primary)/0.1)" : "0 1px 3px rgba(0,0,0,0.05)" }}
        >
            {/* Chain header */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2.5 w-full px-3.5 py-3 bg-card hover:bg-secondary/30 transition-colors text-left"
            >
                <div className="w-7 h-7 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                    <Link2 className="w-3.5 h-3.5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{clientName || "Linked Documents"}</p>
                    <p className="text-[11px] text-muted-foreground">{sessions.length} documents</p>
                </div>
                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground/50 transition-transform duration-200 shrink-0", expanded && "rotate-180")} />
            </button>

            {/* Items */}
            <div
                className="grid transition-[grid-template-rows] duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
                <div className="overflow-hidden">
                    <div className={cn("border-t border-border/50 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>
                        {sessions.map(session => {
                            const { Icon, text, bg } = getTypeVisuals(session.document_type)
                            return (
                                <button
                                    key={session.id}
                                    type="button"
                                    onClick={() => onSelect(session.id)}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-3.5 py-2.5 text-left transition-colors border-b border-border/30 last:border-0 group",
                                        session.id === currentSessionId ? "bg-primary/5" : "bg-card hover:bg-secondary/30"
                                    )}
                                >
                                    <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center shrink-0", bg)}>
                                        <Icon className={cn("w-3.5 h-3.5", text)} strokeWidth={1.5} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-xs font-semibold truncate", session.id === currentSessionId ? "text-primary" : "text-foreground")}>
                                            {getSessionTitle(session)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">{getTimeLabel(session)}</p>
                                    </div>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
