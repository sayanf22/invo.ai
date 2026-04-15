"use client"

import { useState, useEffect } from "react"
import { authFetch } from "@/lib/auth-fetch"

// Module-level cache — persists across component mounts for the session
export const logoCache = new Map<string, string>()
// Track in-flight requests to avoid duplicate fetches
const inFlight = new Map<string, Promise<string | null>>()

function isR2Key(value: string): boolean {
  return (
    value.length > 0 &&
    !value.startsWith("data:") &&
    !value.startsWith("http") &&
    !value.startsWith("blob:")
  )
}

async function fetchLogoDataUrl(key: string): Promise<string | null> {
  // Check cache first
  const cached = logoCache.get(key)
  if (cached) return cached

  // Deduplicate concurrent fetches for the same key
  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await authFetch(`/api/storage/image?key=${encodeURIComponent(key)}`)
      if (!res.ok) return null
      const data = await res.json()
      if (data?.dataUrl) {
        logoCache.set(key, data.dataUrl)
        // Backfill: save to businesses table so future loads are instant
        try {
          const { createClient } = await import("@/lib/supabase")
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            await supabase
              .from("businesses")
              .update({ logo_data_url: data.dataUrl } as any)
              .eq("user_id", user.id)
              .eq("logo_url", key)
          }
        } catch { /* non-blocking */ }
        return data.dataUrl
      }
      return null
    } catch {
      return null
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, promise)
  return promise
}

/**
 * Resolves an R2 object key to a displayable URL.
 * - Returns the value directly if it's already a data URL, http URL, or blob URL
 * - Caches results in memory to avoid re-fetching on every mount
 * - Deduplicates concurrent fetches for the same key
 */
export function useLogoUrl(logoKey: string | null | undefined): {
  url: string | null
  loading: boolean
} {
  const [url, setUrl] = useState<string | null>(() => {
    if (!logoKey) return null
    if (!isR2Key(logoKey)) return logoKey
    return logoCache.get(logoKey) ?? null
  })
  const [loading, setLoading] = useState<boolean>(() => {
    if (!logoKey) return false
    if (!isR2Key(logoKey)) return false
    return !logoCache.has(logoKey)
  })

  useEffect(() => {
    if (!logoKey) {
      setUrl(null)
      setLoading(false)
      return
    }

    // Already a usable URL
    if (!isR2Key(logoKey)) {
      setUrl(logoKey)
      setLoading(false)
      return
    }

    // Check cache first — instant return
    const cached = logoCache.get(logoKey)
    if (cached) {
      setUrl(cached)
      setLoading(false)
      return
    }

    // Fetch from server
    let cancelled = false
    setLoading(true)

    fetchLogoDataUrl(logoKey).then((result) => {
      if (cancelled) return
      setUrl(result)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [logoKey])

  return { url, loading }
}

/**
 * Pre-warm the logo cache for a given key.
 * Call this after upload to avoid the spinner on next render.
 */
export function warmLogoCache(key: string, url: string) {
  if (key && url) logoCache.set(key, url)
}

/**
 * Invalidate a cached logo (e.g. after deletion or replacement).
 */
export function invalidateLogoCache(key: string) {
  logoCache.delete(key)
  inFlight.delete(key)
}
