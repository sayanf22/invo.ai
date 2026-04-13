/**
 * Property-based tests for sanitization module
 * Feature: security-hardening, Properties 5, 6, 7, 8
 */

import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
    sanitizeText,
    sanitizeEmail,
    sanitizeObject,
    sanitizeFileName,
} from "@/lib/sanitize"

// ── Property 5: HTML and control character sanitization ────────────────

describe("Feature: security-hardening, Property 5: HTML and control character sanitization", () => {
    /**
     * Validates: Requirements 3.1, 3.2
     *
     * For any input string, sanitizeText SHALL produce output containing
     * no HTML tags (<...>) and no control characters (U+0000–U+001F)
     * except tab (U+0009), newline (U+000A), and carriage return (U+000D).
     */
    it("output contains no HTML tags", () => {
        fc.assert(
            fc.property(
                fc.string(),
                (input) => {
                    const result = sanitizeText(input)
                    expect(result).not.toMatch(/<[^>]*>/)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("output contains no control characters except tab, newline, and CR", () => {
        fc.assert(
            fc.property(
                fc.string(),
                (input) => {
                    const result = sanitizeText(input)
                    for (const ch of result) {
                        const code = ch.charCodeAt(0)
                        if (code <= 0x1f) {
                            expect([0x09, 0x0a, 0x0d]).toContain(code)
                        }
                        expect(code).not.toBe(0x7f)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })

    it("strips HTML tags from strings containing them", () => {
        fc.assert(
            fc.property(
                fc.tuple(fc.string(), fc.string(), fc.string()).map(
                    ([before, tag, after]) => `${before}<${tag}>${after}`
                ),
                (input) => {
                    const result = sanitizeText(input)
                    expect(result).not.toMatch(/<[^>]*>/)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("removes injected control characters while preserving tab/newline/CR", () => {
        // Build strings with explicit control chars mixed in
        const controlCharArb = fc.oneof(
            fc.constant("\x00"), fc.constant("\x01"), fc.constant("\x07"),
            fc.constant("\x08"), fc.constant("\x0B"), fc.constant("\x0E"),
            fc.constant("\x1F"), fc.constant("\x7F"),
            fc.constant("\t"), fc.constant("\n"), fc.constant("\r"),
            fc.constant("a"), fc.constant("b"), fc.constant(" ")
        )
        fc.assert(
            fc.property(
                fc.array(controlCharArb, { minLength: 1, maxLength: 50 }).map(arr => arr.join("")),
                (input) => {
                    const result = sanitizeText(input)
                    for (const ch of result) {
                        const code = ch.charCodeAt(0)
                        if (code <= 0x1f) {
                            expect([0x09, 0x0a, 0x0d]).toContain(code)
                        }
                        expect(code).not.toBe(0x7f)
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ── Property 6: Email validation rejects malformed addresses ───────────

describe("Feature: security-hardening, Property 6: Email validation rejects malformed addresses", () => {
    /**
     * Validates: Requirements 3.3
     *
     * For any string containing consecutive dots (..), a leading dot before @,
     * or not matching the basic user@domain.tld pattern, sanitizeEmail SHALL
     * throw an error. For any well-formed email, it SHALL return the lowercase
     * trimmed version.
     */

    /** Arbitrary for a simple alphanumeric string of given length range */
    const alphaNum = (min: number, max: number) =>
        fc.stringMatching(new RegExp(`^[a-z0-9]{${min},${max}}$`))

    const alpha = (min: number, max: number) =>
        fc.stringMatching(new RegExp(`^[a-z]{${min},${max}}$`))

    it("rejects emails with consecutive dots", () => {
        fc.assert(
            fc.property(
                fc.tuple(alphaNum(1, 10), alphaNum(1, 10), alpha(2, 5))
                    .map(([a, b, domain]) => `${a}..${b}@${domain}.com`),
                (email) => {
                    expect(() => sanitizeEmail(email)).toThrow("Invalid email format")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("rejects emails starting with a dot before @", () => {
        fc.assert(
            fc.property(
                fc.tuple(alphaNum(1, 10), alpha(2, 5))
                    .map(([local, domain]) => `.${local}@${domain}.com`),
                (email) => {
                    expect(() => sanitizeEmail(email)).toThrow("Invalid email format")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("rejects strings not matching user@domain.tld pattern", () => {
        fc.assert(
            fc.property(
                fc.oneof(
                    fc.constant("plaintext"),
                    fc.constant("missing@tld"),
                    fc.constant("@nodomain.com"),
                    fc.constant("spaces in@email.com"),
                    // Generate random strings without @ sign
                    fc.stringMatching(/^[a-z]{3,20}$/)
                ),
                (input) => {
                    expect(() => sanitizeEmail(input)).toThrow()
                }
            ),
            { numRuns: 100 }
        )
    })

    it("returns lowercase trimmed version for well-formed emails", () => {
        fc.assert(
            fc.property(
                fc.tuple(alphaNum(1, 15), alpha(2, 10), alpha(2, 5))
                    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
                (email) => {
                    const result = sanitizeEmail(email)
                    expect(result).toBe(email.toLowerCase().trim())
                }
            ),
            { numRuns: 100 }
        )
    })
})


// ── Property 7: Recursive object sanitization with depth limit ─────────

describe("Feature: security-hardening, Property 7: Recursive object sanitization with depth limit", () => {
    /**
     * Validates: Requirements 3.4, 3.5
     *
     * For any nested object with string values at depth ≤ 10, sanitizeObject
     * SHALL return an equivalent object where every string value has been
     * sanitized. For any object nested deeper than 10 levels, sanitizeObject
     * SHALL throw "Object nesting too deep".
     */

    function buildNested(depth: number, leafValue: string): Record<string, unknown> {
        if (depth <= 1) return { value: leafValue }
        return { nested: buildNested(depth - 1, leafValue) }
    }

    function getLeaf(obj: Record<string, unknown>, depth: number): string {
        if (depth <= 1) return obj.value as string
        return getLeaf(obj.nested as Record<string, unknown>, depth - 1)
    }

    it("sanitizes string values at depth ≤ 10", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                fc.constant("<script>alert('xss')</script>hello"),
                (depth, leafValue) => {
                    const input = buildNested(depth, leafValue)
                    const result = sanitizeObject(input)
                    const leaf = getLeaf(result as Record<string, unknown>, depth)
                    expect(leaf).not.toMatch(/<[^>]*>/)
                    expect(leaf).toContain("hello")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("throws 'Object nesting too deep' at depth > 10", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 11, max: 15 }),
                (depth) => {
                    const input = buildNested(depth, "test")
                    expect(() => sanitizeObject(input)).toThrow("Object nesting too deep")
                }
            ),
            { numRuns: 100 }
        )
    })

    it("sanitizes all string values in flat objects", () => {
        fc.assert(
            fc.property(
                fc.dictionary(
                    fc.stringMatching(/^[a-z]{1,5}$/),
                    fc.string()
                ),
                (obj) => {
                    const result = sanitizeObject(obj)
                    for (const key of Object.keys(result)) {
                        const val = (result as Record<string, unknown>)[key]
                        if (typeof val === "string") {
                            expect(val).not.toMatch(/<[^>]*>/)
                        }
                    }
                }
            ),
            { numRuns: 100 }
        )
    })
})

// ── Property 8: File name sanitization removes dangerous sequences ─────

describe("Feature: security-hardening, Property 8: File name sanitization removes dangerous sequences", () => {
    /**
     * Validates: Requirements 3.7
     *
     * For any input string, sanitizeFileName SHALL produce output containing
     * no path traversal sequences (..), no path separators (/, \\), no null
     * bytes, and length ≤ 255 characters.
     */
    it("output contains no path traversal sequences, separators, or null bytes", () => {
        // Generate strings that include dangerous characters
        const dangerousCharArb = fc.oneof(
            fc.constant("."), fc.constant(".."), fc.constant("/"),
            fc.constant("\\"), fc.constant("\0"),
            fc.constant("a"), fc.constant("b"), fc.constant("c"),
            fc.constant("."), fc.constant("t"), fc.constant("x")
        )
        fc.assert(
            fc.property(
                fc.array(dangerousCharArb, { minLength: 1, maxLength: 300 }).map(arr => arr.join("")),
                (input) => {
                    let result: string
                    try {
                        result = sanitizeFileName(input)
                    } catch {
                        // "File name required" or "Invalid file name" is acceptable
                        return
                    }
                    expect(result).not.toContain("..")
                    expect(result).not.toContain("/")
                    expect(result).not.toContain("\\")
                    expect(result).not.toContain("\0")
                    expect(result.length).toBeLessThanOrEqual(255)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("removes null bytes from file names", () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.stringMatching(/^[a-z0-9]{1,10}$/),
                    fc.stringMatching(/^[a-z0-9]{1,10}$/),
                ).map(([a, b]) => `${a}\0${b}.txt`),
                (input) => {
                    const result = sanitizeFileName(input)
                    expect(result).not.toContain("\0")
                    expect(result.length).toBeGreaterThan(0)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("truncates file names longer than 255 characters", () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^[a-z]{256,500}$/),
                (input) => {
                    const result = sanitizeFileName(input)
                    expect(result.length).toBeLessThanOrEqual(255)
                }
            ),
            { numRuns: 100 }
        )
    })

    it("removes path traversal sequences from file names", () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.stringMatching(/^[a-z]{1,10}$/),
                    fc.stringMatching(/^[a-z]{1,10}$/),
                ).map(([a, b]) => `${a}/../${b}.txt`),
                (input) => {
                    const result = sanitizeFileName(input)
                    expect(result).not.toContain("..")
                    expect(result).not.toContain("/")
                    expect(result).not.toContain("\\")
                }
            ),
            { numRuns: 100 }
        )
    })
})
