import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

let supabaseInstance: ReturnType<typeof createSupabaseClient<Database>> | null = null

/**
 * Cookie-based storage adapter for Supabase auth.
 * Stores auth tokens in cookies so server-side code can read them.
 * Also keeps localStorage as fallback.
 */
const cookieStorage = {
    getItem: (key: string): string | null => {
        if (typeof document === "undefined") return null
        const cookieVal = getCookie(key)
        if (cookieVal) return cookieVal
        try { return localStorage.getItem(key) } catch { return null }
    },
    setItem: (key: string, value: string): void => {
        if (typeof document === "undefined") return
        try { localStorage.setItem(key, value) } catch {}
        setCookieChunked(key, value)
    },
    removeItem: (key: string): void => {
        if (typeof document === "undefined") return
        try { localStorage.removeItem(key) } catch {}
        removeCookieChunked(key)
    },
}

const CHUNK_SIZE = 3500

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null
    const cookies = document.cookie.split(";").map(c => c.trim())
    const chunk0 = cookies.find(c => c.startsWith(`${name}.0=`))
    if (chunk0) {
        const chunks: string[] = []
        for (let i = 0; ; i++) {
            const chunk = cookies.find(c => c.startsWith(`${name}.${i}=`))
            if (!chunk) break
            chunks.push(chunk.split("=").slice(1).join("="))
        }
        return decodeURIComponent(chunks.join(""))
    }
    const base = cookies.find(c => c.startsWith(`${name}=`))
    if (base) return decodeURIComponent(base.split("=").slice(1).join("="))
    return null
}

function setCookieChunked(name: string, value: string): void {
    if (typeof document === "undefined") return
    removeCookieChunked(name)
    const encoded = encodeURIComponent(value)
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString()
    const opts = `path=/;expires=${expires};SameSite=Lax`
    if (encoded.length <= CHUNK_SIZE) {
        document.cookie = `${name}=${encoded};${opts}`
    } else {
        const count = Math.ceil(encoded.length / CHUNK_SIZE)
        for (let i = 0; i < count; i++) {
            document.cookie = `${name}.${i}=${encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)};${opts}`
        }
    }
}

function removeCookieChunked(name: string): void {
    if (typeof document === "undefined") return
    const past = "Thu, 01 Jan 1970 00:00:00 GMT"
    document.cookie = `${name}=;path=/;expires=${past}`
    for (let i = 0; i < 10; i++) {
        document.cookie = `${name}.${i}=;path=/;expires=${past}`
    }
}

export function createClient() {
    if (supabaseInstance) return supabaseInstance

    const isBrowser = typeof document !== "undefined"

    supabaseInstance = createSupabaseClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                ...(isBrowser ? { storage: cookieStorage } : {}),
            },
            global: {
                fetch: async (url, options) => {
                    const response = await fetch(url, options)
                    if (!response.ok && typeof url === "string" && url.includes("/auth/v1/token")) {
                        try {
                            const cloned = response.clone()
                            const body = await cloned.json()
                            if (body?.error_description?.includes("Refresh Token") || body?.error === "invalid_grant") {
                                clearAuthTokens()
                            }
                        } catch { /* ignore */ }
                    }
                    return response
                },
            },
        }
    )

    return supabaseInstance
}

/** Clear all Supabase auth tokens from localStorage and cookies. */
export function clearAuthTokens() {
    if (typeof document === "undefined") return
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith("sb-") && k.includes("-auth-token"))
            .forEach(k => {
                localStorage.removeItem(k)
                removeCookieChunked(k)
            })
    } catch {}
}
