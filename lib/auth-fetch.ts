/**
 * Authenticated fetch helper for API calls.
 * Adds the Supabase access token as an Authorization header
 * so server-side auth works on Cloudflare Workers (where cookies may not be readable).
 *
 * Also transparently attaches a CSRF token on state-changing requests (POST/PUT/PATCH/DELETE).
 * The token is cached in memory and refreshed when it expires (1 hour TTL).
 */

import { createClient } from "@/lib/supabase"

// ── CSRF token cache ──────────────────────────────────────────────────────────
// Cached per browser session. Token expires server-side after 1 hour, so we
// refresh 5 minutes before that to avoid race conditions.
let csrfToken: string | null = null
let csrfTokenFetchedAt: number = 0
const CSRF_CACHE_MS = 55 * 60 * 1000 // 55 minutes (server TTL is 60 min)

async function getCsrfToken(): Promise<string | null> {
    const now = Date.now()
    if (csrfToken && now - csrfTokenFetchedAt < CSRF_CACHE_MS) {
        return csrfToken
    }
    try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token
        const headers: Record<string, string> = {}
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`

        const res = await fetch("/api/csrf", { headers })
        if (res.ok) {
            const data = await res.json()
            if (data.csrfToken) {
                csrfToken = data.csrfToken
                csrfTokenFetchedAt = now
                return csrfToken
            }
        }
    } catch {
        // Non-fatal — if CSRF fetch fails, proceed without token
        // The server enforces it, this is a best-effort client attachment
    }
    return null
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    const headers = new Headers(options.headers || {})
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`)
    }
    // Ensure Content-Type is set for JSON requests (skip for FormData — browser sets multipart boundary)
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
        headers.set("Content-Type", "application/json")
    }

    // Attach CSRF token for state-changing requests
    const method = (options.method || "GET").toUpperCase()
    if (STATE_CHANGING_METHODS.has(method)) {
        const token = await getCsrfToken()
        if (token) {
            headers.set("X-CSRF-Token", token)
        }
    }

    return fetch(url, { ...options, headers })
}
