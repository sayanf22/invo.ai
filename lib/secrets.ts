/**
 * Secure secret management.
 * 
 * On Cloudflare Workers: secrets set via `wrangler secret put` are available as process.env
 * On local dev: secrets come from .env file
 * Fallback: Supabase Vault via service_role (if SUPABASE_SERVICE_ROLE_KEY is set)
 * 
 * All secrets are cached in memory for 5 minutes.
 */

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function getSecret(name: string): Promise<string> {
    // 1. Check cache
    const cached = cache.get(name)
    if (cached && cached.expires > Date.now()) {
        return cached.value
    }

    // 2. Check process.env (covers both Cloudflare secrets and local .env)
    const envValue = process.env[name]
    if (envValue && envValue.length > 5) {
        cache.set(name, { value: envValue, expires: Date.now() + CACHE_TTL })
        return envValue
    }

    // 3. Try Supabase Vault as last resort
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (url && serviceKey) {
            const { createClient } = await import("@supabase/supabase-js")
            const client = createClient(url, serviceKey)
            const { data, error } = await client.rpc("get_secret", { secret_name: name })
            if (!error && data && typeof data === "string" && data.length > 0) {
                cache.set(name, { value: data, expires: Date.now() + CACHE_TTL })
                return data
            }
        }
    } catch {
        // Vault unavailable — continue
    }

    return ""
}
