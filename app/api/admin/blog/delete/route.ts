/**
 * DELETE /api/admin/blog/delete
 *
 * Permanently deletes a blog post — removes metadata from Supabase
 * and HTML content from R2.
 *
 * Body: { id: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { createClient } from "@supabase/supabase-js"
import { deleteObject } from "@/lib/r2"
import { revalidatePath } from "next/cache"

export const runtime = "nodejs"

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function DELETE(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.id) {
    return NextResponse.json({ error: "Missing required field: id" }, { status: 400 })
  }

  const supabase = getServiceClient()

  // Fetch the post to get the R2 key before deleting
  const { data: post, error: fetchErr } = await supabase
    .from("blog_posts")
    .select("id, slug, content_r2_key, status")
    .eq("id", body.id)
    .maybeSingle()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 })
  }

  // Delete R2 content (best effort — don't fail if already gone)
  if (post.content_r2_key) {
    await deleteObject(post.content_r2_key).catch((err) => {
      console.warn(`[blog.delete] R2 delete failed for ${post.content_r2_key}:`, err.message)
    })
  }

  // Delete metadata from Supabase
  const { error: deleteErr } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", body.id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  // Revalidate blog pages
  revalidatePath("/blog")
  revalidatePath(`/blog/${post.slug}`)

  console.log(`[blog.delete] admin=${adminEmail} slug=${post.slug}`)

  return NextResponse.json({ success: true, slug: post.slug })
}
