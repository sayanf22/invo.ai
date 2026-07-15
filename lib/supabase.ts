import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Phoenix reads window.sessionStorage while Supabase initializes Realtime.
 * Edge can deny that property in privacy-restricted or embedded contexts,
 * which would otherwise prevent the entire Supabase browser client from being
 * created. Install an in-memory sessionStorage only when native access throws.
 *
 * This is not an auth storage adapter: @supabase/ssr continues to own auth
 * persistence and cookie interoperability with the server client.
 */
function ensureRealtimeSessionStorage() {
    if (typeof window === "undefined") return

    try {
        const storage = window.sessionStorage
        const probeKey = "clorefy_storage_probe"
        storage.setItem(probeKey, "1")
        storage.removeItem(probeKey)
        return
    } catch {
        // Fall through to a page-lifetime store for Realtime fallback metadata.
    }

    const values = new Map<string, string>()
    const memoryStorage: Storage = {
        get length() {
            return values.size
        },
        clear() {
            values.clear()
        },
        getItem(key) {
            return values.get(key) ?? null
        },
        key(index) {
            return Array.from(values.keys())[index] ?? null
        },
        removeItem(key) {
            values.delete(key)
        },
        setItem(key, value) {
            values.set(key, String(value))
        },
    }

    try {
        Object.defineProperty(window, "sessionStorage", {
            configurable: true,
            value: memoryStorage,
        })
        document.documentElement.setAttribute("data-clorefy-session-storage-fallback", "true")
    } catch {
        // The Supabase constructor will surface the browser restriction if the
        // Window object itself cannot be patched in this environment.
    }
}

/**
 * Create a Supabase client for browser use.
 * 
 * Uses @supabase/ssr's createBrowserClient which handles cookie reading/writing
 * in a format compatible with the server-side @supabase/ssr createServerClient.
 * This ensures OAuth sessions set by the server callback are readable client-side.
 */
export function createClient() {
    if (supabaseInstance) return supabaseInstance

    ensureRealtimeSessionStorage()
    supabaseInstance = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    return supabaseInstance
}

/** Clear all Supabase auth tokens from localStorage and cookies. */
export function clearAuthTokens() {
    if (typeof document === "undefined") return
    try {
        // Clear localStorage
        Object.keys(localStorage)
            .filter(k => k.startsWith("sb-") && k.includes("-auth-token"))
            .forEach(k => localStorage.removeItem(k))
        
        // Clear cookies
        const past = "Thu, 01 Jan 1970 00:00:00 GMT"
        document.cookie.split(";").forEach(c => {
            const name = c.trim().split("=")[0]
            if (name.startsWith("sb-") && name.includes("-auth-token")) {
                document.cookie = `${name}=;path=/;expires=${past}`
            }
        })
    } catch {}
}

/** Scan localStorage for corrupted Supabase tokens and remove them.
 *
 * IMPORTANT: Cookies are managed by @supabase/ssr which writes them URL-encoded
 * (e.g. values containing `%`). That's NORMAL and VALID — we must NOT treat
 * URL-encoded cookies as corrupted. Only purge localStorage entries that fail
 * to JSON-parse.
 */
export function clearCorruptedAuthTokens() {
    if (typeof window === "undefined") return
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith("sb-") && k.includes("-auth-token"))
            .forEach(k => {
                try {
                    const val = localStorage.getItem(k)
                    if (!val) return
                    // Supabase stores JSON in localStorage — validate parse succeeds.
                    // If it doesn't parse, it's genuinely corrupted.
                    JSON.parse(val)
                } catch {
                    console.warn("[auth] Removing unparseable localStorage token:", k)
                    try { localStorage.removeItem(k) } catch {}
                }
            })
    } catch {}
    // Do NOT touch cookies here. Cookie values are URL-encoded by NextResponse
    // and @supabase/ssr decodes them correctly. Deleting them causes the
    // user's valid session to vanish on every page load.
}
