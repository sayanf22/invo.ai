import { requireAdmin } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import {
    computeOnboardingStatus,
    getFieldCompletion,
} from "@/lib/onboarding-utils"
import OnboardingTrackingClient from "./onboarding-client"

const PAGE_SIZE = 25

export default async function AdminOnboardingPage() {
    await requireAdmin()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

    // 1. Fetch profiles
    const { data: profiles, count: profileCount, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name, onboarding_complete, last_active_at, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1)

    if (profilesError || !profiles || profiles.length === 0) {
        return (
            <OnboardingTrackingClient
                initialUsers={[]}
                initialTotal={0}
            />
        )
    }

    const userIds = profiles.map((p) => p.id)

    // 2. Fetch onboarding_progress for these users
    const { data: progressRecords } = await supabase
        .from("onboarding_progress")
        .select(
            "user_id, current_phase, used_extraction, fields_completed, upload_started_at, chat_started_at, logo_started_at, payments_started_at, completed_at, updated_at"
        )
        .in("user_id", userIds)

    // 3. Fetch businesses for field completion
    const { data: businesses } = await supabase
        .from("businesses")
        .select(
            "user_id, business_type, country, name, owner_name, email, phone, address, tax_ids, additional_notes, client_countries, default_currency, payment_methods"
        )
        .in("user_id", userIds)

    // Build lookup maps
    const progressMap = new Map<string, (typeof progressRecords extends (infer T)[] | null ? T : never)>()
    for (const p of progressRecords ?? []) {
        if (p.user_id) progressMap.set(p.user_id, p)
    }

    const businessMap = new Map<string, (typeof businesses extends (infer T)[] | null ? T : never)>()
    for (const b of businesses ?? []) {
        if (b.user_id) businessMap.set(b.user_id, b)
    }

    // 4. Compute onboarding status and field completion for each user
    const initialUsers = profiles.map((profile) => {
        const progress = progressMap.get(profile.id) || null
        const business = businessMap.get(profile.id) || null

        const onboarding_status = computeOnboardingStatus(
            {
                onboarding_complete: profile.onboarding_complete ?? false,
                last_active_at: profile.last_active_at ?? null,
            },
            progress
                ? {
                    current_phase: progress.current_phase,
                    completed_at: progress.completed_at,
                    updated_at: progress.updated_at,
                }
                : null
        )

        const fieldCompletion = business
            ? getFieldCompletion(business as any)
            : { fields: {}, count: 0 }

        return {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            onboarding_status,
            current_phase: progress?.current_phase || null,
            fields_completed: fieldCompletion.count,
            field_details: fieldCompletion.fields,
            used_extraction: progress?.used_extraction ?? false,
            last_active_at: profile.last_active_at || progress?.updated_at || profile.created_at,
            upload_started_at: progress?.upload_started_at || null,
            chat_started_at: progress?.chat_started_at || null,
            logo_started_at: progress?.logo_started_at || null,
            payments_started_at: progress?.payments_started_at || null,
            completed_at: progress?.completed_at || null,
            business_data: business
                ? {
                    business_type: business.business_type ?? null,
                    country: business.country ?? null,
                    name: business.name ?? null,
                    owner_name: business.owner_name ?? null,
                    email: business.email ?? null,
                    phone: business.phone ?? null,
                    address: business.address ?? null,
                    tax_ids: business.tax_ids ?? null,
                    additional_notes: business.additional_notes ?? null,
                    client_countries: business.client_countries ?? null,
                    default_currency: business.default_currency ?? null,
                    payment_methods: business.payment_methods ?? null,
                }
                : null,
        }
    })

    const initialTotal = profileCount ?? profiles.length

    return (
        <OnboardingTrackingClient
            initialUsers={initialUsers}
            initialTotal={initialTotal}
        />
    )
}
