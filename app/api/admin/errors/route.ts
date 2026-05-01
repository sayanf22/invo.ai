/**
 * Admin Error Logs API
 * GET /api/admin/errors — List error logs with context filtering, email search, pagination
 *
 * Auth: verifyAdminSession() on the handler
 * Uses service role client to bypass RLS.
 *
 * Requirements: 8.1, 8.2, 8.3, 11.1, 11.2, 11.3, 11.4
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"

const PAGE_SIZE = 25

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ── GET: Paginated error logs with context filtering and email search ──

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const contextFilter = searchParams.get("context_filter") || "all"
    const search = searchParams.get("search") || undefined
    const page = Math.max(1, Number(searchParams.get("page")) || 1)

    const supabase = getServiceClient()
    const from = (page - 1) * PAGE_SIZE
    const to = page * PAGE_SIZE - 1

    // If searching by email, resolve matching user IDs first
    // because Supabase PostgREST ilike on joined columns can be unreliable
    let userIdFilter: string[] | undefined
    if (search) {
      const { data: matchedProfiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", `%${search}%`)

      const ids = (matchedProfiles ?? []).map((p: any) => p.id)
      if (ids.length === 0) {
        // No matching users — return empty result
        return NextResponse.json({
          errors: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
        })
      }
      userIdFilter = ids
    }

    // Build the main query with count
    let query = supabase
      .from("error_logs")
      .select(
        `id, error_context, error_message, metadata, status, created_at, user_id,
         profiles:user_id (email, full_name)`,
        { count: "exact" }
      )

    // Apply context filter using filterErrorsByContext logic at the DB level
    const filterLower = contextFilter.toLowerCase()
    if (filterLower !== "all") {
      if (filterLower === "non-onboarding") {
        query = query.not("error_context", "like", "onboarding%")
      } else if (filterLower === "upload") {
        query = query.like("error_context", "onboarding_upload%")
      } else if (filterLower === "chat") {
        query = query.like("error_context", "%onboarding_chat%")
      } else if (filterLower === "logo") {
        query = query.like("error_context", "onboarding_logo%")
      } else if (filterLower === "payments") {
        query = query.like("error_context", "onboarding_payments%")
      }
    }

    // Apply email search filter (resolved to user IDs above)
    if (userIdFilter) {
      query = query.in("user_id", userIdFilter)
    }

    // Sort by created_at DESC (newest first) and paginate
    query = query.order("created_at", { ascending: false }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error("[admin/errors] GET error:", error.message)
      return NextResponse.json(
        { error: "Failed to fetch error logs" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      errors: data ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error("[admin/errors] Unexpected GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
