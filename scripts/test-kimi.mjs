/**
 * Quick test for the Kimi K2.5 Bedrock Mantle endpoint.
 * This is the endpoint already used in production for chat.
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

console.log("Testing Kimi K2.5 via Bedrock Mantle (production endpoint)...")
console.log(`Key prefix: ${API_KEY?.slice(0, 8)}...`)
console.log("")

const start = Date.now()
const res = await fetch("https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
  body: JSON.stringify({
    model: "moonshotai.kimi-k2.5",
    messages: [{ role: "user", content: "Say exactly: 'Kimi is working.'" }],
    max_tokens: 20,
    temperature: 0,
    stream: false,
  }),
})

console.log(`Status: ${res.status} ${res.statusText} (${Date.now() - start}ms)`)
const data = await res.json()

if (res.ok) {
  console.log("✅ Kimi response:", data.choices?.[0]?.message?.content)
} else {
  console.log("❌ Error:", JSON.stringify(data))
}
