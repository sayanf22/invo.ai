/**
 * Shared encoding utilities for fixing mojibake sequences that arise when
 * UTF-8 bytes are re-interpreted as Latin-1/Windows-1252.
 *
 * The most common case is the em dash (U+2014, bytes E2 80 94) being decoded
 * as three separate Latin-1 characters: â (U+00E2), € (U+0080), " (U+0094).
 */

/**
 * Replace literal mojibake sequences with their correct Unicode equivalents.
 * Handles the most common case: UTF-8 smart punctuation read as Latin-1.
 *
 * Call this on any string that may have passed through a Latin-1 decode layer.
 */
export function fixEncoding(str: string): string {
  return str
    .replace(/\u00e2\u0080\u0094/g, "\u2014") // â€" → — (em dash)
    .replace(/\u00e2\u0080\u0093/g, "\u2013") // â€" → – (en dash)
    .replace(/\u00e2\u0080\u009c/g, "\u201c") // â€œ → " (left double quote)
    .replace(/\u00e2\u0080\u009d/g, "\u201d") // â€  → " (right double quote)
    .replace(/\u00e2\u0080\u0098/g, "\u2018") // â€˜ → ' (left single quote)
    .replace(/\u00e2\u0080\u0099/g, "\u2019") // â€™ → ' (right single quote)
}

/**
 * Returns `true` when the string contains no detectable mojibake byte patterns,
 * `false` when at least one mojibake sequence is found.
 *
 * Use this to validate that a string round-tripped correctly through the
 * encoding pipeline.
 */
export function isCleanUtf8(str: string): boolean {
  return !/[\u00e2][\u0080][\u0094\u0093\u009c\u009d\u0098\u0099]/.test(str)
}
