"use client"

import { useState, useRef, useCallback } from "react"
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
    const scrollRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)
    const startX = useRef(0)
    const scrollLeft = useRef(0)
    const dragMoved = useRef(false)

    const currentType = currentDocType.toLowerCase()
    const allTypes = Object.keys(DOC_OPTIONS)

    const handleClick = async (targetType: string) => {
        if (loadingType || dragMoved.current) return
        setLoadingType(targetType)
        try {
            await onCreateLinked(parentSessionId, targetType)
        } finally {
            setLoadingType(null)
        }
    }

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (!scrollRef.current) return
        isDragging.current = true
        dragMoved.current = false
        startX.current = e.pageX - scrollRef.current.offsetLeft
        scrollLeft.current = scrollRef.current.scrollLeft
        scrollRef.current.style.cursor = "grabbing"
        scrollRef.current.style.userSelect = "none"
    }, [])

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging.current || !scrollRef.current) return
        e.preventDefault()
        const x = e.pageX - scrollRef.current.offsetLeft
        const walk = (x - startX.current) * 1.2
        if (Math.abs(walk) > 3) dragMoved.current = true
        scrollRef.current.scrollLeft = scrollLeft.current - walk
    }, [])

    const onMouseUp = useCallback(() => {
        isDragging.current = false
        if (scrollRef.current) {
            scrollRef.current.style.cursor = "grab"
            scrollRef.current.style.userSelect = ""
        }
    }, [])

    return (
        <div className="rounded-2xl border border-border bg-card p-3.5"
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px -4px rgba(0,0,0,0.08)" }}
        >
            <p className="text-[12px] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <ArrowRight className="w-3 h-3" />
                {clientName
                    ? <span>Create another document for <span className="font-semibold text-foreground">{clientName}</span></span>
                    : <span>Create a related document</span>
                }
            </p>
            <div
                ref={scrollRef}
                className="flex gap-2 overflow-x-auto pb-0.5 select-none"
                style={{ cursor: "grab", WebkitOverflowScrolling: "touch" }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
            >
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
                                "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200 active:scale-[0.97] whitespace-nowrap shrink-0",
                                isLoading
                                    ? "opacity-60 cursor-wait border-border bg-background text-foreground"
                                    : isCurrent
                                    ? "border-primary/30 bg-primary/8 text-foreground hover:bg-primary/12 shadow-sm"
                                    : "border-border bg-background text-foreground hover:bg-secondary/60 shadow-sm hover:shadow-md"
                            )}
                            style={{ boxShadow: isCurrent ? "0 1px 4px hsl(var(--primary)/0.15)" : "0 1px 3px rgba(0,0,0,0.06)" }}
                        >
                            {isLoading
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                            }
                            {opt.label}
                            {isCurrent && <span className="text-[10px] text-muted-foreground/70 font-normal">(new)</span>}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
