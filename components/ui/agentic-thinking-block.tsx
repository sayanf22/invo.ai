"use client"

import { useState, useCallback } from "react"
import { ChevronRight, Database, Search, PenLine, Brain, ScanText, GitBranch, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityItem {
    id: string
    action: "read" | "think" | "search" | "generate" | "analyze" | "route" | "context"
    label: string
    detail?: string
    reasoningText?: string // Expandable content for any action type
}

export interface AgenticThinkingBlockProps {
    activities: ActivityItem[]
    isWorking: boolean
    className?: string
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<ActivityItem["action"], React.ReactNode> = {
    analyze: <ScanText className="w-3.5 h-3.5" />,
    read: <Database className="w-3.5 h-3.5" />,
    search: <Search className="w-3.5 h-3.5" />,
    generate: <PenLine className="w-3.5 h-3.5" />,
    think: <Brain className="w-3.5 h-3.5" />,
    route: <GitBranch className="w-3.5 h-3.5" />,
    context: <Layers className="w-3.5 h-3.5" />,
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgenticThinkingBlock({
    activities,
    isWorking,
    className,
}: AgenticThinkingBlockProps) {
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }, [])

    if (activities.length === 0) return null

    return (
        <div
            className={cn(
                "w-full rounded-xl border border-border/30 bg-card/50 overflow-hidden",
                className,
            )}
        >
            <div className="relative">
                {/* Vertical dotted connecting line */}
                {activities.length > 1 && (
                    <div
                        className="absolute left-[19px] top-[22px] w-px border-l border-dotted border-muted-foreground/20"
                        style={{ height: `calc(100% - 44px)` }}
                    />
                )}

                {activities.map((activity, idx) => {
                    const isLast = idx === activities.length - 1
                    const isExpanded = expandedIds.has(activity.id)
                    const hasExpandableContent =
                        activity.reasoningText ||
                        (activity.action === "think" && activity.reasoningText) ||
                        activity.detail

                    return (
                        <div key={activity.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
                            <button
                                type="button"
                                onClick={() => hasExpandableContent && toggleExpand(activity.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors relative z-10",
                                    hasExpandableContent && "cursor-pointer hover:bg-muted/30",
                                    !hasExpandableContent && "cursor-default",
                                )}
                                disabled={!hasExpandableContent}
                            >
                                {/* Icon */}
                                <span
                                    className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-muted-foreground bg-muted/50",
                                        isLast && isWorking && !activity.detail && "animate-pulse",
                                    )}
                                >
                                    {ACTION_ICONS[activity.action]}
                                </span>

                                {/* Label + detail */}
                                <span className="flex-1 min-w-0 flex items-center gap-1.5 text-[13px]">
                                    <span
                                        className={cn(
                                            "font-medium text-foreground shrink-0",
                                            isLast && isWorking && !activity.detail && "animate-pulse",
                                        )}
                                    >
                                        {activity.label}
                                    </span>
                                    {activity.detail && (
                                        <>
                                            <span className="text-muted-foreground/40 shrink-0">|</span>
                                            <span className="text-muted-foreground truncate transition-opacity duration-300">
                                                {activity.detail}
                                            </span>
                                        </>
                                    )}
                                </span>

                                {/* Chevron */}
                                {hasExpandableContent && (
                                    <ChevronRight
                                        className={cn(
                                            "w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-transform duration-200",
                                            isExpanded && "rotate-90",
                                        )}
                                    />
                                )}
                            </button>

                            {/* Expandable content */}
                            {hasExpandableContent && (
                                <div
                                    className="grid transition-all duration-300 ease-out"
                                    style={{
                                        gridTemplateRows: isExpanded ? "1fr" : "0fr",
                                    }}
                                >
                                    <div className="overflow-hidden">
                                        <div className="pl-14 pr-4 pb-2.5 max-h-[240px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                                            <p className="text-[12px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap break-words">
                                                {activity.reasoningText || activity.detail}
                                                {activity.action === "think" && isWorking && isLast && (
                                                    <span className="inline-block w-0.5 h-3 bg-muted-foreground/40 ml-0.5 animate-pulse align-middle" />
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
