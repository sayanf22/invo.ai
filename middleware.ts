import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * Server-side middleware for Supabase auth.
 *
 * 1. Refreshes the session on every navigation (keeps long-lived sessions alive).
 * 2. Redirects unauthenticated users away from protected routes.
 * 3. Redirects authenticated users away from auth pages (login/signup).
 * 4. Edge-runtime compatible (works on Cloudflare Workers).
 */

// ── Public routes that don't require auth ──────────────────────────────
const PUBLIC_PATHS = [
  "/auth",
  "/pricing",
  "/features",
  "/resources",
  "/use-cases",
  "/developers",
  "/sign",
  "/api",
]

function isPublicPath(pathname: string): boolean {
  // Root landing page is protected (dashboard)
  if (pathname === "/") return false
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

// ── Cookie helpers (same chunked format as lib/supabase.ts) ────────────
function getAuthTokenFromCookies(request: NextRequest): string | null {
  const allCookies = request.cookies.getAll()
  const authCookies = allCookies.filter(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  )
  if (authCookies.length === 0) return null

  const baseName = authCookies[0].name.replace(/\.\d+$/, "")
  const chunks = allCookies
    .filter((c) => c.name === baseName || c.name.startsWith(baseName + "."))
    .sort((a, b) => {
      const aIdx = a.name.includes(".") ? parseInt(a.name.split(".").pop()!) : -1
      const bIdx = b.name.includes(".") ? parseInt(b.name.split(".").pop()!) : -1
      return aIdx - bIdx
    })
    .map((c) => c.value)
    .join("")

  return chunks || null
}

function parseAuthToken(raw: string): { access_token?: string; refresh_token?: string } | null {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const response = NextResponse.next()

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return response
  }

  // ── Read auth token from cookies ─────────────────────────────────────
  const rawToken = getAuthTokenFromCookies(request)
  const parsed = rawToken ? parseAuthToken(rawToken) : null
  const accessToken = parsed?.access_token
  const refreshToken = parsed?.refresh_token

  let isAuthenticated = false

  if (accessToken) {
    // Quick JWT expiry check (avoid network call if token is clearly valid)
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]))
      const exp = payload.exp * 1000
      const now = Date.now()

      if (exp > now + 60_000) {
        // Token valid for >1 minute — no refresh needed
        isAuthenticated = true
      } else if (refreshToken) {
        // Token expired or about to expire — try refreshing
        const refreshed = await refreshSession(accessToken, refreshToken)
        if (refreshed) {
          isAuthenticated = true
          // Write refreshed tokens back to cookies
          writeAuthCookies(response, refreshed.rawJson, request)
        }
      }
    } catch {
      // JWT decode failed — try refresh as fallback
      if (refreshToken) {
        const refreshed = await refreshSession(accessToken, refreshToken)
        if (refreshed) {
          isAuthenticated = true
          writeAuthCookies(response, refreshed.rawJson, request)
        }
      }
    }
  }

  // ── Route protection ─────────────────────────────────────────────────
  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages (except callback/confirm)
  if (
    isAuthenticated &&
    pathname.startsWith("/auth") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/confirm") &&
    !pathname.startsWith("/auth/update-password")
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

// ── Refresh session via Supabase REST API (edge-compatible) ────────────
async function refreshSession(
  _accessToken: string,
  refreshToken: string
): Promise<{ rawJson: string } | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return null

    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) return null

    const data = await res.json()
    if (!data.access_token || !data.refresh_token) return null

    // Build the same JSON structure the client stores
    const tokenObj = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || "bearer",
      expires_in: data.expires_in || 3600,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user,
    }

    return { rawJson: JSON.stringify(tokenObj) }
  } catch {
    return null
  }
}

// ── Write refreshed auth cookies (chunked, same format as client) ──────
const CHUNK_SIZE = 3500

function writeAuthCookies(response: NextResponse, rawJson: string, request: NextRequest): void {
  // Determine the cookie name from existing cookies
  const allCookies = request.cookies.getAll()
  const authCookie = allCookies.find(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  )
  if (!authCookie) return

  const baseName = authCookie.name.replace(/\.\d+$/, "")
  const encoded = encodeURIComponent(rawJson)
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  const cookieOpts = {
    path: "/",
    expires,
    sameSite: "lax" as const,
    // Don't set secure in dev
    ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
  }

  // Clear old chunks first
  for (let i = 0; i < 10; i++) {
    response.cookies.delete(`${baseName}.${i}`)
  }
  response.cookies.delete(baseName)

  if (encoded.length <= CHUNK_SIZE) {
    response.cookies.set(baseName, encoded, cookieOpts)
  } else {
    const count = Math.ceil(encoded.length / CHUNK_SIZE)
    for (let i = 0; i < count; i++) {
      response.cookies.set(
        `${baseName}.${i}`,
        encoded.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        cookieOpts
      )
    }
  }
}

// ── Matcher: run middleware on all routes except static files ───────────
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files with extensions (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
}
