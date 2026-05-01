import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import ErrorsClient from "./errors-client"

const PAGE_SIZE = 25

export default async function AdminErrorsPage() {
    await requireAdmin()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const { data: errors, count, error } = await supabase
        .from("error_logs")
        .select(
            `id, error_context, error_message, metadata, status, created_at, user_id`,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1)

    // Fetch profiles separately since error_logs has no FK to profiles
    let profilesMap: Record<string, { email: string | null; full_name: string | null }> = {}
    if (!error && errors && errors.length > 0) {
        const userIds = [...new Set(errors.map((e: any) => e.user_id).filter(Boolean))]
        if (userIds.length > 0) {
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, email, full_name")
                .in("id", userIds)
            for (const p of profiles ?? []) {
                profilesMap[p.id] = { email: p.email, full_name: p.full_name }
            }
        }
    }

    const initialErrors = error ? [] : (errors ?? []).map((e: any) => ({
        ...e,
        profiles: e.user_id ? (profilesMap[e.user_id] || null) : null,
    }))
    const initialTotal = error ? 0 : (count ?? 0)

    return (
        <ErrorsClient
            initialErrors={initialErrors as any}
            initialTotal={initialTotal}
        />
    )
}
