import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import {
  RATE_LIMITS,
  ipStore,
  bruteForceStore,
  getRouteCategory,
  checkIPRateLimit,
  checkBruteForce,
  recordFailedLogin,
  resetBruteForce,
} from "@/lib/middleware-security"
import { isMisspellingPath } from "@/lib/misspelling-data"
import { normalizePathname } from "@/lib/url-utils"
import { verifyAdminSession } from "@/lib/admin-auth"

/**
 * Server-side middleware for Supabase auth + IP-based rate limiting + brute force protection.
 *
 * 1. IP-based rate limiting (DDoS / brute-force protection)
 * 2. Brute force detection (5 consecutive failures → 15-min block)
 * 3. Refreshes the session on every navigation (keeps long-lived sessions alive)
 * 4. Redirects unauthenticated users away from protected routes
 * 5. Redirects authenticated users away from auth pages (login/signup)
 * 6. Edge-runtime compatible (works on Cloudflare Workers)
 */

// ── last_active_at throttle (fire-and-forget, 5-min window) ────────────
const lastActiveCache = new Map<string, number>()
const LAST_ACTIVE_THROTTLE = 5 * 60 * 1000 // 5 minutes

// ── IP Blocklist cache (avoids a DB round-trip on every request) ────────
// Blocked IPs are cached for 5 minutes. Allowed IPs are cached for 2 minutes.
// This means a newly blocked IP can still access the site for up to 5 minutes,
// which is an acceptable trade-off for eliminating per-request DB calls.
const IP_BLOCK_CACHE_TTL = 5 * 60 * 1000 // 5 min for blocked IPs
const IP_ALLOW_CACHE_TTL = 2 * 60 * 1000 // 2 min for allowed IPs
const ipBlocklistCache = new Map<string, { blocked: boolean; expiresAt: number }>()

function isIPBlocked(ip: string): boolean | null {
  const entry = ipBlocklistCache.get(ip)
  if (!entry) return null // cache miss
  if (Date.now() > entry.expiresAt) {
    ipBlocklistCache.delete(ip)
    return null // expired
  }
  return entry.blocked
}

function cacheIPResult(ip: string, blocked: boolean): void {
  const ttl = blocked ? IP_BLOCK_CACHE_TTL : IP_ALLOW_CACHE_TTL
  ipBlocklistCache.set(ip, { blocked, expiresAt: Date.now() + ttl })
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

// ── Public routes that don't require auth ──────────────────────────────
// /clients is intentionally NOT listed here — it is protected by default.
// Only paths listed in PUBLIC_PATHS bypass authentication.
const PUBLIC_PATHS = [
  "/auth",
  "/pricing",
  "/features",
  "/resources",
  "/use-cases",
  "/developers",
  "/sign",
  "/pay", // public payment pages — /pay/[sessionId] accessible without auth
  "/view", // public document view — /view/[sessionId] accessible without auth (for email recipients)
  "/verify", // public document verification — /verify/[token] accessible without auth
  "/api",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/business",
  "/tools",
  "/clorefy-alternative-spellings",
  "/clorefy", // brand name URL — public, no auth needed
  "/clorify", // misspelling redirect — public
  "/clorefy-ctrl-8x2m", // admin routes — protected by their own JWT check in middleware
]

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true // Landing page is public — app/page.tsx handles auth check
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

// ── URL Normalization ──────────────────────────────────────────────────
// normalizePathname is imported from @/lib/url-utils

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Admin route protection ────────────────────────────────────────────
  // Must run before all other middleware logic.
  // All /clorefy-ctrl-8x2m/* paths (except /login) require a valid admin session.
  if (
    pathname.startsWith("/clorefy-ctrl-8x2m") &&
    pathname !== "/clorefy-ctrl-8x2m/login"
  ) {
    const adminEmail = await verifyAdminSession(request)
    if (!adminEmail) {
      return new NextResponse(null, { status: 404 })
    }
  }

  // SECURITY: Strip x-middleware-subrequest header to prevent CVE-2025-29927 bypass
  // Even though Next.js 16.x is patched, this is defense-in-depth
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete("x-middleware-subrequest")

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Skip static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return response
  }

  // ── URL Normalization (301 redirect to canonical form) ───────────────
  const normalizedPath = normalizePathname(pathname)
  if (normalizedPath !== null) {
    const redirectUrl = new URL(request.url)
    redirectUrl.pathname = normalizedPath
    return NextResponse.redirect(redirectUrl, { status: 301 })
  }

  // ── Misspelling Redirects (301 redirect to corrected URL) ────────────
  const correctedPath = isMisspellingPath(pathname)
  if (correctedPath !== null) {
    const redirectUrl = new URL(request.url)
    redirectUrl.pathname = correctedPath
    return NextResponse.redirect(redirectUrl, { status: 301 })
  }

  // ── IP-Based Rate Limiting ───────────────────────────────────────────
  const clientIP = getClientIP(request)
  const category = getRouteCategory(pathname)

  // ── IP Blocklist Check (admin-blocked IPs) ───────────────────────────
  // Uses an in-memory cache (5-min TTL for blocked, 2-min for allowed) to avoid
  // a DB round-trip on every single request. Cache miss triggers one fetch.
  if (clientIP !== "unknown" && !pathname.startsWith("/clorefy-ctrl-8x2m")) {
    const cachedResult = isIPBlocked(clientIP)
    if (cachedResult === true) {
      // Cached as blocked — deny immediately, no network call
      return new NextResponse(
        JSON.stringify({ error: "Access denied." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    } else if (cachedResult === null) {
      // Cache miss — fetch from DB once, then cache the result
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        if (supabaseUrl && supabaseKey) {
          const now = new Date().toISOString()
          const blocklistRes = await fetch(
            `${supabaseUrl}/rest/v1/ip_blocklist?ip_address=eq.${encodeURIComponent(clientIP)}&select=ip_address,expires_at&limit=1`,
            {
              headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
              },
              signal: AbortSignal.timeout(2000), // 2s max — don't block the request
            }
          )
          if (blocklistRes.ok) {
            const blocked = await blocklistRes.json()
            if (Array.isArray(blocked) && blocked.length > 0) {
              const entry = blocked[0]
              const isActive = !entry.expires_at || entry.expires_at > now
              cacheIPResult(clientIP, isActive)
              if (isActive) {
                return new NextResponse(
                  JSON.stringify({ error: "Access denied." }),
                  { status: 403, headers: { "Content-Type": "application/json" } }
                )
              }
            } else {
              // Not in blocklist — cache as allowed
              cacheIPResult(clientIP, false)
            }
          }
        }
      } catch {
        // Non-blocking — if blocklist check fails, allow the request
        // Don't cache on error so next request retries
      }
    }
    // cachedResult === false → cached as allowed, skip the fetch entirely
  }

  // Skip rate limiting for all auth routes — OAuth flows make multiple
  // redirects that would trigger false positives. Auth is protected by
  // brute force detection instead.
  const skipRateLimit = pathname.startsWith("/auth")

  if (!skipRateLimit) {
    const rateCheck = checkIPRateLimit(clientIP, category, ipStore)
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
  }

  // ── Brute Force Detection (auth routes only) ────────────────────────
  if (category === "auth") {
    const bruteCheck = checkBruteForce(clientIP, bruteForceStore)
    if (bruteCheck.blocked) {
      // Fire-and-forget audit log for brute force block
      logBruteForceBlock(clientIP, request).catch(() => {})
      return new NextResponse(
        JSON.stringify({
          error: "Too many login attempts. Please try again later.",
          retryAfter: bruteCheck.retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(bruteCheck.retryAfter),
          },
        }
      )
    }
  }

  // ── Read auth token from cookies ─────────────────────────────────────
  // Use @supabase/ssr createServerClient — handles token refresh and cookie writing
  // in the same format as the browser client. This is the ONLY correct way to
  // refresh sessions in middleware without causing client/server cookie format conflicts.
  const isPublic = isPublicPath(pathname)

  let isAuthenticated = false
  let userId: string | null = null

  // Create a mutable response so @supabase/ssr can write refreshed cookies
  const supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            // Write refreshed cookies to both the request (for downstream) and response
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
            // Also copy to the main response
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // For public pages, use getSession() (fast, no network) — just check if logged in
    // For protected pages, use getUser() (network call) — validates token server-side
    if (isPublic) {
      const { data: { session } } = await supabase.auth.getSession()
      isAuthenticated = !!session?.user
      userId = session?.user?.id ?? null
    } else {
      // getUser() makes a network call to validate the JWT — more secure for protected routes
      // It also triggers token refresh if needed, writing new cookies via setAll above
      const { data: { user } } = await supabase.auth.getUser()
      isAuthenticated = !!user
      userId = user?.id ?? null
    }
  } catch {
    // Auth check failed — treat as unauthenticated for protected routes
    isAuthenticated = isPublic // Public pages are always accessible
  }

  // Update last_active_at (fire-and-forget, non-blocking)
  if (isAuthenticated && userId) {
    const nowMs = Date.now()
    const lastUpdate = lastActiveCache.get(userId) ?? 0
    if (nowMs - lastUpdate > LAST_ACTIVE_THROTTLE) {
      lastActiveCache.set(userId, nowMs)
      updateLastActive(userId).catch(() => {})
    }
  }

  // ── Route protection ─────────────────────────────────────────────────
  // Track brute force on auth routes
  if (category === "auth" && pathname.startsWith("/auth/login")) {
    if (isAuthenticated) {
      // Successful login — reset brute force counter
      resetBruteForce(clientIP, bruteForceStore)
    } else if (request.method === "POST") {
      // Failed login attempt on POST — record failure
      const nowBlocked = recordFailedLogin(clientIP, bruteForceStore)
      if (nowBlocked) {
        logBruteForceBlock(clientIP, request).catch(() => {})
      }
    }
  }

  if (!isAuthenticated && !isPublicPath(pathname)) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirectTo", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from auth pages (except callback/confirm/update-password)
  // NOTE: We do NOT redirect from login/signup — the user may be initiating OAuth
  // from there, and redirecting away would break the PKCE flow.
  // The app-shell handles routing authenticated users to the right page.
  if (
    isAuthenticated &&
    pathname.startsWith("/auth") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/confirm") &&
    !pathname.startsWith("/auth/update-password") &&
    !pathname.startsWith("/auth/login") &&
    !pathname.startsWith("/auth/signup")
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  // ── Onboarding: allow users to revisit /onboarding anytime ─────────
  // The onboarding page itself handles whether to show the form or redirect.
  // No middleware guard needed — users with incomplete profiles should be
  // able to click "Complete your business profile" and reach onboarding.

  return response
}

/** Audit log brute force block — fire-and-forget, non-blocking */
async function logBruteForceBlock(ip: string, request: NextRequest): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return

    const entry = bruteForceStore.get(ip)
    await fetch(`${supabaseUrl}/rest/v1/audit_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: null,
        action: "security.brute_force_block",
        ip_address: ip,
        user_agent: request.headers.get("user-agent") || "unknown",
        metadata: {
          failed_attempts: entry?.failedAttempts ?? 0,
          block_duration_minutes: 15,
          pathname: request.nextUrl.pathname,
        },
      }),
    })
  } catch {
    // Non-blocking — audit log failure should never break the request
    console.error("Failed to log brute force block for IP:", ip)
  }
}

/** Update last_active_at for the user — fire-and-forget */
async function updateLastActive(userId: string): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return

    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ last_active_at: new Date().toISOString() }),
    })
  } catch {
    // Non-blocking
  }
}

// ── Matcher: run middleware on all routes except static files ───────────
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
    "/clorefy-ctrl-8x2m/:path*",
  ],
}
