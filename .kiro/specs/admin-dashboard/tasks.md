# Tasks: Admin Dashboard

## Task List

- [x] 1. Database Migration
  - [x] 1.1 Create `supabase/migrations/admin_dashboard.sql` with all new tables (`admin_sessions`, `admin_tier_overrides`, `system_announcements`, `ip_blocklist`), new columns on `profiles` (`tier`, `tier_expires_at`, `suspended_at`, `last_active_at`), indexes, and RLS deny-all policies
  - [x] 1.2 Apply migration to Supabase project

- [x] 2. Dependencies and Environment
  - [x] 2.1 Add `bcryptjs` and `@types/bcryptjs` to `package.json`
  - [x] 2.2 Add `jose` to `package.json`
  - [x] 2.3 Document required env vars (`ADMIN_EMAILS`, `ADMIN_PIN_HASH`, `ADMIN_SESSION_SECRET`) in `.env` with placeholder values

- [x] 3. Core Auth Library (`lib/admin-auth.ts`)
  - [x] 3.1 Implement `verifyAdminSession(request)` — reads `admin_session` cookie, verifies JWT with `jose` using `ADMIN_SESSION_SECRET`, checks email against `ADMIN_EMAILS` whitelist, returns admin email or null
  - [x] 3.2 Implement `createAdminSessionToken(email)` — signs JWT with 1hr TTL using `jose`
  - [x] 3.3 Implement `requireAdmin()` — server component helper that calls `verifyAdminSession` and calls `notFound()` if not authenticated

- [x] 4. Middleware Extension
  - [x] 4.1 Add admin route handling to `middleware.ts` — intercept all `/clorefy-ctrl-8x2m/*` paths (except `/clorefy-ctrl-8x2m/login`), call `verifyAdminSession`, return 404 response on failure
  - [x] 4.2 Ensure admin route check runs before all other middleware logic

- [x] 5. Admin Auth API Routes
  - [x] 5.1 Create `app/api/admin/auth/verify-pin/route.ts` — Layer 1 (Supabase session check), Layer 2 (email whitelist), Layer 3 (bcrypt PIN compare against `ADMIN_PIN_HASH`), rate limit check via `check_rate_limit` RPC with category `admin_pin`, issue `admin_session` JWT cookie on success, insert into `admin_sessions` table, log `admin.login` audit entry
  - [x] 5.2 Create `app/api/admin/auth/logout/route.ts` — clear `admin_session` cookie, delete from `admin_sessions`, log `admin.logout` audit entry

- [x] 6. Admin Queries Library (`lib/admin-queries.ts`)
  - [x] 6.1 Implement `getOverviewKPIs()` — query profiles, documents, user_usage, generation_history for all KPI values and trend data
  - [x] 6.2 Implement `getUsersPage(params)` — paginated query with search (ilike on name/email), tier filter, status filter, date range, sort, page/pageSize
  - [x] 6.3 Implement `getUserDetail(userId)` — profile, business, usage stats, last 10 documents, last 20 audit log entries
  - [x] 6.4 Implement `getSubscriptions(params)` — paginated subscription data from profiles + user_usage
  - [x] 6.5 Implement `getAIUsage(params)` — summary cards, top users, document type breakdown, generation history from generation_history table
  - [x] 6.6 Implement `getRevenue()` — MRR/ARR calculations, payment history from Razorpay webhook data
  - [x] 6.7 Implement `getSecurity(params)` — audit logs with filters, brute force events, suspicious activity, IP blocklist

- [x] 7. Admin Data API Routes
  - [x] 7.1 Create `app/api/admin/overview/route.ts` — call `getOverviewKPIs()`, return full KPI payload
  - [x] 7.2 Create `app/api/admin/users/route.ts` — call `getUsersPage()` with query params
  - [x] 7.3 Create `app/api/admin/users/[id]/route.ts` — call `getUserDetail()`
  - [x] 7.4 Create `app/api/admin/users/[id]/tier/route.ts` — validate body `{ tier, expires_at?, reason }`, update `profiles.tier` and `profiles.tier_expires_at`, insert into `admin_tier_overrides`, log `admin.tier_change` audit entry
  - [x] 7.5 Create `app/api/admin/users/[id]/suspend/route.ts` — validate body `{ suspended: boolean }`, set/clear `profiles.suspended_at`, log `admin.user_suspend` or `admin.user_unsuspend` audit entry
  - [x] 7.6 Create `app/api/admin/users/[id]/reset-usage/route.ts` — delete `user_usage` record for current month, log `admin.usage_reset` audit entry
  - [x] 7.7 Create `app/api/admin/users/export/route.ts` — stream CSV response with all users matching filter params
  - [x] 7.8 Create `app/api/admin/subscriptions/route.ts` — call `getSubscriptions()` with query params
  - [x] 7.9 Create `app/api/admin/subscriptions/override/route.ts` — validate body, insert `admin_tier_overrides`, update `profiles`, log `admin.tier_change`
  - [x] 7.10 Create `app/api/admin/ai-usage/route.ts` — call `getAIUsage()` with query params
  - [x] 7.11 Create `app/api/admin/revenue/route.ts` — call `getRevenue()`
  - [x] 7.12 Create `app/api/admin/security/route.ts` — call `getSecurity()` with query params; handle POST for IP blocklist add, DELETE for IP blocklist remove with audit logging
  - [x] 7.13 Create `app/api/admin/settings/announcement/route.ts` — validate body `{ message, expires_at? }`, insert into `system_announcements`, log `admin.announcement_create`
  - [x] 7.14 Create `app/api/admin/settings/pin/route.ts` — validate current PIN, bcrypt hash new PIN, update `ADMIN_PIN_HASH` (store in `admin_config` table if env var update not feasible), log `admin.pin_change`

- [x] 8. Extend Audit Log Types
  - [x] 8.1 Add all `admin.*` action strings to the `AuditAction` union type in `lib/audit-log.ts`

- [x] 9. Admin Layout and Navigation
  - [x] 9.1 Create `app/clorefy-ctrl-8x2m/layout.tsx` — call `requireAdmin()`, render `AdminSidebar` + `AdminHeader` + session countdown, wrap children
  - [x] 9.2 Create `components/admin/admin-sidebar.tsx` — dark sidebar with nav links (Overview, Users, Subscriptions, AI Usage, Revenue, Security, Settings), icons, active state, collapse to icons-only below 1024px
  - [x] 9.3 Create `components/admin/admin-header.tsx` — top bar showing admin email, session countdown timer, logout button

- [x] 10. Shared Admin UI Components
  - [x] 10.1 Create `components/admin/kpi-card.tsx` — count-up animation using `useCountUp` hook (requestAnimationFrame, 1.2s, easeOutCubic), skeleton state, error state with retry button
  - [x] 10.2 Create `components/admin/skeleton-card.tsx` — skeleton placeholder matching KPI card dimensions
  - [x] 10.3 Create `components/admin/skeleton-table.tsx` — skeleton placeholder for table rows (configurable row count)
  - [x] 10.4 Create `components/admin/data-table.tsx` — reusable sortable/filterable/paginated table with checkbox selection, bulk action toolbar slot, empty state slot
  - [x] 10.5 Create `components/admin/confirmation-dialog.tsx` — reusable destructive action confirmation dialog using shadcn/ui Dialog
  - [x] 10.6 Create `components/admin/command-palette.tsx` — Cmd+K command palette using shadcn/ui Command, searches users via debounced API call, navigates to admin pages

- [x] 11. Admin Login Page
  - [x] 11.1 Create `app/clorefy-ctrl-8x2m/login/page.tsx` — PIN entry form (6-digit input), shows remaining attempts, calls `POST /api/admin/auth/verify-pin`, redirects to `/clorefy-ctrl-8x2m` on success, displays lockout message when rate limited

- [x] 12. Overview Page
  - [x] 12.1 Create `app/clorefy-ctrl-8x2m/page.tsx` — server component fetching from `/api/admin/overview`, renders KPI cards grid, charts, activity feed, system health indicators
  - [x] 12.2 Add Recharts area chart (signups last 30 days), bar chart (documents last 30 days), line chart (revenue last 6 months), pie chart (tier distribution) — all with custom dark-theme tooltips and skeleton loading states

- [x] 13. Users Page
  - [x] 13.1 Create `app/clorefy-ctrl-8x2m/users/page.tsx` — server component shell calling `requireAdmin()`
  - [x] 13.2 Create users client component — DataTable with search input (300ms debounce), tier/status/date filters, sort controls, pagination, checkbox selection, bulk action toolbar
  - [x] 13.3 Create `components/admin/user-detail-drawer.tsx` — slide-in drawer with profile info, business details, usage stats, last 10 documents, last 20 audit entries; action buttons for tier change, trial extension, usage reset, suspend/unsuspend, password reset; confirmation dialogs for destructive actions; toast notifications on action completion
  - [x] 13.4 Create `components/admin/tier-override-modal.tsx` — tier selector, optional expiry date picker, required reason textarea, confirm button

- [x] 14. Subscriptions Page
  - [x] 14.1 Create `app/clorefy-ctrl-8x2m/subscriptions/page.tsx` — server component shell
  - [x] 14.2 Create subscriptions client component — revenue summary cards (MRR, ARR, churn, new/cancelled this month), subscriptions DataTable with filters, manual override panel, CSV export button

- [x] 15. AI Usage Page
  - [x] 15.1 Create `app/clorefy-ctrl-8x2m/ai-usage/page.tsx` — server component shell
  - [x] 15.2 Create AI usage client component — summary cards, top-10 users table, document type pie chart, avg generation time, success/error bar chart, generation history DataTable with filters

- [x] 16. Revenue Page
  - [x] 16.1 Create `app/clorefy-ctrl-8x2m/revenue/page.tsx` — server component shell
  - [x] 16.2 Create revenue client component — KPI cards (MRR, ARR, new revenue, MoM change), revenue by plan breakdown, payment history DataTable, refunds/failed payments section, CSV export

- [x] 17. Security Page
  - [x] 17.1 Create `app/clorefy-ctrl-8x2m/security/page.tsx` — server component shell
  - [x] 17.2 Create security client component — audit log DataTable with action/email/date/IP filters, brute force section, suspicious activity section, IP blocklist panel with add/remove controls

- [x] 18. Settings Page
  - [x] 18.1 Create `app/clorefy-ctrl-8x2m/settings/page.tsx` — server component shell
  - [x] 18.2 Create settings client component — read-only admin email display, PIN change form (current PIN + new PIN + confirm), announcements panel (create form + active announcements list with deactivate), feature flags panel, maintenance mode toggle

- [x] 19. Sitemap and Robots Exclusion
  - [x] 19.1 Verify `app/sitemap.ts` does not include any `/clorefy-ctrl-8x2m` paths
  - [x] 19.2 Verify `app/robots.ts` disallows `/clorefy-ctrl-8x2m` for all crawlers

- [x] 20. Property-Based Tests
  - [x] 20.1 Add `fast-check` as a dev dependency
  - [x] 20.2 Write property test for Property 1: generate random admin sub-paths and invalid cookies, verify all return 404 from `verifyAdminSession`
  - [x] 20.3 Write property test for Property 2: generate random email addresses, verify none pass whitelist check against a fixed `ADMIN_EMAILS` test value
  - [x] 20.4 Write property test for Property 3: generate various failure inputs to `verify-pin` handler (wrong PIN, non-whitelisted email, missing session), verify all error responses have identical structure and opaque message
  - [x] 20.5 Write property test for Property 4: generate random IP addresses, simulate 5 failed attempts, verify 6th is blocked; verify 4 attempts do not trigger lockout
  - [x] 20.6 Write property test for Property 5: generate random user IDs and tier values, call each admin action handler with mocked Supabase, verify `audit_logs` insert was called with correct `action` field and all required metadata keys
  - [x] 20.7 Write property test for Property 6: generate random user datasets and search queries, run search filter function, verify every result contains query in name or email (case-insensitive)
