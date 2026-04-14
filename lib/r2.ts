// lib/r2.ts
//
// R2 storage operations with dual strategy:
// 1. Native R2 binding via getCloudflareContext() — used in production (Cloudflare Workers)
// 2. S3 SDK fallback — used in local development (next dev)
//
// The native binding avoids the @aws-sdk __name issue on Workers runtime.

import { getSecret } from "@/lib/secrets"

// ── Native R2 binding (Cloudflare Workers) ──────────────────────────

async function getNativeR2Bucket(): Promise<R2Bucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const ctx = await getCloudflareContext()
    const bucket = (ctx.env as any).R2_BUCKET as R2Bucket | undefined
    return bucket ?? null
  } catch {
    return null
  }
}

// ── S3 SDK fallback (local development) ─────────────────────────────

let _client: any = null

async function getS3Client() {
  if (_client) return _client
  const { S3Client } = await import("@aws-sdk/client-s3")
  const accountId = await getSecret("R2_ACCOUNT_ID")
  const accessKeyId = await getSecret("R2_ACCESS_KEY_ID")
  const secretAccessKey = await getSecret("R2_SECRET_ACCESS_KEY")
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing R2 credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY")
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })
  return _client
}

export async function getBucketName(): Promise<string> {
  const bucket = await getSecret("R2_BUCKET_NAME")
  if (!bucket) throw new Error("Missing R2_BUCKET_NAME environment variable")
  return bucket
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Upload a file to R2.
 * Uses native binding on Workers, S3 SDK locally.
 */
export async function uploadToR2(
  objectKey: string,
  body: Uint8Array | ArrayBuffer,
  contentType: string
): Promise<void> {
  const nativeBucket = await getNativeR2Bucket()
  if (nativeBucket) {
    await nativeBucket.put(objectKey, body, {
      httpMetadata: { contentType },
    })
    return
  }

  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const client = await getS3Client()
  const bucket = await getBucketName()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: new Uint8Array(body instanceof ArrayBuffer ? body : body),
    ContentType: contentType,
  }))
}

/**
 * Generate a presigned PUT URL for direct browser upload.
 */
export async function generatePresignedPutUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes?: number
): Promise<string> {
  const { PutObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const client = await getS3Client()
  const bucket = await getBucketName()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
  })
  return getSignedUrl(client, command, { expiresIn: 300 })
}

/**
 * Get an object from R2 as an ArrayBuffer + content type.
 * Uses native binding on Workers, S3 SDK locally.
 * This eliminates the need for presigned GET URLs in production.
 */
export async function getObject(objectKey: string): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  // Try native R2 binding first (Cloudflare Workers)
  try {
    const nativeBucket = await getNativeR2Bucket()
    if (nativeBucket) {
      const obj = await nativeBucket.get(objectKey)
      if (!obj) return null
      const body = await obj.arrayBuffer()
      const contentType = obj.httpMetadata?.contentType || "application/octet-stream"
      return { body, contentType }
    }
  } catch (err) {
    console.error("Native R2 getObject failed, falling back to S3 SDK:", err instanceof Error ? err.message : err)
  }

  // S3 SDK fallback (local dev or native binding failure)
  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const client = await getS3Client()
  const bucket = await getBucketName()
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))
  if (!res.Body) return null
  const body = await res.Body.transformToByteArray()
  const contentType = res.ContentType || "application/octet-stream"
  return { body: body.buffer as ArrayBuffer, contentType }
}

/**
 * Generate a presigned GET URL for downloading a file.
 * @deprecated Use getObject() instead — avoids S3 SDK on Workers.
 * Kept for backward compatibility with tests.
 */
export async function generatePresignedGetUrl(objectKey: string): Promise<string> {
  const { GetObjectCommand } = await import("@aws-sdk/client-s3")
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner")
  const client = await getS3Client()
  const bucket = await getBucketName()
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  return getSignedUrl(client, command, { expiresIn: 3600 })
}

/**
 * Delete an object from R2.
 * Uses native binding on Workers, S3 SDK locally.
 */
export async function deleteObject(objectKey: string): Promise<void> {
  const nativeBucket = await getNativeR2Bucket()
  if (nativeBucket) {
    await nativeBucket.delete(objectKey)
    return
  }

  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3")
  const client = await getS3Client()
  const bucket = await getBucketName()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
