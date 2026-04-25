"use client"

/**
 * PageLoader — consistent full-page loading screen
 * Used across all pages for a unified loading experience.
 * Background matches the app's brand color (#FBF7F0).
 */
export function PageLoader({ label = "Clorefy" }: { label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "#FBF7F0" }}
    >
      <div className="relative w-10 h-10">
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
          style={{
            borderTopColor: "hsl(33 17% 10%)",
            borderRightColor: "hsl(33 17% 10% / 0.12)",
            animationDuration: "0.7s",
          }}
        />
      </div>
      {label && (
        <p className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: "hsl(33 11% 40%)" }}>
          {label}
        </p>
      )}
    </div>
  )
}

/**
 * SkeletonLoader — skeleton loading state for list pages
 * Matches the card style of the documents/history pages.
 */
export function SkeletonLoader({ count = 4 }: { count?: number }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF7F0" }}>
      {/* Skeleton header */}
      <div className="sticky top-0 z-10 border-b border-border/50" style={{ backgroundColor: "#FBF7F0" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-5 w-32 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-20 rounded-md bg-muted/60 animate-pulse" />
          </div>
          <div className="w-9 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
          <div className="w-16 h-9 rounded-xl bg-muted animate-pulse shrink-0" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* Skeleton filter pills */}
        <div className="flex gap-2">
          {[56, 72, 80, 68].map((w, i) => (
            <div
              key={i}
              className="h-8 rounded-full bg-muted animate-pulse shrink-0"
              style={{ width: w, animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>

        {/* Skeleton cards */}
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-card overflow-hidden"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start gap-3 px-3.5 py-5">
              <div className="w-14 h-6 rounded-lg bg-muted animate-pulse shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-4 rounded-md bg-muted animate-pulse" style={{ width: `${45 + (i * 17) % 35}%` }} />
                  <div className="h-5 w-16 rounded-full bg-muted animate-pulse shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-24 rounded-md bg-muted/60 animate-pulse" />
                  <div className="h-3 w-16 rounded-md bg-muted/60 animate-pulse" />
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
                <div className="w-8 h-8 rounded-xl bg-muted animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
