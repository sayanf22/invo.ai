-- Paid entitlement evidence, atomic provider/admin transitions, canonical tier sync.
-- Application and schema changes in this migration are a coordinated deployment.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS entitlement_source text,
  ADD COLUMN IF NOT EXISTS entitlement_payment_id text,
  ADD COLUMN IF NOT EXISTS entitlement_verified_at timestamptz;

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS razorpay_invoice_id text,
  ADD COLUMN IF NOT EXISTS razorpay_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS payment_history_razorpay_invoice_id_key
  ON public.payment_history (razorpay_invoice_id)
  WHERE razorpay_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payment_history_subscription_charge_idx
  ON public.payment_history (razorpay_subscription_id, created_at DESC)
  WHERE status = 'captured' AND amount > 0;

-- De-duplicate old best-effort admin session rows before enforcing revocation identity.
DELETE FROM public.admin_sessions older
USING public.admin_sessions newer
WHERE older.session_token_hash = newer.session_token_hash
  AND (older.created_at, older.id) < (newer.created_at, newer.id);
CREATE UNIQUE INDEX IF NOT EXISTS admin_sessions_session_token_hash_key
  ON public.admin_sessions (session_token_hash);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx
  ON public.admin_sessions (expires_at);

-- Admin grants are a distinct, non-recurring billing marker.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_cycle_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly', 'yearly', 'admin_grant'));

-- Attach old payments to a provider subscription only for the same local owner.
WITH latest_payment AS (
  SELECT DISTINCT ON (user_id) user_id, razorpay_payment_id, created_at
  FROM public.payment_history
  WHERE status = 'captured' AND amount > 0 AND razorpay_payment_id IS NOT NULL
  ORDER BY user_id, created_at DESC
)
UPDATE public.payment_history ph
SET razorpay_subscription_id = s.razorpay_subscription_id
FROM public.subscriptions s, latest_payment lp
WHERE lp.user_id = s.user_id
  AND ph.user_id = lp.user_id
  AND ph.razorpay_payment_id = lp.razorpay_payment_id
  AND s.razorpay_subscription_id IS NOT NULL
  AND ph.razorpay_subscription_id IS NULL;

-- Backfill explicit provenance. Admin evidence wins only for an actual admin grant;
-- captured provider evidence wins for provider-bound rows; legacy paid rows remain
-- distinguishable and cannot be extended by future writes.
UPDATE public.subscriptions
SET entitlement_source = 'free',
    entitlement_payment_id = NULL,
    entitlement_verified_at = NULL
WHERE plan = 'free';

WITH latest_override AS (
  SELECT DISTINCT ON (user_id) user_id, tier, created_at
  FROM public.admin_tier_overrides
  ORDER BY user_id, created_at DESC
)
UPDATE public.subscriptions s
SET entitlement_source = 'admin_grant',
    entitlement_payment_id = NULL,
    entitlement_verified_at = o.created_at,
    billing_cycle = 'admin_grant',
    razorpay_subscription_id = NULL,
    razorpay_plan_id = NULL,
    razorpay_payment_id = NULL,
    razorpay_order_id = NULL
FROM latest_override o
WHERE o.user_id = s.user_id
  AND o.tier = s.plan
  AND s.plan IN ('starter', 'pro', 'agency')
  AND (s.billing_cycle = 'admin_grant' OR s.razorpay_subscription_id IS NULL);

WITH latest_payment AS (
  SELECT DISTINCT ON (user_id) user_id, razorpay_payment_id, created_at
  FROM public.payment_history
  WHERE status = 'captured' AND amount > 0 AND razorpay_payment_id IS NOT NULL
  ORDER BY user_id, created_at DESC
)
UPDATE public.subscriptions s
SET entitlement_source = 'razorpay',
    entitlement_payment_id = p.razorpay_payment_id,
    entitlement_verified_at = p.created_at
FROM latest_payment p
WHERE p.user_id = s.user_id
  AND s.plan IN ('starter', 'pro', 'agency')
  AND s.razorpay_subscription_id IS NOT NULL;

WITH latest_payment AS (
  SELECT DISTINCT ON (user_id) user_id, razorpay_payment_id, created_at
  FROM public.payment_history
  WHERE status = 'captured' AND amount > 0 AND razorpay_payment_id IS NOT NULL
  ORDER BY user_id, created_at DESC
)
UPDATE public.subscriptions s
SET entitlement_source = 'legacy_payment',
    entitlement_payment_id = p.razorpay_payment_id,
    entitlement_verified_at = p.created_at
FROM latest_payment p
WHERE p.user_id = s.user_id
  AND s.plan IN ('starter', 'pro', 'agency')
  AND s.razorpay_subscription_id IS NULL
  AND s.entitlement_source IS DISTINCT FROM 'admin_grant';

-- Unknown or indefinite paid rows fail closed instead of becoming permanent access.
UPDATE public.subscriptions
SET plan = 'free', status = 'cancelled', billing_cycle = NULL,
    current_period_start = NULL, current_period_end = NULL,
    entitlement_source = 'free', entitlement_payment_id = NULL,
    entitlement_verified_at = NULL, updated_at = now()
WHERE plan IN ('starter', 'pro', 'agency')
  AND (entitlement_source IS NULL
    OR current_period_start IS NULL
    OR current_period_end IS NULL
    OR current_period_end <= current_period_start);

ALTER TABLE public.subscriptions
  ALTER COLUMN entitlement_source SET DEFAULT 'free';
UPDATE public.subscriptions SET entitlement_source = 'free' WHERE entitlement_source IS NULL;
ALTER TABLE public.subscriptions ALTER COLUMN entitlement_source SET NOT NULL;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_entitlement_source_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_entitlement_source_check
  CHECK (entitlement_source IN ('free', 'razorpay', 'admin_grant', 'legacy_payment'));
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_paid_period_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_paid_period_check CHECK (
  plan = 'free' OR (
    current_period_start IS NOT NULL
    AND current_period_end IS NOT NULL
    AND current_period_end > current_period_start
  )
);
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_entitlement_shape_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_entitlement_shape_check CHECK (
  (plan = 'free' AND entitlement_source = 'free' AND entitlement_payment_id IS NULL)
  OR (plan IN ('starter', 'pro', 'agency') AND entitlement_verified_at IS NOT NULL AND (
    (entitlement_source = 'razorpay' AND entitlement_payment_id IS NOT NULL AND razorpay_subscription_id IS NOT NULL)
    OR (entitlement_source = 'legacy_payment' AND entitlement_payment_id IS NOT NULL)
    OR (entitlement_source = 'admin_grant' AND entitlement_payment_id IS NULL AND billing_cycle = 'admin_grant')
  ))
);

CREATE OR REPLACE FUNCTION public.enforce_paid_entitlement_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_rank integer := 0;
  v_new_rank integer := CASE NEW.plan WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'agency' THEN 3 ELSE 0 END;
  v_requires_fresh boolean := false;
BEGIN
  IF NEW.plan = 'free' THEN
    NEW.entitlement_source := 'free';
    NEW.entitlement_payment_id := NULL;
    NEW.entitlement_verified_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.current_period_start IS NULL OR NEW.current_period_end IS NULL
     OR NEW.current_period_end <= NEW.current_period_start THEN
    RAISE EXCEPTION 'paid entitlement requires a finite valid period' USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old_rank := CASE OLD.plan WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'agency' THEN 3 ELSE 0 END;
    v_requires_fresh := v_new_rank > v_old_rank
      OR OLD.current_period_end IS NULL
      OR NEW.current_period_end > OLD.current_period_end
      OR NEW.razorpay_subscription_id IS DISTINCT FROM OLD.razorpay_subscription_id;
  ELSE
    v_requires_fresh := true;
  END IF;

  IF NEW.entitlement_source = 'razorpay' THEN
    IF NEW.entitlement_payment_id IS NULL OR NEW.entitlement_verified_at IS NULL
       OR NEW.razorpay_subscription_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.payment_history ph
        WHERE ph.user_id = NEW.user_id
          AND ph.razorpay_payment_id = NEW.entitlement_payment_id
          AND ph.razorpay_subscription_id = NEW.razorpay_subscription_id
          AND ph.status = 'captured' AND ph.amount > 0
          AND ph.amount = NEW.amount_paid
          AND upper(ph.currency) = upper(NEW.currency)
       ) THEN
      RAISE EXCEPTION 'matching captured Razorpay evidence is required' USING ERRCODE = '23514';
    END IF;
    IF v_requires_fresh AND TG_OP = 'UPDATE'
       AND NEW.entitlement_payment_id IS NOT DISTINCT FROM OLD.entitlement_payment_id THEN
      RAISE EXCEPTION 'fresh Razorpay payment is required for entitlement increase' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.entitlement_source = 'admin_grant' THEN
    IF NEW.billing_cycle <> 'admin_grant' OR NEW.entitlement_payment_id IS NOT NULL
       OR NEW.razorpay_subscription_id IS NOT NULL
       OR NOT EXISTS (
         SELECT 1 FROM public.admin_tier_overrides ato
         WHERE ato.user_id = NEW.user_id AND ato.tier = NEW.plan
           AND ato.created_at = NEW.entitlement_verified_at
       ) THEN
      RAISE EXCEPTION 'matching admin grant evidence is required' USING ERRCODE = '23514';
    END IF;
    IF v_requires_fresh AND TG_OP = 'UPDATE'
       AND NEW.entitlement_verified_at IS NOT DISTINCT FROM OLD.entitlement_verified_at THEN
      RAISE EXCEPTION 'fresh admin override is required for entitlement increase' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.entitlement_source = 'legacy_payment' THEN
    IF NEW.entitlement_payment_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.payment_history ph
      WHERE ph.user_id = NEW.user_id
        AND ph.razorpay_payment_id = NEW.entitlement_payment_id
        AND ph.status = 'captured' AND ph.amount > 0
    ) THEN
      RAISE EXCEPTION 'matching legacy payment evidence is required' USING ERRCODE = '23514';
    END IF;
    IF v_requires_fresh AND TG_OP = 'UPDATE' THEN
      RAISE EXCEPTION 'legacy evidence cannot extend paid entitlement' USING ERRCODE = '23514';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid paid entitlement source' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_paid_entitlement_evidence ON public.subscriptions;
CREATE TRIGGER enforce_paid_entitlement_evidence
BEFORE INSERT OR UPDATE OF plan, billing_cycle, current_period_start, current_period_end,
  amount_paid, currency, razorpay_subscription_id, entitlement_source,
  entitlement_payment_id, entitlement_verified_at
ON public.subscriptions FOR EACH ROW
EXECUTE FUNCTION public.enforce_paid_entitlement_evidence();
REVOKE ALL ON FUNCTION public.enforce_paid_entitlement_evidence() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_subscription_charge_event(
  p_user_id uuid,
  p_subscription_id text,
  p_plan_id text,
  p_plan text,
  p_billing_cycle text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_payment_id text,
  p_invoice_id text,
  p_order_id text,
  p_amount integer,
  p_currency text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_previous_subscription_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_payment public.payment_history%ROWTYPE;
BEGIN
  -- Access control is enforced by REVOKE/GRANT below (service_role only).
  IF p_plan NOT IN ('starter', 'pro')
     OR p_billing_cycle NOT IN ('monthly', 'yearly')
     OR p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
     OR p_plan_id IS NULL OR btrim(p_plan_id) = ''
     OR p_payment_id !~ '^pay_[A-Za-z0-9]+$'
     OR p_invoice_id !~ '^inv_[A-Za-z0-9]+$'
     OR p_order_id !~ '^order_[A-Za-z0-9]+$'
     OR p_amount <= 0 OR p_currency IS NULL OR btrim(p_currency) = ''
     OR p_period_start IS NULL OR p_period_end IS NULL OR p_period_end <= p_period_start
     OR p_event_type NOT IN ('subscription.charged', 'provider.verify', 'provider.reconcile', 'provider.immediate_update')
     OR p_event_created_at IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid_evidence');
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions
  WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR (
    v_sub.razorpay_subscription_id IS DISTINCT FROM p_subscription_id
    AND v_sub.pending_razorpay_subscription_id IS DISTINCT FROM p_subscription_id
  ) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'subscription_not_bound');
  END IF;
  IF v_sub.provider_event_created_at IS NOT NULL
     AND v_sub.provider_event_created_at > p_event_created_at THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'stale_event');
  END IF;
  IF v_sub.entitlement_source = 'razorpay'
     AND v_sub.entitlement_payment_id = p_payment_id
     AND v_sub.plan = p_plan
     AND v_sub.current_period_end >= p_period_end THEN
    RETURN jsonb_build_object('applied', true, 'duplicate', true, 'plan', v_sub.plan);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_payment_id, 0));
  SELECT * INTO v_payment FROM public.payment_history
  WHERE razorpay_payment_id = p_payment_id FOR UPDATE;
  IF FOUND THEN
    IF v_payment.user_id IS DISTINCT FROM p_user_id
       OR v_payment.status <> 'captured' OR v_payment.amount <> p_amount
       OR upper(v_payment.currency) <> upper(p_currency)
       OR (v_payment.razorpay_order_id IS NOT NULL AND v_payment.razorpay_order_id <> p_order_id)
       OR (v_payment.razorpay_invoice_id IS NOT NULL AND v_payment.razorpay_invoice_id <> p_invoice_id)
       OR (v_payment.razorpay_subscription_id IS NOT NULL AND v_payment.razorpay_subscription_id <> p_subscription_id) THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'payment_evidence_conflict');
    END IF;
    UPDATE public.payment_history SET
      razorpay_order_id = p_order_id,
      razorpay_invoice_id = p_invoice_id,
      razorpay_subscription_id = p_subscription_id,
      plan = p_plan,
      billing_cycle = p_billing_cycle
    WHERE id = v_payment.id;
  ELSE
    INSERT INTO public.payment_history (
      user_id, razorpay_payment_id, razorpay_order_id, razorpay_invoice_id,
      razorpay_subscription_id, amount, currency, status, plan, billing_cycle, metadata
    ) VALUES (
      p_user_id, p_payment_id, p_order_id, p_invoice_id,
      p_subscription_id, p_amount, upper(p_currency), 'captured', p_plan,
      p_billing_cycle, jsonb_build_object('type', 'subscription_charge', 'invoice_id', p_invoice_id)
    );
  END IF;

  UPDATE public.subscriptions SET
    plan = p_plan, billing_cycle = p_billing_cycle, status = 'active',
    razorpay_subscription_id = p_subscription_id, razorpay_plan_id = p_plan_id,
    currency = upper(p_currency), amount_paid = p_amount,
    current_period_start = p_period_start, current_period_end = p_period_end,
    cancelled_at = NULL, scheduled_downgrade = NULL,
    pending_plan = NULL, pending_billing_cycle = NULL,
    pending_razorpay_subscription_id = NULL, pending_change_type = NULL,
    pending_effective_at = NULL,
    pending_previous_subscription_id = CASE
      WHEN p_previous_subscription_id IS DISTINCT FROM p_subscription_id THEN p_previous_subscription_id
      ELSE NULL END,
    provider_sync_required = false,
    provider_event_created_at = p_event_created_at,
    provider_event_type = p_event_type,
    entitlement_source = 'razorpay',
    entitlement_payment_id = p_payment_id,
    entitlement_verified_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE public.profiles SET plan_selected = true WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'applied', true, 'plan', p_plan, 'payment_id', p_payment_id,
    'invoice_id', p_invoice_id, 'period_end', p_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_subscription_charge_event(
  uuid, text, text, text, text, timestamptz, timestamptz,
  text, text, text, integer, text, text, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_charge_event(
  uuid, text, text, text, text, timestamptz, timestamptz,
  text, text, text, integer, text, text, timestamptz, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_admin_tier_override(
  p_user_id uuid,
  p_tier text,
  p_expires_at timestamptz,
  p_reason text,
  p_admin_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_old_tier text := 'free';
  v_period_end timestamptz;
  v_evidence_at timestamptz;
BEGIN
  -- Access control is enforced by REVOKE/GRANT below (service_role only).
  IF p_tier NOT IN ('free', 'starter', 'pro', 'agency')
     OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 500
     OR p_admin_email IS NULL OR length(btrim(p_admin_email)) > 320
     OR (p_expires_at IS NOT NULL AND p_expires_at <= now()) THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid_override');
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('applied', false, 'reason', 'user_not_found'); END IF;
  v_old_tier := COALESCE(v_profile.tier, 'free');

  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id FOR UPDATE;
  IF FOUND AND v_sub.razorpay_subscription_id IS NOT NULL
     AND v_sub.entitlement_source = 'razorpay'
     AND v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > now() THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'active_provider_subscription');
  END IF;

  INSERT INTO public.admin_tier_overrides (user_id, tier, expires_at, reason, admin_email)
  VALUES (p_user_id, p_tier, p_expires_at, btrim(p_reason), lower(btrim(p_admin_email)))
  RETURNING created_at INTO v_evidence_at;

  IF p_tier = 'free' THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status, billing_cycle, current_period_start, current_period_end,
      cancelled_at, scheduled_downgrade, razorpay_subscription_id, razorpay_plan_id,
      razorpay_payment_id, razorpay_order_id, pending_plan, pending_billing_cycle,
      pending_razorpay_subscription_id, pending_change_type, pending_effective_at,
      pending_previous_subscription_id, entitlement_source, entitlement_payment_id,
      entitlement_verified_at, updated_at
    ) VALUES (
      p_user_id, 'free', 'cancelled', NULL, NULL, NULL, now(), NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      'free', NULL, NULL, now()
    ) ON CONFLICT (user_id) DO UPDATE SET
      plan = 'free', status = 'cancelled', billing_cycle = NULL,
      current_period_start = NULL, current_period_end = NULL, cancelled_at = now(),
      scheduled_downgrade = NULL, razorpay_subscription_id = NULL,
      razorpay_plan_id = NULL, razorpay_payment_id = NULL, razorpay_order_id = NULL,
      pending_plan = NULL, pending_billing_cycle = NULL,
      pending_razorpay_subscription_id = NULL, pending_change_type = NULL,
      pending_effective_at = NULL, pending_previous_subscription_id = NULL,
      entitlement_source = 'free', entitlement_payment_id = NULL,
      entitlement_verified_at = NULL, updated_at = now();
  ELSE
    v_period_end := COALESCE(p_expires_at, now() + interval '100 years');
    INSERT INTO public.subscriptions (
      user_id, plan, status, billing_cycle, current_period_start, current_period_end,
      cancelled_at, scheduled_downgrade, amount_paid, currency,
      razorpay_subscription_id, razorpay_plan_id, razorpay_payment_id, razorpay_order_id,
      pending_plan, pending_billing_cycle, pending_razorpay_subscription_id,
      pending_change_type, pending_effective_at, pending_previous_subscription_id,
      entitlement_source, entitlement_payment_id, entitlement_verified_at, updated_at
    ) VALUES (
      p_user_id, p_tier, 'active', 'admin_grant', now(), v_period_end,
      NULL, NULL, 0, 'USD', NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL,
      'admin_grant', NULL, v_evidence_at, now()
    ) ON CONFLICT (user_id) DO UPDATE SET
      plan = p_tier, status = 'active', billing_cycle = 'admin_grant',
      current_period_start = now(), current_period_end = v_period_end,
      cancelled_at = NULL, scheduled_downgrade = NULL, amount_paid = 0, currency = 'USD',
      razorpay_subscription_id = NULL, razorpay_plan_id = NULL,
      razorpay_payment_id = NULL, razorpay_order_id = NULL,
      pending_plan = NULL, pending_billing_cycle = NULL,
      pending_razorpay_subscription_id = NULL, pending_change_type = NULL,
      pending_effective_at = NULL, pending_previous_subscription_id = NULL,
      entitlement_source = 'admin_grant', entitlement_payment_id = NULL,
      entitlement_verified_at = v_evidence_at, updated_at = now();
  END IF;

  UPDATE public.profiles SET
    tier = p_tier,
    tier_expires_at = CASE WHEN p_tier = 'free' THEN NULL ELSE p_expires_at END,
    plan_selected = CASE WHEN p_tier = 'free' THEN plan_selected ELSE true END,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object('applied', true, 'old_tier', v_old_tier, 'new_tier', p_tier);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_admin_tier_override(uuid, text, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_admin_tier_override(uuid, text, timestamptz, text, text)
  TO service_role;

-- Repair stale profile badges from canonical finite subscription periods.
UPDATE public.profiles p SET
  tier = CASE
    WHEN s.plan IN ('starter', 'pro', 'agency') AND s.current_period_end > now() THEN s.plan
    ELSE 'free' END,
  tier_expires_at = CASE
    WHEN s.entitlement_source = 'admin_grant' AND s.current_period_end > now() THEN s.current_period_end
    ELSE NULL END,
  updated_at = now()
FROM public.subscriptions s
WHERE s.user_id = p.id;
UPDATE public.profiles p SET tier = 'free', tier_expires_at = NULL, updated_at = now()
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id)
  AND p.tier IS DISTINCT FROM 'free';

CREATE OR REPLACE FUNCTION public.sync_profile_effective_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET
    tier = CASE
      WHEN NEW.plan IN ('starter', 'pro', 'agency')
       AND NEW.current_period_end IS NOT NULL AND NEW.current_period_end > now()
      THEN NEW.plan ELSE 'free' END,
    tier_expires_at = CASE
      WHEN NEW.entitlement_source = 'admin_grant' AND NEW.current_period_end > now()
      THEN NEW.current_period_end ELSE NULL END,
    updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_profile_effective_tier ON public.subscriptions;
CREATE TRIGGER sync_profile_effective_tier
AFTER INSERT OR UPDATE OF plan, status, current_period_end, entitlement_source
ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.sync_profile_effective_tier();
REVOKE ALL ON FUNCTION public.sync_profile_effective_tier() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tier := 'free'; NEW.tier_expires_at := NULL; NEW.suspended_at := NULL;
    ELSE
      NEW.tier := OLD.tier; NEW.tier_expires_at := OLD.tier_expires_at;
      NEW.suspended_at := OLD.suspended_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.check_subscription_expiry(p_user_id uuid)
RETURNS TABLE(plan text, status text, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_sub public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;
  IF NOT FOUND OR v_sub.plan = 'free' THEN
    RETURN QUERY SELECT 'free'::text, 'active'::text, false; RETURN;
  END IF;
  IF v_sub.current_period_end IS NULL OR v_sub.current_period_end <= now() THEN
    RETURN QUERY SELECT 'free'::text, 'past_due'::text, true; RETURN;
  END IF;
  RETURN QUERY SELECT v_sub.plan, v_sub.status, false;
END;
$$;
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry(uuid) TO authenticated, service_role;

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
  WHERE id = p_session_id AND user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR v_session.document_type = 'chat' THEN
    RAISE EXCEPTION 'Document session not found';
  END IF;
  IF v_session.quota_counted_at IS NOT NULL THEN
    SELECT COALESCE(documents_count, 0) INTO v_count FROM public.user_usage
    WHERE user_id = p_user_id AND month = p_month;
    RETURN jsonb_build_object('allowed', true, 'reserved', false, 'current_count', COALESCE(v_count, 0));
  END IF;

  SELECT plan, current_period_end INTO v_plan, v_period_end
  FROM public.subscriptions WHERE user_id = p_user_id;
  IF v_plan IN ('starter', 'pro', 'agency')
     AND v_period_end IS NOT NULL AND v_period_end > now() THEN
    v_tier := v_plan;
  END IF;
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
    RETURN jsonb_build_object('allowed', false, 'reserved', false,
      'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
  END IF;

  UPDATE public.document_sessions
  SET quota_counted_at = now(), quota_counted_month = p_month, updated_at = now()
  WHERE id = p_session_id;
  RETURN jsonb_build_object('allowed', true, 'reserved', true,
    'current_count', v_count, 'limit', v_limit, 'tier', v_tier);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_document_quota(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_document_quota(uuid, uuid, text) TO authenticated, service_role;
