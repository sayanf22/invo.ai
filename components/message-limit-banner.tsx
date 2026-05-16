"use client"

import {
    FileText, ScrollText, ClipboardList, Lightbulb, AlertTriangle,
    GitMerge, Shield, Bell, ClipboardCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getTierLimits, parseTier, nextTierUpgrade } from "@/lib/cost-protection"

// Mirror of next-steps-bar's ALL_DOC_OPTIONS — keep the icon/label mapping in
// sync so the chat banner and the New Doc dropdown stay visually consistent.
const ALL_DOC_OPTIONS: Record<string, { label: string; icon: React.ElementType }> = {
    invoice:                { label: "Invoice",          icon: FileText },
    contract:               { label: "Contract",         icon: ScrollText },
    quote:                  { label: "Quote",            icon: ClipboardList },
    proposal:               { label: "Proposal",         icon: Lightbulb },
    sow:                    { label: "SOW",              icon: GitMerge },
    nda:                    { label: "NDA",              icon: Shield },
    change_order:           { label: "Change Order",     icon: ClipboardCheck },
    client_onboarding_form: { label: "Onboarding Form",  icon: ClipboardCheck },
    payment_followup:       { label: "Payment Reminder", icon: Bell },
}

interface MessageLimitBannerProps {
    currentMessages: number
    limit: number
    tier: string
    currentDocType: string
    hasChain: boolean
    parentSessionId: string
    onCreateDocument: (docType: string) => void
}

export function MessageLimitBanner({
    currentMessages,
    limit,
    tier,
    currentDocType,
    onCreateDocument,
}: MessageLimitBannerProps) {
    // Derive allowed doc types from the tier prop directly (no hook required).
    // This keeps the component self-contained and side-effect-free, which is
    // important for both correctness and unit testability.
    const parsedTier = parseTier(tier)
    const allowedDocTypes = getTierLimits(parsedTier).allowedDocTypes

    const tierLabel = parsedTier === "free" ? "Free" : parsedTier === "starter" ? "Starter" : parsedTier === "pro" ? "Pro" : "Agency"
    const { nextTier, label, messagesPerSession } = nextTierUpgrade(parsedTier)
    const upgradeMsg = nextTier
        ? `Upgrade to ${label} for ${messagesPerSession} messages/session`
        : null

    // Filter to types we actually have icon/label mappings for, in canonical
    // ALL_DOC_OPTIONS order (so labels and icons match the New Doc dropdown).
    const optionEntries = Object.keys(ALL_DOC_OPTIONS) as (keyof typeof ALL_DOC_OPTIONS)[]
    const visibleTypes = optionEntries.filter(t => allowedDocTypes.includes(t))

    return (
        <div className="rounded-2xl border bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        Session message limit reached
                    </p>
                    <p className="text-amber-600 dark:text-amber-400 text-sm mt-0.5">
                        {currentMessages}/{limit} messages used ({tierLabel} plan)
                    </p>
                    {upgradeMsg && (
                        <a href="/pricing" className="text-xs text-amber-700 dark:text-amber-300 underline mt-0.5 block">
                            {upgradeMsg}
                        </a>
                    )}
                </div>
            </div>

            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2.5 ml-8">
                {nextTier
                    ? "Start a new session or upgrade to continue chatting"
                    : "Start a new session to continue"}
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none snap-x snap-mandatory ml-8">
                {visibleTypes.map((type) => {
                    const opt = ALL_DOC_OPTIONS[type]
                    const Icon = opt.icon
                    const isCurrent = type === currentDocType.toLowerCase()
                    return (
                        <button
                            key={type}
                            type="button"
                            onClick={() => onCreateDocument(type)}
                            className={cn(
                                "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[14px] font-medium border transition-all duration-200 active:scale-[0.97] shadow-sm whitespace-nowrap shrink-0 snap-start cursor-pointer",
                                isCurrent
                                    ? "border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-900/60"
                                    : "border-amber-200 bg-white text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                            )}
                        >
                            <Icon className="w-[18px] h-[18px]" />
                            {opt.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
