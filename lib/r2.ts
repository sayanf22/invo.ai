/**
 * R2 Storage Service — Native Cloudflare R2 Bindings
 *
 * Uses Cloudflare Workers native R2 bindings (zero external dependencies).
 * The R2 bucket is bound as `R2_BUCKET` in wrangler.json.
 *
 * In the Workers runtime, bindings are available on `process.env` (via OpenNext)
 * or `globalThis`. This module abstracts the binding lookup.
 */

// ── R2 Bucket Binding ──────────────────────────────────────────────────

/**
 * Retrieve the R2 bucket binding from the Workers runtime.
 * OpenNext exposes Cloudflare bindings on process.env at runtime.
 */
function getR2Bucket(): R2Bucket {
  // OpenNext / Cloudflare Workers expose bindings on process.env
  const bucket = (process.env as any).R2_BUCKET ?? (globalThis as any).R2_BUCKET
  if (!bucket || typeof bucket.put !== "function") {
    throw new Error(
      "R2_BUCKET binding not found. Ensure the R2 bucket is bound in wrangler.json."
    )
  }
  return bucket as R2Bucket
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Upload a file to R2.
 * Called server-side from API routes — the file body is passed directly.
 */
export async function putObject(
  objectKey: string,
  body: ReadableStream | ArrayBuffer | Uint8Array | string,
  contentType: string
): Promise<void> {
  const bucket = getR2Bucket()
  await bucket.put(objectKey, body, {
    httpMetadata: { contentType },
  })
}

/**
 * Get an object from R2.
 * Returns the R2ObjectBody (with .body ReadableStream) or null if not found.
 */
export async function getObject(
  objectKey: string
): Promise<R2ObjectBody | null> {
  const bucket = getR2Bucket()
  return bucket.get(objectKey)
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const bucket = getR2Bucket()
  await bucket.delete(objectKey)
}
