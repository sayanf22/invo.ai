/**
 * Storage API — File Download & Delete
 *
 * GET  /api/storage/url?key={objectKey} — Stream file from R2
 * DELETE /api/storage/url?key={objectKey} — Delete file from R2
 *
 * SECURITY: Authenticates user, verifies object ownership via the user ID
 * segment in the object key. Signature keys skip the ownership check.
 */

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest } from "@/lib/api-auth"
import { getObject, deleteObject } from "@/lib/r2"

// ── Helpers ────────────────────────────────────────────────────────────

function extractUserIdFromKey(key: string): string | null {
  const segments = key.split("/")
  if (segments.length < 3) return null
  return segments[1] || null
}

function isSignatureKey(key: string): boolean {
  return key.startsWith("signatures/")
}

function verifyOwnership(key: string, userId: string): NextResponse | null {
  if (isSignatureKey(key)) return null
  const keyUserId = extractUserIdFromKey(key)
  if (!keyUserId || keyUserId !== userId) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 })
  }
  return null
}

// ── GET — Stream file from R2 ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json(
        { error: "Missing required parameter: key" },
        { status: 400 },
      )
    }

    const ownershipError = verifyOwnership(key, auth.user.id)
    if (ownershipError) return ownershipError

    const object = await getObject(key)
    if (!object) {
      return NextResponse.json({ error: "File not found." }, { status: 404 })
    }

    const headers = new Headers()
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream")
    headers.set("Cache-Control", "private, max-age=3600")
    if (object.size) headers.set("Content-Length", String(object.size))

    return new Response(object.body, { status: 200, headers })
  } catch (error) {
    console.error("Download API error:", error)
    return NextResponse.json(
      { error: "Failed to retrieve file." },
      { status: 500 },
    )
  }
}

// ── DELETE — Remove object from R2 ─────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json(
        { error: "Missing required parameter: key" },
        { status: 400 },
      )
    }

    const ownershipError = verifyOwnership(key, auth.user.id)
    if (ownershipError) return ownershipError

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
