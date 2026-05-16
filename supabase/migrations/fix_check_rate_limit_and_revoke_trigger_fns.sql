-- ============================================================
-- MIGRATION: Fix check_rate_limit ownership + revoke trigger fn grants
-- Applied: 2026-05-17
-- ============================================================

-- ─── 1. Add ownership check to check_rate_limit ──────────────────────────────
-- Without ownership check, any user could call:
-- POST /rest/v1/rpc/check_rate_limit { p_user_id: <victim_uuid>, ... }
-- to spike another user's rate limit window and block their AI requests.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id uuid,
    p_category text,
    p_max_requests integer,
    p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after integer, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INT;
    v_remaining INT;
    v_current_role text;
BEGIN
    v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
    IF v_current_role != 'service_role' AND p_user_id != auth.uid() THEN
        RETURN QUERY SELECT FALSE, 0, 60, 'Unauthorized'::TEXT;
        RETURN;
    END IF;
    v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
    DELETE FROM rate_limit_log WHERE created_at < NOW() - INTERVAL '2 hours';
    SELECT COALESCE(COUNT(*), 0) INTO v_current_count
    FROM rate_limit_log
    WHERE user_id = p_user_id AND category = p_category AND created_at >= v_window_start;
    IF v_current_count >= p_max_requests THEN
        RETURN QUERY SELECT FALSE, 0, p_window_seconds, 'Rate limit exceeded'::TEXT;
        RETURN;
    END IF;
    INSERT INTO rate_limit_log (user_id, category, request_count, window_start, created_at)
    VALUES (p_user_id, p_category, 1, NOW(), NOW());
    v_remaining := p_max_requests - v_current_count - 1;
    RETURN QUERY SELECT TRUE, v_remaining, 0, NULL::TEXT;
END;
$$;

-- ─── 2. Revoke trigger function callable by anon/authenticated via REST RPC ───
REVOKE EXECUTE ON FUNCTION public.update_blog_posts_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_blog_posts_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_blog_posts_updated_at() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_blog_posts_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_blog_posts_updated_at() TO postgres;
