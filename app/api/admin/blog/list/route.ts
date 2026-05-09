/**
 * GET /api/admin/blog/list — list all blog posts (any status).
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { listAllPosts } from "@/lib/blog-storage"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") ?? undefined
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0

  try {
    const posts = await listAllPosts({ status, limit, offset })
    return NextResponse.json({ posts, count: posts.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
