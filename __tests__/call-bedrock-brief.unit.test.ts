/**
 * Unit tests for callBedrockBrief() — non-streaming Bedrock call
 * Feature: kimi-rag-orchestrator, Task 1.3
 *
 * Validates: Requirements 1.3, 3.5, 6.2
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { callBedrockBrief } from "@/lib/bedrock"

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchResponse(body: unknown, status = 200, statusText = "OK") {
    return vi.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        statusText,
        json: () => Promise.resolve(body),
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("callBedrockBrief() unit tests", () => {
    const originalFetch = globalThis.fetch

    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {})
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
        vi.restoreAllMocks()
    })

    /**
     * Test successful response returns text string.
     * Validates: Requirement 1.3 (graceful handling), 6.2 (timeout/error handling)
     */
    it("returns text string on successful response", async () => {
        const responseBody = {
            choices: [{ message: { content: "Business is based in India with INR currency." } }],
        }
        globalThis.fetch = mockFetchResponse(responseBody)

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBe("Business is based in India with INR currency.")
        expect(globalThis.fetch).toHaveBeenCalledTimes(1)

        // Verify the request body includes stream: false
        const callArgs = (globalThis.fetch as any).mock.calls[0]
        const requestBody = JSON.parse(callArgs[1].body)
        expect(requestBody.stream).toBe(false)
        expect(requestBody.max_tokens).toBe(100)
        expect(requestBody.temperature).toBe(0.2)
    })

    /**
     * Test HTTP error returns null and logs error.
     * Validates: Requirement 1.3 (continue without commentary on failure)
     */
    it("returns null and logs error on HTTP 500", async () => {
        globalThis.fetch = mockFetchResponse({}, 500, "Internal Server Error")

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBeNull()
        expect(console.error).toHaveBeenCalledWith(
            "[callBedrockBrief] HTTP error",
            expect.objectContaining({ status: 500 })
        )
    })

    /**
     * Test timeout returns null and logs error.
     * Validates: Requirement 3.5 (timeout → skip validation), 6.2 (30s timeout)
     */
    it("returns null and logs error on timeout (AbortError)", async () => {
        const abortError = new DOMException("The operation was aborted.", "AbortError")
        globalThis.fetch = vi.fn().mockRejectedValue(abortError)

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBeNull()
        expect(console.error).toHaveBeenCalledWith(
            "[callBedrockBrief] Request timed out after 30 seconds"
        )
    })

    /**
     * Test empty/invalid API key returns null.
     * Validates: Requirement 6.2 (error handling)
     */
    it("returns null for empty API key", async () => {
        globalThis.fetch = vi.fn()

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "",
            100
        )

        expect(result).toBeNull()
        expect(globalThis.fetch).not.toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
            "[callBedrockBrief] Missing or empty API key"
        )
    })

    it("returns null for whitespace-only API key", async () => {
        globalThis.fetch = vi.fn()

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "   ",
            100
        )

        expect(result).toBeNull()
        expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    /**
     * Test JSON parse failure returns null.
     * Validates: Requirement 6.2 (error handling)
     */
    it("returns null when response JSON has no valid content", async () => {
        // Response JSON is valid but has unexpected structure (no choices)
        globalThis.fetch = mockFetchResponse({ unexpected: "structure" })

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBeNull()
        expect(console.error).toHaveBeenCalledWith(
            "[callBedrockBrief] Empty or invalid response body",
            expect.anything()
        )
    })

    it("returns null when response.json() throws", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: () => Promise.reject(new Error("Invalid JSON")),
        })

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBeNull()
        expect(console.error).toHaveBeenCalled()
    })

    /**
     * Test that empty string content returns null.
     */
    it("returns null when content is empty string", async () => {
        const responseBody = {
            choices: [{ message: { content: "   " } }],
        }
        globalThis.fetch = mockFetchResponse(responseBody)

        const result = await callBedrockBrief(
            "You are a reviewer.",
            "Summarize this business.",
            "valid-api-key-that-is-long-enough",
            100
        )

        expect(result).toBeNull()
    })
})
