/**
 * POST /api/admin/blog/generate
 *
 * Manually generate a blog post from a topic. Saves as draft by default.
 * Admin-only. Uses Amazon Bedrock Nova Lite.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyAdminSession } from "@/lib/admin-auth"
import { generateBlogPost, type BlogGenerationInput } from "@/lib/blog-generator"
import { saveGeneratedPost } from "@/lib/blog-storage"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const adminEmail = await verifyAdminSession(request)
  if (!adminEmail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: Partial<BlogGenerationInput> & { publishNow?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body.topic || !body.primaryKeyword || !body.category) {
    return NextResponse.json(
      { error: "Missing required fields: topic, primaryKeyword, category" },
      { status: 400 }
    )
  }

  try {
    const generated = await generateBlogPost({
      topic: body.topic,
      primaryKeyword: body.primaryKeyword,
      category: body.category,
      context: body.context,
      targetCountry: body.targetCountry,
      hub: body.hub,
      relatedSlugs: body.relatedSlugs,
      relatedToolPages: body.relatedToolPages,
    })

    const saved = await saveGeneratedPost(generated, {
      category: body.category,
      hub: body.hub,
      relatedSlugs: body.relatedSlugs,
      relatedToolPages: body.relatedToolPages,
      status: body.publishNow ? "published" : "draft",
    })

    console.log(`[blog.generate] admin=${adminEmail} slug=${saved.slug} words=${saved.wordCount} cost=$${generated.costUsd.toFixed(6)}`)

    return NextResponse.json({
      success: true,
      post: {
        id: saved.id,
        slug: saved.slug,
        title: saved.title,
        status: saved.status,
        wordCount: saved.wordCount,
        readTimeMinutes: saved.readTimeMinutes,
      },
      generation: {
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
        costUsd: generated.costUsd,
        modelId: generated.modelId,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    )
  }
}
