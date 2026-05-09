/**
 * AI-powered blog content generator.
 *
 * Uses Amazon Nova Lite via Bedrock to generate SEO-optimized long-form articles.
 * Outputs clean, semantic HTML ready for rendering.
 *
 * Quality bar:
 * - 1500-2500 words
 * - H1/H2/H3 hierarchy
 * - Primary keyword in first 100 words
 * - FAQ section at end (triggers rich snippet)
 * - Internal links to /pricing, /tools/*, related blog posts
 * - Meta description + title + excerpt
 * - No fluff, actionable content
 */

import { novaGenerate, NOVA_LITE_MODEL_ID } from "@/lib/bedrock-nova"

export interface BlogGenerationInput {
  topic: string
  primaryKeyword: string
  category: "guides" | "templates" | "country" | "tips" | "comparisons" | "news"
  context?: string
  targetCountry?: string
  hub?: string
  /** Slugs of related existing posts for internal linking */
  relatedSlugs?: string[]
  /** Tool pages to link to (e.g., "/tools/invoice-generator/india") */
  relatedToolPages?: string[]
}

export interface BlogGenerationOutput {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  description: string
  excerpt: string
  content: string
  keyword: string
  wordCount: number
  readTimeMinutes: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  modelId: string
}

/**
 * System prompt that defines the article quality bar.
 * This is the single most important piece — tune it carefully.
 */
const SYSTEM_PROMPT = `You are a senior B2B SaaS content strategist writing for Clorefy (https://clorefy.com), an AI-powered invoice, contract, quotation, and proposal generator. Clorefy supports 11 countries (India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands) and handles GST, VAT, and sales tax compliance automatically. It auto-emails clients, attaches payment links, chases overdue bills for 37 days, and runs recurring billing.

Your writing style:
- Clear, direct, zero fluff. Show expertise without jargon.
- Written for busy founders, freelancers, and SMB operators.
- Uses concrete examples, numbers, and specific scenarios.
- Answers the searcher's intent in the first 100 words.
- Never uses phrases like "in today's fast-paced world", "game-changing", or "revolutionary".
- Skips hyperbole. Prefers "saves 6 hours/week" over "saves tons of time".

SEO requirements (non-negotiable):
- Primary keyword must appear in H1, intro paragraph, and at least 2 H2 headings.
- Word count between 1500 and 2500 words.
- Use 5-8 H2 section headings, with H3 subheadings where appropriate.
- Include a FAQ section at the end with 4-6 questions (formatted as H3 questions).
- Naturally link to relevant Clorefy pages where it adds value (no keyword stuffing).

Output format: Return ONLY a JSON object. No markdown code fences, no preamble, no explanation. The JSON must parse cleanly.

JSON schema:
{
  "slug": "kebab-case-url-slug-max-60-chars",
  "title": "Article title with primary keyword, 50-65 chars",
  "metaTitle": "SEO title for <title> tag, 55-60 chars, includes keyword + brand",
  "metaDescription": "SEO meta description, 150-160 chars, benefit-focused with CTA",
  "description": "Short card description shown in blog listings, 120-160 chars",
  "excerpt": "Opening hook, 200-250 chars — used as preview snippet",
  "content": "Full HTML content. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <a>, <blockquote>. NO <html>, <head>, <body>, or <h1> (the title becomes the h1)."
}`

function buildUserPrompt(input: BlogGenerationInput): string {
  const lines: string[] = []

  lines.push(`Write a comprehensive, SEO-optimized blog article.`)
  lines.push(``)
  lines.push(`Topic: ${input.topic}`)
  lines.push(`Primary keyword: ${input.primaryKeyword}`)
  lines.push(`Category: ${input.category}`)

  if (input.targetCountry) {
    lines.push(`Target country: ${input.targetCountry} — include country-specific tax rules, legal requirements, and local examples.`)
  }

  if (input.context) {
    lines.push(``)
    lines.push(`Additional context: ${input.context}`)
  }

  lines.push(``)
  lines.push(`Article structure to follow:`)
  lines.push(`1. Hook opening paragraph (answer the searcher's main question in the first 100 words, include primary keyword).`)
  lines.push(`2. 5-8 H2 sections covering the topic in depth with actionable detail.`)
  lines.push(`3. At least one numbered list or bullet list with concrete examples.`)
  lines.push(`4. Mention how Clorefy solves this problem naturally (1-2 times, not more — no hard sell).`)
  lines.push(`5. FAQ section at end: <h2>Frequently Asked Questions</h2> followed by 4-6 <h3> questions and <p> answers.`)
  lines.push(`6. End with a short, punchy conclusion paragraph.`)

  if (input.relatedToolPages && input.relatedToolPages.length > 0) {
    lines.push(``)
    lines.push(`Internal links to include naturally (use descriptive anchor text, not "click here"):`)
    input.relatedToolPages.forEach((path) => {
      lines.push(`- https://clorefy.com${path}`)
    })
  }

  if (input.relatedSlugs && input.relatedSlugs.length > 0) {
    lines.push(``)
    lines.push(`Related articles to link to where relevant:`)
    input.relatedSlugs.forEach((slug) => {
      lines.push(`- https://clorefy.com/blog/${slug}`)
    })
  }

  lines.push(``)
  lines.push(`Product CTA (include once near the end):`)
  lines.push(`- Link to https://clorefy.com/pricing or https://clorefy.com with natural anchor text.`)

  lines.push(``)
  lines.push(`Remember: Return ONLY the JSON object. No code fences, no explanation.`)

  return lines.join("\n")
}

/**
 * Strip markdown code fences if the model wraps JSON in them.
 */
function extractJson(text: string): string {
  const trimmed = text.trim()
  // Strip ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fenceMatch) return fenceMatch[1].trim()
  return trimmed
}

/**
 * Validate and repair common LLM output issues.
 */
function parseAndValidate(rawText: string): {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  description: string
  excerpt: string
  content: string
} {
  const jsonText = extractJson(rawText)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    throw new Error(
      `Failed to parse AI output as JSON: ${err instanceof Error ? err.message : String(err)}. First 500 chars: ${jsonText.slice(0, 500)}`
    )
  }

  const required = ["slug", "title", "metaTitle", "metaDescription", "description", "excerpt", "content"] as const
  for (const field of required) {
    if (typeof parsed[field] !== "string" || !parsed[field]) {
      throw new Error(`AI output missing or invalid field: ${field}`)
    }
  }

  return {
    slug: String(parsed.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80),
    title: String(parsed.title).trim(),
    metaTitle: String(parsed.metaTitle).trim().slice(0, 70),
    metaDescription: String(parsed.metaDescription).trim().slice(0, 200),
    description: String(parsed.description).trim().slice(0, 200),
    excerpt: String(parsed.excerpt).trim().slice(0, 300),
    content: String(parsed.content).trim(),
  }
}

/**
 * Count words in HTML content (strips tags first).
 */
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text.split(" ").filter(Boolean).length
}

/**
 * Generate a complete blog article using AWS Bedrock Nova Lite.
 */
export async function generateBlogPost(
  input: BlogGenerationInput
): Promise<BlogGenerationOutput> {
  const userPrompt = buildUserPrompt(input)

  const result = await novaGenerate(userPrompt, {
    modelId: NOVA_LITE_MODEL_ID,
    systemPrompt: SYSTEM_PROMPT,
    maxTokens: 5000,
    temperature: 0.7,
    topP: 0.9,
  })

  const parsed = parseAndValidate(result.text)
  const wordCount = countWords(parsed.content)
  const readTimeMinutes = Math.max(2, Math.round(wordCount / 220))

  // Quality gate: reject posts under 1000 words (too thin for SEO)
  if (wordCount < 1000) {
    throw new Error(
      `Generated article too short: ${wordCount} words (minimum 1000). This usually means the model hit a token limit or misunderstood the prompt.`
    )
  }

  return {
    ...parsed,
    keyword: input.primaryKeyword,
    wordCount,
    readTimeMinutes,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
    modelId: result.modelId,
  }
}
