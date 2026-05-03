/**
 * SSE line-buffering parser extracted from lib/bedrock.ts and lib/deepseek.ts.
 *
 * This module provides a testable, pure function that implements the same
 * SSE parsing logic used by both the Bedrock and DeepSeek streaming clients:
 *   1. Accumulate incoming text in a buffer
 *   2. Split on newlines
 *   3. Keep the last (potentially incomplete) part in the buffer
 *   4. For each complete line, check if it starts with "data: ", skip "[DONE]",
 *      try JSON.parse, and yield the parsed object
 *
 * The parser is stateful (maintains an internal buffer) and processes chunks
 * sequentially, yielding parsed JSON objects as they become available.
 */

export interface SSEParseResult<T = unknown> {
    /** Successfully parsed JSON objects from SSE data lines */
    parsed: T[]
    /** Number of malformed JSON lines that were skipped */
    skippedCount: number
}

/**
 * Creates a stateful SSE line-buffering parser.
 *
 * Feed chunks of text sequentially via `push()`, then call `flush()` to
 * process any remaining buffered data. Collect results from both.
 */
export function createSSEParser<T = unknown>() {
    let buffer = ""

    /**
     * Push a chunk of text into the parser. Returns any complete, valid
     * SSE data-line JSON objects parsed from the accumulated buffer.
     */
    function push(chunk: string): SSEParseResult<T> {
        const parsed: T[] = []
        let skippedCount = 0

        buffer += chunk

        // Split on newlines, keep the last (potentially incomplete) part in the buffer
        const parts = buffer.split("\n")
        buffer = parts.pop() || ""

        for (const rawLine of parts) {
            const line = rawLine.trim()
            if (!line.startsWith("data: ")) continue

            const data = line.slice(6)
            if (data === "[DONE]") continue

            try {
                const obj = JSON.parse(data) as T
                parsed.push(obj)
            } catch {
                // Skip invalid JSON chunks
                skippedCount++
            }
        }

        return { parsed, skippedCount }
    }

    /**
     * Flush any remaining data in the buffer. Call this after all chunks
     * have been pushed to ensure no trailing data line is lost.
     */
    function flush(): SSEParseResult<T> {
        const parsed: T[] = []
        let skippedCount = 0

        if (buffer.trim()) {
            const line = buffer.trim()
            buffer = ""

            if (line.startsWith("data: ")) {
                const data = line.slice(6)
                if (data !== "[DONE]") {
                    try {
                        const obj = JSON.parse(data) as T
                        parsed.push(obj)
                    } catch {
                        skippedCount++
                    }
                }
            }
        }

        return { parsed, skippedCount }
    }

    return { push, flush }
}

/**
 * Parse a complete SSE text stream (or array of chunks) into JSON objects.
 *
 * This is a convenience wrapper around `createSSEParser` for cases where
 * all chunks are available upfront.
 */
export function parseSSEChunks<T = unknown>(chunks: string[]): SSEParseResult<T> {
    const parser = createSSEParser<T>()
    const allParsed: T[] = []
    let totalSkipped = 0

    for (const chunk of chunks) {
        const result = parser.push(chunk)
        allParsed.push(...result.parsed)
        totalSkipped += result.skippedCount
    }

    const flushResult = parser.flush()
    allParsed.push(...flushResult.parsed)
    totalSkipped += flushResult.skippedCount

    return { parsed: allParsed, skippedCount: totalSkipped }
}
