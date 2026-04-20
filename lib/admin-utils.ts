/**
 * Admin utility helpers — shared across admin API routes.
 */

import type { NextRequest } from "next/server"

/** UUID v4 regex for validating user IDs from path params */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Validate that a string is a valid UUID v4.
 * Use this on all path params in admin routes to prevent injection.
 */
export function isValidUUID(id: string): boolean {
  return typeof id === "string" && UUID_REGEX.test(id)
}

/**
 * Get the real client IP from a request.
 * Checks Cloudflare header first, then x-forwarded-for, then x-real-ip.
 */
export function getAdminClientIP(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  )
}
