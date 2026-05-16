-- ============================================================
-- MIGRATION: Add ownership checks to all user-facing RPC functions
-- Applied: 2026-05-17
-- 
-- PROBLEM: cancel_email_schedules, increment_user_usage, increment_document_count,
-- and increment_email_count are SECURITY DEFINER functions callable by anon/authenticated
-- users via REST RPC. Without ownership checks, any user could:
--   - Cancel another user's email follow-up schedules
--   - Inflate another user's usage counters (exhausting their quota)
-- 
-- FIX: Each function now checks that the calling user owns the resource,
-- with a service_role bypass for legitimate server-side calls (webhooks, cron).
-- ============================================================

-- ─── 1. cancel_email_schedules — add ownership check ─────────────────────────
DROP FUNCTION IF EXISTS public.cancel_email_schedules(uuid, text);

CREATE FUNCTION public.cancel_email_schedules(
  p_session_id uuid,
  p_reason text DEFAULT 'user_cancelled'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_affected integer;
  v_session_owner uuid;
  v_current_role text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role != 'service_role' THEN
    SELECT user_id INTO v_session_owner FROM public.document_sessions WHERE id = p_session_id;
    IF v_session_owner IS NULL OR v_session_owner != auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;
  UPDATE public.email_schedules
  SET status = 'cancelled', cancelled_reason = p_reason, updated_at = NOW()
  WHERE session_id = p_session_id AND status = 'pending';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_email_schedules(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_email_schedules(uuid, text) TO anon;

-- ─── 2. increment_user_usage — add ownership check ───────────────────────────
DROP FUNCTION IF EXISTS public.increment_user_usage(uuid, text, integer, bigint, numeric);

CREATE FUNCTION public.increment_user_usage(
  p_user_id uuid,
  p_month text,
  p_requests integer DEFAULT 1,
  p_tokens bigint DEFAULT 0,
  p_cost numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role != 'service_role' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.user_usage (user_id, month, ai_requests_count, ai_tokens_used, estimated_cost_usd, documents_count, updated_at)
  VALUES (p_user_id, p_month, p_requests, p_tokens, p_cost, 0, now())
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    ai_requests_count = user_usage.ai_requests_count + p_requests,
    ai_tokens_used = user_usage.ai_tokens_used + p_tokens,
    estimated_cost_usd = user_usage.estimated_cost_usd + p_cost,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, integer, bigint, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_user_usage(uuid, text, integer, bigint, numeric) TO anon;

-- ─── 3. increment_document_count — add ownership check ───────────────────────
CREATE OR REPLACE FUNCTION public.increment_document_count(p_user_id uuid, p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role != 'service_role' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.user_usage (user_id, month, documents_count)
  VALUES (p_user_id, p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET documents_count = public.user_usage.documents_count + 1, updated_at = NOW();
END;
$$;

-- ─── 4. increment_email_count — add ownership check ──────────────────────────
CREATE OR REPLACE FUNCTION public.increment_email_count(p_user_id uuid, p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role != 'service_role' AND p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  INSERT INTO public.user_usage (user_id, month, emails_count)
  VALUES (p_user_id, p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET emails_count = public.user_usage.emails_count + 1, updated_at = NOW();
END;
$$;

-- ─── 5. Revoke PUBLIC on update_blog_posts_updated_at (trigger fn) ───────────
REVOKE EXECUTE ON FUNCTION public.update_blog_posts_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_blog_posts_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_blog_posts_updated_at() TO postgres;
