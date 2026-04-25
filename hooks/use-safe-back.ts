"use client"

import { useRouter } from "next/navigation"
import { useCallback } from "react"

/**
 * useSafeBack — safe back navigation hook
 *
 * Problem: router.back() calls window.history.back() which can navigate to:
 * - An external site (if user came from Google/social media)
 * - A blank tab (if the page was opened in a new tab)
 * - Nothing (if there's no history), causing a 404 or empty page
 *
 * Solution: Check if there's a valid history entry before going back.
 * If not, navigate to the fallback URL (default: "/").
 *
 * Usage:
 *   const goBack = useSafeBack()
 *   const goBack = useSafeBack("/documents")  // custom fallback
 */
export function useSafeBack(fallback = "/") {
  const router = useRouter()

  return useCallback(() => {
    // history.length === 1 means this is the first page in the tab (no back history)
    // history.length === 2 means there's exactly one page before this one
    // We check > 1 to ensure there's actually a page to go back to
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallback)
    }
  }, [router, fallback])
}
