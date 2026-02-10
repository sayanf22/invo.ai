import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null

export function createClient() {
    if (supabaseInstance) {
        return supabaseInstance
    }

    supabaseInstance = createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    return supabaseInstance
}

// Default export for convenience
export const supabase = createClient()
