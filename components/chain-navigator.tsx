"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
    FileText,
    ScrollText,
    ClipboardList,
    Lightbulb,
    ChevronRight,
    Link2,
    FileQuestion,
    Presentation,
    GitMerge,
    Shield,
    ClipboardCheck,
    Bell,
    RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/components/auth-provider"
import { authFetch } from "@/lib/auth-fetch"
import { getDocumentTypeConfig, getDocumentTypeLabel, normalizeDocumentType } from "@/lib/document-type-registry"

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

/**
 * Map Lucide icon name strings (from the registry) to actual React components.
 * This avoids dynamic imports — all icons are statically bundled.
 */
const ICON_COMPONENTS: Record<string, React.ElementType> = {
    FileText,
    FileCheck: ScrollText,  // contract uses ScrollText visually
    FileQuestion,
    Presentation,
    ClipboardList,
    GitMerge,
    Shield,
    ClipboardCheck,
    Bell,
    RefreshCw,
}

/**
 * Resolve the Lucide icon component for a document type string.
 * Falls back to FileText for unknown types.
 */
function getDocIcon(documentType: string): React.ElementType {
    const config = getDocumentTypeConfig(documentType)
    if (config && ICON_COMPONENTS[config.icon]) {
        return ICON_COMPONENTS[config.icon]
    }
    return FileText
}

/**
 * Derive active/inactive pill color classes from the registry's Tailwind color.
 * Registry colors follow the pattern "text-{color}-600"; we map to matching pill styles.
 */
function getPillColors(documentType: string): { active: string; inactive: string } {
    const config = getDocumentTypeConfig(documentType)
    if (!config) {
        return {
            active: "bg-gray-500 text-white border-gray-500",
            inactive: "bg-card text-foreground border-border hover:bg-secondary hover:border-border",
        }
    }

    // Map registry text color class to active pill bg color
    const colorMap: Record<string, string> = {
        "text-blue-600": "bg-blue-500 text-white border-blue-500",
        "text-emerald-600": "bg-emerald-500 text-white border-emerald-500",
        "text-amber-600": "bg-amber-500 text-white border-amber-500",
        "text-violet-600": "bg-violet-500 text-white border-violet-500",
        "text-cyan-600": "bg-cyan-500 text-white border-cyan-500",
        "text-orange-600": "bg-orange-500 text-white border-orange-500",
        "text-slate-600": "bg-slate-500 text-white border-slate-500",
        "text-teal-600": "bg-teal-500 text-white border-teal-500",
        "text-rose-600": "bg-rose-500 text-white border-rose-500",
        "text-indigo-600": "bg-indigo-500 text-white border-indigo-500",
    }

    const active = colorMap[config.color] ?? "bg-gray-500 text-white border-gray-500"
    const inactive = "bg-card text-foreground border-border hover:bg-secondary hover:border-border"

    return { active, inactive }
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
            <div
                className="flex items-center gap-2 overflow-x-auto scrollbar-none hover:scrollbar-thin hover:scrollbar-thumb-muted-foreground/20 hover:scrollbar-track-transparent"
                style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x", scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}
                onMouseEnter={(e) => { (e.currentTarget.style as any).scrollbarColor = "rgba(0,0,0,0.15) transparent" }}
                onMouseLeave={(e) => { (e.currentTarget.style as any).scrollbarColor = "transparent transparent" }}
            >
                <Link2 className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                {clientName && (
                    <span className="text-[12px] font-semibold text-foreground/70 shrink-0 mr-0.5">
                        {clientName}
                    </span>
                )}
                {chain.map((session, idx) => {
                    const Icon = getDocIcon(session.document_type)
                    const isCurrent = session.id === currentSessionId
                    const colors = getPillColors(session.document_type)
                    // Use registry label, normalize "quotation" → "Quote"
                    const label = getDocumentTypeLabel(session.document_type)
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
                                title={getDocumentTypeConfig(session.document_type)?.description ?? label}
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
