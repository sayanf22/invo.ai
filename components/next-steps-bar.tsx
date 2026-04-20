"use client"

import { useState, useRef, useCallback } from "react"
import { FileText, ScrollText, ClipboardList, Lightbulb, Loader2, ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

const DOC_OPTIONS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    invoice:   { label: "Invoice",   icon: FileText,      color: "text-blue-500" },
    contract:  { label: "Contract",  icon: ScrollText,    color: "text-indigo-500" },
    quotation: { label: "Quotation", icon: ClipboardList, color: "text-emerald-500" },
    proposal:  { label: "Proposal",  icon: Lightbulb,     color: "text-amber-500" },
}

interface NextStepsBarProps {
    clientName: string | null
    currentDocType: string
    parentSessionId: string
    onCreateLinked: (parentSessionId: string, targetType: string) => Promise<void>
}

export function NextStepsBar({ clientName, currentDocType, parentSessionId, onCreateLinked }: NextStepsBarProps) {
    const [open, setOpen] = useState(false)
    const [loadingType, setLoadingType] = useState<string | null>(null)

    const currentType = currentDocType.toLowerCase()
    const allTypes = Object.keys(DOC_OPTIONS)

    const handleClick = async (targetType: string) => {
        if (loadingType) return
        setLoadingType(targetType)
        try {
            await onCreateLinked(parentSessionId, targetType)
            setOpen(false)
        } finally {
            setLoadingType(null)
        }
    }

    return (
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden"
            style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 2px 8px -2px rgba(0,0,0,0.06)" }}
        >
            {/* ── Collapsed trigger row ── */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 active:bg-secondary/60 transition-colors"
            >
                {/* Plus icon */}
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 shrink-0">
                    <Plus className="w-3 h-3 text-primary" />
                </span>

                {/* Label */}
                <span className="text-[12px] font-medium text-foreground/70 flex-1 text-left truncate">
                    {clientName
                        ? <>New doc for <span className="font-semibold text-foreground">{clientName}</span></>
                        : "Create related document"
                    }
                </span>

                {/* Doc type pills — collapsed preview */}
                <span className="hidden sm:flex items-center gap-1 shrink-0">
                    {allTypes.map(type => {
                        const opt = DOC_OPTIONS[type]
                        const Icon = opt.icon
                        return (
                            <span
                                key={type}
                                className={cn(
                                    "text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                                    type === currentType
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground/60"
                                )}
                            >
                                {opt.label}
                            </span>
                        )
                    })}
                </span>

                {/* Chevron */}
                <ChevronDown
                    className={cn(
                        "w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-300",
                        open && "rotate-180"
                    )}
                />
            </button>

            {/* ── Expandable panel — CSS grid animation (no JS height calc) ── */}
            {/* 
                Pattern: grid-rows-[0fr] → grid-rows-[1fr]
                The inner div needs min-h-0 to allow collapsing to 0.
                This is the modern, performant approach used by Radix/shadcn Collapsible.
            */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="px-3 pb-3 pt-1 border-t border-border/50">
                        <div className="grid grid-cols-2 gap-1.5">
                            {allTypes.map(type => {
                                const opt = DOC_OPTIONS[type]
                                const Icon = opt.icon
                                const isLoading = loadingType === type
                                const isCurrent = type === currentType
                                return (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => handleClick(type)}
                                        disabled={!!loadingType}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium border transition-all duration-150 active:scale-[0.97] disabled:opacity-50",
                                            isCurrent
                                                ? "border-primary/25 bg-primary/6 text-foreground"
                                                : "border-border/60 bg-background text-foreground hover:bg-secondary/50 hover:border-border"
                                        )}
                                    >
                                        {isLoading
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />
                                            : <Icon className={cn("w-3.5 h-3.5 shrink-0", opt.color)} />
                                        }
                                        <span className="flex-1 text-left">{opt.label}</span>
                                        {isCurrent && (
                                            <span className="text-[9px] font-semibold uppercase tracking-wide text-primary/60 bg-primary/8 px-1.5 py-0.5 rounded-md">
                                                new
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
