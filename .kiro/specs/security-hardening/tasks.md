# Tasks

## Task 1: Harden CSRF Module and Create Token Endpoint
- [x] 1.1 Update `lib/csrf.ts` to use dedicated `CSRF_SECRET` env var and remove fallback to Supabase anon key
- [x] 1.2 Add timing-safe comparison for HMAC signature verification in `validateCSRFToken`
- [x] 1.3 Add audit logging on CSRF validation failure (call `logAudit` with `security.csrf_failure` action)
- [x] 1.4 Create `app/api/csrf/route.ts` GET endpoint that returns a fresh CSRF token for the authenticated user's session
- [x] 1.5 Write property tests for CSRF method filtering and token round-trip integrity (Properties 1, 2)

## Task 2: Harden Edge Middleware Rate Limiting and Brute Force Protection
- [x] 2.1 Reduce auth route rate limit from 30/min to 10/min in `middleware.ts` RATE_LIMITS config
- [x] 2.2 Add `signing` (5/min) and `webhook` (30/min) rate limit categories to middleware with route detection in `getRouteCategory`
- [x] 2.3 Implement brute force detection: track consecutive failed login attempts per IP, block after 5 failures for 15 minutes
- [x] 2.4 Add successful login reset logic to clear brute force counter for an IP
- [x] 2.5 Add audit logging for brute force blocks (call `logAudit` with `security.brute_force_block` action)
- [x] 2.6 Write property tests for rate limit enforcement across all categories and brute force detection/reset (Properties 3, 4)

## Task 3: Harden Input Sanitization
- [x] 3.1 Refine `sanitizeText` in `lib/sanitize.ts` to explicitly preserve tab, newline, and CR while removing all other control characters (U+0000–U+001F)
- [x] 3.2 Add null byte removal to `sanitizeFileName` function
- [x] 3.3 Enhance `sanitizeEmail` to reject addresses starting with a dot before `@`
- [x] 3.4 Add `sanitizeFileName` call in `app/api/storage/upload/route.ts` for uploaded file names
- [x] 3.5 Write property tests for sanitization functions: HTML/control char removal, email validation, recursive object sanitization, file name sanitization (Properties 5, 6, 7, 8)

## Task 4: Harden Security Headers
- [x] 4.1 Add `preload` to HSTS directive in `next.config.mjs`
- [x] 4.2 Remove `unsafe-eval` from CSP `script-src` (use environment-aware CSP: allow in dev, block in prod)
- [x] 4.3 Update `Permissions-Policy` to include `payment=(self https://checkout.razorpay.com)` and `usb=()`
- [x] 4.4 Add `poweredByHeader: false` to `next.config.mjs` to remove `X-Powered-By` header
- [x] 4.5 Write smoke tests verifying all security headers are present with correct values

## Task 5: Harden Auth Module and Origin Validation
- [x] 5.1 Update `validateOrigin` in `lib/api-auth.ts` to reject POST/PUT/DELETE requests when both Origin and Referer are absent
- [x] 5.2 Remove localhost origins from allowed list when `NODE_ENV === 'production'`
- [x] 5.3 Ensure `cf-connecting-ip` is checked first in `getClientIP` (move before x-forwarded-for)
- [x] 5.4 Add AI-specific safe error messages to `sanitizeError` ("AI service temporarily unavailable. Please try again.")
- [x] 5.5 Write property tests for body size validation, error sanitization, and origin validation (Properties 9, 15, 17)

## Task 6: Harden R2 Storage Security
- [x] 6.1 Verify presigned PUT URL expiration is ≤ 15 minutes (currently 5 min — compliant)
- [x] 6.2 Verify presigned GET URL expiration is ≤ 1 hour (currently 1 hour — compliant)
- [x] 6.3 Write property tests for file upload MIME/size validation and R2 key ownership verification (Properties 10, 11)

## Task 7: Harden AI API Endpoint Security
- [x] 7.1 Add prompt length validation (max 10,000 chars) to all AI routes that don't already have it (`app/api/ai/onboarding/route.ts`, `app/api/ai/detect-type/route.ts`, `app/api/ai/analyze-file/route.ts`, `app/api/ai/profile-update/route.ts`)
- [x] 7.2 Add file context truncation (5,000 chars) to all AI routes that accept file context
- [x] 7.3 Update cost protection tier limits: message limits to Free (10), Starter (30), Pro (50), Agency (unlimited) in `lib/cost-protection.ts`
- [x] 7.4 Add `sanitizeText` call for prompt input in AI routes that don't already have it
- [x] 7.5 Write property tests for tier-based usage limit enforcement (Property 12)

## Task 8: Harden Payment Security
- [x] 8.1 Add plan ID validation against known plans (`free`, `starter`, `pro`, `agency`) in `app/api/razorpay/verify/route.ts` before processing
- [x] 8.2 Add audit logging for payment verification (success and failure) using `logAudit` with `payment.verify` action
- [x] 8.3 Add idempotency check to webhook handler: check for existing `payment_history` record before inserting
- [x] 8.4 Add IP-based rate limiting to webhook endpoint (handled by middleware category in Task 2.2)
- [x] 8.5 Write property tests for HMAC signature verification and plan ID validation (Properties 13, 14)

## Task 9: Harden Error Handling
- [x] 9.1 Audit all API routes to ensure unhandled errors return generic messages via `sanitizeError`
- [x] 9.2 Add database-specific safe error message "Operation failed. Please try again." to `sanitizeError` whitelist
- [x] 9.3 Add AI-specific error handling: return "AI service temporarily unavailable. Please try again." when AI API calls fail, without exposing provider details
- [x] 9.4 Verify `app/error.tsx` error boundary does not expose error details in production

## Task 10: Harden Audit Logging
- [x] 10.1 Add new security event types to `AuditAction` type: `security.csrf_failure`, `security.rate_limit`, `security.auth_failure`, `security.origin_failure`, `security.payment_failure`, `security.brute_force_block`
- [x] 10.2 Update `getIPAddress` in `lib/audit-log.ts` to check `cf-connecting-ip` header first
- [x] 10.3 Add audit logging calls in origin validation failures and authentication failures in `lib/api-auth.ts`
- [x] 10.4 Write property test for audit logger non-blocking behavior (Property 16)

## Task 11: Harden Signing Endpoint Security
- [x] 11.1 Add decoded signature image size validation (≤ 500KB) in `app/api/signatures/sign/route.ts`
- [x] 11.2 Verify token format validation (starts with `sign_`, max 100 chars) is present (already implemented)
- [x] 11.3 Verify expired token returns 410 (already implemented)
- [x] 11.4 Write property tests for signing token format validation and signature data URL validation (Properties 18, 19)

## Task 12: Harden Middleware Security
- [x] 12.1 Verify `x-middleware-subrequest` header stripping is present (already implemented)
- [x] 12.2 Verify static asset bypass logic is correct (already implemented)
- [x] 12.3 Verify JWT expiration check includes 60-second grace period (already implemented)
- [x] 12.4 Write property tests for middleware header stripping and protected route redirect (Properties 20, 21)

## Task 13: Database RLS and Secret Management
- [x] 13.1 Create SQL migration to verify RLS is enabled on all tables: `profiles`, `businesses`, `documents`, `document_versions`, `signatures`, `compliance_rules`, `audit_logs`, `user_usage`, `payment_history`, `subscriptions`, `chat_messages`
- [x] 13.2 Verify `signatures` table RLS allows public read by token and restricts write to document owners
- [x] 13.3 Add startup validation in `lib/secrets.ts` for required secrets (SUPABASE_URL, SUPABASE_ANON_KEY, CSRF_SECRET) with fail-fast behavior
- [x] 13.4 Verify Razorpay key secret (`RAZORPAY_KEY_SECRET`) is not in `wrangler.json` vars
- [x] 13.5 Write integration tests for RLS policy enforcement
