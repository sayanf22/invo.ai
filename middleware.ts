import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Server-side middleware for Supabase auth + IP-based rate limiting.
 *
 * 1. IP-based rate limiting (DDoS / brute-force protection)
 * 2. Refreshes the session on every navigation (keeps long-lived sessions alive)
 * 3. Redirects unauthenticated users away from protected routes
 * 4. Redirects authenticated users away from auth pages (login/signup)
 * 5. Edge-runtime compatible (works on Cloudflare Workers)
 */

// ── IP-Based Rate Limiting (in-memory sliding window) ──────────────────
// Edge-compatible, no DB needed. Resets on deploy/restart which is acceptable
// since Cloudflare Workers have short lifetimes anyway.

interface RateLimitEntry {
  timestamps: number[]
}

// Separate stores for different route categories
const ipStore = new Map<string, RateLimitEntry>()

// Rate limit configs per route category
const RATE_LIMITS = {
  auth:    { maxRequests: 30,  windowMs: 60_000 },  // 30 req/min for auth (brute force)
  api:     { maxRequests: 120, windowMs: 60_000 },  // 120 req/min for API routes
  global:  { maxRequests: 300, windowMs: 60_000 },  // 300 req/min global fallback
} as const

type RateLimitCategory = keyof typeof RATE_LIMITS

// Cleanup stale entries every 5 minutes to prevent memory leaks
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60_000

function cleanupStaleEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - 120_000 // Remove entries older than 2 minutes
  for (const [key, entry] of ipStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      ipStore.delete(key)
    }
  }
}

function getClientIP(request: NextRequest): string {
  // Cloudflare provides the real IP
  const cfIP = request.headers.get("cf-connecting-ip")
  if (cfIP) return cfIP

  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()

  const realIP = request.headers.get("x-real-ip")
  if (realIP) return realIP

  return "unknown"
}

function getRouteCategory(pathname: string): RateLimitCategory {
  if (pathname.startsWith("/auth")) return "auth"
  if (pathname.startsWith("/api")) return "api"
  return "global"
}

function checkIPRateLimit(
  ip: string,
  category: RateLimitCategory
): { allowed: boolean; retryAfter: number } {
  cleanupStaleEntries()

  const config = RATE_LIMITS[category]
  const key = `${ip}:${category}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  let entry = ipStore.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    ipStore.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    // Calculate retry-after from oldest timestamp in window
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  entry.timestamps.push(now)
  return { allowed: true, retryAfter: 0 }
}

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
  if (pathname === "/") return true // Landing page is public — app/page.tsx handles auth check
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
  // Handle base64-prefixed cookies (from @supabase/ssr or newer client versions)
  let decoded = raw
  if (decoded.startsWith("base64-")) {
    try {
      decoded = atob(decoded.slice(7))
    } catch {
      // Not valid base64, try as-is
    }
  }
  try {
    return JSON.parse(decoded)
  } catch {
    // Cookie value might still be URL-encoded
    try {
      return JSON.parse(decodeURIComponent(decoded))
    } catch {
      return null
    }
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

  // ── IP-Based Rate Limiting ───────────────────────────────────────────
  const clientIP = getClientIP(request)
  const category = getRouteCategory(pathname)
  const rateCheck = checkIPRateLimit(clientIP, category)

  if (!rateCheck.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: "Too many requests. Please slow down.",
        retryAfter: rateCheck.retryAfter,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateCheck.retryAfter),
          "X-RateLimit-Limit": String(RATE_LIMITS[category].maxRequests),
          "X-RateLimit-Remaining": "0",
        },
      }
    )
  }

  // ── Read auth token from cookies ─────────────────────────────────────
  const rawToken = getAuthTokenFromCookies(request)
  const parsed = rawToken ? parseAuthToken(rawToken) : null
  const accessToken = parsed?.access_token
  const refreshToken = parsed?.refresh_token

  let isAuthenticated = false

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]))
      const exp = payload.exp * 1000
      const now = Date.now()

      if (exp > now + 60_000) {
        isAuthenticated = true
      } else if (refreshToken) {
        const refreshed = await refreshSession(accessToken, refreshToken)
        if (refreshed) {
          isAuthenticated = true
          writeAuthCookies(response, refreshed.rawJson, request)
        }
      }
    } catch {
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

  // Redirect authenticated users away from auth pages (except callback/confirm/update-password)
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
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
}
