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
        active: "bg-blue-500 text-white border-blue-500",
        inactive: "bg-card text-foreground border-border hover:bg-secondary hover:border-border",
    },
    contract: {
        active: "bg-amber-500 text-white border-amber-500",
        inactive: "bg-card text-foreground border-border hover:bg-secondary hover:border-border",
    },
    quotation: {
        active: "bg-emerald-500 text-white border-emerald-500",
        inactive: "bg-card text-foreground border-border hover:bg-secondary hover:border-border",
    },
    proposal: {
        active: "bg-purple-500 text-white border-purple-500",
        inactive: "bg-card text-foreground border-border hover:bg-secondary hover:border-border",
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
        <div className="animate-in fade-in slide-in-from-top-2 duration-300 px-4 py-2.5 border-b border-border bg-card shrink-0"
            style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.04), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                <Link2 className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                {clientName && (
                    <span className="text-[12px] font-semibold text-foreground/70 shrink-0 mr-0.5">
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
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            <button
                                type="button"
                                onClick={() => { if (!isCurrent) onSessionSelect(session.id) }}
                                disabled={isCurrent}
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all duration-200",
                                    isCurrent
                                        ? cn(colors.active, "cursor-default shadow-md")
                                        : cn(colors.inactive, "active:scale-95 cursor-pointer shadow-sm")
                                )}
                                style={isCurrent ? { boxShadow: "0 2px 8px rgba(0,0,0,0.18)" } : { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {label}
                                {isCompleted && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                )}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
