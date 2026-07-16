-- Tier-aware usage periods.
--
-- Free tier keeps UTC calendar-month allowance buckets (reset on the 1st).
-- Paid tiers get a monthly allowance window anchored on their billing day of
-- month (current_period_start), so a subscriber who started on the 16th gets a
-- fresh document/email/AI allowance on the 16th of each month — for monthly AND
-- yearly billing cycles. The bucket key stays a YYYY-MM string (the calendar
-- month the window STARTS in); consecutive monthly windows always fall in
-- consecutive calendar months, so keys remain unique and admin YYYY-MM rollups
-- keep working. This function is the single source of truth for every reader
-- and writer of public.user_usage.

CREATE OR REPLACE FUNCTION public.current_usage_period(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_plan text;
  v_status text;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_now timestamptz := now();
  v_anchor timestamptz;
  v_months int;
  v_ws timestamptz;
  v_we timestamptz;
  v_utc_now timestamp;
  v_month_start timestamp;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_role <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT plan, status, current_period_start, current_period_end
  INTO v_plan, v_status, v_anchor, v_period_end
  FROM public.subscriptions WHERE user_id = p_user_id;

  -- Paid entitlement requires a live, unexpired provider period AND a known
  -- anchor. Anything else falls closed to the free calendar-month window.
  IF v_plan IN ('starter', 'pro', 'agency')
     AND v_period_end IS NOT NULL AND v_period_end > v_now
     AND v_anchor IS NOT NULL THEN
    v_months := (EXTRACT(YEAR FROM timezone('UTC', v_now)) - EXTRACT(YEAR FROM timezone('UTC', v_anchor))) * 12
              + (EXTRACT(MONTH FROM timezone('UTC', v_now)) - EXTRACT(MONTH FROM timezone('UTC', v_anchor)));
    IF v_months < 0 THEN v_months := 0; END IF;
    v_ws := v_anchor + make_interval(months => v_months);
    IF v_ws > v_now THEN
      v_months := v_months - 1;
      v_ws := v_anchor + make_interval(months => v_months);
    END IF;
    v_we := v_anchor + make_interval(months => v_months + 1);
    RETURN jsonb_build_object(
      'key', to_char(timezone('UTC', v_ws), 'YYYY-MM'),
      'period_start', v_ws,
      'period_end', v_we,
      'tier', v_plan,
      'billing_anchored', true
    );
  END IF;

  -- Free / expired: UTC calendar month.
  v_utc_now := timezone('UTC', v_now);
  v_month_start := date_trunc('month', v_utc_now);
  v_period_start := v_month_start AT TIME ZONE 'UTC';
  v_period_end := (v_month_start + interval '1 month') AT TIME ZONE 'UTC';
  RETURN jsonb_build_object(
    'key', to_char(v_utc_now, 'YYYY-MM'),
    'period_start', v_period_start,
    'period_end', v_period_end,
    'tier', 'free',
    'billing_anchored', false
  );
END;
$$;
REVOKE ALL ON FUNCTION public.current_usage_period(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usage_period(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_usage_period_key(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (public.current_usage_period(p_user_id) ->> 'key');
$$;
REVOKE ALL ON FUNCTION public.current_usage_period_key(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usage_period_key(uuid) TO authenticated, service_role;


-- ── Rebind usage writers to the tier-aware period key ──────────────────────
-- Each writer now derives its bucket from current_usage_period_key so paid
-- windows and free calendar months are consistent across reservation, increment
-- and release. The p_month parameter is retained for signature compatibility
-- but is no longer authoritative (the DB owns the period).

CREATE OR REPLACE FUNCTION public.reserve_document_quota(p_user_id uuid, p_session_id uuid, p_month text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text; v_session public.document_sessions%ROWTYPE;
  v_plan text := 'free'; v_period_end timestamptz;
  v_tier text := 'free'; v_limit integer := 5; v_count integer := 0;
  v_period text;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_role <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Authoritative, tier-aware allowance bucket (free = calendar month,
  -- paid = billing-anchored monthly window).
  v_period := public.current_usage_period_key(p_user_id);
  IF v_period !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid quota period';
  END IF;

  SELECT * INTO v_session FROM public.document_sessions
  WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_session.document_type = 'chat' THEN
    RAISE EXCEPTION 'Document session not found';
  END IF;
  -- Already reserved (existing document): never double-charge, even after a
  -- downgrade. Editing a previously generated document stays free.
  IF v_session.quota_counted_at IS NOT NULL THEN
    SELECT COALESCE(documents_count, 0) INTO v_count FROM public.user_usage
    WHERE user_id = p_user_id AND month = v_session.quota_counted_month;
    RETURN jsonb_build_object('allowed', true, 'reserved', false, 'current_count', COALESCE(v_count, 0));
  END IF;

  SELECT plan, current_period_end INTO v_plan, v_period_end
  FROM public.subscriptions WHERE user_id = p_user_id;
  IF v_plan IN ('starter', 'pro', 'agency') AND v_period_end IS NOT NULL AND v_period_end > now() THEN
    v_tier := v_plan;
  END IF;
  v_limit := CASE v_tier WHEN 'starter' THEN 50 WHEN 'pro' THEN 150 WHEN 'agency' THEN 0 ELSE 5 END;

  INSERT INTO public.user_usage (user_id, month, documents_count)
  VALUES (p_user_id, v_period, 0) ON CONFLICT (user_id, month) DO NOTHING;
  UPDATE public.user_usage SET documents_count = documents_count + 1, updated_at = now()
  WHERE user_id = p_user_id AND month = v_period AND (v_limit = 0 OR documents_count < v_limit)
  RETURNING documents_count INTO v_count;
  IF NOT FOUND THEN
    SELECT COALESCE(documents_count, 0) INTO v_count FROM public.user_usage
    WHERE user_id = p_user_id AND month = v_period;
    RETURN jsonb_build_object('allowed', false, 'reserved', false,
      'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
  END IF;

  UPDATE public.document_sessions
  SET quota_counted_at = now(), quota_counted_month = v_period, updated_at = now()
  WHERE id = p_session_id;
  RETURN jsonb_build_object('allowed', true, 'reserved', true,
    'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_document_quota(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_document_quota(uuid, uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_document_count(p_user_id uuid, p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
  v_period text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role <> 'service_role' AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  v_period := public.current_usage_period_key(p_user_id);
  INSERT INTO public.user_usage (user_id, month, documents_count)
  VALUES (p_user_id, v_period, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET documents_count = public.user_usage.documents_count + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_email_count(p_user_id uuid, p_month text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
  v_period text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role <> 'service_role' AND p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  v_period := public.current_usage_period_key(p_user_id);
  INSERT INTO public.user_usage (user_id, month, emails_count)
  VALUES (p_user_id, v_period, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET emails_count = public.user_usage.emails_count + 1, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_user_usage(p_user_id uuid, p_month text, p_requests integer DEFAULT 1, p_tokens bigint DEFAULT 0, p_cost numeric DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_role text;
  v_period text;
BEGIN
  v_current_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_current_role <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_requests < 0 OR p_tokens < 0 OR p_cost < 0 THEN
    RAISE EXCEPTION 'Invalid usage increment';
  END IF;
  v_period := public.current_usage_period_key(p_user_id);

  INSERT INTO public.user_usage (
    user_id, month, ai_requests_count, ai_tokens_used,
    estimated_cost_usd, documents_count, updated_at
  ) VALUES (p_user_id, v_period, p_requests, p_tokens, p_cost, 0, now())
  ON CONFLICT (user_id, month) DO UPDATE SET
    ai_requests_count = public.user_usage.ai_requests_count + EXCLUDED.ai_requests_count,
    ai_tokens_used = public.user_usage.ai_tokens_used + EXCLUDED.ai_tokens_used,
    estimated_cost_usd = public.user_usage.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    updated_at = now();
END;
$$;
