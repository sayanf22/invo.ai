/**
 * Smoke test for blog generation via Bedrock.
 *
 * Tests both endpoints:
 * 1. Kimi K2.5 (Mantle) — primary, already working
 * 2. Nova Lite v1 (Runtime) — optional, requires model access enabled
 *
 * Usage: node scripts/test-bedrock.mjs
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

if (!API_KEY) {
  console.error("❌ Missing amazon_beadrocl_key in .env")
  process.exit(1)
}

console.log("=".repeat(60))
console.log("Bedrock Blog Generation Test")
console.log("=".repeat(60))
console.log(`Key prefix: ${API_KEY.slice(0, 8)}...`)
console.log("")

// ── Test 1: Kimi K2.5 (primary blog model) ──────────────────────────
console.log("TEST 1: Kimi K2.5 via Bedrock Mantle (primary blog model)")
console.log("-".repeat(60))

let start = Date.now()
const kimiRes = await fetch("https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "moonshotai.kimi-k2.5",
    messages: [
      {
        role: "system",
        content: "You are a professional blog writer. Write concise, SEO-optimized content.",
      },
      {
        role: "user",
        content: "Write a 3-sentence intro paragraph for a blog post titled 'How to Create a GST Invoice in India'. Include the keyword 'GST invoice' naturally.",
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
    stream: false,
  }),
})

console.log(`Status: ${kimiRes.status} ${kimiRes.statusText} (${Date.now() - start}ms)`)
const kimiData = await kimiRes.json()

if (kimiRes.ok) {
  const text = kimiData.choices?.[0]?.message?.content ?? ""
  const inputTokens = kimiData.usage?.prompt_tokens ?? 0
  const outputTokens = kimiData.usage?.completion_tokens ?? 0
  const cost = (inputTokens / 1e6) * 0.15 + (outputTokens / 1e6) * 0.60

  console.log("✅ Kimi working!")
  console.log("")
  console.log("Sample output:")
  console.log(text.trim())
  console.log("")
  console.log(`Tokens: ${inputTokens} in / ${outputTokens} out | Cost: $${cost.toFixed(6)}`)
  console.log(`Projected per 2000-word post: ~$${((inputTokens * 5 / 1e6) * 0.15 + (outputTokens * 15 / 1e6) * 0.60).toFixed(4)}`)
} else {
  console.log("❌ Kimi failed:", JSON.stringify(kimiData))
}

console.log("")

// ── Test 2: Nova Lite v1 (optional, cheaper) ─────────────────────────
console.log("TEST 2: Nova Lite v1 via Bedrock Runtime (optional, requires model access)")
console.log("-".repeat(60))

start = Date.now()
const novaRes = await fetch(
  "https://bedrock-runtime.us-east-1.amazonaws.com/model/amazon.nova-lite-v1%3A0/converse",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: [{ text: "Say: Nova Lite is working." }] }],
      inferenceConfig: { maxTokens: 20, temperature: 0 },
    }),
  }
)

console.log(`Status: ${novaRes.status} ${novaRes.statusText} (${Date.now() - start}ms)`)
const novaData = await novaRes.json()

if (novaRes.ok) {
  const text = novaData.output?.message?.content?.[0]?.text ?? ""
  console.log("✅ Nova Lite working!")
  console.log("Response:", text.trim())
} else if (novaRes.status === 429) {
  console.log("⚠️  Nova Lite: Daily token quota exhausted (key is valid)")
  console.log("   → Enable model access: AWS Console → Bedrock → Model access → Nova Lite")
  console.log("   → Or wait until midnight UTC for quota reset")
} else if (novaRes.status === 403) {
  console.log("⚠️  Nova Lite: Model access not enabled")
  console.log("   → Go to: AWS Console → Amazon Bedrock → Model access")
  console.log("   → Request access to 'Amazon Nova Lite' (instant approval)")
} else {
  console.log("❌ Nova Lite error:", JSON.stringify(novaData))
}

console.log("")
console.log("=".repeat(60))
console.log("SUMMARY")
console.log("=".repeat(60))
console.log(`Kimi K2.5:   ${kimiRes.ok ? "✅ WORKING — blog generation will use this" : "❌ FAILED"}`)
console.log(`Nova Lite:   ${novaRes.ok ? "✅ WORKING" : novaRes.status === 429 ? "⚠️  QUOTA LIMIT" : "⚠️  NOT ENABLED"}`)
console.log("")
if (kimiRes.ok) {
  console.log("✅ Blog automation is ready to use.")
  console.log("   Go to /clorefy-ctrl-8x2m/blog to generate your first post.")
}
