/**
 * POST /api/cron/generate-blog
 *
 * Cron-triggered endpoint that pulls the next topic from the queue
 * and generates a blog post as a draft. Admin reviews before publishing.
 *
 * Auth: Invoked by Supabase pg_cron via pg_net.http_post(). The cron job
 * sends the x-cron-secret header which must match env CRON_SECRET.
 *
 * See migration blog_generation_cron_job for the schedule definition.
 *
 * Trigger: Once per day at 10:00 UTC. Safe to call multiple times — only
 * processes one pending topic per call.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { generateBlogPost } from "@/lib/blog-generator"
import { saveGeneratedPost } from "@/lib/blog-storage"

export const runtime = "nodejs"
export const maxDuration = 60

interface QueueRow {
  id: string
  topic: string
  primary_keyword: string
  context: string | null
  category: string
  hub: string | null
  target_country: string | null
  attempts: number
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials")
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isAuthorized(request: NextRequest): boolean {
  // Invoked by Supabase pg_cron via pg_net.http_post. pg_cron sends the
  // x-cron-secret header we defined in the cron schedule SQL.
  const secret = request.headers.get("x-cron-secret")
  const envSecret = process.env.CRON_SECRET
  if (!envSecret) return false
  return secret === envSecret
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getServiceClient()

  // Pick next pending topic (highest priority, oldest first)
  const { data: topics, error: fetchErr } = await supabase
    .from("blog_topic_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)

  if (fetchErr) {
    return NextResponse.json(
      { error: `Failed to fetch queue: ${fetchErr.message}` },
      { status: 500 }
    )
  }

  if (!topics || topics.length === 0) {
    return NextResponse.json({ success: true, message: "No pending topics", generated: 0 })
  }

  const topic = topics[0] as QueueRow

  // Mark as generating to prevent concurrent runs
  await supabase
    .from("blog_topic_queue")
    .update({
      status: "generating",
      attempts: topic.attempts + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq("id", topic.id)

  try {
    // Generate article
    const generated = await generateBlogPost({
      topic: topic.topic,
      primaryKeyword: topic.primary_keyword,
      category: topic.category as "guides" | "templates" | "country" | "tips" | "comparisons" | "news",
      context: topic.context ?? undefined,
      targetCountry: topic.target_country ?? undefined,
      hub: topic.hub ?? undefined,
    })

    // Save post as draft (admin reviews before publishing)
    const saved = await saveGeneratedPost(generated, {
      category: topic.category,
      hub: topic.hub ?? undefined,
      status: "draft",
    })

    // Mark topic as generated
    await supabase
      .from("blog_topic_queue")
      .update({
        status: "generated",
        generated_post_id: saved.id,
      })
      .eq("id", topic.id)

    console.log(
      `[cron.generate-blog] topic=${topic.id} slug=${saved.slug} words=${saved.wordCount} cost=$${generated.costUsd.toFixed(6)}`
    )

    return NextResponse.json({
      success: true,
      generated: 1,
      post: {
        id: saved.id,
        slug: saved.slug,
        title: saved.title,
        wordCount: saved.wordCount,
      },
      cost: generated.costUsd,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    await supabase
      .from("blog_topic_queue")
      .update({
        status: topic.attempts >= 2 ? "failed" : "pending",
        error_message: message.slice(0, 500),
      })
      .eq("id", topic.id)

    console.error(`[cron.generate-blog] FAILED topic=${topic.id}: ${message}`)
    return NextResponse.json(
      { error: `Generation failed: ${message}`, topicId: topic.id },
      { status: 500 }
    )
  }
}
