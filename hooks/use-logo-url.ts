"use client"

import { useState, useEffect } from "react"
import { authFetch } from "@/lib/auth-fetch"

// Module-level cache — persists across component mounts for the session
const logoCache = new Map<string, string>()

function isR2Key(value: string): boolean {
  return value.length > 0 && !value.startsWith("data:") && !value.startsWith("http") && !value.startsWith("blob:")
}

/**
 * Resolves an R2 object key to a displayable URL.
 * - Returns the value directly if it's already a data URL, http URL, or blob URL
 * - Caches results in memory to avoid re-fetching on every mount
 * - Returns null while loading
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

    // Check cache first
    const cached = logoCache.get(logoKey)
    if (cached) {
      setUrl(cached)
      setLoading(false)
      return
    }

    // Fetch from server
    let cancelled = false
    setLoading(true)

    authFetch(`/api/storage/image?key=${encodeURIComponent(logoKey)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.dataUrl) {
          logoCache.set(logoKey, data.dataUrl)
          setUrl(data.dataUrl)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [logoKey])

  return { url, loading }
}

/**
 * Pre-warm the logo cache for a given key.
 * Call this after upload to avoid the spinner on next render.
 */
export function warmLogoCache(key: string, objectUrl: string) {
  logoCache.set(key, objectUrl)
}

/**
 * Invalidate a cached logo (e.g. after deletion or replacement).
 */
export function invalidateLogoCache(key: string) {
  logoCache.delete(key)
}
