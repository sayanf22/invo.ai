/**
 * POST /api/admin/blog/publish — change post status (draft → review → published → archived).
 * Admin-only.
 *
 * Body: { id: string, status: "draft" | "review" | "published" | "archived" }
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { updatePostStatus } from "@/lib/blog-storage"
import { revalidatePath } from "next/cache"

export const runtime = "nodejs"

const VALID_STATUSES = ["draft", "review", "published", "archived"] as const
type ValidStatus = typeof VALID_STATUSES[number]

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: { id?: string; status?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.id || !body.status) {
    return NextResponse.json(
      { error: "Missing required fields: id, status" },
      { status: 400 }
    )
  }

  if (!VALID_STATUSES.includes(body.status as ValidStatus)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    )
  }

  try {
    const post = await updatePostStatus(body.id, body.status as ValidStatus)

    // Revalidate blog pages so the change shows up immediately
    if (body.status === "published") {
      revalidatePath("/blog")
      revalidatePath(`/blog/${post.slug}`)
    }

    console.log(`[blog.publish] admin=${adminEmail} slug=${post.slug} status=${post.status}`)

    return NextResponse.json({ success: true, post })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
