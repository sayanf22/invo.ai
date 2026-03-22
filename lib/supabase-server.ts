import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "./database.types"

export async function createServerSupabaseClient() {
    const cookieStore = await cookies()

    // Read the Supabase auth token from cookies
    const allCookies = cookieStore.getAll()
    const authCookies = allCookies.filter(c => c.name.startsWith("sb-") && c.name.includes("-auth-token"))

    // Reconstruct the auth token from chunked cookies
    let accessToken: string | undefined
    if (authCookies.length > 0) {
        // Supabase stores auth as JSON in cookies (may be chunked)
        const baseName = authCookies[0].name.replace(/\.\d+$/, "")
        const chunks = allCookies
            .filter(c => c.name === baseName || c.name.startsWith(baseName + "."))
            .sort((a, b) => {
                const aIdx = a.name.includes(".") ? parseInt(a.name.split(".").pop()!) : 0
                const bIdx = b.name.includes(".") ? parseInt(b.name.split(".").pop()!) : 0
                return aIdx - bIdx
            })
            .map(c => c.value)
            .join("")

        try {
            // Handle base64-prefixed cookies (from @supabase/ssr or newer client versions)
            let decoded = chunks
            if (decoded.startsWith("base64-")) {
                try {
                    decoded = atob(decoded.slice(7))
                } catch {
                    // Not valid base64, try as-is
                }
            }
            const parsed = JSON.parse(decoded)
            accessToken = parsed.access_token
        } catch {
            // Cookie parse failed
        }
    }

    const supabase = createClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
            },
        }
    )

    return supabase
}

// Helper to get current user on server
export async function getServerUser() {
    const supabase = await createServerSupabaseClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    return user
}

// Helper to get current session on server
export async function getServerSession() {
    const supabase = await createServerSupabaseClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return session
}
