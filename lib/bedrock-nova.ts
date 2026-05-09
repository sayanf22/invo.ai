/**
 * Bedrock content generation client for blog automation.
 *
 * Uses Kimi K2.5 via Bedrock Mantle — same endpoint and key as the chat
 * feature, already proven working in production.
 *
 * Web search note: Nova 2 Lite on Bedrock has built-in web grounding but
 * requires a quota increase (currently 0 on new accounts). Until that's
 * approved, Kimi handles all blog generation. For evergreen SEO content
 * (guides, comparisons, templates, country guides) this is sufficient —
 * Kimi's training data covers all relevant topics.
 *
 * When Nova 2 Lite quota is approved, set modelId = NOVA_2_LITE_MODEL_ID
 * and enableWebSearch = true for news category posts.
 */

const BEDROCK_MANTLE_URL = "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions"
const BEDROCK_RUNTIME_ENDPOINT = "https://bedrock-runtime.us-east-1.amazonaws.com"

export const KIMI_MODEL_ID = "moonshotai.kimi-k2.5"
export const NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0"
export const NOVA_2_LITE_MODEL_ID = "amazon.nova-2-lite-v1:0"

// Default: Kimi K2.5 — proven working, same key as chat feature
export const DEFAULT_BLOG_MODEL = KIMI_MODEL_ID

const PRICING: Record<string, { input: number; output: number }> = {
  [KIMI_MODEL_ID]: { input: 0.15, output: 0.60 },
  [NOVA_LITE_MODEL_ID]: { input: 0.06, output: 0.24 },
  [NOVA_2_LITE_MODEL_ID]: { input: 0.17, output: 0.68 },
}

export interface NovaGenerateOptions {
  modelId?: string
  systemPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  /**
   * Enable built-in web grounding. Only works on Nova 2 Lite.
   * Requires Nova 2 Lite quota to be approved in AWS Service Quotas.
   */
  enableWebSearch?: boolean
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
  if (!key) throw new Error("Missing env var: amazon_beadrocl_key")
  return key
}

/**
 * Generate text using Kimi K2.5 via Bedrock Mantle (OpenAI-compatible API).
 * Primary path — already proven working in production.
 */
async function generateWithKimi(
  userPrompt: string,
  systemPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<NovaGenerateResult> {
  const apiKey = getApiKey()

  const response = await fetch(BEDROCK_MANTLE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: KIMI_MODEL_ID,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  })

  if (!response.ok) {
    const err = await response.text().catch(() => "")
    throw new Error(`Kimi API error ${response.status}: ${err.slice(0, 400)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }

  const text = data.choices?.[0]?.message?.content ?? ""
  const inputTokens = data.usage?.prompt_tokens ?? 0
  const outputTokens = data.usage?.completion_tokens ?? 0
  const pricing = PRICING[KIMI_MODEL_ID]
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output

  return { text, inputTokens, outputTokens, costUsd, modelId: KIMI_MODEL_ID }
}

/**
 * Generate text using Nova models via Bedrock Runtime (Converse API).
 * Requires Nova model quota to be approved in AWS Service Quotas.
 * Nova 2 Lite supports enableWebSearch = true for web-grounded responses.
 */
async function generateWithNova(
  userPrompt: string,
  options: NovaGenerateOptions
): Promise<NovaGenerateResult> {
  const modelId = options.modelId ?? NOVA_LITE_MODEL_ID
  const apiKey = getApiKey()

  const url = `${BEDROCK_RUNTIME_ENDPOINT}/model/${encodeURIComponent(modelId)}/converse`

  const body: Record<string, unknown> = {
    messages: [{ role: "user", content: [{ text: userPrompt }] }],
    inferenceConfig: {
      maxTokens: options.maxTokens ?? 4000,
      temperature: options.temperature ?? 0.7,
      topP: options.topP ?? 0.9,
    },
  }

  if (options.systemPrompt) {
    body.system = [{ text: options.systemPrompt }]
  }

  if (options.enableWebSearch) {
    if (modelId !== NOVA_2_LITE_MODEL_ID) {
      throw new Error(`Web search only works on Nova 2 Lite. Got: ${modelId}`)
    }
    body.toolConfig = { tools: [{ builtInTool: { name: "web_grounding" } }] }
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
    const err = await response.text().catch(() => "")
    throw new Error(`Nova API error ${response.status}: ${err.slice(0, 400)}`)
  }

  const data = (await response.json()) as {
    output?: { message?: { content?: Array<{ text?: string }> } }
    usage?: { inputTokens?: number; outputTokens?: number }
  }

  const text = data.output?.message?.content?.[0]?.text ?? ""
  const inputTokens = data.usage?.inputTokens ?? 0
  const outputTokens = data.usage?.outputTokens ?? 0
  const pricing = PRICING[modelId] ?? { input: 0.06, output: 0.24 }
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output

  return { text, inputTokens, outputTokens, costUsd, modelId }
}

/**
 * Main entry point for blog content generation.
 *
 * Default: Kimi K2.5 (AWS Bedrock Mantle) — works today, no setup needed.
 * Optional: Nova 2 Lite with web search — when AWS quota is approved.
 */
export async function novaGenerate(
  userPrompt: string,
  options: NovaGenerateOptions = {}
): Promise<NovaGenerateResult> {
  const modelId = options.modelId ?? DEFAULT_BLOG_MODEL

  if (modelId === KIMI_MODEL_ID) {
    return generateWithKimi(
      userPrompt,
      options.systemPrompt ?? "",
      options.maxTokens ?? 4000,
      options.temperature ?? 0.7
    )
  }

  return generateWithNova(userPrompt, { ...options, modelId })
}
