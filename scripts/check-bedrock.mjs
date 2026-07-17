// Safe Bedrock Mantle key and exact-model inference check.
// Never prints credentials, model output, or provider response bodies.
// Usage: node scripts/check-bedrock.mjs
import { existsSync, readFileSync } from "node:fs"

const KEY_NAMES = ["AWS_BEARER_TOKEN_BEDROCK", "AMAZON_BEDROCK_KEY", "amazon_beadrocl_key"]
const REGION = "us-east-1"
const MANTLE = `https://bedrock-mantle.${REGION}.api.aws`
const OPENAI_COMPATIBLE_BASE = `${MANTLE}/v1`
const REQUEST_TIMEOUT_MS = 20_000

function parseDotEnvValue(raw) {
  const value = raw.trim()
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }
  return value.replace(/\s+#.*$/, "").trim()
}

function readKey() {
  for (const name of KEY_NAMES) {
    if (process.env[name]?.trim()) return process.env[name].trim()
  }
  for (const file of [".env.local", ".env", ".dev.vars"]) {
    if (!existsSync(file)) continue
    const text = readFileSync(file, "utf8")
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (!match || !KEY_NAMES.includes(match[1])) continue
      const key = parseDotEnvValue(match[2])
      if (key) return key
    }
  }
  return ""
}

async function safeFetch(url, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    return { ok: false, status: 0, aborted: error?.name === "AbortError" }
  } finally {
    clearTimeout(timeout)
  }
}

function containsText(value) {
  if (typeof value === "string") return value.trim().length > 0
  if (Array.isArray(value)) return value.some(containsText)
  if (value && typeof value === "object") return Object.values(value).some(containsText)
  return false
}

function statusLabel(response, hasOutput) {
  if (response.status === 0) return response.aborted ? "timeout" : "network error"
  if (response.status === 401) return "invalid key"
  if (response.status === 403) return "not authorized for this account"
  if (response.status === 404) return "not available on this endpoint/account"
  if (!response.ok) return `unavailable (HTTP ${response.status})`
  return hasOutput ? "inferable" : "HTTP 200 but empty/malformed output"
}

async function probeChat(model, key) {
  const requestBody = {
    model,
    messages: [{ role: "user", content: "Reply only: ok" }],
    temperature: 0,
    stream: false,
  }
  if (model.startsWith("openai.gpt-oss-")) {
    requestBody.max_completion_tokens = 512
    requestBody.reasoning_effort = "low"
  } else {
    requestBody.max_tokens = 16
  }

  const response = await safeFetch(`${OPENAI_COMPATIBLE_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(requestBody),
  })
  const json = response.ok ? await response.json().catch(() => null) : null
  const hasOutput = containsText(json?.choices?.[0]?.message?.content)
  return { label: statusLabel(response, hasOutput), ok: response.ok && hasOutput }
}

async function probeOpenAIResponses(model, key) {
  const response = await safeFetch(`${MANTLE}/openai/v1/responses`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      input: "Reply only: ok",
      max_output_tokens: 64,
      store: false,
    }),
  })
  const json = response.ok ? await response.json().catch(() => null) : null
  const hasOutput = containsText(json?.output)
  return { label: statusLabel(response, hasOutput), ok: response.ok && hasOutput }
}

async function probeClaudeMessages(model, key) {
  const response = await safeFetch(`${MANTLE}/anthropic/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply only: ok" }],
    }),
  })
  const json = response.ok ? await response.json().catch(() => null) : null
  const hasOutput = Array.isArray(json?.content) && json.content.some((part) => containsText(part?.text))
  return { label: statusLabel(response, hasOutput), ok: response.ok && hasOutput }
}

async function probeClaudeRuntime(model, key) {
  const encodedModel = encodeURIComponent(model)
  const response = await safeFetch(`https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodedModel}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 16,
      messages: [{ role: "user", content: "Reply only: ok" }],
    }),
  })
  const json = response.ok ? await response.json().catch(() => null) : null
  const hasOutput = Array.isArray(json?.content) && json.content.some((part) => containsText(part?.text))
  return { label: statusLabel(response, hasOutput), ok: response.ok && hasOutput }
}

async function main() {
  const key = readKey()
  if (!key) {
    console.error(`❌ No Bedrock key found. Set ${KEY_NAMES.join(" or ")}.`)
    process.exit(1)
  }

  const modelsResponse = await safeFetch(`${OPENAI_COMPATIBLE_BASE}/models`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!modelsResponse.ok) {
    console.error(`❌ Bedrock key check failed: ${statusLabel(modelsResponse, false)}.`)
    process.exit(2)
  }

  const payload = await modelsResponse.json().catch(() => null)
  const ids = Array.isArray(payload?.data)
    ? payload.data.map((model) => model?.id).filter((id) => typeof id === "string")
    : []
  const listed = new Set(ids)
  console.log(`✅ Bedrock key accepted; ${ids.length} models listed by /v1/models.`)
  console.log("Listed OpenAI models:")
  for (const id of ids.filter((id) => id.startsWith("openai.")).sort()) console.log(`  - ${id}`)

  const probes = [
    ["moonshotai.kimi-k2.5", "Chat Completions", probeChat],
    ["openai.gpt-oss-120b", "Chat Completions", probeChat],
    ["openai.gpt-oss-20b", "Chat Completions", probeChat],
    ["openai.gpt-5.6-sol", "Responses", probeOpenAIResponses],
    ["openai.gpt-5.6-terra", "Responses", probeOpenAIResponses],
    ["openai.gpt-5.6-luna", "Responses", probeOpenAIResponses],
    ["openai.gpt-5.5", "Responses", probeOpenAIResponses],
    ["openai.gpt-5.4", "Responses", probeOpenAIResponses],
    ["us.anthropic.claude-sonnet-4-6", "Bedrock Runtime Invoke", probeClaudeRuntime],
    ["anthropic.claude-sonnet-4-6", "Bedrock Runtime Invoke", probeClaudeRuntime],
    ["anthropic.claude-sonnet-5", "Messages", probeClaudeMessages],
  ]

  console.log("\nMinimal live inference probes (model output and provider bodies suppressed):")
  let baselineWorks = false
  for (const [model, api, probe] of probes) {
    const result = await probe(model, key)
    if (model === "moonshotai.kimi-k2.5") baselineWorks = result.ok
    console.log(`  ${model} | listed=${listed.has(model) ? "yes" : "no"} | api=${api} | ${result.label}`)
  }

  if (!baselineWorks) {
    console.error("❌ The currently configured production model is not inferable.")
    process.exit(3)
  }
}

main().catch(() => {
  console.error("❌ Bedrock check failed unexpectedly; sensitive details were suppressed.")
  process.exit(4)
})