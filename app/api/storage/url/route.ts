/**
 * Download API — Presigned GET URL Generation
 *
 * SECURITY: Authenticates user, verifies object ownership via the user ID
 * segment in the object key, then returns a short-lived presigned GET URL.
 * Signature keys skip the ownership check (server-side only access).
 *
 * GET /api/storage/url?key={objectKey}
 * Response: { url: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { generatePresignedGetUrl, deleteObject } from "@/lib/r2"

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract the user ID segment from an object key.
 * Standard pattern: {category}/{user_id}/{uuid}.{ext}
 * The user ID is always the second segment.
 */
function extractUserIdFromKey(key: string): string | null {
  const segments = key.split("/")
  if (segments.length < 3) return null
  return segments[1] || null
}

/**
 * Check if the key is a signature key.
 * Signature keys follow: signatures/{signature_id}_{timestamp}.png
 * These are not user-scoped — external signers submit via token-based access.
 */
function isSignatureKey(key: string): boolean {
  return key.startsWith("signatures/")
}

// ── Route handler ──────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // 2. Extract key from query params
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json(
        { error: "Missing required parameter: key" },
        { status: 400 },
      )
    }

    // 3. Verify ownership (skip for signature keys)
    if (!isSignatureKey(key)) {
      const keyUserId = extractUserIdFromKey(key)
      if (!keyUserId || keyUserId !== auth.user.id) {
        return NextResponse.json(
          { error: "Access denied." },
          { status: 403 },
        )
      }
    }

    // 4. Generate presigned GET URL (1 hour TTL)
    const url = await generatePresignedGetUrl(key)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json(
      { error: "Failed to generate download URL." },
      { status: 500 },
    )
  }
}


// ── DELETE handler — Remove object from R2 ─────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    // 2. Extract key from query params
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json(
        { error: "Missing required parameter: key" },
        { status: 400 },
      )
    }

    // 3. Verify ownership (skip for signature keys)
    if (!isSignatureKey(key)) {
      const keyUserId = extractUserIdFromKey(key)
      if (!keyUserId || keyUserId !== auth.user.id) {
        return NextResponse.json(
          { error: "Access denied." },
          { status: 403 },
        )
      }
    }

    // 4. Delete object from R2
    await deleteObject(key)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete API error:", error)
    return NextResponse.json(
      { error: "Failed to delete object." },
      { status: 500 },
    )
  }
}
