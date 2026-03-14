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
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <InvoLogo size={48} />
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
