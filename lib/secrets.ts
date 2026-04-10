/**
 * Fetch API keys from Supabase Vault.
 * Falls back to environment variables if Vault is unavailable.
 * Caches secrets in memory for 5 minutes to avoid repeated DB calls.
 */

import { createClient } from "@supabase/supabase-js"

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function fetchFromVault(name: string): Promise<string | null> {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const { data, error } = await (supabase.rpc as any)("get_secret", { secret_name: name })

        if (error || !data) return null
        return data as string
    } catch {
        return null
    }
}

export async function getSecret(name: string): Promise<string> {
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

    // Try Supabase Vault
    const vaultValue = await fetchFromVault(name)
    if (vaultValue) {
        cache.set(name, { value: vaultValue, expires: Date.now() + CACHE_TTL })
        return vaultValue
    }

    return ""
}
