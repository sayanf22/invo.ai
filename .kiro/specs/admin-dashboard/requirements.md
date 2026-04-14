# Requirements Document

## Introduction

The Admin Dashboard is a secure, internal control panel for Clorefy (invo.ai) administrators. It provides full visibility and control over users, subscriptions, AI usage, revenue, and system health — all behind a triple-layer authentication system with an obfuscated URL. The dashboard is built on the existing Next.js 16 App Router, Supabase (PostgreSQL), Tailwind CSS, shadcn/ui, and Recharts stack, and integrates with the existing audit_logs, profiles, businesses, documents, generation_history, user_usage, and rate_limit_log tables.

The dashboard is accessible only at `/clorefy-ctrl-8x2m` and is invisible to search engines, sitemaps, and non-admin users. All admin actions are logged to the audit_logs table with the `admin.*` action prefix.

---

## Glossary

- **Admin_Dashboard**: The complete admin control panel at `/clorefy-ctrl-8x2m` and its sub-routes.
- **Admin_Auth_System**: The triple-layer authentication mechanism (Supabase session + email whitelist + PIN).
- **Admin_Session**: A short-lived httpOnly cookie-based session issued after successful PIN verification, valid for 1 hour.
- **PIN_Verifier**: The server-side API route at `POST /api/admin/auth/verify-pin` that validates the 6-digit PIN against the bcrypt hash in `ADMIN_PIN_HASH` env var.
- **Rate_Limiter**: The IP-based mechanism that blocks PIN attempts after 5 failures within 15 minutes.
- **Overview_Page**: The root admin page at `/clorefy-ctrl-8x2m` showing KPI cards, charts, and activity feed.
- **Users_Page**: The admin page at `/clorefy-ctrl-8x2m/users` for managing all user accounts.
- **User_Detail_Drawer**: The slide-in panel showing full user profile, usage, and admin action controls.
- **Subscriptions_Page**: The admin page at `/clorefy-ctrl-8x2m/subscriptions` for managing paid subscriptions and tier overrides.
- **AI_Usage_Page**: The admin page at `/clorefy-ctrl-8x2m/ai-usage` for monitoring AI consumption and generation history.
- **Revenue_Page**: The admin page at `/clorefy-ctrl-8x2m/revenue` for financial reporting and Razorpay payment history.
- **Security_Page**: The admin page at `/clorefy-ctrl-8x2m/security` for audit logs, brute force events, and IP blocklist.
- **Settings_Page**: The admin page at `/clorefy-ctrl-8x2m/settings` for PIN management, announcements, feature flags, and maintenance mode.
- **Tier_Override**: An admin-initiated change to a user's subscription tier stored in the `admin_tier_overrides` table.
- **Middleware**: The existing `middleware.ts` file that handles route protection at the edge.
- **Audit_Logger**: The existing `lib/audit-log.ts` module extended with `admin.*` action types.
- **KPI_Card**: A metric display card with count-up animation on page load.
- **Skeleton_Loader**: A placeholder UI shown during data fetching, replacing spinner-based loading.
- **System_Announcement**: A broadcast message stored in the `system_announcements` table and shown as a banner to all users.
- **IP_Blocklist**: The `ip_blocklist` table storing manually blocked IP addresses with optional expiry.
- **Feature_Flag**: A per-tier toggle controlling availability of specific platform features.
- **MRR**: Monthly Recurring Revenue — sum of all active monthly subscription amounts.
- **ARR**: Annual Recurring Revenue — MRR × 12.

---

## Requirements

### Requirement 1: Obfuscated Route and Middleware Protection

**User Story:** As a security-conscious platform operator, I want the admin dashboard to be completely hidden from non-admins, so that attackers cannot discover or probe the admin interface.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL be served exclusively at the path `/clorefy-ctrl-8x2m` and its sub-paths.
2. WHEN a non-admin user or unauthenticated user requests any path under `/clorefy-ctrl-8x2m`, THE Middleware SHALL return an HTTP 404 response — not a 401 or 403 — to avoid revealing the route exists.
3. THE Admin_Dashboard route SHALL NOT appear in `app/sitemap.ts` or `app/robots.ts`.
4. WHEN the Middleware processes a request to `/clorefy-ctrl-8x2m/*`, THE Middleware SHALL verify the presence of a valid Admin_Session cookie before allowing the request to proceed.
5. IF the Admin_Session cookie is absent or expired on a request to `/clorefy-ctrl-8x2m/*`, THEN THE Middleware SHALL return HTTP 404.
6. THE Middleware SHALL perform admin route checks before any other route logic for paths matching `/clorefy-ctrl-8x2m/*`.

---

### Requirement 2: Triple-Layer Authentication

**User Story:** As a platform operator, I want three independent authentication layers before granting admin access, so that a single compromised credential cannot expose the admin panel.

#### Acceptance Criteria

1. WHEN a user navigates to `/clorefy-ctrl-8x2m`, THE Admin_Auth_System SHALL present a PIN entry screen only after verifying the user has an active Supabase session (Layer 1).
2. WHEN Layer 1 passes, THE Admin_Auth_System SHALL verify the authenticated user's email exists in the `ADMIN_EMAILS` environment variable whitelist (Layer 2).
3. IF the authenticated user's email is not in the `ADMIN_EMAILS` whitelist, THEN THE Admin_Auth_System SHALL return HTTP 404 — not 401 or 403.
4. WHEN Layers 1 and 2 pass, THE Admin_Auth_System SHALL display a 6-digit PIN entry form (Layer 3).
5. WHEN the admin submits the PIN, THE PIN_Verifier SHALL compare the submitted PIN against the bcrypt hash stored in the `ADMIN_PIN_HASH` environment variable using server-side bcrypt comparison.
6. WHEN PIN verification succeeds, THE PIN_Verifier SHALL issue an httpOnly, Secure, SameSite=Strict cookie named `admin_session` containing a signed session token with a 1-hour TTL.
7. WHEN PIN verification succeeds, THE PIN_Verifier SHALL insert a record into the `admin_sessions` table with the admin email, expiry timestamp, and client IP address.
8. IF PIN verification fails, THEN THE PIN_Verifier SHALL increment the failure counter for the requesting IP address and return an error response without revealing whether the email or PIN was incorrect.
9. THE Admin_Auth_System SHALL display the remaining PIN attempts to the admin on the PIN entry screen.

---

### Requirement 3: PIN Rate Limiting and Lockout

**User Story:** As a platform operator, I want automated lockout after repeated PIN failures, so that brute-force attacks on the admin PIN are blocked.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL allow a maximum of 5 PIN verification attempts per IP address within any 15-minute sliding window.
2. WHEN an IP address reaches 5 failed PIN attempts within 15 minutes, THE Rate_Limiter SHALL block all subsequent PIN attempts from that IP for the remainder of the 15-minute window.
3. WHEN a PIN attempt is blocked by the Rate_Limiter, THE Admin_Auth_System SHALL return an error response indicating the lockout duration in minutes.
4. WHEN a PIN attempt is blocked, THE Audit_Logger SHALL insert a record into `audit_logs` with action `admin.pin_lockout`, the IP address, and the attempt count.
5. WHEN the 15-minute window expires, THE Rate_Limiter SHALL automatically reset the failure counter for that IP address.
6. THE Rate_Limiter SHALL track attempt counts in the `rate_limit_log` table using the existing `check_rate_limit` database function with category `admin_pin`.

---

### Requirement 4: Admin Session Management and Auto-Logout

**User Story:** As a platform operator, I want admin sessions to expire automatically after inactivity, so that unattended admin sessions cannot be exploited.

#### Acceptance Criteria

1. THE Admin_Session SHALL expire 1 hour after issuance, regardless of activity.
2. WHEN an admin makes any request to `/api/admin/*`, THE Admin_Auth_System SHALL verify the `admin_session` cookie is present, valid, and not expired.
3. WHEN an admin makes any request to `/api/admin/*`, THE Admin_Auth_System SHALL re-verify the admin's email against the `ADMIN_EMAILS` whitelist on every request.
4. IF the `admin_session` cookie is expired or invalid on a request to `/api/admin/*`, THEN THE Admin_Auth_System SHALL return HTTP 404.
5. WHEN an admin calls `POST /api/admin/auth/logout`, THE Admin_Auth_System SHALL clear the `admin_session` cookie and delete the corresponding record from `admin_sessions`.
6. WHEN an admin session expires, THE Admin_Dashboard SHALL redirect the admin to the PIN entry screen on the next navigation.
7. THE Admin_Dashboard SHALL display a countdown timer showing the remaining session time in the navigation sidebar.

---

### Requirement 5: Admin Action Audit Logging

**User Story:** As a compliance-conscious operator, I want every admin action logged with full context, so that I have a complete audit trail of all administrative operations.

#### Acceptance Criteria

1. THE Audit_Logger SHALL record an entry in `audit_logs` for every admin action with an action string prefixed with `admin.`.
2. WHEN an admin changes a user's tier, THE Audit_Logger SHALL record action `admin.tier_change` with metadata containing the target user ID, old tier, new tier, reason, and admin email.
3. WHEN an admin suspends or unsuspends a user, THE Audit_Logger SHALL record action `admin.user_suspend` or `admin.user_unsuspend` with the target user ID and admin email.
4. WHEN an admin resets a user's monthly usage, THE Audit_Logger SHALL record action `admin.usage_reset` with the target user ID and the month being reset.
5. WHEN an admin creates a system announcement, THE Audit_Logger SHALL record action `admin.announcement_create` with the announcement message and admin email.
6. WHEN an admin modifies the IP blocklist, THE Audit_Logger SHALL record action `admin.ip_block` or `admin.ip_unblock` with the IP address and reason.
7. WHEN an admin changes the admin PIN, THE Audit_Logger SHALL record action `admin.pin_change` with the admin email and timestamp — without logging the old or new PIN value.
8. WHEN an admin logs in successfully, THE Audit_Logger SHALL record action `admin.login` with the admin email and IP address.
9. WHEN an admin logs out, THE Audit_Logger SHALL record action `admin.logout` with the admin email.
10. THE Audit_Logger SHALL capture the IP address and user agent for every admin audit log entry.

---

### Requirement 6: Database Schema Changes

**User Story:** As a developer, I want the required new tables and columns created in Supabase, so that the admin dashboard has the data structures it needs to operate.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL require a new `admin_sessions` table with columns: `id` (UUID PK), `admin_email` (text), `session_token_hash` (text), `expires_at` (timestamptz), `created_at` (timestamptz), `ip_address` (inet).
2. THE Admin_Dashboard SHALL require a new `admin_tier_overrides` table with columns: `id` (UUID PK), `user_id` (UUID FK → profiles.id), `tier` (text), `expires_at` (timestamptz nullable), `reason` (text NOT NULL), `admin_email` (text), `created_at` (timestamptz).
3. THE Admin_Dashboard SHALL require a new `system_announcements` table with columns: `id` (UUID PK), `message` (text NOT NULL), `active` (boolean DEFAULT true), `created_by` (text), `created_at` (timestamptz), `expires_at` (timestamptz nullable).
4. THE Admin_Dashboard SHALL require a new `ip_blocklist` table with columns: `id` (UUID PK), `ip_address` (inet NOT NULL UNIQUE), `reason` (text), `blocked_by` (text), `created_at` (timestamptz), `expires_at` (timestamptz nullable).
5. THE `profiles` table SHALL require new columns: `tier` (text DEFAULT 'free'), `tier_expires_at` (timestamptz nullable), `suspended_at` (timestamptz nullable), `last_active_at` (timestamptz nullable).
6. WHEN the migration is applied, THE Admin_Dashboard SHALL ensure all new tables have Row Level Security enabled with policies that deny all access to non-service-role clients.
7. THE `admin_tier_overrides` table SHALL have an index on `user_id` for efficient per-user lookups.
8. THE `admin_sessions` table SHALL have an index on `session_token_hash` for efficient session validation.

---

### Requirement 7: Overview Page — KPI Cards

**User Story:** As an admin, I want a high-level metrics overview on the dashboard home page, so that I can assess platform health at a glance without running manual queries.

#### Acceptance Criteria

1. THE Overview_Page SHALL display KPI_Cards for: total users (all time), new signups (today / this week / this month — toggleable), active paid users (starter + pro + agency tiers), total documents generated (all time and this month), total AI requests this month, estimated AI cost this month in USD, total revenue collected from Razorpay, and current MRR.
2. WHEN the Overview_Page loads, THE KPI_Card SHALL animate the displayed number from 0 to the actual value using a count-up animation over 1.2 seconds.
3. WHEN the Overview_Page is fetching data, THE KPI_Card SHALL display a Skeleton_Loader in place of the number.
4. WHEN the admin toggles the "new signups" KPI_Card between today / this week / this month, THE KPI_Card SHALL update the displayed value without a full page reload.
5. THE Overview_Page SHALL fetch all KPI data from `GET /api/admin/overview` in a single request.
6. IF the `GET /api/admin/overview` request fails, THEN THE Overview_Page SHALL display an error state on each KPI_Card with a retry button.

---

### Requirement 8: Overview Page — Charts

**User Story:** As an admin, I want visual trend charts on the overview page, so that I can identify growth patterns and anomalies quickly.

#### Acceptance Criteria

1. THE Overview_Page SHALL display a Recharts area chart showing user signups per day for the last 30 days, using data from the `profiles.created_at` column.
2. THE Overview_Page SHALL display a Recharts bar chart showing documents generated per day for the last 30 days, using data from the `documents.created_at` column.
3. THE Overview_Page SHALL display a Recharts line chart showing total revenue per month for the last 6 months, using data from Razorpay payment records.
4. THE Overview_Page SHALL display a Recharts pie chart showing the distribution of users across free, starter, pro, and agency tiers, using data from the `profiles.tier` column.
5. WHEN chart data is loading, THE Overview_Page SHALL display Skeleton_Loaders matching the chart dimensions.
6. WHEN a chart has no data for a given period, THE Overview_Page SHALL display an empty state message within the chart area.
7. THE Overview_Page SHALL display a recent activity feed showing the last 20 entries from `audit_logs` ordered by `created_at` descending.
8. THE Overview_Page SHALL display system health indicators showing the Supabase database connection status and the DeepSeek AI API reachability status.

---

### Requirement 9: Users Page — Table and Filtering

**User Story:** As an admin, I want a searchable and filterable table of all users, so that I can quickly find and inspect any user account.

#### Acceptance Criteria

1. THE Users_Page SHALL display a paginated table of all users with columns: avatar, full name, email, tier, signup date, last active date, documents count, AI requests count, and account status (active/suspended).
2. THE Users_Page SHALL support full-text search across user name and email, with results updating as the admin types with a 300ms debounce.
3. THE Users_Page SHALL support filtering by: tier (free/starter/pro/agency), signup date range, onboarding completion status, and account status (active/suspended).
4. THE Users_Page SHALL support sorting by: signup date, documents count, AI usage count, and full name — in ascending and descending order.
5. THE Users_Page SHALL support pagination with selectable page sizes of 25, 50, and 100 users per page.
6. THE Users_Page SHALL fetch data from `GET /api/admin/users` with query parameters for search, filters, sort, page, and page size.
7. WHEN the Users_Page is loading data, THE Users_Page SHALL display Skeleton_Loaders for each table row.
8. WHEN the Users_Page has no results matching the current filters, THE Users_Page SHALL display an empty state with a message and a "Clear filters" button.

---

### Requirement 10: Users Page — User Detail Drawer

**User Story:** As an admin, I want a detailed view of any individual user, so that I can inspect their full profile, usage history, and take administrative actions.

#### Acceptance Criteria

1. WHEN an admin clicks a user row in the Users_Page table, THE User_Detail_Drawer SHALL slide in from the right displaying the user's full profile information, business profile details, current tier and subscription status, usage statistics (documents, AI requests, tokens, estimated cost), last 10 documents, and last 20 audit log entries for that user.
2. THE User_Detail_Drawer SHALL fetch data from `GET /api/admin/users/[id]`.
3. WHEN the User_Detail_Drawer is loading, THE User_Detail_Drawer SHALL display Skeleton_Loaders for each section.
4. THE User_Detail_Drawer SHALL provide an admin action to change the user's tier (free/starter/pro/agency) with an optional expiry date field.
5. THE User_Detail_Drawer SHALL provide an admin action to grant a trial extension by entering a number of days to add to the user's `tier_expires_at`.
6. THE User_Detail_Drawer SHALL provide an admin action to reset the user's monthly usage counter for the current month.
7. THE User_Detail_Drawer SHALL provide an admin action to suspend or unsuspend the user account by setting or clearing `profiles.suspended_at`.
8. THE User_Detail_Drawer SHALL provide an admin action to trigger a password reset email to the user via Supabase Auth admin API.
9. WHEN an admin initiates a destructive action (suspend, tier change), THE User_Detail_Drawer SHALL display a confirmation dialog requiring the admin to confirm before the action is executed.
10. WHEN an admin action completes successfully, THE User_Detail_Drawer SHALL display a toast notification confirming the action and refresh the displayed user data.
11. IF an admin action fails, THEN THE User_Detail_Drawer SHALL display a toast notification with the error message.
12. THE User_Detail_Drawer SHALL support keyboard navigation: pressing Escape SHALL close the drawer.

---

### Requirement 11: Users Page — Bulk Actions

**User Story:** As an admin, I want to perform actions on multiple users at once, so that I can efficiently manage large groups of accounts.

#### Acceptance Criteria

1. THE Users_Page SHALL allow the admin to select multiple users via checkboxes in the table.
2. WHEN one or more users are selected, THE Users_Page SHALL display a bulk action toolbar with options: export selected as CSV, bulk tier change, and bulk suspend.
3. WHEN the admin initiates a bulk tier change, THE Users_Page SHALL display a confirmation dialog showing the number of affected users, the new tier, and require the admin to enter a reason before confirming.
4. WHEN the admin initiates a bulk suspend, THE Users_Page SHALL display a confirmation dialog showing the number of affected users and require confirmation before proceeding.
5. WHEN a bulk action completes, THE Users_Page SHALL display a toast notification with the count of successfully updated users and the count of any failures.
6. THE Users_Page SHALL support exporting all users (not just selected) matching the current filters to a CSV file via `GET /api/admin/users/export`.

---

### Requirement 12: Subscriptions Page

**User Story:** As an admin, I want a complete view of all paid subscriptions and the ability to manually override tiers, so that I can handle billing edge cases and support requests.

#### Acceptance Criteria

1. THE Subscriptions_Page SHALL display a table of all paid subscriptions with columns: user name, user email, plan, status (active/cancelled/past_due), start date, next billing date, amount, and Razorpay subscription ID.
2. THE Subscriptions_Page SHALL support filtering by: plan (starter/pro/agency), status (active/cancelled/past_due), and date range.
3. THE Subscriptions_Page SHALL display a revenue summary section showing: current MRR, ARR, churn rate, new subscriptions this month, and cancellations this month.
4. THE Subscriptions_Page SHALL provide a manual override panel where the admin selects a user, selects a new tier, optionally sets an expiry date, and enters a required reason before confirming.
5. WHEN a Tier_Override is confirmed, THE Subscriptions_Page SHALL insert a record into `admin_tier_overrides` and update `profiles.tier` and `profiles.tier_expires_at` for the target user.
6. WHEN a Tier_Override is confirmed, THE Audit_Logger SHALL record action `admin.tier_change` with the override details.
7. THE Subscriptions_Page SHALL support exporting the subscription table to CSV.
8. WHEN the Subscriptions_Page is loading, THE Subscriptions_Page SHALL display Skeleton_Loaders for the table rows and revenue summary cards.

---

### Requirement 13: AI Usage Page

**User Story:** As an admin, I want detailed visibility into AI consumption across the platform, so that I can monitor costs, identify heavy users, and detect anomalies.

#### Acceptance Criteria

1. THE AI_Usage_Page SHALL display summary cards for: total AI requests today, this week, and this month; total tokens consumed this month; and estimated total AI cost this month in USD.
2. THE AI_Usage_Page SHALL display a table of the top 10 users by AI usage for the current month, showing user name, email, request count, tokens used, and estimated cost.
3. THE AI_Usage_Page SHALL display a Recharts pie chart showing the breakdown of document types generated (invoice, contract, quotation, proposal) for the current month.
4. THE AI_Usage_Page SHALL display the average document generation time in milliseconds, calculated from `generation_history.generation_time_ms`.
5. THE AI_Usage_Page SHALL display a Recharts bar chart showing the success rate versus error rate for AI generation requests, using data from `generation_history.success`.
6. THE AI_Usage_Page SHALL display a paginated generation history table with columns: user, document type, timestamp, tokens used, estimated cost, and success/fail status.
7. THE AI_Usage_Page SHALL support filtering the generation history table by: date range, document type, user email, and success/fail status.
8. THE AI_Usage_Page SHALL fetch data from `GET /api/admin/ai-usage` with optional query parameters for date range and filters.

---

### Requirement 14: Revenue Page

**User Story:** As an admin, I want a financial overview of platform revenue, so that I can track business performance and reconcile payments.

#### Acceptance Criteria

1. THE Revenue_Page SHALL display KPI_Cards for: current MRR, ARR, new revenue this month, and the percentage change versus last month.
2. THE Revenue_Page SHALL display a breakdown of revenue by plan (starter/pro/agency) showing subscriber count and revenue contribution for each.
3. THE Revenue_Page SHALL display a paginated Razorpay payment history table with columns: user name, user email, amount, plan, payment date, Razorpay payment ID, and status.
4. THE Revenue_Page SHALL display a refunds and failed payments section showing payments with failed or refunded status.
5. THE Revenue_Page SHALL support exporting the payment history table to CSV.
6. THE Revenue_Page SHALL fetch data from `GET /api/admin/revenue`.
7. WHEN the Revenue_Page is loading, THE Revenue_Page SHALL display Skeleton_Loaders for all cards and table rows.

---

### Requirement 15: Security and Audit Page

**User Story:** As an admin, I want a dedicated security monitoring page, so that I can review audit logs, detect threats, and manage IP blocks.

#### Acceptance Criteria

1. THE Security_Page SHALL display a paginated audit log table showing all entries from `audit_logs` with columns: timestamp, user email, action, resource type, resource ID, and IP address.
2. THE Security_Page SHALL support filtering the audit log table by: action prefix (e.g., `admin.*`, `security.*`, `document.*`), user email, date range, and IP address.
3. THE Security_Page SHALL display a brute force attempts section showing all `audit_logs` entries where `action = 'security.brute_force_block'` or `action = 'admin.pin_lockout'`, grouped by IP address with attempt counts.
4. THE Security_Page SHALL display a suspicious activity section listing users who have made more than 50 AI requests within any 1-hour window, derived from `generation_history`.
5. THE Security_Page SHALL display an IP blocklist management panel showing all entries in the `ip_blocklist` table with columns: IP address, reason, blocked by, created date, and expiry date.
6. THE Security_Page SHALL allow the admin to add an IP address to the `ip_blocklist` by entering the IP, a required reason, and an optional expiry date.
7. THE Security_Page SHALL allow the admin to remove an IP address from the `ip_blocklist`.
8. WHEN an admin adds or removes an IP from the blocklist, THE Audit_Logger SHALL record the corresponding `admin.ip_block` or `admin.ip_unblock` action.
9. THE Security_Page SHALL fetch data from `GET /api/admin/security`.

---

### Requirement 16: Settings Page

**User Story:** As an admin, I want a settings page to manage admin configuration, system announcements, feature flags, and maintenance mode, so that I can control platform behavior without code deployments.

#### Acceptance Criteria

1. THE Settings_Page SHALL display the current admin's email address in a read-only field.
2. THE Settings_Page SHALL provide a form to change the admin PIN, requiring the admin to enter the current PIN, a new 6-digit PIN, and confirm the new PIN before submitting.
3. WHEN the admin submits a PIN change, THE Settings_Page SHALL call `PATCH /api/admin/settings/pin`, which SHALL bcrypt-hash the new PIN and update the `ADMIN_PIN_HASH` environment variable via the hosting platform's API, or store the hash in a dedicated `admin_config` database table if env var update is not feasible.
4. THE Settings_Page SHALL provide a system announcements panel where the admin can create a new announcement by entering a message and an optional expiry date.
5. WHEN an announcement is created, THE Settings_Page SHALL call `POST /api/admin/settings/announcement` which SHALL insert a record into `system_announcements` with `active = true`.
6. THE Settings_Page SHALL display a list of existing active announcements with the ability to deactivate each one.
7. THE Settings_Page SHALL provide a feature flags panel displaying toggles for platform features organized by tier (free/starter/pro/agency).
8. THE Settings_Page SHALL provide a maintenance mode toggle that, when enabled, stores a flag in the database and causes the application to display a maintenance banner to all non-admin users.
9. WHEN the admin enables maintenance mode, THE Audit_Logger SHALL record action `admin.maintenance_enable` with the admin email.
10. WHEN the admin disables maintenance mode, THE Audit_Logger SHALL record action `admin.maintenance_disable` with the admin email.

---

### Requirement 17: Admin API Routes

**User Story:** As a developer, I want all admin data operations to go through dedicated, protected API routes, so that admin functionality is cleanly separated and consistently secured.

#### Acceptance Criteria

1. THE Admin_Auth_System SHALL expose `POST /api/admin/auth/verify-pin` for PIN verification and session issuance, and `POST /api/admin/auth/logout` for session termination.
2. THE Admin_Dashboard SHALL expose `GET /api/admin/overview` returning all KPI data for the Overview_Page in a single response.
3. THE Admin_Dashboard SHALL expose `GET /api/admin/users` accepting query parameters: `search`, `tier`, `status`, `onboarding`, `dateFrom`, `dateTo`, `sortBy`, `sortDir`, `page`, `pageSize`.
4. THE Admin_Dashboard SHALL expose `GET /api/admin/users/[id]` returning full user detail including profile, business, usage stats, last 10 documents, and last 20 audit log entries.
5. THE Admin_Dashboard SHALL expose `PATCH /api/admin/users/[id]/tier` accepting `{ tier, expires_at?, reason }` to update a user's tier.
6. THE Admin_Dashboard SHALL expose `PATCH /api/admin/users/[id]/suspend` accepting `{ suspended: boolean }` to suspend or unsuspend a user.
7. THE Admin_Dashboard SHALL expose `POST /api/admin/users/[id]/reset-usage` to delete the user's `user_usage` record for the current month.
8. THE Admin_Dashboard SHALL expose `GET /api/admin/subscriptions` returning paginated subscription data with optional filters.
9. THE Admin_Dashboard SHALL expose `POST /api/admin/subscriptions/override` accepting `{ user_id, tier, expires_at?, reason }` to create a Tier_Override.
10. THE Admin_Dashboard SHALL expose `GET /api/admin/ai-usage` returning AI usage statistics with optional date range and filter parameters.
11. THE Admin_Dashboard SHALL expose `GET /api/admin/revenue` returning revenue KPIs and paginated payment history.
12. THE Admin_Dashboard SHALL expose `GET /api/admin/security` returning audit logs, brute force events, suspicious activity, and IP blocklist data.
13. THE Admin_Dashboard SHALL expose `GET /api/admin/users/export` returning a CSV file of users matching the current filter parameters.
14. THE Admin_Dashboard SHALL expose `POST /api/admin/settings/announcement` accepting `{ message, expires_at? }` to create a System_Announcement.
15. THE Admin_Dashboard SHALL expose `PATCH /api/admin/settings/pin` accepting `{ current_pin, new_pin }` to change the admin PIN.
16. WHEN any `/api/admin/*` route receives a request, THE Admin_Auth_System SHALL verify the `admin_session` cookie and re-check the email whitelist before processing the request, returning HTTP 404 on any failure.

---

### Requirement 18: UI/UX Standards

**User Story:** As an admin, I want a polished, responsive, and keyboard-accessible dashboard UI, so that I can work efficiently without friction.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL render a dark sidebar navigation with icons and labels for: Overview, Users, Subscriptions, AI Usage, Revenue, Security, and Settings.
2. THE Admin_Dashboard SHALL display smooth page transitions between admin routes using CSS transitions or framer-motion.
3. WHEN any admin action completes (success or failure), THE Admin_Dashboard SHALL display a toast notification using the existing sonner library.
4. WHEN the admin presses `Cmd+K` (or `Ctrl+K` on Windows), THE Admin_Dashboard SHALL open a command palette for searching users and navigating to admin pages.
5. WHEN the admin presses `Escape`, THE Admin_Dashboard SHALL close any open modal, drawer, or command palette.
6. THE Admin_Dashboard SHALL display Skeleton_Loaders (not spinners) for all data-loading states.
7. WHEN a data table or section has no data, THE Admin_Dashboard SHALL display an empty state with a descriptive message and, where applicable, a suggested action.
8. THE Admin_Dashboard SHALL be responsive and usable on tablet viewports (768px and above), with the sidebar collapsing to icons-only on viewports below 1024px.
9. WHEN the admin initiates a destructive action (suspend user, bulk suspend, delete announcement), THE Admin_Dashboard SHALL display a confirmation dialog before executing the action.
10. THE Admin_Dashboard SHALL use shadcn/ui components for all UI elements, consistent with the existing application design system.
