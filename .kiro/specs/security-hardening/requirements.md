# Requirements Document

## Introduction

Comprehensive security hardening for the Clorefy (Invo.ai) production application — a Next.js 16.1.6 app deployed on Cloudflare Workers via OpenNext, with Supabase backend, Cloudflare R2 storage, DeepSeek/OpenAI AI APIs, and Razorpay payments. This spec addresses all identified vulnerabilities in the existing security implementation, hardens against DDoS, XSS, CSRF, SQL injection, brute force, and other attack vectors, and adds security monitoring and alerting capabilities. The app runs on Cloudflare Workers paid plan ($5/month) which provides network-level DDoS protection.

## Glossary

- **Application**: The Clorefy Next.js 16.1.6 web application deployed on Cloudflare Workers
- **Middleware**: The Next.js edge middleware (`middleware.ts`) that runs on every request before route handlers
- **API_Route**: A server-side Next.js route handler under `/app/api/`
- **Auth_Module**: The `lib/api-auth.ts` module providing `authenticateRequest()`, origin validation, and IP extraction
- **Rate_Limiter**: The rate limiting system combining IP-based middleware limits and Postgres-based per-user limits
- **CSRF_Module**: The `lib/csrf.ts` module providing HMAC-signed CSRF token generation and validation
- **Sanitizer**: The `lib/sanitize.ts` module providing input sanitization functions for XSS, injection, and path traversal prevention
- **Audit_Logger**: The `lib/audit-log.ts` module that records sensitive operations to the `audit_logs` table
- **Cost_Protector**: The `lib/cost-protection.ts` module enforcing tier-based document and message limits
- **R2_Storage**: Cloudflare R2 object storage accessed via presigned URLs for file uploads and downloads
- **Signing_Endpoint**: The unauthenticated `/api/signatures/sign` endpoint for external document signers
- **Webhook_Endpoint**: The unauthenticated `/api/razorpay/webhook` endpoint for Razorpay payment events
- **CSP**: Content Security Policy header controlling which resources the browser can load
- **RLS**: Row Level Security policies in Supabase PostgreSQL enforcing data isolation per user
- **Cloudflare_DDoS**: Cloudflare's built-in network-level DDoS mitigation on the Workers paid plan
- **Security_Event**: A logged occurrence of a suspicious or malicious action (failed auth, rate limit hit, CSRF failure)
- **Presigned_URL**: A time-limited, signed URL granting temporary access to an R2 object

## Requirements

### Requirement 1: CSRF Protection Enforcement on All State-Changing API Routes

**User Story:** As a user, I want all my state-changing requests to be protected by CSRF tokens, so that attackers cannot trick my browser into making unwanted requests on my behalf.

#### Acceptance Criteria

1. WHEN a POST, PUT, or DELETE request is received by any API_Route, THE API_Route SHALL validate the CSRF token from the `X-CSRF-Token` header before processing the request
2. IF a state-changing request arrives without a valid CSRF token, THEN THE API_Route SHALL return a 403 response with the message "CSRF token missing or invalid"
3. WHEN the CSRF_Module validates a token, THE CSRF_Module SHALL verify the HMAC signature, session binding, and expiration (maximum 1 hour) using timing-safe comparison
4. THE Application SHALL provide a GET endpoint at `/api/csrf` that returns a fresh CSRF token for the authenticated user's session
5. WHEN the frontend makes any POST, PUT, or DELETE request, THE Application SHALL include the CSRF token in the `X-CSRF-Token` header
6. THE CSRF_Module SHALL use a dedicated `CSRF_SECRET` environment variable and SHALL NOT fall back to the Supabase anon key as the HMAC secret
7. WHEN a CSRF validation fails, THE Audit_Logger SHALL log the failure with the user ID, IP address, and request path

### Requirement 2: IP-Based Rate Limiting for Unauthenticated Endpoints

**User Story:** As a system operator, I want unauthenticated endpoints to be rate-limited by IP address, so that attackers cannot abuse public endpoints with automated requests.

#### Acceptance Criteria

1. THE Middleware SHALL enforce IP-based rate limits on all requests before authentication occurs, using the `cf-connecting-ip` header as the primary IP source
2. WHILE the Middleware is processing an auth route request, THE Middleware SHALL apply a limit of 10 requests per minute per IP address to prevent brute force attacks
3. WHILE the Middleware is processing an API route request, THE Middleware SHALL apply a limit of 120 requests per minute per IP address
4. WHILE the Middleware is processing a general page request, THE Middleware SHALL apply a limit of 300 requests per minute per IP address
5. WHEN the Signing_Endpoint receives a request, THE Signing_Endpoint SHALL enforce a rate limit of 5 requests per minute per IP address
6. WHEN the Webhook_Endpoint receives a request, THE Webhook_Endpoint SHALL enforce a rate limit of 30 requests per minute per IP address
7. IF an IP address exceeds the rate limit, THEN THE Middleware SHALL return a 429 response with a `Retry-After` header and SHALL NOT process the request further
8. THE Middleware SHALL clean up stale rate limit entries from the in-memory store every 5 minutes to prevent memory exhaustion

### Requirement 3: Comprehensive Input Sanitization and Validation

**User Story:** As a user, I want all my inputs to be sanitized before storage and display, so that malicious content cannot be injected into the application.

#### Acceptance Criteria

1. WHEN any API_Route receives user-provided string input, THE Sanitizer SHALL strip all HTML tags, script elements, and event handler attributes before the input is stored in the database
2. WHEN the Sanitizer processes text input, THE Sanitizer SHALL remove control characters (U+0000–U+001F except tab, newline, carriage return) and normalize whitespace
3. WHEN the Sanitizer processes an email address, THE Sanitizer SHALL validate the format against RFC 5322 simplified pattern and reject addresses containing consecutive dots or starting with a dot
4. THE Sanitizer SHALL provide a `sanitizeObject` function that recursively sanitizes all string values in nested objects up to a maximum depth of 10 levels
5. WHEN the Sanitizer encounters an object nested deeper than 10 levels, THE Sanitizer SHALL throw an error with the message "Object nesting too deep"
6. WHEN any API_Route receives a request body, THE API_Route SHALL validate the body size against the endpoint-specific limit (10KB for signatures, 50KB for onboarding, 100KB for AI stream, 500KB for signing) before parsing
7. THE Sanitizer SHALL provide a `sanitizeFileName` function that removes path traversal sequences (`..`), path separators (`/`, `\`), null bytes, and limits file names to 255 characters

### Requirement 4: Security Headers Hardening

**User Story:** As a system operator, I want the application to send comprehensive security headers on every response, so that browsers enforce strict security policies.

#### Acceptance Criteria

1. THE Application SHALL send a `Content-Security-Policy` header that restricts `default-src` to `'self'`, allows scripts only from `'self'`, Razorpay domains, and Cloudflare Insights, and blocks `unsafe-eval` in production
2. THE Application SHALL send a `Strict-Transport-Security` header with `max-age=31536000`, `includeSubDomains`, and `preload` directives
3. THE Application SHALL send `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'` to prevent clickjacking
4. THE Application SHALL send a `Permissions-Policy` header that disables camera, microphone, geolocation, payment (except Razorpay frame), and USB access
5. THE Application SHALL send `X-Content-Type-Options: nosniff` to prevent MIME-type sniffing attacks
6. THE Application SHALL send `Referrer-Policy: strict-origin-when-cross-origin` to limit referrer information leakage
7. THE Application SHALL remove the `X-Powered-By` header from all responses to prevent technology fingerprinting

### Requirement 5: Brute Force Protection on Authentication Endpoints

**User Story:** As a user, I want my account to be protected against brute force login attempts, so that attackers cannot guess my password through automated attempts.

#### Acceptance Criteria

1. WHILE the Middleware is processing requests to `/auth/login` or `/auth/signup`, THE Middleware SHALL apply a rate limit of 10 requests per minute per IP address
2. WHEN 5 consecutive failed login attempts occur from the same IP address within 15 minutes, THE Middleware SHALL block further login attempts from that IP for 15 minutes
3. IF a login attempt is blocked due to brute force protection, THEN THE Middleware SHALL return a 429 response with the message "Too many login attempts. Please try again later." and a `Retry-After` header
4. WHEN a successful login occurs, THE Middleware SHALL reset the failed attempt counter for that IP address
5. WHEN a brute force block is triggered, THE Audit_Logger SHALL log the event with the IP address, number of failed attempts, and block duration

### Requirement 6: Secure File Upload and R2 Storage Protection

**User Story:** As a user, I want my file uploads to be validated and stored securely, so that malicious files cannot compromise the application or other users' data.

#### Acceptance Criteria

1. WHEN a file upload request is received, THE API_Route SHALL validate the file's MIME type against the whitelist: `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `application/pdf`
2. WHEN a file upload request is received, THE API_Route SHALL validate that the file size does not exceed 10MB
3. THE API_Route SHALL generate R2 object keys using the pattern `{category}/{userId}/{uuid}.{ext}` to enforce user-scoped storage isolation
4. WHEN a presigned GET URL is requested, THE API_Route SHALL verify that the requesting user's ID matches the user ID segment in the object key, except for signature keys
5. WHEN a presigned PUT URL is generated, THE API_Route SHALL set the URL expiration to a maximum of 15 minutes
6. WHEN a presigned GET URL is generated, THE API_Route SHALL set the URL expiration to a maximum of 1 hour
7. IF a file upload request specifies a content type that does not match the whitelist, THEN THE API_Route SHALL return a 400 response and SHALL NOT generate a presigned URL

### Requirement 7: AI API Endpoint Abuse Prevention

**User Story:** As a system operator, I want AI API endpoints to be protected against abuse, so that attackers cannot exhaust API credits or use the AI for unintended purposes.

#### Acceptance Criteria

1. WHEN an AI API request is received, THE API_Route SHALL validate the prompt length does not exceed 10,000 characters
2. WHEN an AI API request includes file context, THE API_Route SHALL truncate the file context to 5,000 characters
3. THE Cost_Protector SHALL enforce tier-based monthly document limits: Free (5/month), Starter (50/month), Pro (150/month), Agency (unlimited)
4. THE Cost_Protector SHALL enforce tier-based per-session message limits: Free (10/session), Starter (30/session), Pro (50/session), Agency (unlimited)
5. WHEN a user exceeds their monthly document limit, THE Cost_Protector SHALL return a 429 response with the current usage, limit, tier, and upgrade suggestion
6. WHEN an AI API request is received, THE API_Route SHALL validate the request origin against the allowed origins list before processing
7. THE API_Route SHALL sanitize all user-provided prompt text using `sanitizeText` before sending it to the DeepSeek or OpenAI API
8. THE Application SHALL fetch AI API keys from Supabase Vault at runtime and SHALL NOT store them in environment variables accessible to the client bundle

### Requirement 8: Payment Security and Webhook Integrity

**User Story:** As a user, I want my payment transactions to be verified cryptographically, so that attackers cannot forge payment confirmations or tamper with subscription data.

#### Acceptance Criteria

1. WHEN the payment verification endpoint receives a request, THE API_Route SHALL verify the Razorpay signature using HMAC-SHA256 with the Razorpay key secret before activating any subscription
2. WHEN the Webhook_Endpoint receives a request, THE Webhook_Endpoint SHALL verify the `x-razorpay-signature` header using HMAC-SHA256 with the webhook secret before processing any event
3. IF the payment signature verification fails, THEN THE API_Route SHALL return a 400 response and SHALL log the failed verification attempt with the order ID and payment ID
4. THE Webhook_Endpoint SHALL process events idempotently so that duplicate webhook deliveries do not create duplicate subscription records or payment history entries
5. WHEN a payment is verified, THE API_Route SHALL log the payment to the `payment_history` table with the user ID, payment ID, order ID, amount, and plan for audit purposes
6. THE API_Route SHALL validate the `plan` parameter against the known plan IDs (free, starter, pro, agency) before processing a payment verification

### Requirement 9: Secure Error Handling and Information Leakage Prevention

**User Story:** As a system operator, I want error responses to never expose internal implementation details, so that attackers cannot use error messages to discover vulnerabilities.

#### Acceptance Criteria

1. WHEN an unhandled error occurs in any API_Route, THE API_Route SHALL return a generic error message ("Internal server error") and SHALL NOT include stack traces, database error codes, or internal paths in the response
2. THE Auth_Module SHALL provide a `sanitizeError` function that maps known safe error messages to their original text and replaces all other error messages with "Internal server error"
3. WHEN a database query fails, THE API_Route SHALL log the full error details server-side and SHALL return only "Operation failed. Please try again." to the client
4. THE Application SHALL configure the Next.js error boundary (`app/error.tsx`) to display a user-friendly error page without exposing error details in production
5. WHEN an AI API call fails, THE API_Route SHALL return "AI service temporarily unavailable. Please try again." and SHALL NOT expose the AI provider name, API key prefix, or error details from the provider

### Requirement 10: Audit Logging and Security Monitoring

**User Story:** As a system operator, I want all security-relevant events to be logged and queryable, so that I can detect, investigate, and respond to security incidents.

#### Acceptance Criteria

1. WHEN any of the following events occur, THE Audit_Logger SHALL record the event with user ID, IP address, user agent, timestamp, and event-specific metadata: login, logout, signup, document creation, document export, document signing, signature creation, AI generation, business profile update, payment verification
2. THE Audit_Logger SHALL record failed security events: CSRF validation failures, rate limit violations, authentication failures, origin validation failures, and payment signature verification failures
3. THE Application SHALL provide SQL queries for monitoring: top users by AI cost, rate limit violations per hour, suspicious activity patterns (high-frequency actions from single user), and failed authentication attempts per IP
4. WHEN the Audit_Logger fails to write a log entry, THE Audit_Logger SHALL log the failure to the server console and SHALL NOT block or fail the original request
5. THE `audit_logs` table SHALL have RLS policies that allow users to read only their own audit logs and allow the service role to insert logs for any user
6. THE Application SHALL retain audit logs for a minimum of 90 days

### Requirement 11: Origin Validation and CORS Hardening

**User Story:** As a system operator, I want API requests to be validated against allowed origins, so that unauthorized domains cannot make requests to the application's API.

#### Acceptance Criteria

1. WHEN a cross-origin API request is received, THE Auth_Module SHALL validate the `Origin` header against the allowed origins list: the production domain (`https://clorefy.com`), the `NEXT_PUBLIC_APP_URL` environment variable, and `localhost` origins in development mode only
2. IF the `Origin` header is not present, THE Auth_Module SHALL validate the `Referer` header as a fallback
3. IF both `Origin` and `Referer` headers are absent on a state-changing request, THE Auth_Module SHALL reject the request with a 403 response
4. WHEN the Application responds to a preflight OPTIONS request, THE Application SHALL return CORS headers allowing only the production domain and configured app URL
5. THE Auth_Module SHALL NOT include wildcard (`*`) in any CORS `Access-Control-Allow-Origin` response header

### Requirement 12: Signing Endpoint Security for External Signers

**User Story:** As an external signer, I want the signing process to be secure and tamper-proof, so that my signature cannot be forged or the signing link cannot be abused.

#### Acceptance Criteria

1. WHEN the Signing_Endpoint receives a request, THE Signing_Endpoint SHALL validate the token format (must start with `sign_` and be no longer than 100 characters)
2. WHEN the Signing_Endpoint receives a request, THE Signing_Endpoint SHALL verify the token exists in the database and has not been used (no `signed_at` value)
3. IF the signing token has expired (past `expires_at`), THEN THE Signing_Endpoint SHALL return a 410 response with the message "Signing link has expired"
4. WHEN a signature is submitted, THE Signing_Endpoint SHALL record the signer's IP address and user agent for non-repudiation
5. THE Signing_Endpoint SHALL enforce a rate limit of 5 requests per minute per IP address to prevent automated signing attempts
6. WHEN the Signing_Endpoint receives a signature data URL, THE Signing_Endpoint SHALL validate that it starts with `data:image/` and that the decoded image size does not exceed 500KB
7. IF all signatures for a document are complete, THEN THE Signing_Endpoint SHALL update the document status to "signed"

### Requirement 13: Middleware Security Hardening

**User Story:** As a system operator, I want the middleware to enforce security controls at the edge before any route handler executes, so that malicious requests are blocked as early as possible.

#### Acceptance Criteria

1. THE Middleware SHALL strip the `x-middleware-subrequest` header from all incoming requests to prevent CVE-2025-29927 middleware bypass attacks
2. THE Middleware SHALL skip rate limiting and auth checks for static assets (`/_next`, favicon, files with extensions like `.svg`, `.png`, `.jpg`, `.css`, `.js`)
3. WHEN the Middleware refreshes an expired JWT using the refresh token, THE Middleware SHALL write the new auth cookies in the same chunked format used by the Supabase SSR client
4. WHEN the Middleware detects an unauthenticated request to a protected route, THE Middleware SHALL redirect to `/auth/login` with a `redirectTo` query parameter preserving the original path
5. THE Middleware SHALL validate JWT expiration by decoding the token payload and checking the `exp` claim, with a 60-second grace period for clock skew
6. WHEN the Middleware encounters a JWT parsing error, THE Middleware SHALL treat the request as unauthenticated and attempt token refresh if a refresh token is available

### Requirement 14: Database Security and RLS Policy Enforcement

**User Story:** As a user, I want my data to be isolated from other users at the database level, so that no API vulnerability can expose my documents, business profile, or payment information to other users.

#### Acceptance Criteria

1. THE Application SHALL have RLS policies enabled on all tables: `profiles`, `businesses`, `documents`, `document_versions`, `signatures`, `compliance_rules`, `audit_logs`, `user_usage`, `payment_history`, `subscriptions`, `chat_messages`
2. THE RLS policies SHALL enforce that users can only SELECT, UPDATE, and DELETE their own rows (matched by `user_id = auth.uid()`)
3. THE RLS policies SHALL allow the service role to INSERT audit logs and update subscription records from webhook handlers
4. WHEN the Application queries the database, THE Application SHALL use parameterized queries through the Supabase client library and SHALL NOT construct SQL strings by concatenation
5. THE Application SHALL use the Supabase anon key for user-context operations and the service role key only for webhook handlers and audit logging
6. THE `signatures` table RLS policy SHALL allow public read access for rows matched by token (for external signers) while restricting write access to authenticated document owners

### Requirement 15: API Key and Secret Management

**User Story:** As a system operator, I want all API keys and secrets to be stored securely and rotatable, so that a compromised key can be quickly replaced without application downtime.

#### Acceptance Criteria

1. THE Application SHALL fetch the DeepSeek API key and OpenAI API key from Supabase Vault at runtime using the `getSecret` function
2. THE Application SHALL NOT expose any API keys in the client-side JavaScript bundle or in `NEXT_PUBLIC_` prefixed environment variables (except the Supabase anon key and app URL which are designed to be public)
3. WHEN the Application starts, THE Application SHALL validate that all required secrets (Supabase URL, Supabase anon key, CSRF secret) are present and SHALL fail fast with a descriptive error if any are missing
4. THE Application SHALL use the Razorpay key secret from server-side environment variables only and SHALL NOT include it in the Wrangler vars or client bundle
5. IF an AI API key is missing or invalid, THEN THE API_Route SHALL return a 503 response with the message "AI service temporarily unavailable" and SHALL NOT expose the key name or provider

