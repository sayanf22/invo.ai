/**
 * AWS Bedrock Nova client for long-form content generation.
 *
 * Uses Amazon Nova Lite — the cheapest quality model on Bedrock.
 * Pricing (2025): $0.06/1M input tokens, $0.24/1M output tokens.
 * A 2000-word blog post costs approximately $0.005 (half a cent).
 *
 * NOTE: This is separate from lib/bedrock.ts which uses Bedrock Mantle
 * (Kimi K2.5) for chat. This file uses the standard Bedrock Runtime API
 * with Nova models, which is designed for longer-form generation.
 *
 * Authentication: Long-term API key (bearer token) stored in env as
 * `amazon_beadrocl_key`. The key is pre-base64-encoded by AWS.
 *
 * Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html
 */

const BEDROCK_REGION = "us-east-1"
const BEDROCK_ENDPOINT = `https://bedrock-runtime.${BEDROCK_REGION}.amazonaws.com`

// Nova Lite v1 — best price-to-quality ratio for long-form content
export const NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0"

// Pricing per 1M tokens (USD), Jan 2025 — used for cost tracking
const PRICING = {
  [NOVA_LITE_MODEL_ID]: { input: 0.06, output: 0.24 },
} as const

export interface NovaMessage {
  role: "user" | "assistant"
  content: Array<{ text: string }>
}

export interface NovaGenerateOptions {
  modelId?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
}

export interface NovaGenerateResult {
  text: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  modelId: string
}

function getApiKey(): string {
  const key = process.env.amazon_beadrocl_key
  if (!key) {
    throw new Error(
      "Missing AWS Bedrock API key. Set env var `amazon_beadrocl_key`."
    )
  }
  return key
}

/**
 * Generate text using Amazon Bedrock Converse API with Nova models.
 *
 * The Converse API is the recommended unified interface for Nova.
 */
export async function novaConverse(
  messages: NovaMessage[],
  options: NovaGenerateOptions = {}
): Promise<NovaGenerateResult> {
  const modelId = options.modelId ?? NOVA_LITE_MODEL_ID
  const apiKey = getApiKey()

  const url = `${BEDROCK_ENDPOINT}/model/${encodeURIComponent(modelId)}/converse`

  const body: Record<string, unknown> = {
    messages,
    inferenceConfig: {
      maxTokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
    },
  }

  if (options.systemPrompt) {
    body.system = [{ text: options.systemPrompt }]
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "")
    throw new Error(
      `Bedrock Nova API error ${response.status}: ${errorText.slice(0, 500)}`
    )
  }

  const data = (await response.json()) as {
    output?: { message?: { content?: Array<{ text?: string }> } }
    usage?: { inputTokens?: number; outputTokens?: number }
  }

  const text = data.output?.message?.content?.[0]?.text ?? ""
  const inputTokens = data.usage?.inputTokens ?? 0
  const outputTokens = data.usage?.outputTokens ?? 0

  const pricing = PRICING[modelId as keyof typeof PRICING] ?? { input: 0.06, output: 0.24 }
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output

  return { text, inputTokens, outputTokens, costUsd, modelId }
}

/**
 * Convenience helper: single-turn text generation from a user prompt.
 */
export async function novaGenerate(
  userPrompt: string,
  options: NovaGenerateOptions = {}
): Promise<NovaGenerateResult> {
  return novaConverse(
    [{ role: "user", content: [{ text: userPrompt }] }],
    options
  )
}
