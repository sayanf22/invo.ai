"use client"

import { useEffect } from "react"
import { InvoLogo } from "@/components/invo-logo"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Unhandled error:", error)

    // ChunkLoadError = stale deployment cache. Auto-reload once to get fresh chunks.
    const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase()
    const chunkError =
      message.includes("loading chunk") ||
      message.includes("chunkloaderror") ||
      message.includes("failed to fetch dynamically imported module") ||
      message.includes("error loading dynamically imported module") ||
      message.includes("importing a module script failed")

    if (
      chunkError &&
      !document.documentElement.hasAttribute("data-clorefy-session-storage-fallback")
    ) {
      try {
        const reloadKey = "clorefy_chunk_reload"
        const lastReload = Number(sessionStorage.getItem(reloadKey))
        const now = Date.now()
        // Only auto-reload once per 30 seconds to prevent loops.
        if (!Number.isFinite(lastReload) || now - lastReload > 30_000) {
          sessionStorage.setItem(reloadKey, String(now))
          window.location.reload()
        }
      } catch (storageError) {
        // Storage may be blocked in Edge privacy modes or embedded contexts.
        // Fall through to the normal error UI instead of creating a reload loop.
        console.warn("Chunk reload skipped because sessionStorage is unavailable:", storageError)
      }
    }
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <InvoLogo size={44} />
      <h1 className="mt-8 text-[48px] font-bold tracking-tight text-foreground leading-none">
        Something went wrong
      </h1>
      <p className="mt-3 text-[17px] text-muted-foreground text-center max-w-md">
        An unexpected error occurred. Please try again or contact support if the problem persists.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-[15px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  )
}
