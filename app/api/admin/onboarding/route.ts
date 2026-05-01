/**
 * Admin Onboarding Tracking API
 * GET /api/admin/onboarding — Paginated onboarding progress with filters
 *
 * Auth: verifyAdminSession() on all handlers
 * Uses service role client to bypass RLS.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import {
  computeOnboardingStatus,
  getFieldCompletion,
  applyOnboardingFilters,
} from "@/lib/onboarding-utils"
import type { OnboardingRecord } from "@/lib/onboarding-utils"

const PAGE_SIZE = 25

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET: Paginated onboarding progress with filters ────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "all"
    const phase = searchParams.get("phase") || "all"
    const errors = searchParams.get("errors") || "all"
    const search = searchParams.get("search") || ""
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const supabase = getServiceClient()

    // 1. Fetch all profiles with left-joined onboarding_progress and businesses
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        onboarding_complete,
        last_active_at,
        created_at,
        tier
      `)
      .order("created_at", { ascending: false })

    if (profilesError) {
      console.error("[admin/onboarding] profiles fetch error:", profilesError.message)
      return NextResponse.json(
        { error: "Failed to fetch profiles" },
        { status: 500 }
      )
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({
        users: [],
        total: 0,
        page,
        pageSize: PAGE_SIZE,
      })
    }

    const userIds = profiles.map((p: any) => p.id)

    // 2. Fetch onboarding_progress for all users
    const { data: progressRecords, error: progressError } = await supabase
      .from("onboarding_progress")
      .select(`
        user_id,
        current_phase,
        used_extraction,
        fields_completed,
        upload_started_at,
        chat_started_at,
        logo_started_at,
        payments_started_at,
        completed_at,
        updated_at
      `)
      .in("user_id", userIds)

    if (progressError) {
      console.error("[admin/onboarding] progress fetch error:", progressError.message)
      return NextResponse.json(
        { error: "Failed to fetch onboarding progress" },
        { status: 500 }
      )
    }

    // 3. Fetch businesses for all users (for field completion)
    const { data: businesses, error: businessesError } = await supabase
      .from("businesses")
      .select(`
        user_id,
        business_type,
        country,
        name,
        owner_name,
        email,
        phone,
        address,
        tax_ids,
        additional_notes,
        client_countries,
        default_currency,
        payment_methods
      `)
      .in("user_id", userIds)

    if (businessesError) {
      console.error("[admin/onboarding] businesses fetch error:", businessesError.message)
      return NextResponse.json(
        { error: "Failed to fetch business data" },
        { status: 500 }
      )
    }

    // 4. If error filter is active, fetch user IDs that have onboarding errors
    let userIdsWithErrors: Set<string> | null = null
    if (errors !== "all") {
      const { data: errorLogs, error: errorLogsError } = await supabase
        .from("error_logs")
        .select("user_id")
        .like("error_context", "onboarding%")

      if (errorLogsError) {
        console.error("[admin/onboarding] error_logs fetch error:", errorLogsError.message)
        return NextResponse.json(
          { error: "Failed to fetch error logs" },
          { status: 500 }
        )
      }

      userIdsWithErrors = new Set(
        (errorLogs ?? [])
          .map((e: any) => e.user_id)
          .filter(Boolean)
      )
    }

    // 5. Fetch additional analytics data in batch
    const { data: sessionRows } = await supabase
      .from("document_sessions")
      .select("user_id")
      .in("user_id", userIds)

    const { data: genRows } = await supabase
      .from("generation_history")
      .select("user_id")
      .eq("success", true)
      .in("user_id", userIds)

    const { data: emailRows } = await supabase
      .from("document_emails")
      .select("user_id")
      .in("user_id", userIds)

    const { data: messageRows } = await supabase
      .from("chat_messages")
      .select("session_id, document_sessions!inner(user_id)")
      .in("document_sessions.user_id", userIds)

    // Build count maps for analytics
    const sessionCountMap = new Map<string, number>()
    for (const r of sessionRows ?? []) {
      sessionCountMap.set(r.user_id, (sessionCountMap.get(r.user_id) || 0) + 1)
    }

    const genCountMap = new Map<string, number>()
    for (const r of genRows ?? []) {
      genCountMap.set(r.user_id, (genCountMap.get(r.user_id) || 0) + 1)
    }

    const emailCountMap = new Map<string, number>()
    for (const r of emailRows ?? []) {
      emailCountMap.set(r.user_id, (emailCountMap.get(r.user_id) || 0) + 1)
    }

    const messageCountMap = new Map<string, number>()
    for (const r of messageRows ?? []) {
      const uid = (r as any).document_sessions?.user_id
      if (uid) messageCountMap.set(uid, (messageCountMap.get(uid) || 0) + 1)
    }

    // Build lookup maps
    const progressMap = new Map<string, any>()
    for (const p of progressRecords ?? []) {
      progressMap.set(p.user_id, p)
    }

    const businessMap = new Map<string, any>()
    for (const b of businesses ?? []) {
      if (b.user_id) businessMap.set(b.user_id, b)
    }

    // 6. Compute onboarding_status and fields_completed for each user
    const enrichedUsers: (OnboardingRecord & Record<string, any>)[] = profiles.map((profile: any) => {
      const progress = progressMap.get(profile.id) || null
      const business = businessMap.get(profile.id) || null

      const onboarding_status = computeOnboardingStatus(
        {
          onboarding_complete: profile.onboarding_complete ?? false,
          last_active_at: profile.last_active_at,
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
        ? getFieldCompletion(business)
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
        has_errors: userIdsWithErrors ? userIdsWithErrors.has(profile.id) : undefined,
        upload_started_at: progress?.upload_started_at || null,
        chat_started_at: progress?.chat_started_at || null,
        logo_started_at: progress?.logo_started_at || null,
        payments_started_at: progress?.payments_started_at || null,
        completed_at: progress?.completed_at || null,
        total_sessions: sessionCountMap.get(profile.id) || 0,
        total_generations: genCountMap.get(profile.id) || 0,
        total_emails_sent: emailCountMap.get(profile.id) || 0,
        total_messages: messageCountMap.get(profile.id) || 0,
        tier: profile.tier ?? null,
        signed_up_at: profile.created_at ?? null,
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

    // 7. Apply all filters using shared utility functions (AND logic)
    const filtered = applyOnboardingFilters(enrichedUsers, {
      status,
      phase,
      errors,
      search,
    })

    // 7. Paginate the filtered results
    const total = filtered.length
    const from = (page - 1) * PAGE_SIZE
    const paginated = filtered.slice(from, from + PAGE_SIZE)

    return NextResponse.json({
      users: paginated,
      total,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error("[admin/onboarding] Unexpected GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
