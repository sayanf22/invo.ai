/**
 * Bedrock content generation client for blog automation.
 *
 * PRIMARY model: Kimi K2.5 via Bedrock Mantle — already working in production,
 * same key, same endpoint as the chat feature. No extra setup needed.
 *
 * OPTIONAL models (require Nova model access to be enabled in AWS Console):
 * - Nova Lite v1: $0.06/1M input — cheapest, no web search
 * - Nova 2 Lite: $0.17/1M input — has built-in web grounding (search)
 *
 * To enable Nova: AWS Console → Amazon Bedrock → Model access → Request access
 * to "Amazon Nova Lite" (instant approval). Then set modelId in options.
 */

const BEDROCK_MANTLE_URL = "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions"
const BEDROCK_RUNTIME_ENDPOINT = "https://bedrock-runtime.us-east-1.amazonaws.com"

export const KIMI_MODEL_ID = "moonshotai.kimi-k2.5"
export const NOVA_LITE_MODEL_ID = "amazon.nova-lite-v1:0"
export const NOVA_2_LITE_MODEL_ID = "amazon.nova-2-lite-v1:0"

// Default: use Kimi (proven working, no extra setup)
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
   * Requires Nova 2 Lite model access to be enabled in AWS Console.
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
 * This is the primary path — already proven working.
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
 * Requires Nova model access to be enabled in AWS Console.
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
 * Routes to the right model:
 * - Default (no modelId): Kimi K2.5 — already working, no setup needed
 * - modelId = NOVA_LITE_MODEL_ID: Nova Lite — requires model access enabled
 * - modelId = NOVA_2_LITE_MODEL_ID + enableWebSearch: Nova 2 with web search
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
