# Design Document: Admin Dashboard

## Overview

The Admin Dashboard is a secure, internal control panel for Clorefy administrators, accessible exclusively at the obfuscated path `/clorefy-ctrl-8x2m`. It provides full visibility and control over users, subscriptions, AI usage, revenue, and system health.

The dashboard is built entirely on the existing stack (Next.js 16 App Router, TypeScript, Supabase, Tailwind CSS, shadcn/ui, Recharts, sonner) with two new dependencies: `bcryptjs` for PIN hashing and `jose` for JWT signing of admin session tokens.

The core design principle is **security through obscurity plus depth**: the route is obfuscated, all unauthenticated access returns 404 (not 401/403), and three independent authentication layers must all pass before any admin UI is rendered.

---

## Architecture

### Triple-Layer Authentication Flow

```
Request to /clorefy-ctrl-8x2m/*
         │
         ▼
┌─────────────────────────────┐
│  Middleware (Edge)          │
│  1. Check admin_session     │
│     cookie (JWT verify)     │
│  2. Check email whitelist   │
│  → 404 on any failure       │
└─────────────┬───────────────┘
              │ Valid session
              ▼
┌─────────────────────────────┐
│  Server Component           │
│  requireAdmin()             │
│  → Re-verify session        │
│  → Redirect 404 on failure  │
└─────────────┬───────────────┘
              │ Authenticated
              ▼
         Admin Page

Login Flow (no session):
         │
         ▼
┌─────────────────────────────┐
│  Layer 1: Supabase Session  │
│  User must be logged in     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Layer 2: Email Whitelist   │
│  ADMIN_EMAILS env var       │
│  → 404 if not in list       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Layer 3: 6-digit PIN       │
│  bcrypt compare vs          │
│  ADMIN_PIN_HASH env var     │
│  Rate limited: 5/15min/IP   │
└─────────────┬───────────────┘
              │ All pass
              ▼
    Issue admin_session JWT
    (httpOnly, Secure, SameSite=Strict, 1hr TTL)
```

### Data Flow

```
Admin Page (Server Component)
    │ requireAdmin() → verifyAdminSession()
    │
    ▼
/api/admin/* Route Handler
    │ verifyAdminSession() → Supabase service role client
    │
    ▼
Supabase (PostgreSQL)
    │ Returns data
    │
    ▼
Client Component (charts, tables, drawers)
    │ SWR for client-side revalidation
    │
    ▼
Admin UI
```

### Middleware Integration

The existing `middleware.ts` is extended to handle admin routes before any other logic. Admin route checks run first in the middleware chain:

1. If path starts with `/clorefy-ctrl-8x2m`, extract `admin_session` cookie
2. Verify JWT signature using `ADMIN_SESSION_SECRET`
3. Check email in `ADMIN_EMAILS` whitelist
4. Return 404 on any failure (not 401/403)
5. Allow `/clorefy-ctrl-8x2m/login` through without session check (so the login page renders)

---

## Components and Interfaces

### `lib/admin-auth.ts`

```typescript
// Verify admin_session cookie JWT, check email whitelist
// Returns admin email string or null
export async function verifyAdminSession(request: Request): Promise<string | null>

// Server component helper — calls verifyAdminSession, redirects to /not-found on failure
export async function requireAdmin(): Promise<string>

// Create signed JWT for admin session
export async function createAdminSessionToken(email: string): Promise<string>
```

### `lib/admin-queries.ts`

All Supabase query functions for admin data, using the service role client:

```typescript
export async function getOverviewKPIs(): Promise<OverviewKPIs>
export async function getUsersPage(params: UsersQueryParams): Promise<PaginatedUsers>
export async function getUserDetail(userId: string): Promise<UserDetail>
export async function getSubscriptions(params: SubscriptionsQueryParams): Promise<PaginatedSubscriptions>
export async function getAIUsage(params: AIUsageQueryParams): Promise<AIUsageData>
export async function getRevenue(): Promise<RevenueData>
export async function getSecurity(params: SecurityQueryParams): Promise<SecurityData>
```

### Page Components (Server Components)

All admin pages are Server Components that call `requireAdmin()` at the top:

```typescript
// app/clorefy-ctrl-8x2m/page.tsx
export default async function AdminOverviewPage() {
  const adminEmail = await requireAdmin()
  // fetch data from /api/admin/overview
  // render KPI cards + charts
}
```

### Client Components (`components/admin/`)

| Component | Purpose |
|---|---|
| `admin-sidebar.tsx` | Dark sidebar with nav links, session countdown timer |
| `admin-header.tsx` | Top bar with admin email, logout button |
| `kpi-card.tsx` | Count-up animation card with skeleton state |
| `data-table.tsx` | Reusable sortable/filterable/paginated table |
| `user-detail-drawer.tsx` | Slide-in user detail panel with action buttons |
| `tier-override-modal.tsx` | Modal for tier change with reason field |
| `confirmation-dialog.tsx` | Reusable destructive action confirmation |
| `skeleton-card.tsx` | Skeleton placeholder for KPI cards |
| `skeleton-table.tsx` | Skeleton placeholder for table rows |
| `command-palette.tsx` | Cmd+K command palette for user search + navigation |

### API Routes (`app/api/admin/`)

All routes call `verifyAdminSession()` as the first operation and return 404 on failure.

| Route | Method | Purpose |
|---|---|---|
| `auth/verify-pin` | POST | PIN verification, session issuance |
| `auth/logout` | POST | Session termination |
| `overview` | GET | All KPI data in one response |
| `users` | GET | Paginated user list with filters |
| `users/[id]` | GET | Full user detail |
| `users/[id]/tier` | PATCH | Change user tier |
| `users/[id]/suspend` | PATCH | Suspend/unsuspend user |
| `users/[id]/reset-usage` | POST | Reset monthly usage |
| `users/export` | GET | CSV export |
| `subscriptions` | GET | Paginated subscriptions |
| `subscriptions/override` | POST | Manual tier override |
| `ai-usage` | GET | AI usage statistics |
| `revenue` | GET | Revenue KPIs + payment history |
| `security` | GET | Audit logs, brute force, IP blocklist |
| `settings/announcement` | POST | Create system announcement |
| `settings/pin` | PATCH | Change admin PIN |

---

## Data Models

### New Database Tables

```sql
-- Admin sessions (tracks active admin logins)
CREATE TABLE admin_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email      TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,  -- SHA-256 of the JWT
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  ip_address       INET
);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(session_token_hash);

-- Admin tier overrides (manual tier changes)
CREATE TABLE admin_tier_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier         TEXT NOT NULL,
  expires_at   TIMESTAMPTZ,
  reason       TEXT NOT NULL,
  admin_email  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_tier_overrides_user_id ON admin_tier_overrides(user_id);

-- System announcements (broadcast banners)
CREATE TABLE system_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message     TEXT NOT NULL,
  active      BOOLEAN DEFAULT TRUE,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

-- IP blocklist
CREATE TABLE ip_blocklist (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address  INET NOT NULL UNIQUE,
  reason      TEXT,
  blocked_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);
```

### New Columns on `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN tier           TEXT DEFAULT 'free',
  ADD COLUMN tier_expires_at TIMESTAMPTZ,
  ADD COLUMN suspended_at   TIMESTAMPTZ,
  ADD COLUMN last_active_at TIMESTAMPTZ;
```

### RLS Policies

All new tables have RLS enabled with a single policy: deny all access to non-service-role clients. Admin API routes use the Supabase service role client (bypasses RLS), so no user-facing RLS policies are needed.

```sql
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tier_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocklist ENABLE ROW LEVEL SECURITY;

-- Deny all for anon/authenticated roles (service role bypasses RLS)
CREATE POLICY "deny_all_admin_sessions" ON admin_sessions FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_tier_overrides" ON admin_tier_overrides FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_announcements" ON system_announcements FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_ip_blocklist" ON ip_blocklist FOR ALL TO anon, authenticated USING (false);
```

### Extended `AuditAction` Type

The existing `AuditAction` union in `lib/audit-log.ts` is extended with admin actions:

```typescript
| "admin.login"
| "admin.logout"
| "admin.pin_lockout"
| "admin.tier_change"
| "admin.user_suspend"
| "admin.user_unsuspend"
| "admin.usage_reset"
| "admin.announcement_create"
| "admin.ip_block"
| "admin.ip_unblock"
| "admin.pin_change"
| "admin.maintenance_enable"
| "admin.maintenance_disable"
```

### Admin Session JWT Payload

```typescript
interface AdminSessionPayload {
  email: string      // admin email
  iat: number        // issued at (Unix seconds)
  exp: number        // expires at (iat + 3600)
}
```

Signed with `ADMIN_SESSION_SECRET` using `jose` (HS256). The cookie value is the raw JWT string.

### KPI Card Data Shape

```typescript
interface OverviewKPIs {
  totalUsers: number
  newSignupsToday: number
  newSignupsThisWeek: number
  newSignupsThisMonth: number
  activePaidUsers: number
  totalDocumentsAllTime: number
  totalDocumentsThisMonth: number
  totalAIRequestsThisMonth: number
  estimatedAICostThisMonth: number
  totalRevenue: number
  currentMRR: number
  signupsTrend: Array<{ date: string; count: number }>
  documentsTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ month: string; amount: number }>
  tierDistribution: Array<{ tier: string; count: number }>
  recentActivity: AuditLogEntry[]
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Unauthenticated admin route access returns 404

*For any* HTTP request to any path under `/clorefy-ctrl-8x2m/*` that does not include a valid, non-expired `admin_session` cookie signed with `ADMIN_SESSION_SECRET`, the response status code SHALL be 404.

**Validates: Requirements 1.2, 1.4, 1.5, 4.4, 17.16**

### Property 2: Non-whitelisted email returns 404

*For any* authenticated Supabase user whose email is not present in the `ADMIN_EMAILS` environment variable, any request to any admin route SHALL return HTTP 404.

**Validates: Requirements 2.3**

### Property 3: PIN failure responses are opaque

*For any* failed PIN verification attempt — whether due to wrong PIN, non-whitelisted email, missing Supabase session, or rate-limited IP — the response body SHALL contain the same generic error message and SHALL NOT reveal which specific check failed.

**Validates: Requirements 2.8**

### Property 4: PIN rate limiting enforces 5-attempt threshold

*For any* IP address, after exactly 5 failed PIN verification attempts within any 15-minute sliding window, all subsequent PIN attempts from that IP SHALL return a lockout error response for the remainder of that window.

**Validates: Requirements 3.1, 3.2**

### Property 5: Admin actions always produce audit log entries

*For any* admin action (tier change, user suspension, usage reset, announcement creation, IP block/unblock, PIN change, login, logout), an entry SHALL be inserted into `audit_logs` with the correct `admin.*` action string, the admin email, the IP address, and all required metadata fields — and this insertion SHALL occur before the HTTP response is returned.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10**

### Property 6: User search results always match the query

*For any* search query string submitted to `GET /api/admin/users?search=<query>`, every user record in the response SHALL have the query string present (case-insensitive) in either the `full_name` or `email` field.

**Validates: Requirements 9.2**

---

## Error Handling

### Authentication Errors

All authentication failures in admin routes return HTTP 404 with a generic body `{ "error": "Not found" }`. This applies to:
- Missing `admin_session` cookie
- Invalid JWT signature
- Expired JWT
- Email not in whitelist
- Supabase session invalid

The 404 response is intentional — it prevents attackers from distinguishing between "route doesn't exist" and "route exists but you're not authorized."

### PIN Verification Errors

The `verify-pin` route returns a single generic error message for all failure modes:
```json
{ "error": "Invalid credentials", "attemptsRemaining": 3 }
```

The `attemptsRemaining` field is included to satisfy Requirement 2.9 (display remaining attempts) without revealing which layer failed.

### Rate Limit Errors

When an IP is locked out, the response is:
```json
{ "error": "Too many attempts. Try again in 12 minutes.", "lockedUntil": "<ISO timestamp>" }
```

### API Route Errors

Admin API routes follow this error response shape:
```typescript
{ "error": string, "code"?: string }
```

HTTP status codes:
- `404` — auth failure (all admin auth errors)
- `400` — invalid request body / missing required fields
- `422` — validation error (e.g., invalid tier value)
- `500` — unexpected server error (logged, generic message returned)

### Audit Log Failures

Audit log failures are non-blocking — they are logged to `console.error` but never cause the admin action to fail. This matches the existing pattern in `lib/audit-log.ts`.

---

## Testing Strategy

### Unit Tests

Focus on pure logic functions:
- `verifyAdminSession()` — test with valid JWT, expired JWT, wrong signature, missing cookie
- `createAdminSessionToken()` — verify JWT payload structure and expiry
- PIN rate limiting logic — test threshold boundary (4 attempts allowed, 5th blocked)
- User search filter logic — test case-insensitive matching, empty query, special characters
- CSV export formatting — test column ordering, escaping of commas/quotes in values

### Property-Based Tests

Using `fast-check` (already compatible with the TypeScript/Jest setup). Minimum 100 iterations per property.

**Property 1 test** — `Feature: admin-dashboard, Property 1: Unauthenticated admin route access returns 404`
Generate random sub-paths under `/clorefy-ctrl-8x2m/`, random invalid cookie values (empty string, random JWT, expired JWT, wrong signature), verify all return 404.

**Property 2 test** — `Feature: admin-dashboard, Property 2: Non-whitelisted email returns 404`
Generate random email addresses (valid format), verify none pass the whitelist check when `ADMIN_EMAILS` is set to a fixed test value.

**Property 3 test** — `Feature: admin-dashboard, Property 3: PIN failure responses are opaque`
Generate various failure inputs (wrong PIN strings, non-whitelisted emails, missing sessions), call the verify-pin handler with mocked dependencies, verify all error responses have identical structure and the same generic message.

**Property 4 test** — `Feature: admin-dashboard, Property 4: PIN rate limiting enforces 5-attempt threshold`
Generate random IP addresses, simulate exactly 5 failed attempts, verify the 6th is blocked. Also verify that 4 attempts do not trigger lockout.

**Property 5 test** — `Feature: admin-dashboard, Property 5: Admin actions always produce audit log entries`
Generate random user IDs and tier values, call each admin action handler with mocked Supabase, verify the mock's `insert` on `audit_logs` was called with the correct `action` field and all required metadata keys present.

**Property 6 test** — `Feature: admin-dashboard, Property 6: User search results always match the query`
Generate random user datasets (arrays of `{ full_name, email }`) and random search query strings, run the search filter function, verify every result contains the query in name or email (case-insensitive).

### Integration Tests

- Full PIN verification flow: valid Supabase session + whitelisted email + correct PIN → `admin_session` cookie issued
- Session expiry: verify expired JWT returns 404 from middleware
- Audit log persistence: verify `admin.tier_change` entries appear in `audit_logs` after tier change API call
- Rate limit persistence: verify `rate_limit_log` table is updated after PIN attempts

### Accessibility

- All admin tables have proper `<th scope>` and ARIA labels
- Drawers and modals use `role="dialog"` with `aria-labelledby`
- Command palette uses `role="combobox"` pattern
- Keyboard navigation: Tab through all interactive elements, Escape closes modals/drawers
- Color contrast: dark theme uses minimum 4.5:1 ratio for text

### Security Testing

- Verify admin routes return 404 (not 401/403) for unauthenticated requests
- Verify `admin_session` cookie has `HttpOnly`, `Secure`, `SameSite=Strict` attributes
- Verify PIN hash is never logged or returned in any response
- Verify admin routes are absent from sitemap and robots.txt
- Verify service role key is never exposed to client-side code
