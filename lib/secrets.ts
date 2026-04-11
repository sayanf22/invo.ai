/**
 * Secure secret management for Cloudflare Workers + OpenNext.
 * 
 * On Cloudflare Workers with OpenNext:
 * - wrangler.json vars → available as process.env
 * - Cloudflare Dashboard env vars → available as process.env
 * - wrangler secret put → available as Worker bindings (globalThis), NOT process.env
 * - .env files → available locally via next dev
 * 
 * Fallback: Supabase Vault via service_role key
 * All values cached in memory for 5 minutes.
 */

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000

export async function getSecret(name: string): Promise<string> {
    // 1. Check cache
    const cached = cache.get(name)
    if (cached && cached.expires > Date.now()) {
        return cached.value
    }

    // 2. Check process.env (Cloudflare dashboard vars, wrangler.json vars, local .env)
    const envValue = process.env[name]
    if (envValue && envValue.length > 5) {
        cache.set(name, { value: envValue, expires: Date.now() + CACHE_TTL })
        return envValue
    }

    // 3. Check Cloudflare Worker bindings (wrangler secret put values)
    try {
        const binding = (globalThis as any)[name]
        if (binding && typeof binding === "string" && binding.length > 5) {
            cache.set(name, { value: binding, expires: Date.now() + CACHE_TTL })
            return binding
        }
    } catch {}

    // 4. Try Supabase Vault via service_role
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
            || (typeof globalThis !== "undefined" ? (globalThis as any).SUPABASE_SERVICE_ROLE_KEY : undefined)
        if (url && serviceKey) {
            const { createClient } = await import("@supabase/supabase-js")
            const client = createClient(url, serviceKey)
            const { data, error } = await client.rpc("get_secret", { secret_name: name })
            if (!error && data && typeof data === "string" && data.length > 0) {
                cache.set(name, { value: data, expires: Date.now() + CACHE_TTL })
                return data
            }
        }
    } catch {}

    return ""
}
