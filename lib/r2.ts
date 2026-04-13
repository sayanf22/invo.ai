// lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { getSecret } from "@/lib/secrets"

let _client: S3Client | null = null

async function getR2Client(): Promise<S3Client> {
  if (_client) return _client
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
  })
  return _client
}

export async function getBucketName(): Promise<string> {
  const bucket = await getSecret("R2_BUCKET_NAME")
  if (!bucket) throw new Error("Missing R2_BUCKET_NAME environment variable")
  return bucket
}

export async function generatePresignedPutUrl(
  objectKey: string,
  contentType: string,
  maxSizeBytes?: number
): Promise<string> {
  const client = await getR2Client()
  const bucket = await getBucketName()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: contentType,
    ...(maxSizeBytes ? { ContentLength: maxSizeBytes } : {}),
  })
  // Security: PUT URL expires in 5 minutes (≤ 15 min max per Requirement 6.5 — compliant)
  return getSignedUrl(client, command, { expiresIn: 300 })
}

export async function generatePresignedGetUrl(objectKey: string): Promise<string> {
  const client = await getR2Client()
  const bucket = await getBucketName()
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey })
  // Security: GET URL expires in 1 hour (≤ 1 hour max per Requirement 6.6 — compliant)
  return getSignedUrl(client, command, { expiresIn: 3600 })
}

export async function deleteObject(objectKey: string): Promise<void> {
  const client = await getR2Client()
  const bucket = await getBucketName()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }))
}
