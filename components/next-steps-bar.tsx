"use client"

import { useState } from "react"
import { FileText, ScrollText, ClipboardList, Lightbulb, Loader2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const DOC_OPTIONS: Record<string, { label: string; icon: React.ElementType }> = {
    invoice: { label: "Invoice", icon: FileText },
    contract: { label: "Contract", icon: ScrollText },
    quotation: { label: "Quotation", icon: ClipboardList },
    proposal: { label: "Proposal", icon: Lightbulb },
}

interface NextStepsBarProps {
    clientName: string | null
    currentDocType: string
    parentSessionId: string
    onCreateLinked: (parentSessionId: string, targetType: string) => Promise<void>
}

export function NextStepsBar({ clientName, currentDocType, parentSessionId, onCreateLinked }: NextStepsBarProps) {
    const [loadingType, setLoadingType] = useState<string | null>(null)

    const currentType = currentDocType.toLowerCase()
    // Show all doc types including the current one — users may want to create
    // the same document type again (e.g., next month's invoice for the same client)
    const allTypes = Object.keys(DOC_OPTIONS)

    const handleClick = async (targetType: string) => {
        if (loadingType) return
        setLoadingType(targetType)
        try {
            await onCreateLinked(parentSessionId, targetType)
        } finally {
            setLoadingType(null)
        }
    }

    return (
        <div className="rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm">
            <p className="text-[13px] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <ArrowRight className="w-3.5 h-3.5" />
                {clientName
                    ? <span>Create another document for <span className="font-medium text-foreground">{clientName}</span></span>
                    : <span>Create a related document</span>
                }
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1.5 -mb-1.5 snap-x snap-mandatory touch-pan-x" style={{ WebkitOverflowScrolling: "touch" }}>
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
                                "flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200 active:scale-[0.97] shadow-sm whitespace-nowrap shrink-0 snap-start",
                                isLoading
                                    ? "opacity-60 cursor-wait border-border/60 bg-background text-foreground"
                                    : isCurrent
                                    ? "cursor-pointer border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10 hover:shadow-md"
                                    : "cursor-pointer border-border/60 bg-background text-foreground hover:bg-secondary/50 hover:shadow-md"
                            )}
                        >
                            {isLoading
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <Icon className="w-4 h-4 text-muted-foreground" />
                            }
                            {opt.label}
                            {isCurrent && <span className="text-[10px] text-muted-foreground font-normal">(new)</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
