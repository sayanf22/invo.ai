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

/** Scan localStorage and cookies for corrupted Supabase tokens and remove them. */
export function clearCorruptedAuthTokens() {
    if (typeof window === "undefined") return
    try {
        // Clear corrupted localStorage tokens
        Object.keys(localStorage)
            .filter(k => k.startsWith("sb-"))
            .forEach(k => {
                try {
                    const val = localStorage.getItem(k)
                    if (!val) return
                    // If the value contains URL-encoded characters, it's corrupted
                    if (val.includes("%")) {
                        console.warn("[auth] Removing corrupted localStorage token:", k)
                        localStorage.removeItem(k)
                    }
                } catch {
                    localStorage.removeItem(k)
                }
            })
    } catch {}

    // Also clear corrupted cookies (URL-encoded % chars are invalid Base64-URL)
    try {
        const past = "Thu, 01 Jan 1970 00:00:00 GMT"
        document.cookie.split(";").forEach(c => {
            const [rawName, ...rest] = c.trim().split("=")
            const name = rawName?.trim()
            if (!name?.startsWith("sb-") || !name.includes("-auth-token")) return
            const val = rest.join("=")
            if (val && val.includes("%")) {
                console.warn("[auth] Removing corrupted cookie token:", name)
                document.cookie = `${name}=;path=/;expires=${past};SameSite=Lax`
            }
        })
    } catch {}
}

/** Reset the singleton Supabase client. */
export function resetSupabaseClient() {
    supabaseInstance = null
}
