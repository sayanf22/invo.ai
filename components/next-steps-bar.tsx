"use client"

import { useState } from "react"
import { FileText, ScrollText, ClipboardList, Lightbulb, Loader2, ChevronDown, FilePlus } from "lucide-react"
import { cn } from "@/lib/utils"
import { PaymentLinkButton } from "@/components/payment-link-button"
import type { InvoiceData } from "@/lib/invoice-types"

const DOC_OPTIONS: Record<string, { label: string; icon: React.ElementType }> = {
    invoice:   { label: "Invoice",   icon: FileText },
    contract:  { label: "Contract",  icon: ScrollText },
    quotation: { label: "Quotation", icon: ClipboardList },
    proposal:  { label: "Proposal",  icon: Lightbulb },
}

interface NextStepsBarProps {
    clientName: string | null
    currentDocType: string
    parentSessionId: string
    onCreateLinked: (parentSessionId: string, targetType: string) => Promise<void>
    /** Slot for the Select Client button — rendered inline in the toolbar row */
    clientSelectorSlot?: React.ReactNode
    /** Invoice data for payment link generation */
    invoiceData?: InvoiceData
    /** Called when payment link is created — syncs into invoice data */
    onPaymentLinkChange?: (shortUrl: string, status: string) => void
}

export function NextStepsBar({
    clientName,
    currentDocType,
    parentSessionId,
    onCreateLinked,
    clientSelectorSlot,
    invoiceData,
    onPaymentLinkChange,
}: NextStepsBarProps) {
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

    // Pill style — h-9 (36px) with extra horizontal padding for comfortable touch
    // Note: visually 36px but the touch target is extended via padding
    const pillBase = cn(
        "inline-flex items-center gap-1.5",
        "h-9 px-3.5 rounded-xl",
        "text-[13px] font-medium text-foreground",
        "bg-card border border-border",
        "transition-all duration-150",
        "hover:bg-secondary/60 hover:border-border/80",
        "active:scale-[0.96] active:bg-secondary/80",
        // Extend touch target without changing visual size
        "touch-manipulation select-none"
    )

    const pillShadow = "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.10)"

    return (
        <div>
            {/* ── Unified toolbar row ── */}
            <div className="flex items-center gap-2">

                {/* New Doc pill */}
                <button
                    type="button"
                    onClick={() => setOpen(v => !v)}
                    className={cn(pillBase, open && "bg-secondary/60 border-border/80")}
                    style={{ boxShadow: pillShadow }}
                    aria-expanded={open}
                    aria-label="Create new document"
                >
                    <FilePlus className="w-3.5 h-3.5 text-foreground/60 shrink-0" />
                    <span>New Doc</span>
                    <ChevronDown
                        className={cn(
                            "w-3 h-3 text-foreground/40 shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)]",
                            open && "rotate-180"
                        )}
                    />
                </button>

                {/* Select Client slot */}
                {clientSelectorSlot}

                {/* Payment Link button — only for invoices */}
                {invoiceData && (
                    <PaymentLinkButton
                        sessionId={parentSessionId}
                        invoiceData={invoiceData}
                        documentType={currentDocType}
                        onPaymentLinkChange={onPaymentLinkChange}
                    />
                )}

            </div>

            {/* ── Expandable doc-type panel ── */}
            {/*
                CSS grid-rows animation: grid-rows-[0fr] → grid-rows-[1fr]
                Inner div needs min-h-0 to collapse to zero height.
                GPU-composited — no JS height measurement, no layout thrash.
            */}
            <div
                className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                )}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="pt-2">
                        <div
                            className="rounded-xl border border-border bg-card overflow-hidden"
                            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 16px -4px rgba(0,0,0,0.10)" }}
                        >
                            {/* Panel header */}
                            <div className="px-3.5 py-2.5 border-b border-border/60 bg-secondary/20">
                                <p className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider leading-none">
                                    {clientName
                                        ? <>Create for <span className="text-foreground/70 normal-case font-semibold">{clientName}</span></>
                                        : "Create related document"
                                    }
                                </p>
                            </div>

                            {/* 2×2 grid — each button has min 44px height for touch */}
                            <div className="grid grid-cols-2 gap-px bg-border/40">
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
                                                // min-h-[44px] = Apple HIG minimum touch target
                                                "flex items-center gap-2.5 px-4 min-h-[44px]",
                                                "text-[13px] font-medium text-foreground",
                                                "bg-card transition-colors duration-100",
                                                "hover:bg-secondary/50 active:bg-secondary/80",
                                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                                "touch-manipulation select-none",
                                                isCurrent && "bg-primary/5"
                                            )}
                                        >
                                            {isLoading
                                                ? <Loader2 className="w-4 h-4 animate-spin text-foreground/40 shrink-0" />
                                                : <Icon className="w-4 h-4 text-foreground/50 shrink-0" />
                                            }
                                            <span className="flex-1 text-left">{opt.label}</span>
                                            {isCurrent && (
                                                <span className="text-[10px] font-semibold text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-md shrink-0 leading-none">
                                                    current
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
        </div>
    )
}
