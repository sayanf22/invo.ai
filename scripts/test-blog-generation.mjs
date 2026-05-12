/**
 * End-to-end test of blog generation with Kimi K2.5.
 * Tests the full flow: system prompt → Kimi → JSON parse → quality check.
 *
 * Usage: node scripts/test-blog-generation.mjs
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

function loadEnv() {
  const content = readFileSync(resolve(process.cwd(), ".env"), "utf-8")
  const env = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return env
}

const env = loadEnv()
const API_KEY = env.amazon_beadrocl_key

const SYSTEM_PROMPT = `You are a senior B2B SaaS content strategist writing for Clorefy (https://clorefy.com), an AI-powered invoice, contract, quotation, and proposal generator. Clorefy supports every country worldwide — with deep compliance data for major markets (India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands) and a growing knowledge base covering the rest — and handles GST, VAT, and sales tax compliance automatically. It auto-emails clients, attaches payment links, chases overdue payments on a 37-day cycle, and runs recurring billing.ayment links, chases overdue bills for 37 days, and runs recurring billing.

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

const USER_PROMPT = `Write a comprehensive, SEO-optimized blog article.

Topic: How to create a GST invoice in India: complete guide
Primary keyword: GST invoice format India
Category: country

Target country: India — include country-specific tax rules, legal requirements, and local examples.

Additional context: Cover GSTIN, HSN/SAC codes, CGST/SGST/IGST split, mandatory fields per GST law, place of supply rules, and penalties for non-compliance.

Article structure to follow:
1. Hook opening paragraph (answer the searcher's main question in the first 100 words, include primary keyword).
2. 5-8 H2 sections covering the topic in depth with actionable detail.
3. At least one numbered list or bullet list with concrete examples.
4. Mention how Clorefy solves this problem naturally (1-2 times, not more — no hard sell).
5. FAQ section at end: <h2>Frequently Asked Questions</h2> followed by 4-6 <h3> questions and <p> answers.
6. End with a short, punchy conclusion paragraph.

Internal links to include naturally:
- https://clorefy.com/tools/invoice-generator/india

Product CTA (include once near the end):
- Link to https://clorefy.com/pricing or https://clorefy.com with natural anchor text.

Remember: Return ONLY the JSON object. No code fences, no explanation.`

console.log("=".repeat(60))
console.log("Blog Generation End-to-End Test")
console.log("=".repeat(60))
console.log("Topic: GST invoice format India")
console.log("Model: Kimi K2.5 (Bedrock Mantle)")
console.log("")

const start = Date.now()
console.log("→ Calling Kimi K2.5...")

const res = await fetch("https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "moonshotai.kimi-k2.5",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_PROMPT },
    ],
    max_tokens: 5000,
    temperature: 0.7,
    stream: false,
  }),
})

const elapsed = Date.now() - start
console.log(`Status: ${res.status} (${elapsed}ms)`)

if (!res.ok) {
  const err = await res.text()
  console.error("❌ API error:", err)
  process.exit(1)
}

const data = await res.json()
const rawText = data.choices?.[0]?.message?.content ?? ""
const inputTokens = data.usage?.prompt_tokens ?? 0
const outputTokens = data.usage?.completion_tokens ?? 0

console.log(`Tokens: ${inputTokens} in / ${outputTokens} out`)
console.log(`Cost: $${((inputTokens / 1e6) * 0.15 + (outputTokens / 1e6) * 0.60).toFixed(6)}`)
console.log("")

// Try to parse JSON
let parsed
const trimmed = rawText.trim()
const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed

try {
  parsed = JSON.parse(jsonText)
  console.log("✅ JSON parsed successfully")
} catch (err) {
  console.error("❌ JSON parse failed:", err.message)
  console.log("Raw output (first 1000 chars):")
  console.log(rawText.slice(0, 1000))
  process.exit(1)
}

// Quality checks
const required = ["slug", "title", "metaTitle", "metaDescription", "description", "excerpt", "content"]
const missing = required.filter(f => !parsed[f])
if (missing.length > 0) {
  console.error("❌ Missing fields:", missing.join(", "))
  process.exit(1)
}

const wordCount = parsed.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length
const hasH2 = (parsed.content.match(/<h2/g) || []).length
const hasFAQ = parsed.content.toLowerCase().includes("frequently asked")
const hasKeyword = parsed.content.toLowerCase().includes("gst invoice")

console.log("")
console.log("Quality Report:")
console.log(`  Slug:         ${parsed.slug}`)
console.log(`  Title:        ${parsed.title}`)
console.log(`  Meta title:   ${parsed.metaTitle}`)
console.log(`  Meta desc:    ${parsed.metaDescription?.length} chars`)
console.log(`  Word count:   ${wordCount} ${wordCount >= 1500 ? "✅" : "⚠️ (under 1500)"}`)
console.log(`  H2 sections:  ${hasH2} ${hasH2 >= 5 ? "✅" : "⚠️ (under 5)"}`)
console.log(`  FAQ section:  ${hasFAQ ? "✅" : "❌ missing"}`)
console.log(`  Keyword used: ${hasKeyword ? "✅" : "❌ missing"}`)
console.log("")
console.log("Excerpt:")
console.log(" ", parsed.excerpt)
console.log("")
console.log("Content preview (first 500 chars of HTML):")
console.log(parsed.content.slice(0, 500))
console.log("")

if (wordCount >= 1500 && hasH2 >= 5 && hasFAQ && hasKeyword) {
  console.log("✅ PASS — Article meets quality bar. Blog automation is working.")
} else {
  console.log("⚠️  Some quality checks failed. Review the system prompt.")
}
