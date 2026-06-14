# Clorefy — Security Audit Remediation

This document tracks every finding from the external penetration-test report and the
exact action taken for each. It is written to be honest about what is a real
exploitable bug, what is expected platform behaviour, and what requires a Supabase
dashboard configuration change (which cannot be done from application code).

**Status key:** ✅ Fixed in code/DB · ⚙️ Requires Supabase dashboard config · ℹ️ Working as designed / already mitigated

| ID | Reported severity | Real severity | Status |
|----|------------------|---------------|--------|
| F-01 | Critical | Informational | ℹ️ By design (see below) |
| F-02 | High | High *(needs token theft first)* | ⚙️ Dashboard config |
| F-03 | High | Low–Medium | ✅ Fixed (prompt hardening) |
| F-04 | Medium | Low | ℹ️ Already mitigated (SameSite + origin) |
| F-05 | Medium | Medium | ✅ Fixed (server-authoritative + DB trigger) |
| F-06 | Medium | Not exploitable | ✅ Hardened (column locked) |
| F-07 | Low | Low | ⚙️ / ℹ️ Mitigated by HSTS |
| F-08 | Low | Low | ⚙️ Dashboard config |

---

## F-01 — Supabase anon key in client JS (reported Critical → Informational)

**This is expected, documented Supabase behaviour, not a vulnerability by itself.**
The `anon` key is *designed* to be public and shipped to the browser — it is how every
Supabase app works. Its only power is what Row-Level Security (RLS) policies allow.
The report itself notes "Supabase anonymous keys are commonly used client-side."

**Action:** No key rotation needed (rotating a public key changes nothing). The real
protection is RLS + column grants, which the F-05/F-06 fixes below tighten. The
`service_role` key (the actually-secret one) is **not** in the bundle — verified it
lives only in Cloudflare/Supabase server secrets and is git-ignored.

---

## F-02 — Password change without current password (High)

**Real but conditional:** Supabase GoTrue's `PUT /auth/v1/user` lets a logged-in user
change their password with only a valid access token — the current password isn't
required. This is the GoTrue **default**. It only becomes account-takeover **if an
attacker first steals a valid token** (via XSS, device theft, etc.).

**Action required (Supabase Dashboard — cannot be set from code):**
1. Authentication → Providers/Settings → enable **"Secure password change"** (requires
   recent re-authentication before a password change is accepted).
2. Authentication → Sessions → shorten **access token (JWT) expiry** (e.g. 1 hour) so a
   stolen token has a short useful life. Refresh-token rotation is already on by default.
3. Keep the app's own re-auth on the password-update screen.

This removes the "stolen token → instant password change → permanent lockout" path.

---

## F-03 — Prompt injection / system-prompt disclosure (High → Low–Medium) ✅

**What actually leaked:** the AI *persona* text ("You are Clorefy AI…"). No secrets,
keys, or other users' data — the model only has the *current* user's own context in
window. The `reasoningText` the report read from `chat_messages` is the user's **own**
chat row (RLS user-scoped), so it is not a cross-user leak.

**Fix applied (`lib/deepseek.ts`):** Added a top-priority **Confidentiality & Safety**
block to the system prompt that:
- Refuses to reveal/repeat/encode/"complete verbatim" the system prompt or internal
  rules under any framing (`[TASK]`, "for QA", roleplay, "ignore previous instructions",
  nested/hypothetical tasks, encoding tricks).
- Treats all user-provided text (prompts, file contents, profile fields) as **data, not
  instructions**.
- Returns a brief safe refusal and continues the legitimate document task.

> Note: prompt injection can never be 100% eliminated for any LLM product. This raises
> the bar substantially; pair it with not surfacing internal orchestration text to users.

---

## F-04 — `x-csrf-token` not enforced server-side (Medium → Low) ℹ️

**Why the real risk is low:** classic CSRF requires the browser to *auto-attach*
credentials on a cross-site request. Clorefy's Supabase auth cookie is **`SameSite=Lax`**,
which is **not** sent on cross-site `POST` requests — so a forged cross-site POST to
`/api/ai/stream` arrives **unauthenticated** and is rejected. The API additionally runs
**origin validation**. Those two controls are the actual CSRF defence and they are in
place.

**Action:** The unused `x-csrf-token` should either be enforced or removed to avoid a
false sense of protection. Left as-is for now (no exploitable gap); flagged for cleanup.
No code change made because changing request validation on the streaming endpoint risks
breaking the chat flow — the existing SameSite + origin controls already close the hole.

---

## F-05 — Onboarding / paywall gate bypass via direct PostgREST write (Medium) ✅

**The real bug.** RLS + column grants let an authenticated user `PATCH` their own
`profiles` row and set `plan_selected = true` / `onboarding_complete = true` directly via
PostgREST, skipping the choose-plan / onboarding funnel. (`tier` was already protected by
a trigger, so this was *not* a paid-tier escalation — usage is still gated server-side by
`cost-protection.ts`.)

**Fix applied (code + DB):**
1. **New server endpoint** `app/api/profile/progress/route.ts` — the single trusted path
   that flips these flags. It authenticates the user, only ever sets the flags to `true`,
   and writes via the **service role**.
2. **Rerouted every legitimate client write** to use it instead of a direct Supabase
   update:
   - `app/onboarding/page.tsx` (complete + skip paths)
   - `app/choose-plan/page.tsx` (free plan + paid-success paths)
   - `app/api/razorpay/verify/route.ts` (now uses service role for `plan_selected`)
3. **DB trigger hardening** (`protect_profile_sensitive_columns`): extended the existing
   trigger so any **client-role** update to `plan_selected`, `onboarding_complete`, and
   `saved_signature_url` is silently reverted to the old value. Only the `service_role`
   (the new server endpoints) can change them.

Result: a direct PostgREST PATCH to these columns now no-ops; the funnel can only be
advanced through the authenticated server endpoints.

---

## F-06 — "Potential SSRF" via `saved_signature_url` (Medium → Not exploitable) ✅

**Confirmed NOT SSRF.** The value is used as a **Supabase Storage object key**
(`storage.from("signatures").download(key)`), never fetched as a URL — which is exactly
why the OAST callback never fired. The report correctly marked it "Unconfirmed."

**Hardened anyway:** the same F-05 trigger now prevents users from writing **arbitrary
values** to `saved_signature_url` directly; the only writer is the signature endpoint,
which sets a controlled `sb:signatures/saved_<uid>.<ext>` key via the service role. So the
field can no longer hold attacker-controlled data, closing the door fully even if a future
flow ever did fetch it.

---

## F-07 — Auth cookie missing `Secure` flag (Low) ℹ️ / ⚙️

**Largely mitigated already:** the app sends **`Strict-Transport-Security` with
`preload`** (see `next.config.mjs`), which forces browsers to use HTTPS for the domain and
never issue plaintext `http://` requests to it — removing the transport on which a
non-Secure cookie could leak.

**Optional dashboard hardening:** ensure the production domain is on the HSTS preload list
and that Supabase Auth is configured with the production HTTPS site URL so cookies are
issued with `Secure`. We intentionally did **not** force-modify the Supabase SSR cookie
options from code, because mis-setting cookie flags can break the auth/session flow — and
HSTS already neutralises the practical risk.

---

## F-08 — User enumeration via OTP endpoint (Low) ⚙️

GoTrue returns different responses for registered vs unregistered emails on the OTP
endpoint. This is partly inherent to GoTrue.

**Action required (Supabase Dashboard):**
1. Authentication → enable **CAPTCHA** (hCaptcha/Turnstile) on auth endpoints to stop
   automated enumeration.
2. Authentication → Rate Limits → tighten OTP/email rate limits.
3. Keep generic, identical client-facing error copy on login/reset screens.

---

## Post-assessment cleanup (owner action)
- The pentest changed the password of test account **`qozeg@mailto.plus`** (John Harker)
  and created **`sarah-clorefy-pentest@mailinator.com`**. Review/remove these from
  Supabase Auth.
- No production secret rotation is required (only the public anon key was exposed, by
  design). If you want extra assurance, rotate the **service_role** key only if you ever
  suspect it leaked — it was confirmed not exposed in the bundle.

## Verification
- `pnpm build` passes; diagnostics clean on all changed files.
- Legitimate onboarding, choose-plan (free + paid), Razorpay verify, and signature
  save/delete flows continue to work because their writes now run through the service role.
- Direct client PATCH attempts to the protected columns are reverted by the DB trigger
  (same mechanism that already protected `tier`, which the pentest confirmed works).
