"use client"

/**
 * Shared skeleton building blocks used across pages to replace full-page
 * circular spinners with content-shaped loading states. Keeping these in one
 * file keeps every page's skeleton visually consistent and easy to maintain.
 */

import { cn } from "@/lib/utils"

/** A single shimmering placeholder bar/block. */
export function Shimmer({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-muted/60", className)} style={style}>
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite]"
        style={{
          background: "linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground)/0.06) 50%, transparent 100%)",
        }}
      />
    </div>
  )
}

/** Sticky header skeleton — matches the back-button + logo + hamburger pattern used on most inner pages. */
export function PageHeaderSkeleton({ titleWidth = 32 }: { titleWidth?: number }) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border/50 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-muted animate-pulse" />
            <Shimmer className={`h-4 w-${titleWidth} rounded-md`} style={{ width: titleWidth * 4 }} />
          </div>
        </div>
        <div className="w-8 h-8 rounded-xl bg-muted animate-pulse shrink-0" />
      </div>
    </div>
  )
}

/** Stat tile row skeleton (used by billing) — N cards with icon + label + value. */
export function StatTilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 space-y-3" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted animate-pulse shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Shimmer className="h-2.5 w-20 rounded-md" />
              <Shimmer className="h-4 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Plan card grid skeleton (used by billing + choose-plan). */
export function PlanGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-3xl border border-border/60 bg-card overflow-hidden" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="p-6 pb-4 space-y-3">
            <Shimmer className="h-5 w-20 rounded-md" />
            <Shimmer className="h-8 w-24 rounded-md" />
          </div>
          <div className="px-6 pb-4 pt-2 space-y-3">
            {[0.9, 0.75, 0.85, 0.6].map((w, j) => (
              <div key={j} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-muted animate-pulse shrink-0" />
                <Shimmer className="h-3 rounded-md" style={{ width: `${w * 80}%` }} />
              </div>
            ))}
          </div>
          <div className="p-6 pt-4 border-t border-border/40 mt-auto bg-muted/10">
            <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Generic list-item card skeleton (used by history + notifications). */
export function ListItemSkeleton({ count = 5, avatar = "square" }: { count?: number; avatar?: "square" | "circle" }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-card p-4 flex items-start gap-3" style={{ animationDelay: `${i * 80}ms` }}>
          <div className={cn("w-10 h-10 shrink-0 bg-muted animate-pulse", avatar === "circle" ? "rounded-full" : "rounded-xl")} />
          <div className="flex-1 min-w-0 space-y-2">
            <Shimmer className="h-4 rounded-md" style={{ width: `${50 + (i * 13) % 35}%` }} />
            <Shimmer className="h-3 w-2/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Filter-pill row skeleton. */
export function FilterPillsSkeleton({ widths = [56, 72, 80, 68, 76] }: { widths?: number[] }) {
  return (
    <div className="flex gap-2 overflow-hidden">
      {widths.map((w, i) => (
        <div key={i} className="h-8 rounded-full bg-muted animate-pulse shrink-0" style={{ width: w, animationDelay: `${i * 60}ms` }} />
      ))}
    </div>
  )
}

/** Form-section card skeleton (used by profile page) — mimics a labeled 2-col field grid. */
export function FormSectionSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="rounded-2xl border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-36 rounded-md" />
            <Shimmer className="h-3 w-28 rounded-md" />
          </div>
        </div>
        <div className="w-16 h-8 rounded-lg bg-muted animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-1.5">
            <Shimmer className="h-2.5 w-20 rounded-md" />
            <Shimmer className="h-5 w-4/5 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Paper-document preview skeleton (used by sign/view pages). */
export function DocumentPreviewSkeleton() {
  return (
    <div className="w-full max-w-[520px] mx-auto bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-6 pt-6 pb-4 border-b border-border/40 flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <Shimmer className="h-5 w-28 rounded-md" />
          <Shimmer className="h-3.5 w-20 rounded-md" />
        </div>
        <Shimmer className="h-14 w-14 rounded-xl shrink-0" />
      </div>
      <div className="px-6 py-4 grid grid-cols-2 gap-6 border-b border-border/40">
        {[0, 1].map((col) => (
          <div key={col} className="space-y-2">
            <Shimmer className="h-3 w-12 rounded-md" />
            <Shimmer className="h-3.5 w-[80%] rounded-md" />
            <Shimmer className="h-3 w-[60%] rounded-md" />
          </div>
        ))}
      </div>
      <div className="px-6 py-4 space-y-3">
        {[0.9, 0.7, 0.8].map((w, i) => (
          <Shimmer key={i} className="h-3 rounded-md" style={{ width: `${w * 100}%` }} />
        ))}
      </div>
    </div>
  )
}

/** Small centered chat-bubble skeleton (used by onboarding while it initializes). */
export function ChatBubbleSkeleton() {
  return (
    <div className="flex items-end gap-2.5 max-w-[80%] mx-auto">
      <div className="w-7 h-7 rounded-full bg-muted/80 border border-border/40 shrink-0 mb-0.5" />
      <div className="bg-card border border-border/50 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm space-y-2 flex-1">
        <Shimmer className="h-3.5 w-[85%]" />
        <Shimmer className="h-3.5 w-[60%]" />
      </div>
    </div>
  )
}
