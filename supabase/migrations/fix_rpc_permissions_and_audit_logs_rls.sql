-- ============================================================
-- MIGRATION: Fix RPC permissions and audit_logs INSERT policy
-- Applied: 2026-05-17
-- These bugs were causing live 403 errors in production:
--   POST /rest/v1/audit_logs → 403 (no INSERT policy)
--   POST /rest/v1/rpc/increment_user_usage → 403 (no EXECUTE grant)
-- ============================================================

-- ─── 1. Grant EXECUTE on all server-side RPC functions ───────────────────────
-- These are all SECURITY DEFINER functions — they execute as postgres/owner.
-- They need EXECUTE grants on authenticated so the API server's JWT-based
-- client (anon key + Bearer token = "authenticated" role) can call them.

GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, integer, bigint, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, integer, bigint, numeric) TO anon;

GRANT EXECUTE ON FUNCTION public.increment_document_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_document_count(uuid, text) TO anon;

GRANT EXECUTE ON FUNCTION public.increment_email_count(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_email_count(uuid, text) TO anon;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO anon;

GRANT EXECUTE ON FUNCTION public.cancel_email_schedules(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_email_schedules(uuid, text) TO anon;

-- ─── 2. Fix audit_logs: add INSERT policy ────────────────────────────────────
-- The table only had SELECT policy. Server inserts audit entries via the
-- anon+Bearer client (authenticated role). Service role always bypasses RLS
-- already. The authenticated role needed an INSERT policy.

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role full access on audit_logs" ON public.audit_logs;

-- Allow any client to insert logs where user_id is:
--   - NULL (unauthenticated / middleware brute-force logs)
--   - 'anonymous' (string sentinel for unidentified server calls)
--   - Their own auth.uid() (authenticated user)
CREATE POLICY "Authenticated users can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    user_id IS NULL
    OR user_id::text = 'anonymous'
    OR user_id = (SELECT auth.uid())
  );

-- Service role full access (needed for server-side service clients)
CREATE POLICY "Service role full access on audit_logs"
  ON public.audit_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
