/**
 * Middleware Security Module
 * 
 * Extracted rate limiting and brute force detection logic from middleware.ts
 * for testability. All functions are pure or use injectable stores.
 */

// ── Rate Limit Types & Config ──────────────────────────────────────────

export interface RateLimitEntry {
  timestamps: number[]
}

export const RATE_LIMITS = {
  auth:    { maxRequests: 30,  windowMs: 60_000 },  // 30 req/min for auth (increased for OAuth flows)
  api:     { maxRequests: 120, windowMs: 60_000 },  // 120 req/min for API
  signing: { maxRequests: 5,   windowMs: 60_000 },  // 5 req/min for signing
  webhook: { maxRequests: 30,  windowMs: 60_000 },  // 30 req/min for webhooks
  global:  { maxRequests: 300, windowMs: 60_000 },  // 300 req/min global
} as const

export type RateLimitCategory = keyof typeof RATE_LIMITS

// ── Brute Force Types & Config ─────────────────────────────────────────

export interface BruteForceEntry {
  failedAttempts: number
  lastFailure: number
  blockedUntil: number
}

export const BRUTE_FORCE_MAX_ATTEMPTS = 5
export const BRUTE_FORCE_BLOCK_DURATION_MS = 15 * 60_000 // 15 minutes
export const BRUTE_FORCE_WINDOW_MS = 15 * 60_000 // 15 minutes

// ── In-memory stores (used by middleware at runtime) ───────────────────

export const ipStore = new Map<string, RateLimitEntry>()
export const bruteForceStore = new Map<string, BruteForceEntry>()

// ── Cleanup ────────────────────────────────────────────────────────────

let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60_000

export function cleanupStaleEntries(
  store: Map<string, RateLimitEntry>,
  now: number = Date.now()
): void {
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now

  const cutoff = now - 120_000
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}

/** Reset the cleanup timer — useful for testing */
export function resetCleanupTimer(): void {
  lastCleanup = 0
}

// ── Route Category Detection ───────────────────────────────────────────

export function getRouteCategory(pathname: string): RateLimitCategory {
  if (pathname.startsWith("/auth")) return "auth"
  if (pathname.startsWith("/api/signatures/sign")) return "signing"
  if (pathname.startsWith("/api/razorpay/webhook")) return "webhook"
  if (pathname.startsWith("/api")) return "api"
  return "global"
}

// ── Rate Limit Check ───────────────────────────────────────────────────

export function checkIPRateLimit(
  ip: string,
  category: RateLimitCategory,
  store: Map<string, RateLimitEntry> = ipStore,
  now: number = Date.now()
): { allowed: boolean; retryAfter: number } {
  cleanupStaleEntries(store, now)

  const config = RATE_LIMITS[category]
  const key = `${ip}:${category}`
  const windowStart = now - config.windowMs

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)

  if (entry.timestamps.length >= config.maxRequests) {
    const oldestInWindow = entry.timestamps[0]
    const retryAfter = Math.ceil((oldestInWindow + config.windowMs - now) / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  entry.timestamps.push(now)
  return { allowed: true, retryAfter: 0 }
}

// ── Brute Force Detection ──────────────────────────────────────────────

/**
 * Check if an IP is currently blocked by brute force protection.
 * Returns the remaining block time in seconds, or 0 if not blocked.
 */
export function checkBruteForce(
  ip: string,
  store: Map<string, BruteForceEntry> = bruteForceStore,
  now: number = Date.now()
): { blocked: boolean; retryAfter: number } {
  const entry = store.get(ip)
  if (!entry) return { blocked: false, retryAfter: 0 }

  // Check if block has expired
  if (entry.blockedUntil > 0 && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000)
    return { blocked: true, retryAfter: Math.max(1, retryAfter) }
  }

  // If block expired, check if the failure window has also expired
  if (entry.blockedUntil > 0 && entry.blockedUntil <= now) {
    // Block expired — reset
    store.delete(ip)
    return { blocked: false, retryAfter: 0 }
  }

  return { blocked: false, retryAfter: 0 }
}

/**
 * Record a failed login attempt for an IP.
 * Returns true if the IP is now blocked (reached threshold).
 */
export function recordFailedLogin(
  ip: string,
  store: Map<string, BruteForceEntry> = bruteForceStore,
  now: number = Date.now()
): boolean {
  let entry = store.get(ip)

  if (!entry) {
    entry = { failedAttempts: 0, lastFailure: 0, blockedUntil: 0 }
    store.set(ip, entry)
  }

  // If the last failure was more than 15 minutes ago, reset the counter
  if (entry.lastFailure > 0 && now - entry.lastFailure > BRUTE_FORCE_WINDOW_MS) {
    entry.failedAttempts = 0
  }

  entry.failedAttempts++
  entry.lastFailure = now

  if (entry.failedAttempts >= BRUTE_FORCE_MAX_ATTEMPTS) {
    entry.blockedUntil = now + BRUTE_FORCE_BLOCK_DURATION_MS
    return true
  }

  return false
}

/**
 * Reset brute force counter for an IP after a successful login.
 */
export function resetBruteForce(
  ip: string,
  store: Map<string, BruteForceEntry> = bruteForceStore
): void {
  store.delete(ip)
}
