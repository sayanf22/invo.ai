/**
 * Admin Support Messages API
 * GET  /api/admin/support — List support messages with filters, search, pagination
 * PATCH /api/admin/support — Update message status and/or admin notes
 *
 * Auth: verifyAdminSession() on both handlers
 * Uses service role client to bypass RLS.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4
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

// ── GET: Paginated support messages with filters ───────────────────────

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || undefined
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
          messages: [],
          total: 0,
          page,
          pageSize: PAGE_SIZE,
        })
      }
      userIdFilter = ids
    }

    // Build the main query with count
    let query = supabase
      .from("support_messages")
      .select(
        `id, message, status, admin_notes, onboarding_phase, metadata, created_at, updated_at, user_id,
         profiles:user_id (email, full_name)`,
        { count: "exact" }
      )

    // Apply status filter
    if (status) {
      query = query.eq("status", status)
    }

    // Apply email search filter (resolved to user IDs above)
    if (userIdFilter) {
      query = query.in("user_id", userIdFilter)
    }

    // Sort by created_at DESC (newest first) and paginate
    query = query.order("created_at", { ascending: false }).range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error("[admin/support] GET error:", error.message)
      return NextResponse.json(
        { error: "Failed to fetch support messages" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      messages: data ?? [],
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    })
  } catch (err) {
    console.error("[admin/support] Unexpected GET error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// ── PATCH: Update support message status and/or admin notes ────────────

export async function PATCH(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { id, status, admin_notes } = body as {
      id?: string
      status?: string
      admin_notes?: string
    }

    // Validate required id
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 }
      )
    }

    // Validate at least one field to update
    if (status === undefined && admin_notes === undefined) {
      return NextResponse.json(
        { error: "At least one of status or admin_notes must be provided" },
        { status: 400 }
      )
    }

    // Validate status value if provided
    const validStatuses = ["unread", "read", "resolved"]
    if (status !== undefined && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Validate admin_notes type if provided
    if (admin_notes !== undefined && typeof admin_notes !== "string") {
      return NextResponse.json(
        { error: "admin_notes must be a string" },
        { status: 400 }
      )
    }

    const supabase = getServiceClient()

    // Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (status !== undefined) updatePayload.status = status
    if (admin_notes !== undefined) updatePayload.admin_notes = admin_notes

    const { data, error } = await supabase
      .from("support_messages")
      .update(updatePayload)
      .eq("id", id)
      .select(
        `id, message, status, admin_notes, onboarding_phase, metadata, created_at, updated_at, user_id,
         profiles:user_id (email, full_name)`
      )
      .single()

    if (error) {
      console.error("[admin/support] PATCH error:", error.message)
      // Check if it's a not-found error
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Support message not found" },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: "Failed to update support message" },
        { status: 500 }
      )
    }

    // When resolving, send a thank-you notification to the user
    if (status === 'resolved' && data?.user_id) {
      const originalMessage = data.message?.length > 80
        ? data.message.substring(0, 80) + '...'
        : data.message

      await supabase.from("notifications").insert({
        user_id: data.user_id,
        type: 'support_resolved',
        title: 'Your feedback has been reviewed',
        message: `Thank you for your feedback: "${originalMessage}". Your input helps us improve Clorefy. Keep sharing your thoughts with us!`,
        metadata: { support_message_id: id },
      }).then(() => {}).catch(() => {}) // fire-and-forget, don't block the response
    }

    return NextResponse.json({ message: data })
  } catch (err) {
    console.error("[admin/support] Unexpected PATCH error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
