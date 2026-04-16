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

/** Reset the singleton Supabase client. */
export function resetSupabaseClient() {
    supabaseInstance = null
}
