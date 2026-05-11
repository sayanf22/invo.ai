import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

/**
 * Create a Supabase client for browser use.
 * 
 * Uses @supabase/ssr's createBrowserClient which handles cookie reading/writing
 * in a format compatible with the server-side @supabase/ssr createServerClient.
 * This ensures OAuth sessions set by the server callback are readable client-side.
 */
export function createClient() {
    if (supabaseInstance) return supabaseInstance

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

/** Reset the singleton Supabase client. */
export function resetSupabaseClient() {
    supabaseInstance = null
}
