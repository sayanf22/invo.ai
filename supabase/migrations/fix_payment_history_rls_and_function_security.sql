-- ============================================================
-- MIGRATION: Fix payment_history INSERT policy + function security
-- Applied: 2026-05-17
-- ============================================================

-- ─── 1. Add INSERT + service_role policies to payment_history ───────────────
-- /api/razorpay/verify uses auth.supabase (authenticated role) to insert.
-- Without an INSERT policy, payment verification logs silently fail.

CREATE POLICY "Users can insert own payments"
  ON public.payment_history
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role can manage payment history"
  ON public.payment_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ─── 2. Revoke PUBLIC EXECUTE on trigger/cron functions ─────────────────────
-- These functions should only be called by triggers or pg_cron (postgres/service_role).
-- Revoking PUBLIC EXECUTE prevents arbitrary users from calling them via REST RPC.

REVOKE EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.schedule_next_template_check() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.session_dedup_bucket(timestamp with time zone) FROM PUBLIC;

-- Keep service_role and postgres access for cron jobs and triggers
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() TO postgres;
