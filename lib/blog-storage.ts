/**
 * Blog storage service.
 *
 * Hybrid storage strategy:
 * - Metadata → Supabase (fast indexed queries for listings, filters, related posts)
 * - Full HTML content → Cloudflare R2 (cheap, CDN-backed, keeps Postgres small)
 *
 * This keeps the Postgres database under 500MB (Supabase free tier limit)
 * even with thousands of long-form articles.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { uploadToR2, getObject, deleteObject } from "@/lib/r2"
import type { BlogGenerationOutput } from "@/lib/blog-generator"

const CONTENT_PREFIX = "blog-content"

/**
 * Create a service-role Supabase client for server-side admin operations.
 * This bypasses RLS — only use in trusted server contexts (API routes, cron jobs).
 */
function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export interface StoredBlogPost {
  id: string
  slug: string
  title: string
  description: string
  keyword: string
  category: string
  hub: string | null
  excerpt: string
  readTimeMinutes: number
  wordCount: number
  status: "draft" | "review" | "published" | "archived"
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  generatedBy: "human" | "ai"
  aiModel: string | null
  relatedSlugs: string[]
  relatedToolPages: string[]
  viewCount: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface StoredBlogPostWithContent extends StoredBlogPost {
  content: string
}

function contentKey(slug: string): string {
  return `${CONTENT_PREFIX}/${slug}.html`
}

/**
 * Save a generated blog post:
 * 1. Upload HTML content to R2
 * 2. Insert metadata row in Supabase
 */
export async function saveGeneratedPost(
  generated: BlogGenerationOutput,
  options: {
    category: string
    hub?: string
    relatedSlugs?: string[]
    relatedToolPages?: string[]
    status?: "draft" | "review" | "published"
  }
): Promise<StoredBlogPost> {
  const supabase = getServiceClient()
  const r2Key = contentKey(generated.slug)

  // 1. Upload content to R2
  const contentBytes = new TextEncoder().encode(generated.content)
  await uploadToR2(r2Key, contentBytes.buffer as ArrayBuffer, "text/html; charset=utf-8")

  // 2. Insert metadata
  const status = options.status ?? "draft"
  const { data, error } = await supabase
    .from("blog_posts")
    .insert({
      slug: generated.slug,
      title: generated.title,
      description: generated.description,
      keyword: generated.keyword,
      category: options.category,
      hub: options.hub ?? null,
      content_r2_key: r2Key,
      excerpt: generated.excerpt,
      read_time_minutes: generated.readTimeMinutes,
      word_count: generated.wordCount,
      status,
      meta_title: generated.metaTitle,
      meta_description: generated.metaDescription,
      generated_by: "ai",
      ai_model: generated.modelId,
      ai_cost_usd: generated.costUsd,
      related_slugs: options.relatedSlugs ?? [],
      related_tool_pages: options.relatedToolPages ?? [],
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select()
    .single()

  if (error) {
    // Clean up orphaned R2 object on failure
    await deleteObject(r2Key).catch(() => {})
    throw new Error(`Failed to save blog post metadata: ${error.message}`)
  }

  return mapRow(data)
}

/**
 * Fetch a single post (metadata only) by slug.
 */
export async function getPostMetadataBySlug(slug: string): Promise<StoredBlogPost | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch post: ${error.message}`)
  if (!data) return null
  return mapRow(data)
}

/**
 * Fetch a single post with full content (reads from R2).
 */
export async function getPostWithContent(slug: string): Promise<StoredBlogPostWithContent | null> {
  const meta = await getPostMetadataBySlug(slug)
  if (!meta) return null

  // Legacy posts without R2 content
  if (!meta["id"]) return null
  const contentRow = await getContentForPost(meta)
  return { ...meta, content: contentRow }
}

async function getContentForPost(meta: StoredBlogPost): Promise<string> {
  const key = contentKey(meta.slug)
  const obj = await getObject(key)
  if (!obj) return ""
  return new TextDecoder().decode(obj.body)
}

/**
 * List published posts (metadata only) for listings.
 */
export async function listPublishedPosts(opts: {
  limit?: number
  offset?: number
  category?: string
  hub?: string
} = {}): Promise<StoredBlogPost[]> {
  const supabase = getServiceClient()
  let query = supabase
    .from("blog_posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })

  if (opts.category) query = query.eq("category", opts.category)
  if (opts.hub) query = query.eq("hub", opts.hub)
  if (opts.limit) query = query.limit(opts.limit)
  if (opts.offset) query = query.range(opts.offset, (opts.offset + (opts.limit ?? 20)) - 1)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list posts: ${error.message}`)
  return (data ?? []).map(mapRow)
}

/**
 * Admin-only: list all posts regardless of status.
 */
export async function listAllPosts(opts: {
  limit?: number
  offset?: number
  status?: string
} = {}): Promise<StoredBlogPost[]> {
  const supabase = getServiceClient()
  let query = supabase
    .from("blog_posts")
    .select("*")
    .order("created_at", { ascending: false })

  if (opts.status) query = query.eq("status", opts.status)
  if (opts.limit) query = query.limit(opts.limit)
  if (opts.offset) query = query.range(opts.offset, (opts.offset + (opts.limit ?? 20)) - 1)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list posts: ${error.message}`)
  return (data ?? []).map(mapRow)
}

/**
 * Change the status of a post (admin only).
 */
export async function updatePostStatus(
  id: string,
  status: "draft" | "review" | "published" | "archived"
): Promise<StoredBlogPost> {
  const supabase = getServiceClient()
  const update: Record<string, unknown> = { status }
  if (status === "published") {
    update.published_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .update(update)
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update status: ${error.message}`)
  return mapRow(data)
}

/**
 * Get all published slugs (for sitemap generation).
 */
export async function getAllPublishedSlugs(): Promise<string[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("blog_posts")
    .select("slug")
    .eq("status", "published")

  if (error) throw new Error(`Failed to fetch slugs: ${error.message}`)
  return (data ?? []).map((r: { slug: string }) => r.slug)
}

/**
 * Increment view count (fire-and-forget in page render).
 */
export async function incrementViewCount(slug: string): Promise<void> {
  const supabase = getServiceClient()
  // Best effort; ignore errors (don't block page render)
  await supabase.rpc("increment_blog_view", { p_slug: slug }).catch(() => {})
}

// ── Internal ────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): StoredBlogPost {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    keyword: row.keyword as string,
    category: row.category as string,
    hub: (row.hub as string) ?? null,
    excerpt: (row.excerpt as string) ?? "",
    readTimeMinutes: (row.read_time_minutes as number) ?? 5,
    wordCount: (row.word_count as number) ?? 0,
    status: row.status as StoredBlogPost["status"],
    metaTitle: (row.meta_title as string) ?? null,
    metaDescription: (row.meta_description as string) ?? null,
    ogImageUrl: (row.og_image_url as string) ?? null,
    generatedBy: (row.generated_by as StoredBlogPost["generatedBy"]) ?? "human",
    aiModel: (row.ai_model as string) ?? null,
    relatedSlugs: (row.related_slugs as string[]) ?? [],
    relatedToolPages: (row.related_tool_pages as string[]) ?? [],
    viewCount: (row.view_count as number) ?? 0,
    publishedAt: (row.published_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

