/**
 * Fetch API keys securely.
 * 
 * Priority order:
 * 1. In-memory cache (5 min TTL)
 * 2. Environment variable (process.env)
 * 3. Supabase Vault via authenticated RPC
 * 
 * SECURITY: The get_secret RPC requires an authenticated Supabase client.
 * Anon users cannot read secrets. The function is SECURITY DEFINER but
 * checks auth.role() and auth.uid() before returning any value.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get a secret value securely.
 * 
 * @param name - Secret name (e.g. "OPENAI_API_KEY")
 * @param supabase - Authenticated Supabase client (from auth.supabase in API routes)
 */
export async function getSecret(name: string, supabase?: SupabaseClient): Promise<string> {
    // 1. Check cache
    const cached = cache.get(name)
    if (cached && cached.expires > Date.now()) {
        return cached.value
    }

    // 2. Check environment variable
    const envValue = process.env[name]
    if (envValue && envValue.length > 5) {
        cache.set(name, { value: envValue, expires: Date.now() + CACHE_TTL })
        return envValue
    }

    // 3. Fetch from Supabase Vault (requires authenticated client)
    if (supabase) {
        try {
            const { data, error } = await supabase.rpc("get_secret", { secret_name: name })
            if (!error && data && typeof data === "string" && data.length > 0) {
                cache.set(name, { value: data, expires: Date.now() + CACHE_TTL })
                return data
            }
            if (error) {
                console.error(`[secrets] Vault error for ${name}:`, error.message)
            }
        } catch (err) {
            console.error(`[secrets] Vault exception for ${name}:`, err)
        }
    }

    return ""
}
