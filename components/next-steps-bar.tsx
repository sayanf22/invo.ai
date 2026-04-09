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
    const availableTypes = Object.keys(DOC_OPTIONS).filter(t => t !== currentType)

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
            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none snap-x snap-mandatory">
                {availableTypes.map(type => {
                    const opt = DOC_OPTIONS[type]
                    const Icon = opt.icon
                    const isLoading = loadingType === type
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => handleClick(type)}
                            disabled={!!loadingType}
                            className={cn(
                                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium border border-border/60 bg-background text-foreground transition-all duration-200 active:scale-[0.97] shadow-sm whitespace-nowrap shrink-0 snap-start",
                                isLoading ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-secondary/50 hover:shadow-md"
                            )}
                        >
                            {isLoading
                                ? <Loader2 className="w-[18px] h-[18px] animate-spin" />
                                : <Icon className="w-[18px] h-[18px] text-muted-foreground" />
                            }
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
