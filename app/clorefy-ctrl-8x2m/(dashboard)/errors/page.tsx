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
            `id, error_context, error_message, metadata, status, created_at, user_id,
             profiles:user_id (email, full_name)`,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1)

    const initialErrors = error ? [] : (errors ?? [])
    const initialTotal = error ? 0 : (count ?? 0)

    return (
        <ErrorsClient
            initialErrors={initialErrors as any}
            initialTotal={initialTotal}
        />
    )
}
