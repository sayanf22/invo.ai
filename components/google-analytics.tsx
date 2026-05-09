"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

const GA_MEASUREMENT_ID = "G-RC703VVHDW"

export function GoogleAnalytics() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the very first render — the gtag config in layout.tsx already fires it
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (typeof window === "undefined" || !window.gtag) return

    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "")

    window.gtag("config", GA_MEASUREMENT_ID, {
      page_path: url,
    })
  }, [pathname, searchParams])

  return null
}
