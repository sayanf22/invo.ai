"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { FileText, ScrollText, ClipboardList, Lightbulb, ChevronRight, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/auth-provider"
import { authFetch } from "@/lib/auth-fetch"

interface ChainSession {
    id: string
    document_type: string
    title: string | null
    client_name: string | null
    status: string
    created_at: string
}

interface ChainNavigatorProps {
    currentSessionId?: string
    onSessionSelect: (sessionId: string) => void
}

const DOC_ICONS: Record<string, React.ElementType> = {
    invoice: FileText,
    contract: ScrollText,
    quotation: ClipboardList,
    proposal: Lightbulb,
}

const DOC_PILL_COLORS: Record<string, { active: string; inactive: string }> = {
    invoice: {
        active: "bg-blue-100 text-blue-700 border-blue-300 shadow-sm",
        inactive: "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70",
    },
    contract: {
        active: "bg-amber-100 text-amber-700 border-amber-300 shadow-sm",
        inactive: "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70",
    },
    quotation: {
        active: "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm",
        inactive: "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70",
    },
    proposal: {
        active: "bg-purple-100 text-purple-700 border-purple-300 shadow-sm",
        inactive: "bg-secondary/40 text-muted-foreground border-transparent hover:bg-secondary/70",
    },
}

export function ChainNavigator({ currentSessionId, onSessionSelect }: ChainNavigatorProps) {
    const user = useUser()
    const [chain, setChain] = useState<ChainSession[]>([])
    const [clientName, setClientName] = useState<string | null>(null)
    // Keep track of the chain_id so we don't clear the navigator when switching between sessions in the same chain
    const knownChainIdRef = useRef<string | null>(null)
    const lastFetchedSessionRef = useRef<string | null>(null)

    const loadChain = useCallback(async () => {
        if (!currentSessionId || !user) return

        // Don't re-fetch if we already fetched for this session
        if (lastFetchedSessionRef.current === currentSessionId) return
        lastFetchedSessionRef.current = currentSessionId

        try {
            const res = await authFetch(`/api/sessions/linked?sessionId=${currentSessionId}`)
            if (!res.ok) return
            const data = await res.json()

            if (data.success && data.chain && data.chain.length > 1) {
                knownChainIdRef.current = data.chainId || null
                setChain(data.chain)
                const name = data.chain.find((s: ChainSession) => s.client_name)?.client_name
                setClientName(name || null)
            } else if (data.success && data.chainId && data.chainId === knownChainIdRef.current) {
                // Same chain but API returned fewer results — keep existing chain
                // This handles race conditions during session switching
            } else {
                // Truly no chain for this session
                knownChainIdRef.current = null
                setChain([])
                setClientName(null)
            }
        } catch {
            // On error, keep existing chain visible rather than clearing it
        }
    }, [currentSessionId, user])

    useEffect(() => {
        loadChain()
    }, [loadChain])

    // When currentSessionId changes but we already have a chain that includes this session,
    // don't wait for the API — just update the active state immediately
    useEffect(() => {
        if (!currentSessionId || chain.length < 2) return
        const isInChain = chain.some(s => s.id === currentSessionId)
        if (isInChain) {
            // Session is already in our chain — no need to re-fetch, just re-render
            lastFetchedSessionRef.current = currentSessionId
        }
    }, [currentSessionId, chain])

    if (chain.length < 2) return null

    return (
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 px-4 py-3 border-b border-border/50 bg-card/50 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                <Link2 className="w-[18px] h-[18px] text-muted-foreground/60 shrink-0" />
                {clientName && (
                    <span className="text-[13px] font-medium text-muted-foreground shrink-0 mr-1">
                        {clientName}
                    </span>
                )}
                {chain.map((session, idx) => {
                    const Icon = DOC_ICONS[session.document_type] || FileText
                    const isCurrent = session.id === currentSessionId
                    const colors = DOC_PILL_COLORS[session.document_type] || DOC_PILL_COLORS.invoice
                    const label = session.document_type.charAt(0).toUpperCase() + session.document_type.slice(1)
                    const isCompleted = session.status === "completed"

                    return (
                        <div key={session.id} className="flex items-center gap-1.5 shrink-0">
                            {idx > 0 && (
                                <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!isCurrent) onSessionSelect(session.id)
                                }}
                                disabled={isCurrent}
                                className={cn(
                                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-all duration-200",
                                    isCurrent
                                        ? cn(colors.active, "cursor-default")
                                        : cn(colors.inactive, "active:scale-95 cursor-pointer")
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {label}
                                {isCompleted && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
