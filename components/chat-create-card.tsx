"use client"

import { FileText, ScrollText, ClipboardList, Lightbulb, Loader2, FileCheck, Shield, ClipboardCheck, Bell, GitMerge } from "lucide-react"
import { cn } from "@/lib/utils"
import { getDocumentTypeLabel, normalizeDocumentType } from "@/lib/document-type-registry"

// Accept all 9 canonical types (plus legacy "quotation" which is normalized to "quote").
// Recurring invoices are NOT a separate type — they are a setting on a regular invoice.
type CreateCardDocType = "invoice" | "contract" | "quote" | "quotation" | "proposal" | "sow" | "change_order" | "nda" | "client_onboarding_form" | "payment_followup"

interface ChatCreateCardProps {
    documentType: CreateCardDocType
    summary: string
    isCreating: boolean
    onConfirm: () => void
    className?: string
}

const DOC_ICON: Record<string, React.ElementType> = {
    invoice: FileText,
    contract: ScrollText,
    quote: ClipboardList,
    quotation: ClipboardList,
    proposal: Lightbulb,
    sow: ClipboardCheck,
    change_order: GitMerge,
    nda: Shield,
    client_onboarding_form: ClipboardCheck,
    payment_followup: Bell,
}

/**
 * A monochromatic chat card that offers to create a specific document type.
 * Rendered inline in the chat-only screen beneath an AI message when the AI
 * has suggested creating something and the user has confirmed.
 *
 * Visual rules (per design §7):
 *  - No accent / primary colors. Uses only `card`, `border`, `foreground`,
 *    `muted-foreground` tokens.
 *  - Button uses `bg-foreground text-background` (monochromatic inverse).
 *  - `isCreating` swaps the button content to a spinner and disables it.
 */
export function ChatCreateCard({
    documentType,
    summary,
    isCreating,
    onConfirm,
    className,
}: ChatCreateCardProps) {
    // Normalize legacy "quotation" → "quote" for display
    const normalizedType = normalizeDocumentType(documentType) ?? documentType
    const Icon = DOC_ICON[normalizedType] || FileText
    const label = getDocumentTypeLabel(normalizedType)

    return (
        <div
            className={cn(
                "inline-flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm max-w-[420px]",
                className,
            )}
            style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px -2px rgba(0,0,0,0.04)" }}
        >
            <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-sm font-semibold text-foreground leading-tight">
                        {label}
                    </span>
                    <span className="text-[12px] leading-snug text-muted-foreground break-words">
                        {summary}
                    </span>
                </div>
            </div>

            <button
                type="button"
                onClick={onConfirm}
                disabled={isCreating}
                aria-label={`Create ${label}`}
                className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-all",
                    "hover:bg-foreground/90 active:scale-[0.98]",
                    "disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100",
                )}
            >
                {isCreating ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Creating…</span>
                    </>
                ) : (
                    <span>Create {label}</span>
                )}
            </button>
        </div>
    )
}
