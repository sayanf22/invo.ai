import { createHash } from "crypto"

/**
 * Replacer function that recursively sorts object keys at all nesting levels,
 * ensuring a deterministic canonical JSON serialization.
 */
function sortedKeysReplacer(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k]
    }
    return sorted
  }
  return value
}

/**
 * Compute a SHA-256 fingerprint of the canonical document JSON.
 * The input is the `context` JSONB field from document_sessions.
 * Keys are sorted recursively at all nesting levels to ensure deterministic serialization.
 *
 * @returns A 64-char lowercase hex string.
 */
export function computeDocumentFingerprint(context: Record<string, unknown>): string {
  const canonical = JSON.stringify(context, sortedKeysReplacer)
  return createHash("sha256").update(canonical, "utf8").digest("hex")
}
