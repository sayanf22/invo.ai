import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import SupportClient from "./support-client"

const PAGE_SIZE = 25

export default async function AdminSupportPage() {
    await requireAdmin()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const { data: messages, count, error } = await supabase
        .from("support_messages")
        .select(
            `id, message, status, admin_notes, onboarding_phase, metadata, created_at, updated_at, user_id,
             profiles:user_id (email, full_name)`,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1)

    const initialMessages = error ? [] : (messages ?? [])
    const initialTotal = error ? 0 : (count ?? 0)

    return (
        <SupportClient
            initialMessages={initialMessages as any}
            initialTotal={initialTotal}
        />
    )
}
