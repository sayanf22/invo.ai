/**
 * Secure secret management.
 * 
 * Priority: cache → env var → Supabase Vault (via service role)
 * 
 * SECURITY: Vault access uses the service_role key, NOT the anon key.
 * The get_secret RPC is restricted to service_role only — anon and
 * authenticated users cannot call it. This prevents any client-side
 * access to API keys.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const cache = new Map<string, { value: string; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

let serviceClient: SupabaseClient | null = null

function getServiceClient(): SupabaseClient | null {
    if (serviceClient) return serviceClient

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) return null

    serviceClient = createClient(url, serviceKey)
    return serviceClient
}

/**
 * Get a secret value securely.
 * 
 * @param name - Secret name (e.g. "OPENAI_API_KEY")
 */
export async function getSecret(name: string): Promise<string> {
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

    // 3. Fetch from Supabase Vault via service role
    const client = getServiceClient()
    if (client) {
        try {
            const { data, error } = await client.rpc("get_secret", { secret_name: name })
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
