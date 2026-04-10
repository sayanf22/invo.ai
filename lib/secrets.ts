/**
 * Fetch API keys from Supabase Vault.
 * Falls back to environment variables if Vault is unavailable.
 * Caches secrets in memory for 5 minutes to avoid repeated DB calls.
 * 
 * The get_secret RPC requires an authenticated Supabase client.
 * Pass the auth.supabase client from API routes for Vault access.
 */

import { SupabaseClient } from "@supabase/supabase-js"

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchFromVault(name: string, supabase?: SupabaseClient): Promise<string | null> {
    if (!supabase) return null

    try {
        const { data, error } = await supabase.rpc("get_secret", { secret_name: name })

        if (error) {
            console.error(`Vault fetch error for ${name}:`, error.message)
            return null
        }
        if (!data) return null
        return data as string
    } catch (err) {
        console.error(`Vault fetch exception for ${name}:`, err)
        return null
    }
}

/**
 * Get a secret value. Checks in order:
 * 1. In-memory cache
 * 2. Environment variable (process.env)
 * 3. Supabase Vault (requires authenticated client)
 * 
 * @param name - Secret name (e.g. "OPENAI_API_KEY")
 * @param supabase - Optional authenticated Supabase client for Vault access
 */
export async function getSecret(name: string, supabase?: SupabaseClient): Promise<string> {
    // Check cache first
    const cached = cache.get(name)
    if (cached && cached.expires > Date.now()) {
        return cached.value
    }

    // Try environment variable first (fastest)
    const envValue = process.env[name]
    if (envValue) {
        cache.set(name, { value: envValue, expires: Date.now() + CACHE_TTL })
        return envValue
    }

    // Try Supabase Vault (requires authenticated client)
    const vaultValue = await fetchFromVault(name, supabase)
    if (vaultValue) {
        cache.set(name, { value: vaultValue, expires: Date.now() + CACHE_TTL })
        return vaultValue
    }

    return ""
}
