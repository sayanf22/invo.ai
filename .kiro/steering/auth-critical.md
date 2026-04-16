---
inclusion: auto
---

# Authentication — Critical Rules (DO NOT BREAK)

This document describes the authentication architecture. Every rule here was learned from production bugs. Breaking any of these will cause login to fail.

## The Golden Rule

**Both client and server MUST use `@supabase/ssr` for Supabase clients.** This ensures cookies are read and written in the same format on both sides.

- Client (browser): `createBrowserClient` from `@supabase/ssr` — see `lib/supabase.ts`
- Server (route handlers): `createServerClient` from `@supabase/ssr` — see `lib/supabase-server.ts` and `app/auth/callback/route.ts`
- Middleware: reads cookies manually (same chunked base64 format) — see `middleware.ts`

**NEVER replace `createBrowserClient` with `createClient` from `@supabase/supabase-js` with a custom storage adapter.** A custom cookie storage adapter will use a different format than `@supabase/ssr`'s server client, causing OAuth sessions to be unreadable after redirect.

## Auth Flow — How It Works

### Email/Password Login (`app/auth/login/page.tsx`)
1. `signInWithPassword()` is called on the browser Supabase client
2. Supabase JS stores the session via `@supabase/ssr`'s cookie adapter
3. `onAuthStateChange` fires `SIGNED_IN` in the `AuthProvider`
4. The login page watches `authUser` from `useAuth()` — when it becomes non-null, `router.push("/")` navigates to the home page
5. **No `window.location.href` or `window.location.replace` is used** — these cause Chrome navigation chain issues

### Google OAuth Login
1. `signInWithOAuth({ provider: "google" })` redirects to Google
2. Google redirects to Supabase's `/auth/v1/callback`
3. Supabase redirects to `clorefy.com/auth/callback?code=...`
4. The callback route handler (`app/auth/callback/route.ts`) exchanges the code for a session using `createServerClient`
5. Cookies are collected during `setAll` and applied to the redirect response
6. The browser is redirected to `/` with auth cookies set
7. `page.tsx` (client component) mounts, `AuthProvider` reads session from cookies via `createBrowserClient`

### Root Page (`app/page.tsx`)
- This is a **client component** (not a server component)
- Uses `useAuth()` to get the user
- Shows a spinner while `isLoading` is true
- Shows the landing page when `user` is null and no auth cookies exist
- Shows `AppShell` when `user` is authenticated and profile is complete
- If auth cookies exist but `user` is null, waits up to 2 seconds for the session to load

## Rules — DO NOT VIOLATE

1. **`lib/supabase.ts` must use `createBrowserClient` from `@supabase/ssr`** — never a custom storage adapter
2. **`app/page.tsx` must be a client component** (`"use client"`) — server components can't reliably read cookies on Cloudflare Workers after OAuth redirect
3. **Never use `window.location.href` or `window.location.replace` after login** — use `router.push()` for client-side navigation. Full page reloads trigger Chrome's navigation chain state deletion.
4. **Never call `supabase.auth.signOut()` before `signInWithOAuth()`** — this clears the PKCE code verifier, causing "OAuth state not found or expired"
5. **The OAuth callback route must collect cookies in an array during `setAll`** and apply them to the final redirect response — not recreate the response object
6. **The middleware must skip token refresh for public pages** — only validate/refresh tokens for protected routes
7. **`/auth/login` and `/auth/signup` must NOT be redirected by middleware** even for authenticated users — the user may be initiating OAuth from there
8. **The `AuthProvider` must have a `getUser()` fallback** — if `getSession()` returns null (cookies set by server but not yet in client storage), call `getUser()` which makes a network request

## Files Involved

| File | Role | Critical? |
|------|------|-----------|
| `lib/supabase.ts` | Browser Supabase client (singleton) | YES — must use `createBrowserClient` |
| `lib/supabase-server.ts` | Server Supabase client | YES — must use `createServerClient` |
| `app/auth/callback/route.ts` | OAuth code exchange | YES — sets cookies on redirect |
| `app/auth/login/page.tsx` | Login form | YES — uses `useAuth()` for redirect |
| `app/page.tsx` | Root page routing | YES — must be client component |
| `components/auth-provider.tsx` | Auth state management | YES — `getSession()` + `getUser()` fallback |
| `middleware.ts` | JWT validation + route protection | YES — skip refresh for public pages |

## What Broke Before (History)

- **Custom `cookieStorage` adapter** — wrote cookies in URL-encoded format, but `@supabase/ssr` server client wrote in base64 format. Client couldn't read server-set cookies. Fixed by using `createBrowserClient`.
- **`window.location.replace` after login** — Chrome flagged the navigation chain and deleted cookies/localStorage. Fixed by using `router.push`.
- **`signOut()` before OAuth** — cleared the PKCE verifier. Fixed by removing the signOut call.
- **Server Component root page** — `cookies()` from `next/headers` didn't reliably read freshly-set cookies on Cloudflare Workers. Fixed by making `page.tsx` a client component.
- **Middleware redirecting from `/auth/login`** — blocked OAuth flow initiation. Fixed by excluding login/signup from the redirect.
