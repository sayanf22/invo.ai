/**
 * GET /api/public/logo/[userId]  (public, no auth)
 *
 * Streams a business's logo image so it can be embedded in contexts that
 * cannot authenticate: outbound emails (Gmail/Outlook/Apple Mail all block
 * data: URI images, and the logo is stored as a private R2 key, not a public
 * URL) and public pages (/onboard/[token], /sign/[token]) that intentionally
 * have no session.
 *
 * This intentionally exposes ONLY the logo image bytes for a given userId —
 * no other business data. A logo is inherently meant to be shown to the
 * business's own recipients (clients, signers), so this is not a data leak;
 * it mirrors how every other SaaS (Stripe, DocuSign, DocuSign-alikes) serves
 * branded-email logos from a public CDN path keyed by account/org id.
 *
 * SECURITY:
 * - userId must be a valid UUID (rejects path traversal / injection attempts).
 * - IP-based rate limiting (public route, no user to key off of).
 * - Long, immutable cache — logo keys change on re-upload, so caching by the
 *   current key is safe and avoids hammering R2/Supabase on every email open.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getObject } from "@/lib/r2"
import { getClientIP } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// In-memory IP throttle: 60 req/min per IP. Logo requests are read-only and
// cheap, but this is a public unauthenticated endpoint so it still needs a
// floor against abuse/scraping.
const throttle = new Map<string, { ts: number; count: number }>()
function isThrottled(ip: string): boolean {
  const now = Date.now()
  const entry = throttle.get(ip)
  if (!entry || now - entry.ts >= 60_000) {
    throttle.set(ip, { ts: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > 60
}

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
}
function getMimeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() || ""
  return MIME_MAP[ext] || "image/png"
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ip = getClientIP(request)
    if (isThrottled(ip)) {
      return new NextResponse("Too many requests", { status: 429 })
    }

    const { userId } = await params
    if (!UUID_RE.test(userId)) {
      return new NextResponse("Not found", { status: 404 })
    }

    const admin = serviceClient()
    const { data: business } = await admin
      .from("businesses")
      .select("logo_url")
      .eq("user_id", userId)
      .single()

    const logoKey = (business as { logo_url: string | null } | null)?.logo_url
    if (!logoKey) {
      return new NextResponse("Not found", { status: 404 })
    }

    // Already an absolute URL (legacy data) — redirect instead of proxying.
    if (logoKey.startsWith("http://") || logoKey.startsWith("https://")) {
      return NextResponse.redirect(logoKey, 302)
    }

    // Path traversal guard, mirroring /api/storage/image.
    if (logoKey.includes("..") || logoKey.startsWith("/") || logoKey.startsWith("\\")) {
      return new NextResponse("Not found", { status: 404 })
    }

    const obj = await getObject(logoKey)
    if (!obj) {
      return new NextResponse("Not found", { status: 404 })
    }

    const mime = obj.contentType && obj.contentType !== "application/octet-stream"
      ? obj.contentType
      : getMimeFromKey(logoKey)

    return new Response(obj.body, {
      headers: {
        "Content-Type": mime,
        // Immutable-ish: keyed by the CURRENT logo_url, so a re-upload changes
        // the underlying R2 key and this cached response naturally goes stale.
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    })
  } catch (error) {
    console.error("Public logo error:", error instanceof Error ? error.message : error)
    return new NextResponse("Not found", { status: 404 })
  }
}
