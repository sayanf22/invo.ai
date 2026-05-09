/**
 * Unified blog post interface merging hardcoded posts (lib/blog-data.ts)
 * with AI-generated posts stored in Supabase + R2.
 *
 * Used by /blog and /blog/[slug] pages to render all posts consistently.
 *
 * Static posts have content inline. DB posts load content from R2 on demand.
 */

import { blogPosts as staticPosts, type BlogPost } from "@/lib/blog-data"
import {
  listPublishedPosts,
  getPostWithContent,
  getAllPublishedSlugs,
  type StoredBlogPost,
} from "@/lib/blog-storage"

/**
 * A post shape that works for both static and DB-backed posts.
 * Content is optional — use getCombinedPostWithContent when you need it.
 */
export interface CombinedPost {
  slug: string
  title: string
  description: string
  keyword: string
  publishedAt: string
  updatedAt: string
  readTime: number
  category: string
  hub?: string
  relatedSlugs: string[]
  relatedToolPages?: string[]
  excerpt?: string
  content?: string
  metaTitle?: string
  metaDescription?: string
  source: "static" | "ai"
}

function staticToCombined(p: BlogPost): CombinedPost {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    keyword: p.keyword,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    readTime: p.readTime,
    category: p.category,
    hub: p.hub,
    relatedSlugs: p.relatedSlugs,
    relatedToolPages: p.relatedToolPages,
    content: p.content,
    source: "static",
  }
}

function dbToCombined(p: StoredBlogPost, content?: string): CombinedPost {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    keyword: p.keyword,
    publishedAt: p.publishedAt ?? p.createdAt,
    updatedAt: p.updatedAt,
    readTime: p.readTimeMinutes,
    category: p.category,
    hub: p.hub ?? undefined,
    relatedSlugs: p.relatedSlugs,
    relatedToolPages: p.relatedToolPages,
    excerpt: p.excerpt,
    content,
    metaTitle: p.metaTitle ?? undefined,
    metaDescription: p.metaDescription ?? undefined,
    source: "ai",
  }
}

/**
 * Get all published posts (static + DB), sorted by publishedAt desc.
 * Content is NOT loaded for DB posts — use for listings only.
 */
export async function getAllCombinedPosts(): Promise<CombinedPost[]> {
  const staticCombined = staticPosts.map(staticToCombined)

  let dbPosts: StoredBlogPost[] = []
  try {
    dbPosts = await listPublishedPosts({ limit: 200 })
  } catch (err) {
    console.error("[blog-combined] Failed to load DB posts:", err)
  }

  const dbCombined = dbPosts.map((p) => dbToCombined(p))

  // Merge — DB posts override static if slug collides
  const bySlug = new Map<string, CombinedPost>()
  for (const p of staticCombined) bySlug.set(p.slug, p)
  for (const p of dbCombined) bySlug.set(p.slug, p)

  return Array.from(bySlug.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

/**
 * Get a single post with full content. Tries DB first, then static.
 */
export async function getCombinedPostBySlug(slug: string): Promise<CombinedPost | null> {
  // Try DB first
  try {
    const dbPost = await getPostWithContent(slug)
    if (dbPost) return dbToCombined(dbPost, dbPost.content)
  } catch (err) {
    console.error("[blog-combined] DB lookup failed:", err)
  }

  // Fallback to static
  const staticPost = staticPosts.find((p) => p.slug === slug)
  if (staticPost) return staticToCombined(staticPost)

  return null
}

/**
 * All slugs (static + DB) for sitemap generation.
 */
export async function getAllCombinedSlugs(): Promise<string[]> {
  const staticSlugs = staticPosts.map((p) => p.slug)
  let dbSlugs: string[] = []
  try {
    dbSlugs = await getAllPublishedSlugs()
  } catch (err) {
    console.error("[blog-combined] Failed to load DB slugs:", err)
  }
  return Array.from(new Set([...staticSlugs, ...dbSlugs]))
}

/**
 * Posts by category.
 */
export async function getCombinedPostsByCategory(category: string): Promise<CombinedPost[]> {
  const all = await getAllCombinedPosts()
  return all.filter((p) => p.category === category)
}

/**
 * Posts by hub (for topic clustering).
 */
export async function getCombinedPostsByHub(hub: string): Promise<CombinedPost[]> {
  const all = await getAllCombinedPosts()
  return all.filter((p) => p.hub === hub)
}

/**
 * All unique categories across static + DB posts.
 */
export async function getAllCombinedCategories(): Promise<string[]> {
  const all = await getAllCombinedPosts()
  return Array.from(new Set(all.map((p) => p.category)))
}

/**
 * Related posts for a given slug.
 */
export async function getCombinedRelatedPosts(slug: string): Promise<CombinedPost[]> {
  const post = await getCombinedPostBySlug(slug)
  if (!post) return []

  const related: CombinedPost[] = []
  for (const relatedSlug of post.relatedSlugs) {
    const p = await getCombinedPostBySlug(relatedSlug)
    if (p) related.push(p)
  }
  return related
}
