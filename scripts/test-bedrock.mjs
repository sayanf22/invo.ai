/**
 * Smoke test for AWS Bedrock Nova Lite API key.
 *
 * Usage: node scripts/test-bedrock.mjs
 *
 * Verifies:
 * 1. API key is readable from .env
 * 2. Bedrock endpoint accepts the key
 * 3. Nova Lite model is accessible
 * 4. Response has expected shape
 * 5. Cost calculation works
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// ── Load .env manually (no dotenv dep needed) ─────────────────────────
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env")
  const content = readFileSync(envPath, "utf-8")
  const env = {}
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    env[key] = value
  }
  return env
}

const env = loadEnv()
const API_KEY = env.amazon_beadrocl_key
const MODEL_ID = "amazon.nova-lite-v1:0"
const REGION = "us-east-1"

if (!API_KEY) {
  console.error("❌ Missing amazon_beadrocl_key in .env")
  process.exit(1)
}

console.log("✓ API key loaded from .env")
console.log(`  Key prefix: ${API_KEY.slice(0, 8)}...`)
console.log(`  Key length: ${API_KEY.length} chars`)
console.log(`  Model: ${MODEL_ID}`)
console.log(`  Region: ${REGION}`)
console.log("")

const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/converse`

console.log("→ Calling Bedrock Converse API...")

const start = Date.now()

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            {
              text: "Write exactly one sentence: 'Bedrock Nova Lite is working correctly.'",
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 100,
        temperature: 0,
      },
    }),
  })

  const elapsed = Date.now() - start
  console.log(`  Response: ${response.status} ${response.statusText} (${elapsed}ms)`)

  if (!response.ok) {
    const body = await response.text()
    console.error("")
    console.error("❌ Request failed:")
    console.error(body)

    if (response.status === 403) {
      console.error("")
      console.error("→ 403 usually means Nova Lite model access is not enabled.")
      console.error("  Go to AWS Console → Amazon Bedrock → Model access")
      console.error("  Request access to 'Amazon Nova Lite' (takes ~1 minute)")
    }
    if (response.status === 401) {
      console.error("")
      console.error("→ 401 means the API key is invalid or expired.")
      console.error("  Regenerate a long-term key in the Bedrock console.")
    }
    process.exit(1)
  }

  const data = await response.json()
  const text = data.output?.message?.content?.[0]?.text ?? ""
  const inputTokens = data.usage?.inputTokens ?? 0
  const outputTokens = data.usage?.outputTokens ?? 0

  const costUsd =
    (inputTokens / 1_000_000) * 0.06 + (outputTokens / 1_000_000) * 0.24

  console.log("")
  console.log("✅ Success!")
  console.log("")
  console.log("Response text:")
  console.log("  " + text.trim())
  console.log("")
  console.log("Usage:")
  console.log(`  Input tokens:  ${inputTokens}`)
  console.log(`  Output tokens: ${outputTokens}`)
  console.log(`  Cost:          $${costUsd.toFixed(8)}`)
  console.log("")
  console.log("Projected cost for 2000-word blog post:")
  const estInputTokens = 600 // system + user prompt
  const estOutputTokens = 3000 // 2000 words + JSON scaffolding
  const estCost =
    (estInputTokens / 1_000_000) * 0.06 + (estOutputTokens / 1_000_000) * 0.24
  console.log(`  ~$${estCost.toFixed(6)} per post`)
  console.log(`  ~$${(estCost * 365).toFixed(2)}/year at 1 post/day`)
} catch (err) {
  console.error("❌ Network error:", err.message)
  process.exit(1)
}
