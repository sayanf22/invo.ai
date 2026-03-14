import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createClient() {
    if (supabaseInstance) {
        return supabaseInstance
    }

    supabaseInstance = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
            global: {
                fetch: async (url, options) => {
                    const response = await fetch(url, options)
                    // If token refresh returns 400 (invalid/expired), clear tokens immediately
                    // to prevent the retry loop that causes console errors
                    if (!response.ok && typeof url === 'string' && url.includes('/auth/v1/token')) {
                        try {
                            const cloned = response.clone()
                            const body = await cloned.json()
                            if (body?.error_description?.includes('Refresh Token') || body?.error === 'invalid_grant') {
                                clearAuthTokens()
                            }
                        } catch { /* ignore parse errors */ }
                    }
                    return response
                },
            },
        }
    )

    return supabaseInstance
}

/**
 * Clear all Supabase auth tokens from localStorage.
 * Call this when token refresh fails to stop the retry loop.
 */
export function clearAuthTokens() {
    if (typeof window === "undefined") return
    try {
        const keysToRemove = Object.keys(localStorage).filter(
            (k) => k.startsWith("sb-") && k.includes("-auth-token")
        )
        keysToRemove.forEach((k) => localStorage.removeItem(k))
    } catch {
        // localStorage may be unavailable
    }
}

// Default export for convenience
export const supabase = createClient()
