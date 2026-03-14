/**
 * Authenticated fetch helper for API calls.
 * Adds the Supabase access token as an Authorization header
 * so server-side auth works on Cloudflare Workers (where cookies may not be readable).
 */

import { createClient } from "@/lib/supabase"

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token

    const headers = new Headers(options.headers || {})
    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`)
    }
    // Ensure Content-Type is set for JSON requests
    if (!headers.has("Content-Type") && options.body) {
        headers.set("Content-Type", "application/json")
    }

    return fetch(url, { ...options, headers })
}
