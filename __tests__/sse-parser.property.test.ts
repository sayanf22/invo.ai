/**
 * Property 5: SSE parser correctly reassembles events across arbitrary chunk boundaries
 * Feature: ai-dual-model-chat
 *
 * For any sequence of valid SSE events (each formatted as `data: {json}\n\n`),
 * when the concatenated byte stream is split at arbitrary positions into chunks
 * and fed sequentially to the SSE line-buffering parser, the parser SHALL extract
 * exactly the same set of parsed JSON objects as parsing the unsplit stream.
 * Additionally, if malformed JSON lines are interspersed among valid lines,
 * the parser SHALL skip malformed lines and still extract all valid events
 * without throwing.
 *
 * Validates: Requirements 2.2, 2.3, 3.4, 11.1, 11.3
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { parseSSEChunks } from "@/lib/sse-parser"

// ---------- Generators ----------

/** Generate a simple SSE event object (simulates OpenAI-compatible delta format) */
const sseEventObjectArb = fc.record({
    choices: fc.tuple(
        fc.record({
            delta: fc.record({
                content: fc.string({ minLength: 1, maxLength: 50 }),
            }),
            index: fc.constant(0),
        })
    ).map((choices) => choices),
    id: fc.string({ minLength: 1, maxLength: 10 }).map((s) => `chatcmpl-${s.replace(/\n/g, "")}`),
})

/** Serialize an event object as an SSE data line: `data: {json}\n\n` */
function serializeSSEEvent(event: unknown): string {
    return `data: ${JSON.stringify(event)}\n\n`
}

/** Generate a malformed JSON SSE line */
const malformedLineArb = fc.constantFrom(
    "data: {invalid json\n\n",
    "data: not-json-at-all\n\n",
    "data: {\"unclosed\": true\n\n",
    "data: [broken array\n\n",
    "data: undefined\n\n",
)

/**
 * Split a string at arbitrary positions into chunks.
 * Uses an array of random cut points to determine where to split.
 */
function splitAtPositions(text: string, cutPoints: number[]): string[] {
    if (text.length === 0) return [""]

    // Normalize cut points to valid indices within the string, sort, and deduplicate
    const normalized = [...new Set(
        cutPoints.map((p) => Math.abs(p) % (text.length + 1))
    )].sort((a, b) => a - b)

    const chunks: string[] = []
    let prev = 0
    for (const pos of normalized) {
        chunks.push(text.slice(prev, pos))
        prev = pos
    }
    chunks.push(text.slice(prev))

    return chunks.filter((c) => c.length > 0).length > 0
        ? chunks
        : [text] // Ensure at least one non-empty chunk if text is non-empty
}

// ---------- Property Tests ----------

describe("Feature: ai-dual-model-chat, Property 5: SSE parser correctly reassembles events across arbitrary chunk boundaries", () => {
    it("reassembles events identically regardless of chunk boundaries", () => {
        /**
         * Validates: Requirements 2.2, 2.3, 11.1
         *
         * Generate random arrays of valid SSE event objects, serialize them,
         * split the concatenated stream at random positions, feed through
         * the parser, and verify parsed events match originals exactly.
         */
        fc.assert(
            fc.property(
                fc.array(sseEventObjectArb, { minLength: 1, maxLength: 10 }),
                fc.array(fc.nat({ max: 5000 }), { minLength: 0, maxLength: 20 }),
                (events, cutPoints) => {
                    // Serialize all events into a single SSE stream
                    const fullStream = events.map(serializeSSEEvent).join("")

                    // Parse the unsplit stream as a single chunk (reference)
                    const reference = parseSSEChunks([fullStream])

                    // Split at random positions and parse as multiple chunks
                    const chunks = splitAtPositions(fullStream, cutPoints)
                    const chunked = parseSSEChunks(chunks)

                    // Both should produce the same parsed objects
                    expect(chunked.parsed).toEqual(reference.parsed)
                    // And both should match the original event count
                    expect(chunked.parsed.length).toBe(events.length)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("skips malformed JSON lines without affecting valid events", () => {
        /**
         * Validates: Requirements 3.4, 11.3
         *
         * Intersperse malformed JSON lines among valid events, split at
         * random positions, and verify that all valid events are still
         * parsed correctly while malformed lines are skipped.
         */
        fc.assert(
            fc.property(
                fc.array(sseEventObjectArb, { minLength: 1, maxLength: 8 }),
                fc.array(malformedLineArb, { minLength: 1, maxLength: 5 }),
                fc.array(fc.nat({ max: 5000 }), { minLength: 0, maxLength: 20 }),
                (validEvents, malformedLines, cutPoints) => {
                    // Build a stream that interleaves valid and malformed lines
                    const lines: string[] = []
                    let validIdx = 0
                    let malformedIdx = 0

                    // Alternate: valid, malformed, valid, malformed, ...
                    while (validIdx < validEvents.length || malformedIdx < malformedLines.length) {
                        if (validIdx < validEvents.length) {
                            lines.push(serializeSSEEvent(validEvents[validIdx]))
                            validIdx++
                        }
                        if (malformedIdx < malformedLines.length) {
                            lines.push(malformedLines[malformedIdx])
                            malformedIdx++
                        }
                    }

                    const fullStream = lines.join("")

                    // Split at random positions
                    const chunks = splitAtPositions(fullStream, cutPoints)
                    const result = parseSSEChunks(chunks)

                    // All valid events should be parsed
                    expect(result.parsed.length).toBe(validEvents.length)

                    // Verify each parsed event matches the corresponding original
                    for (let i = 0; i < validEvents.length; i++) {
                        expect(result.parsed[i]).toEqual(validEvents[i])
                    }

                    // Malformed lines should have been skipped
                    expect(result.skippedCount).toBeGreaterThanOrEqual(malformedLines.length)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("handles [DONE] sentinel without producing parsed events", () => {
        /**
         * Validates: Requirements 11.1
         *
         * When [DONE] lines appear in the stream (as is standard in
         * OpenAI-compatible SSE), they should be silently skipped.
         */
        fc.assert(
            fc.property(
                fc.array(sseEventObjectArb, { minLength: 1, maxLength: 8 }),
                fc.array(fc.nat({ max: 5000 }), { minLength: 0, maxLength: 15 }),
                (events, cutPoints) => {
                    // Serialize events and append [DONE] sentinel
                    const fullStream =
                        events.map(serializeSSEEvent).join("") + "data: [DONE]\n\n"

                    const chunks = splitAtPositions(fullStream, cutPoints)
                    const result = parseSSEChunks(chunks)

                    // [DONE] should not produce a parsed event
                    expect(result.parsed.length).toBe(events.length)
                    expect(result.skippedCount).toBe(0)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("empty chunks do not affect parsing", () => {
        /**
         * Validates: Requirements 2.2, 11.1
         *
         * Inserting empty strings among chunks should not change the result.
         */
        fc.assert(
            fc.property(
                fc.array(sseEventObjectArb, { minLength: 1, maxLength: 8 }),
                fc.array(fc.nat({ max: 5000 }), { minLength: 0, maxLength: 15 }),
                fc.array(fc.nat({ max: 10 }), { minLength: 1, maxLength: 10 }),
                (events, cutPoints, emptyPositions) => {
                    const fullStream = events.map(serializeSSEEvent).join("")
                    const chunks = splitAtPositions(fullStream, cutPoints)

                    // Insert empty strings at random positions
                    const chunksWithEmpties = [...chunks]
                    for (const pos of emptyPositions) {
                        const insertAt = pos % (chunksWithEmpties.length + 1)
                        chunksWithEmpties.splice(insertAt, 0, "")
                    }

                    const result = parseSSEChunks(chunksWithEmpties)
                    expect(result.parsed.length).toBe(events.length)

                    for (let i = 0; i < events.length; i++) {
                        expect(result.parsed[i]).toEqual(events[i])
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})
