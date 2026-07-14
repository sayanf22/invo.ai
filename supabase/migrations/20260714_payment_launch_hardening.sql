-- Launch hardening for Razorpay ownership, replay safety, and client-write isolation.

-- Provider identifiers must never be shared by different local records.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_razorpay_subscription_id_key
  ON public.subscriptions (razorpay_subscription_id)
  WHERE razorpay_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_pending_razorpay_subscription_id_key
  ON public.subscriptions (pending_razorpay_subscription_id)
  WHERE pending_razorpay_subscription_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_history_razorpay_payment_id_key
  ON public.payment_history (razorpay_payment_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_provider_ids_distinct') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_ids_distinct
      CHECK (
        razorpay_subscription_id IS NULL
        OR pending_razorpay_subscription_id IS NULL
        OR razorpay_subscription_id <> pending_razorpay_subscription_id
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_subscription_provider_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id text;
BEGIN
  -- Serialize ownership checks across both current and pending columns so two
  -- concurrent rows cannot bind the same provider id through different columns.
  FOR v_provider_id IN
    SELECT provider_id
    FROM unnest(ARRAY[NEW.razorpay_subscription_id, NEW.pending_razorpay_subscription_id]) AS ids(provider_id)
    WHERE provider_id IS NOT NULL
    ORDER BY provider_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_provider_id, 0));
  END LOOP;

  IF NEW.razorpay_subscription_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id <> NEW.id
      AND (s.razorpay_subscription_id = NEW.razorpay_subscription_id
        OR s.pending_razorpay_subscription_id = NEW.razorpay_subscription_id)
  ) THEN
    RAISE EXCEPTION 'Razorpay subscription is already bound' USING ERRCODE = '23505';
  END IF;

  IF NEW.pending_razorpay_subscription_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.id <> NEW.id
      AND (s.razorpay_subscription_id = NEW.pending_razorpay_subscription_id
        OR s.pending_razorpay_subscription_id = NEW.pending_razorpay_subscription_id)
  ) THEN
    RAISE EXCEPTION 'Pending Razorpay subscription is already bound' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_subscription_provider_ownership ON public.subscriptions;
CREATE TRIGGER enforce_subscription_provider_ownership
BEFORE INSERT OR UPDATE OF razorpay_subscription_id, pending_razorpay_subscription_id
ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_provider_ownership();

-- Billing and usage state is server-managed. Authenticated clients retain read-only access.
DROP POLICY IF EXISTS "sub_insert_free_only" ON public.subscriptions;
DROP POLICY IF EXISTS "sub_update_free_only" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own invoice payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payment_history;
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_usage;
DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_usage;

REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_usage FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoice_payments FROM anon, authenticated;

-- Webhook delivery state. A row is not processed until business logic commits.
ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.webhook_events
SET status = COALESCE(status, 'processed'),
    attempts = GREATEST(attempts, 1),
    updated_at = COALESCE(updated_at, processed_at, created_at, now())
WHERE status IS NULL OR attempts = 0;

ALTER TABLE public.webhook_events
  ALTER COLUMN status SET DEFAULT 'processing',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN processed_at DROP NOT NULL,
  ALTER COLUMN processed_at DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'webhook_events_status_check') THEN
    ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_status_check
      CHECK (status IN ('processing', 'processed', 'failed'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_gateway_payload_hash_key
  ON public.webhook_events (gateway, payload_hash)
  WHERE payload_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_events_retryable_idx
  ON public.webhook_events (status, updated_at)
  WHERE status IN ('processing', 'failed');

DROP FUNCTION IF EXISTS public.claim_webhook_event(text, text, text, text);
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
  p_gateway text,
  p_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event public.webhook_events%ROWTYPE;
BEGIN
  IF p_gateway IS NULL OR p_event_id IS NULL OR p_event_type IS NULL OR p_payload_hash IS NULL
     OR length(p_event_id) < 6 OR length(p_payload_hash) <> 64 THEN
    RAISE EXCEPTION 'Invalid webhook claim';
  END IF;

  INSERT INTO public.webhook_events (
    gateway, event_id, event_type, payload_hash, status, attempts,
    processed_at, last_error, user_id, created_at, updated_at
  ) VALUES (
    p_gateway, p_event_id, p_event_type, p_payload_hash, 'processing', 1,
    NULL, NULL, p_user_id, now(), now()
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_event;

  IF FOUND THEN
    RETURN 'claimed';
  END IF;

  SELECT * INTO v_event
  FROM public.webhook_events
  WHERE gateway = p_gateway
    AND (event_id = p_event_id OR payload_hash = p_payload_hash)
  ORDER BY (event_id = p_event_id) DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook claim conflict could not be resolved';
  END IF;
  IF v_event.event_id = p_event_id
     AND v_event.payload_hash IS NOT NULL
     AND v_event.payload_hash <> p_payload_hash THEN
    RAISE EXCEPTION 'Webhook event id was reused with another payload';
  END IF;
  IF v_event.status = 'processed' THEN
    RETURN 'duplicate';
  END IF;
  IF v_event.status = 'processing' AND v_event.updated_at > now() - interval '5 minutes' THEN
    RETURN 'in_progress';
  END IF;

  UPDATE public.webhook_events
  SET status = 'processing', attempts = attempts + 1, last_error = NULL,
      processed_at = NULL, updated_at = now()
  WHERE id = v_event.id;
  RETURN 'claimed';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_event(text, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_event(text, text, text, text, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.enforce_subscription_provider_ownership() FROM PUBLIC, anon, authenticated;

-- Authenticated callers may only add non-negative usage to their own account.
CREATE OR REPLACE FUNCTION public.increment_user_usage(
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
  IF v_current_role <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_requests < 0 OR p_tokens < 0 OR p_cost < 0 OR p_month !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Invalid usage increment';
  END IF;

  INSERT INTO public.user_usage (
    user_id, month, ai_requests_count, ai_tokens_used,
    estimated_cost_usd, documents_count, updated_at
  ) VALUES (p_user_id, p_month, p_requests, p_tokens, p_cost, 0, now())
  ON CONFLICT (user_id, month) DO UPDATE SET
    ai_requests_count = public.user_usage.ai_requests_count + EXCLUDED.ai_requests_count,
    ai_tokens_used = public.user_usage.ai_tokens_used + EXCLUDED.ai_tokens_used,
    estimated_cost_usd = public.user_usage.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
    updated_at = now();
END;
$$;

-- One atomic monthly document reservation per generated session.
-- Legacy rows may predate the document counter; normalize them before the
-- reservation function performs arithmetic or limit comparisons.
UPDATE public.user_usage
SET documents_count = 0
WHERE documents_count IS NULL;

ALTER TABLE public.user_usage
  ALTER COLUMN documents_count SET DEFAULT 0,
  ALTER COLUMN documents_count SET NOT NULL;

ALTER TABLE public.document_sessions
  ADD COLUMN IF NOT EXISTS quota_counted_at timestamptz,
  ADD COLUMN IF NOT EXISTS quota_counted_month text;

CREATE OR REPLACE FUNCTION public.reserve_document_quota(
  p_user_id uuid,
  p_session_id uuid,
  p_month text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_session public.document_sessions%ROWTYPE;
  v_plan text := 'free';
  v_status text;
  v_period_end timestamptz;
  v_tier text := 'free';
  v_limit integer := 5;
  v_count integer := 0;
BEGIN
  v_role := current_setting('request.jwt.claims', true)::json->>'role';
  IF v_role <> 'service_role' AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_month <> to_char(timezone('UTC', now()), 'YYYY-MM') THEN
    RAISE EXCEPTION 'Invalid quota month';
  END IF;

  SELECT * INTO v_session FROM public.document_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_session.document_type = 'chat' THEN
    RAISE EXCEPTION 'Document session not found';
  END IF;
  IF v_session.quota_counted_at IS NOT NULL THEN
    SELECT COALESCE(documents_count, 0) INTO v_count FROM public.user_usage
    WHERE user_id = p_user_id AND month = p_month;
    RETURN jsonb_build_object('allowed', true, 'reserved', false, 'current_count', COALESCE(v_count, 0));
  END IF;

  SELECT plan, status, current_period_end INTO v_plan, v_status, v_period_end
  FROM public.subscriptions WHERE user_id = p_user_id;
  IF v_plan IN ('starter', 'pro', 'agency') AND (
    (v_period_end IS NOT NULL AND v_period_end > now())
    OR (v_period_end IS NULL AND COALESCE(v_status, 'active') IN ('active', 'trialing'))
  ) THEN v_tier := v_plan; END IF;
  v_limit := CASE v_tier WHEN 'starter' THEN 50 WHEN 'pro' THEN 150 WHEN 'agency' THEN 0 ELSE 5 END;

  INSERT INTO public.user_usage (user_id, month, documents_count)
  VALUES (p_user_id, p_month, 0)
  ON CONFLICT (user_id, month) DO NOTHING;

  UPDATE public.user_usage
  SET documents_count = documents_count + 1, updated_at = now()
  WHERE user_id = p_user_id AND month = p_month
    AND (v_limit = 0 OR documents_count < v_limit)
  RETURNING documents_count INTO v_count;
  IF NOT FOUND THEN
    SELECT COALESCE(documents_count, 0) INTO v_count FROM public.user_usage
    WHERE user_id = p_user_id AND month = p_month;
    RETURN jsonb_build_object('allowed', false, 'reserved', false, 'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
  END IF;

  UPDATE public.document_sessions
  SET quota_counted_at = now(), quota_counted_month = p_month, updated_at = now()
  WHERE id = p_session_id;
  RETURN jsonb_build_object('allowed', true, 'reserved', true, 'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_document_quota(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
BEGIN
  SELECT quota_counted_month INTO v_month FROM public.document_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND quota_counted_at IS NOT NULL
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.document_sessions
  SET quota_counted_at = NULL, quota_counted_month = NULL, updated_at = now()
  WHERE id = p_session_id;
  UPDATE public.user_usage
  SET documents_count = GREATEST(documents_count - 1, 0), updated_at = now()
  WHERE user_id = p_user_id AND month = v_month;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_document_quota(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_document_quota(uuid, uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_document_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_document_quota(uuid, uuid) TO service_role;


-- Invoice payment records are server-managed and retain both the webhook
-- correlation id and the provider resource id needed for cancellation.
ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS provider_link_id text,
  ADD COLUMN IF NOT EXISTS is_test_mode boolean NOT NULL DEFAULT false;

UPDATE public.invoice_payments
SET provider_link_id = razorpay_payment_link_id
WHERE provider_link_id IS NULL;

ALTER TABLE public.invoice_payments
  ALTER COLUMN provider_link_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS invoice_payments_one_active_link_per_session
  ON public.invoice_payments (session_id)
  WHERE session_id IS NOT NULL AND status IN ('created', 'partially_paid');

CREATE INDEX IF NOT EXISTS invoice_payments_gateway_correlation_idx
  ON public.invoice_payments (gateway, razorpay_payment_link_id, user_id);

-- Apply a signed provider event as one transaction. Provider identifiers,
-- owner, gateway mode, amount, and currency must all match the stored link.
CREATE OR REPLACE FUNCTION public.apply_invoice_payment_event(
  p_user_id uuid,
  p_gateway text,
  p_provider_link_id text,
  p_status text,
  p_amount_paid integer DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_provider_payment_id text DEFAULT NULL,
  p_is_test_mode boolean DEFAULT false,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.invoice_payments%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_gateway NOT IN ('razorpay', 'stripe', 'cashfree')
     OR p_status NOT IN ('paid', 'partially_paid', 'expired', 'cancelled')
     OR p_provider_link_id IS NULL OR length(p_provider_link_id) < 4 THEN
    RAISE EXCEPTION 'Invalid invoice payment event';
  END IF;

  SELECT * INTO v_payment
  FROM public.invoice_payments
  WHERE user_id = p_user_id
    AND gateway = p_gateway
    AND razorpay_payment_link_id = p_provider_link_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'payment_not_found');
  END IF;
  IF v_payment.is_test_mode IS DISTINCT FROM p_is_test_mode THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'gateway_mode_mismatch');
  END IF;
  IF v_payment.status = 'paid' THEN
    RETURN jsonb_build_object(
      'applied', false, 'reason', 'already_paid', 'status', 'paid',
      'session_id', v_payment.session_id, 'reference_id', v_payment.reference_id,
      'amount', v_payment.amount, 'amount_paid', v_payment.amount_paid,
      'currency', v_payment.currency
    );
  END IF;

  IF p_status IN ('paid', 'partially_paid') THEN
    IF p_currency IS NULL OR upper(p_currency) <> upper(v_payment.currency) THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'currency_mismatch');
    END IF;
    IF p_amount_paid IS NULL OR p_amount_paid <= 0 THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'invalid_amount');
    END IF;
    IF p_status = 'paid' AND p_amount_paid <> v_payment.amount THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'amount_mismatch');
    END IF;
    IF p_status = 'partially_paid' AND p_amount_paid >= v_payment.amount THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'invalid_partial_amount');
    END IF;
  END IF;

  IF p_status IN ('expired', 'cancelled') AND v_payment.status NOT IN ('created', 'partially_paid') THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'terminal_state');
  END IF;

  UPDATE public.invoice_payments
  SET status = p_status,
      amount_paid = CASE WHEN p_status IN ('paid', 'partially_paid') THEN p_amount_paid ELSE amount_paid END,
      razorpay_payment_id = COALESCE(p_provider_payment_id, razorpay_payment_id),
      paid_at = CASE WHEN p_status = 'paid' THEN COALESCE(p_paid_at, v_now) ELSE paid_at END,
      updated_at = v_now
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  IF p_status = 'paid' AND v_payment.session_id IS NOT NULL THEN
    UPDATE public.document_sessions
    SET status = 'paid', updated_at = v_now
    WHERE id = v_payment.session_id AND user_id = p_user_id;

    UPDATE public.email_schedules
    SET status = 'cancelled', cancelled_reason = 'payment_received', updated_at = v_now
    WHERE session_id = v_payment.session_id AND user_id = p_user_id AND status = 'pending';
  ELSIF p_status IN ('expired', 'cancelled') AND v_payment.session_id IS NOT NULL THEN
    UPDATE public.email_schedules
    SET status = 'cancelled',
        cancelled_reason = CASE WHEN p_status = 'expired' THEN 'payment_link_expired' ELSE 'payment_link_cancelled' END,
        updated_at = v_now
    WHERE session_id = v_payment.session_id AND user_id = p_user_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object(
    'applied', true, 'status', p_status, 'session_id', v_payment.session_id,
    'reference_id', v_payment.reference_id, 'amount', v_payment.amount,
    'amount_paid', v_payment.amount_paid, 'currency', v_payment.currency
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_invoice_payment_event(uuid, text, text, text, integer, text, text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_invoice_payment_event(uuid, text, text, text, integer, text, text, boolean, timestamptz) TO service_role;


-- Manual payment transitions are atomic and service-only. Active provider links
-- are cancelled externally before this function is called.
CREATE OR REPLACE FUNCTION public.mark_invoice_manually_paid(
  p_user_id uuid,
  p_session_id uuid,
  p_payment_method text,
  p_note text,
  p_paid_at timestamptz,
  p_amount integer,
  p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.document_sessions%ROWTYPE;
  v_payment_id uuid;
  v_provider_id text := 'manual_' || replace(gen_random_uuid()::text, '-', '');
  v_now timestamptz := now();
BEGIN
  IF p_payment_method NOT IN ('cash', 'bank_transfer', 'check', 'upi', 'wire', 'other')
     OR p_amount <= 0 OR p_currency !~ '^[A-Z]{3}$'
     OR p_paid_at IS NULL OR p_paid_at > v_now + interval '5 minutes'
     OR length(COALESCE(p_note, '')) > 500 THEN
    RAISE EXCEPTION 'Invalid manual payment';
  END IF;

  SELECT * INTO v_session FROM public.document_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND document_type = 'invoice'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice session not found'; END IF;

  -- A provider webhook may win between external link cancellation and this
  -- transaction. Never create a second paid record in that case.
  SELECT id INTO v_payment_id FROM public.invoice_payments
  WHERE session_id = p_session_id AND user_id = p_user_id
    AND status = 'paid'
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'already_paid', 'payment_id', v_payment_id);
  END IF;

  UPDATE public.invoice_payments
  SET status = 'cancelled', updated_at = v_now
  WHERE session_id = p_session_id AND user_id = p_user_id
    AND status IN ('created', 'partially_paid');

  INSERT INTO public.invoice_payments (
    session_id, user_id, razorpay_payment_link_id, provider_link_id,
    short_url, amount, currency, status, amount_paid, paid_at,
    gateway, is_test_mode, is_manual, manual_payment_method,
    manual_payment_note, manually_marked_at, created_at, updated_at
  ) VALUES (
    p_session_id, p_user_id, v_provider_id, v_provider_id,
    '', p_amount, p_currency, 'paid', p_amount, p_paid_at,
    'manual', false, true, p_payment_method,
    NULLIF(p_note, ''), v_now, v_now, v_now
  ) RETURNING id INTO v_payment_id;

  UPDATE public.document_sessions
  SET status = 'paid', updated_at = v_now
  WHERE id = p_session_id AND user_id = p_user_id;

  UPDATE public.email_schedules
  SET status = 'cancelled', cancelled_reason = 'payment_received', updated_at = v_now
  WHERE session_id = p_session_id AND user_id = p_user_id AND status = 'pending';

  RETURN jsonb_build_object('applied', true, 'payment_id', v_payment_id, 'status', 'paid');
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_manual_invoice_payment(
  p_user_id uuid,
  p_session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.document_sessions%ROWTYPE;
  v_payment_id uuid;
  v_next_status text;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_session FROM public.document_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND document_type = 'invoice'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice session not found'; END IF;

  SELECT id INTO v_payment_id FROM public.invoice_payments
  WHERE session_id = p_session_id AND user_id = p_user_id
    AND status = 'paid' AND is_manual = true
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manual payment not found'; END IF;

  UPDATE public.invoice_payments
  SET status = 'cancelled', paid_at = NULL, amount_paid = 0,
      manual_payment_note = NULL, manually_marked_at = NULL, updated_at = v_now
  WHERE id = v_payment_id;

  v_next_status := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.invoice_payments
      WHERE session_id = p_session_id AND user_id = p_user_id
        AND status = 'paid' AND id <> v_payment_id
    ) THEN 'paid'
    WHEN v_session.sent_at IS NOT NULL OR v_session.finalized_at IS NOT NULL THEN 'finalized'
    ELSE 'active'
  END;
  UPDATE public.document_sessions
  SET status = v_next_status, updated_at = v_now
  WHERE id = p_session_id AND user_id = p_user_id;

  RETURN jsonb_build_object('applied', true, 'payment_id', v_payment_id, 'status', v_next_status);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_invoice_manually_paid(uuid, uuid, text, text, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_invoice_manually_paid(uuid, uuid, text, text, timestamptz, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.revert_manual_invoice_payment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revert_manual_invoice_payment(uuid, uuid) TO service_role;


-- Distributed throttling for unauthenticated recipient endpoints. Callers hash
-- IP/session identifiers before invoking this RPC; raw identifiers are not stored.
CREATE TABLE IF NOT EXISTS public.public_rate_limits (
  identifier_hash text NOT NULL,
  category text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identifier_hash, category)
);

ALTER TABLE public.public_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_public_rate_limit(
  p_identifier_hash text,
  p_category text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.public_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_identifier_hash !~ '^[0-9a-f]{64}$'
     OR p_category !~ '^[a-z0-9_]{3,64}$'
     OR p_max_requests < 1 OR p_max_requests > 10000
     OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid public rate limit request';
  END IF;

  INSERT INTO public.public_rate_limits(identifier_hash, category, window_start, request_count, updated_at)
  VALUES (p_identifier_hash, p_category, v_now, 1, v_now)
  ON CONFLICT (identifier_hash, category) DO UPDATE SET
    window_start = CASE
      WHEN public.public_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now THEN v_now
      ELSE public.public_rate_limits.window_start
    END,
    request_count = CASE
      WHEN public.public_rate_limits.window_start + make_interval(secs => p_window_seconds) <= v_now THEN 1
      ELSE public.public_rate_limits.request_count + 1
    END,
    updated_at = v_now
  RETURNING * INTO v_row;

  allowed := v_row.request_count <= p_max_requests;
  remaining := GREATEST(p_max_requests - v_row.request_count, 0);
  retry_after := CASE WHEN allowed THEN 0 ELSE GREATEST(
    ceil(extract(epoch FROM (v_row.window_start + make_interval(secs => p_window_seconds) - v_now)))::integer,
    1
  ) END;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_rate_limit(text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(text, text, integer, integer) TO service_role;

CREATE INDEX IF NOT EXISTS public_rate_limits_updated_at_idx
  ON public.public_rate_limits (updated_at);


-- Gateway credentials and encrypted webhook secrets are writable only through
-- authenticated server routes that validate credentials, origin, CSRF, and rate limits.
DROP POLICY IF EXISTS "Users can insert own payment settings" ON public.user_payment_settings;
DROP POLICY IF EXISTS "Users can update own payment settings" ON public.user_payment_settings;
DROP POLICY IF EXISTS "Users can delete own payment settings" ON public.user_payment_settings;
REVOKE INSERT, UPDATE, DELETE ON public.user_payment_settings FROM anon, authenticated;