"use client"

/**
 * DisambiguationCard — shown inline in the chat when the intent classifier
 * returns two or more plausible document types (Requirement 3.3a).
 *
 * Renders one button per candidate type (label + short description from the
 * registry) and a "Something else" escape hatch that falls through to AI chat.
 *
 * When the user clicks a type button, `onSelect(type)` is called with the
 * confirmed DocumentType. When they click "Something else", `onSelectChat()`
 * is called to fall through to the normal AI chat flow.
 */

import { cn } from "@/lib/utils"
import {
  getDocumentTypeConfig,
  type DocumentType,
} from "@/lib/document-type-registry"
import type { IntentSuggestion } from "@/lib/intent-router"
import { MessageSquare } from "lucide-react"

interface DisambiguationCardProps {
  /** Ranked list of candidate types (from classifyIntentFull). */
  suggestions: IntentSuggestion[]
  /** Called with the confirmed type when the user picks one. */
  onSelect: (type: DocumentType) => void
  /** Called when the user clicks "Something else" — falls through to chat. */
  onSelectChat: () => void
  /** Whether a selection is being processed (disables all buttons). */
  isSelecting?: boolean
}

export function DisambiguationCard({
  suggestions,
  onSelect,
  onSelectChat,
  isSelecting = false,
}: DisambiguationCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden max-w-sm w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/40">
        <p className="text-[13px] font-semibold text-foreground leading-tight">
          Which document did you have in mind?
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          Your request matches a few types. Pick the one that fits best.
        </p>
      </div>

      {/* Type buttons */}
      <div className="divide-y divide-border/40">
        {suggestions.map(({ type }) => {
          const config = getDocumentTypeConfig(type)
          if (!config) return null
          return (
            <button
              key={type}
              type="button"
              disabled={isSelecting}
              onClick={() => onSelect(type)}
              className={cn(
                "w-full text-left px-4 py-3 flex flex-col gap-0.5",
                "transition-colors duration-150 active:scale-[0.99]",
                isSelecting
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-muted/50 cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "text-[13px] font-semibold leading-tight",
                  config.color
                )}
              >
                {config.label}
              </span>
              <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {config.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Something else escape hatch */}
      <div className="border-t border-border/40 px-4 py-2.5">
        <button
          type="button"
          disabled={isSelecting}
          onClick={onSelectChat}
          className={cn(
            "w-full flex items-center gap-2 text-[12px] text-muted-foreground transition-colors duration-150",
            isSelecting
              ? "opacity-50 cursor-not-allowed"
              : "hover:text-foreground cursor-pointer"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
          <span>Something else — let me describe it</span>
        </button>
      </div>
    </div>
  )
}
