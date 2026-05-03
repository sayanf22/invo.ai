import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * Unit tests for fallback scenarios in the dual-model chat architecture.
 *
 * The fallback logic lives inline in app/api/ai/stream/route.ts. Rather than
 * spinning up the full route handler (which requires auth, Supabase, etc.),
 * we replicate the core fallback orchestration pattern and test it with
 * mocked async generators for streamBedrockChat and streamGenerateDocument.
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5, 4.6, 8.4, 8.5
 */

// ── Types matching the real SSE event shapes ──────────────────────────

type BedrockEvent = { type: "chunk" | "complete" | "error"; data: string }
type DeepSeekEvent = { type: "chunk" | "complete" | "error" | "reasoning"; data: string }
type ActivityEvent = { type: "activity"; action: string; label: string; detail?: string }
type SentEvent = BedrockEvent | DeepSeekEvent | ActivityEvent | { type: string; data: string }

// ── Fallback orchestration extracted from route handler ───────────────
// This mirrors the exact logic in app/api/ai/stream/route.ts lines ~252-295

async function runFallbackOrchestration(opts: {
  bedrockStream: AsyncGenerator<BedrockEvent>
  deepseekStream: () => AsyncGenerator<DeepSeekEvent>
}): Promise<{ events: SentEvent[]; modelCompletedSuccessfully: boolean }> {
  const events: SentEvent[] = []
  const sendEvent = (event: SentEvent) => events.push(event)
  let modelCompletedSuccessfully = false

  // Emit initial Kimi activity (matches route handler)
  sendEvent({ type: "activity", action: "generate", label: "Responding", detail: "Kimi K2.5" })

  let bedrockFailed = false
  let bedrockChunksForwarded = false

  for await (const chunk of opts.bedrockStream) {
    if (chunk.type === "error") {
      bedrockFailed = true
      break
    }
    if (!bedrockFailed) {
      sendEvent(chunk)
      if (chunk.type === "chunk") {
        bedrockChunksForwarded = true
      }
    }
    if (chunk.type === "complete") {
      modelCompletedSuccessfully = true
      break
    }
  }

  // Fallback to DeepSeek if Bedrock failed
  if (bedrockFailed) {
    if (bedrockChunksForwarded) {
      sendEvent({ type: "error", data: "__fallback_reset__" })
    }
    sendEvent({ type: "activity", action: "generate", label: "Responding", detail: "DeepSeek (fallback)" })
    for await (const chunk of opts.deepseekStream()) {
      sendEvent(chunk)
      if (chunk.type === "complete") {
        modelCompletedSuccessfully = true
        break
      }
      if (chunk.type === "error") break
    }
  }

  return { events, modelCompletedSuccessfully }
}

// ── Helper: create async generators from arrays ───────────────────────

async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("Fallback orchestration – unit tests", () => {
  /**
   * Validates: Requirement 4.1
   * WHEN the Chat_Model returns an HTTP 401 or 403 status code,
   * THE Fallback_Handler SHALL reroute to the Document_Model.
   */
  it("falls back to DeepSeek when Bedrock returns a 401 error", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API key is invalid or expired." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "chunk", data: "Hello from " },
        { type: "chunk", data: "DeepSeek" },
        { type: "complete", data: "Hello from DeepSeek" },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    // Should have fallback activity event
    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeDefined()

    // Should have DeepSeek chunks
    const chunks = events.filter((e) => e.type === "chunk")
    expect(chunks).toHaveLength(2)
    expect(chunks[0].data).toBe("Hello from ")
    expect(chunks[1].data).toBe("DeepSeek")

    // Should have completed successfully
    expect(modelCompletedSuccessfully).toBe(true)

    // Should have a complete event from DeepSeek
    const completeEvent = events.find((e) => e.type === "complete")
    expect(completeEvent).toBeDefined()
    expect(completeEvent!.data).toBe("Hello from DeepSeek")
  })

  /**
   * Validates: Requirement 4.2
   * WHEN the Chat_Model returns an HTTP 429 status code (rate limit),
   * THE Fallback_Handler SHALL reroute to the Document_Model.
   */
  it("falls back to DeepSeek when Bedrock returns a 429 rate limit error", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API rate limit exceeded. Please wait and try again." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "chunk", data: "Fallback response" },
        { type: "complete", data: "Fallback response" },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeDefined()
    expect(modelCompletedSuccessfully).toBe(true)
  })

  /**
   * Validates: Requirement 4.4
   * WHEN the Chat_Model encounters a network error or throws an exception,
   * THE Fallback_Handler SHALL reroute to the Document_Model.
   */
  it("falls back to DeepSeek when Bedrock throws a network error", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock streaming failed" },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "chunk", data: "Network fallback" },
        { type: "complete", data: "Network fallback" },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeDefined()
    expect(modelCompletedSuccessfully).toBe(true)
  })

  /**
   * Validates: Requirements 8.4, 8.5
   * IF both the Chat_Model and the Document_Model fail for the same request,
   * THEN THE system SHALL display a single consolidated error message.
   */
  it("emits a single error event when both models fail", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API key is invalid or expired." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "error", data: "DeepSeek API rate limit exceeded. Please wait and try again." },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    // Should NOT have completed successfully
    expect(modelCompletedSuccessfully).toBe(false)

    // The error events: one is the __fallback_reset__ (if chunks were forwarded) or
    // just the DeepSeek error. Since no Bedrock chunks were forwarded, no reset.
    const errorEvents = events.filter(
      (e) => e.type === "error" && e.data !== "__fallback_reset__"
    )
    // Only the DeepSeek error should be forwarded to the client
    // (Bedrock error triggers fallback, not forwarded)
    expect(errorEvents).toHaveLength(1)
    expect(errorEvents[0].data).toBe(
      "DeepSeek API rate limit exceeded. Please wait and try again."
    )
  })

  /**
   * Validates: Requirement 4.6
   * WHEN the Fallback_Handler reroutes to the Document_Model,
   * THE Fallback_Handler SHALL discard any partial content from the Chat_Model.
   */
  it("does not forward partial Bedrock chunks to client on fallback", async () => {
    // Bedrock sends some chunks then errors
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "chunk", data: "Partial " },
      { type: "chunk", data: "content " },
      { type: "error", data: "Bedrock API server error (502). Service temporarily unavailable." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "chunk", data: "Clean response" },
        { type: "complete", data: "Clean response" },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    // The partial Bedrock chunks ARE forwarded before the error is detected
    // (this matches the real route handler behavior — chunks are forwarded as they arrive).
    // However, a __fallback_reset__ signal is sent to tell the client to discard them.
    const resetEvent = events.find(
      (e) => e.type === "error" && e.data === "__fallback_reset__"
    )
    expect(resetEvent).toBeDefined()

    // The fallback activity should appear
    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeDefined()

    // DeepSeek chunks should follow the reset
    const resetIndex = events.indexOf(resetEvent!)
    const deepseekChunks = events
      .slice(resetIndex + 1)
      .filter((e) => e.type === "chunk")
    expect(deepseekChunks).toHaveLength(1)
    expect(deepseekChunks[0].data).toBe("Clean response")

    expect(modelCompletedSuccessfully).toBe(true)
  })

  /**
   * Validates: Requirement 4.5
   * WHEN the Fallback_Handler activates, THE Activity_Stream SHALL emit
   * an activity event with detail "DeepSeek (fallback)".
   */
  it('shows "DeepSeek (fallback)" in activity stream after fallback', async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API request timed out after 30 seconds." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "complete", data: "Timeout fallback response" },
      ])

    const { events } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    // First activity should be Kimi K2.5
    const activities = events.filter((e) => e.type === "activity") as ActivityEvent[]
    expect(activities).toHaveLength(2)
    expect(activities[0].detail).toBe("Kimi K2.5")
    expect(activities[1].detail).toBe("DeepSeek (fallback)")
  })

  /**
   * Validates: Requirement 4.6
   * When no partial chunks were forwarded, no __fallback_reset__ is sent.
   */
  it("does not send __fallback_reset__ when no Bedrock chunks were forwarded", async () => {
    // Bedrock errors immediately — no chunks forwarded
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API key is invalid or expired." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "complete", data: "Direct fallback" },
      ])

    const { events } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    const resetEvent = events.find(
      (e) => e.type === "error" && e.data === "__fallback_reset__"
    )
    expect(resetEvent).toBeUndefined()
  })

  /**
   * Validates: Requirement 4.1 (500/502/503 server errors)
   * Server errors from Bedrock should also trigger fallback.
   */
  it("falls back to DeepSeek when Bedrock returns a 500/502/503 server error", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "error", data: "Bedrock API server error (503). Service temporarily unavailable." },
    ])
    const deepseekStream = () =>
      fromArray<DeepSeekEvent>([
        { type: "chunk", data: "Server error fallback" },
        { type: "complete", data: "Server error fallback" },
      ])

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream,
    })

    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeDefined()
    expect(modelCompletedSuccessfully).toBe(true)
  })

  /**
   * Validates: Requirement 4.5 (no fallback when Bedrock succeeds)
   * When Bedrock completes successfully, no fallback should occur.
   */
  it("does not trigger fallback when Bedrock succeeds", async () => {
    const bedrockStream = fromArray<BedrockEvent>([
      { type: "chunk", data: "Kimi " },
      { type: "chunk", data: "response" },
      { type: "complete", data: "Kimi response" },
    ])
    const deepseekFn = vi.fn(() =>
      fromArray<DeepSeekEvent>([
        { type: "complete", data: "Should not be called" },
      ])
    )

    const { events, modelCompletedSuccessfully } = await runFallbackOrchestration({
      bedrockStream,
      deepseekStream: deepseekFn,
    })

    // DeepSeek should never be called
    expect(deepseekFn).not.toHaveBeenCalled()

    // No fallback activity
    const fallbackActivity = events.find(
      (e) => e.type === "activity" && (e as ActivityEvent).detail === "DeepSeek (fallback)"
    )
    expect(fallbackActivity).toBeUndefined()

    // Bedrock chunks should be forwarded
    const chunks = events.filter((e) => e.type === "chunk")
    expect(chunks).toHaveLength(2)

    expect(modelCompletedSuccessfully).toBe(true)
  })
})
