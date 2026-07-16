-- Recoverable subscription transitions and idempotent, auditable allowance resets.
-- Counters remain UTC-month buckets, but a completed plan transition starts a
-- fresh allowance inside that month. Previous values are preserved here.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_transition_id uuid,
  ADD COLUMN IF NOT EXISTS pending_provider_plan_id text;

CREATE TABLE IF NOT EXISTS public.subscription_usage_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transition_key text NOT NULL UNIQUE,
  from_plan text NOT NULL,
  to_plan text NOT NULL,
  effective_at timestamptz NOT NULL,
  usage_month text NOT NULL,
  reason text NOT NULL,
  payment_id text,
  previous_ai_requests_count integer NOT NULL DEFAULT 0,
  previous_ai_tokens_used bigint NOT NULL DEFAULT 0,
  previous_estimated_cost_usd numeric NOT NULL DEFAULT 0,
  previous_documents_count integer NOT NULL DEFAULT 0,
  previous_emails_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_usage_resets_plan_check
    CHECK (from_plan IN ('free', 'starter', 'pro', 'agency')
      AND to_plan IN ('free', 'starter', 'pro', 'agency')),
  CONSTRAINT subscription_usage_resets_month_check
    CHECK (usage_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT subscription_usage_resets_reason_check
    CHECK (reason IN ('verified_plan_transition', 'paid_entitlement_ended'))
);

CREATE INDEX IF NOT EXISTS subscription_usage_resets_user_effective_idx
  ON public.subscription_usage_resets(user_id, effective_at DESC);
ALTER TABLE public.subscription_usage_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_usage_resets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_usage_resets TO authenticated;
GRANT SELECT, INSERT ON public.subscription_usage_resets TO service_role;
DROP POLICY IF EXISTS "Users can read own subscription usage resets" ON public.subscription_usage_resets;
CREATE POLICY "Users can read own subscription usage resets"
  ON public.subscription_usage_resets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);


CREATE OR REPLACE FUNCTION public.set_subscription_pending_created_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pending_change_type IS NULL THEN
    NEW.pending_created_at := NULL;
    NEW.pending_transition_id := NULL;
    NEW.pending_provider_plan_id := NULL;
  ELSIF TG_OP = 'INSERT'
     OR OLD.pending_change_type IS DISTINCT FROM NEW.pending_change_type
     OR OLD.pending_plan IS DISTINCT FROM NEW.pending_plan
     OR OLD.pending_billing_cycle IS DISTINCT FROM NEW.pending_billing_cycle
     OR OLD.pending_razorpay_subscription_id IS DISTINCT FROM NEW.pending_razorpay_subscription_id THEN
    NEW.pending_created_at := now();
    NEW.pending_transition_id := gen_random_uuid();
  ELSE
    NEW.pending_created_at := COALESCE(NEW.pending_created_at, OLD.pending_created_at, now());
    NEW.pending_transition_id := COALESCE(NEW.pending_transition_id, OLD.pending_transition_id, gen_random_uuid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_subscription_pending_created_at ON public.subscriptions;
CREATE TRIGGER set_subscription_pending_created_at
BEFORE INSERT OR UPDATE OF pending_change_type, pending_plan, pending_billing_cycle,
  pending_razorpay_subscription_id
ON public.subscriptions FOR EACH ROW
EXECUTE FUNCTION public.set_subscription_pending_created_at();
REVOKE ALL ON FUNCTION public.set_subscription_pending_created_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_pending_created_at() TO service_role, postgres;

UPDATE public.subscriptions
SET pending_created_at = COALESCE(pending_created_at, updated_at, now()),
    pending_transition_id = COALESCE(pending_transition_id, gen_random_uuid())
WHERE pending_change_type IS NOT NULL
  AND (pending_created_at IS NULL OR pending_transition_id IS NULL);

CREATE OR REPLACE FUNCTION public.archive_and_reset_transition_usage(
  p_user_id uuid,
  p_transition_key text,
  p_from_plan text,
  p_to_plan text,
  p_effective_at timestamptz,
  p_reason text,
  p_payment_id text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text;
  v_usage public.user_usage%ROWTYPE;
BEGIN
  IF p_transition_key IS NULL OR length(p_transition_key) NOT BETWEEN 8 AND 240
     OR p_from_plan NOT IN ('free', 'starter', 'pro', 'agency')
     OR p_to_plan NOT IN ('free', 'starter', 'pro', 'agency')
     OR p_reason NOT IN ('verified_plan_transition', 'paid_entitlement_ended')
     OR p_effective_at IS NULL THEN
    RAISE EXCEPTION 'Invalid usage reset transition';
  END IF;

  v_month := to_char(p_effective_at AT TIME ZONE 'UTC', 'YYYY-MM');
  SELECT * INTO v_usage FROM public.user_usage
  WHERE user_id = p_user_id AND month = v_month FOR UPDATE;

  INSERT INTO public.subscription_usage_resets (
    user_id, transition_key, from_plan, to_plan, effective_at, usage_month,
    reason, payment_id, previous_ai_requests_count, previous_ai_tokens_used,
    previous_estimated_cost_usd, previous_documents_count, previous_emails_count
  ) VALUES (
    p_user_id, p_transition_key, p_from_plan, p_to_plan, p_effective_at, v_month,
    p_reason, p_payment_id, COALESCE(v_usage.ai_requests_count, 0),
    COALESCE(v_usage.ai_tokens_used, 0), COALESCE(v_usage.estimated_cost_usd, 0),
    COALESCE(v_usage.documents_count, 0), COALESCE(v_usage.emails_count, 0)
  ) ON CONFLICT (transition_key) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Never reset a later UTC month when a webhook is reconciled late.
  IF v_month = to_char(timezone('UTC', now()), 'YYYY-MM') THEN
    UPDATE public.user_usage SET
      ai_requests_count = 0, documents_count = 0, emails_count = 0,
      updated_at = now()
    WHERE user_id = p_user_id AND month = v_month;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.archive_and_reset_transition_usage(
  uuid, text, text, text, timestamptz, text, text
) FROM PUBLIC, anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.reset_usage_on_completed_subscription_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_key text;
BEGIN
  -- Paid transitions reset inside apply_subscription_charge_event after an
  -- exact transition CAS. This trigger owns only the paid-to-Free boundary.
  IF OLD.plan IN ('starter', 'pro', 'agency')
     AND OLD.current_period_end IS NOT NULL
     AND OLD.current_period_end <= now()
     AND NEW.status IN ('cancelled', 'past_due')
     AND (
       OLD.status IS DISTINCT FROM NEW.status
       OR (OLD.pending_plan = 'free' AND NEW.pending_plan IS NULL)
       OR (OLD.scheduled_downgrade = 'free' AND NEW.scheduled_downgrade IS NULL)
     ) THEN
    v_key := 'free:' || COALESCE(NEW.razorpay_subscription_id, NEW.id::text)
      || ':' || extract(epoch FROM OLD.current_period_end)::bigint::text;
    PERFORM public.archive_and_reset_transition_usage(
      NEW.user_id, v_key, OLD.plan, 'free', OLD.current_period_end,
      'paid_entitlement_ended', NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reset_usage_on_completed_subscription_transition ON public.subscriptions;
CREATE TRIGGER reset_usage_on_completed_subscription_transition
AFTER UPDATE OF plan, billing_cycle, status, current_period_end,
  entitlement_payment_id, pending_plan, pending_change_type, scheduled_downgrade
ON public.subscriptions FOR EACH ROW
EXECUTE FUNCTION public.reset_usage_on_completed_subscription_transition();
REVOKE ALL ON FUNCTION public.reset_usage_on_completed_subscription_transition()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_usage_on_completed_subscription_transition()
  TO service_role, postgres;

CREATE OR REPLACE FUNCTION public.clear_subscription_transition(
  p_user_id uuid,
  p_expected_transition_id uuid,
  p_expected_change_type text,
  p_expected_pending_subscription_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
BEGIN
  IF p_expected_change_type NOT IN ('upgrade', 'cycle_change', 'downgrade', 'cancellation', 'provider_sync')
     OR p_reason NOT IN ('abandoned_checkout', 'provider_terminal', 'provider_missing',
       'provider_no_scheduled_change', 'scheduled_update_cancelled', 'replaced_change',
       'user_cancelled') THEN
    RETURN jsonb_build_object('cleared', false, 'reason', 'invalid_request');
  END IF;
  SELECT * INTO v_sub FROM public.subscriptions
  WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('cleared', false, 'reason', 'not_found'); END IF;
  IF v_sub.pending_transition_id IS DISTINCT FROM p_expected_transition_id
     OR v_sub.pending_change_type IS DISTINCT FROM p_expected_change_type
     OR v_sub.pending_razorpay_subscription_id IS DISTINCT FROM p_expected_pending_subscription_id THEN
    RETURN jsonb_build_object('cleared', false, 'reason', 'transition_changed');
  END IF;
  IF v_sub.pending_change_type = 'cancellation'
     AND p_reason NOT IN ('provider_terminal', 'replaced_change') THEN
    RETURN jsonb_build_object('cleared', false, 'reason', 'cancellation_not_reversible');
  END IF;

  -- If replacement authorization is abandoned after a provider cancellation,
  -- restore the truthful Free-at-boundary transition instead of hiding it.
  IF v_sub.scheduled_downgrade = 'free'
     AND v_sub.pending_plan IS DISTINCT FROM 'free'
     AND v_sub.current_period_end > now() THEN
    UPDATE public.subscriptions SET
      pending_plan = 'free', pending_billing_cycle = NULL,
      pending_razorpay_subscription_id = NULL, pending_change_type = 'cancellation',
      pending_effective_at = current_period_end,
      pending_previous_subscription_id = NULL,
      provider_sync_required = false, updated_at = now()
    WHERE user_id = p_user_id;
    RETURN jsonb_build_object('cleared', true, 'reason', 'cancellation_restored');
  END IF;

  UPDATE public.subscriptions SET
    scheduled_downgrade = CASE
      WHEN scheduled_downgrade IS NOT DISTINCT FROM pending_plan THEN NULL
      ELSE scheduled_downgrade END,
    pending_plan = NULL, pending_billing_cycle = NULL,
    pending_razorpay_subscription_id = NULL, pending_change_type = NULL,
    pending_effective_at = NULL, pending_previous_subscription_id = NULL,
    pending_created_at = NULL, provider_sync_required = false, updated_at = now()
  WHERE user_id = p_user_id;
  RETURN jsonb_build_object('cleared', true, 'reason', p_reason);
END;
$$;
REVOKE ALL ON FUNCTION public.clear_subscription_transition(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.clear_subscription_transition(uuid, uuid, text, text, text)
  TO service_role;


COMMENT ON TABLE public.subscription_usage_resets IS
  'Immutable pre-reset snapshots proving when and why a completed subscription transition refreshed allowances.';
COMMENT ON COLUMN public.subscriptions.pending_created_at IS
  'Server-maintained timestamp used to expire abandoned Checkout transitions without touching valid scheduled changes.';

-- Bring accounts that already completed a paid-to-Free transition this UTC
-- month onto the new policy without deleting their pre-reset history.
DO $$
DECLARE v_sub public.subscriptions%ROWTYPE;
BEGIN
  FOR v_sub IN
    SELECT * FROM public.subscriptions
    WHERE plan IN ('starter', 'pro', 'agency')
      AND current_period_end >= date_trunc('month', timezone('UTC', now())) AT TIME ZONE 'UTC'
      AND current_period_end <= now()
      AND status IN ('cancelled', 'past_due')
  LOOP
    PERFORM public.archive_and_reset_transition_usage(
      v_sub.user_id,
      'free:' || COALESCE(v_sub.razorpay_subscription_id, v_sub.id::text)
        || ':' || extract(epoch FROM v_sub.current_period_end)::bigint::text,
      v_sub.plan, 'free', v_sub.current_period_end,
      'paid_entitlement_ended', NULL
    );
  END LOOP;
END;
$$;


-- Replace the broad charge applicator with an exact transition compare-and-set.
-- Renewal charges may advance the current entitlement without erasing an
-- unrelated scheduled change; only the expected target clears and resets it.
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
  v_completes_transition boolean := false;
  v_transition_id uuid;
  v_from_plan text;
  v_effective_at timestamptz;
BEGIN
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


  IF v_sub.pending_change_type IS NOT NULL THEN
    v_completes_transition := v_sub.pending_transition_id IS NOT NULL
      AND v_sub.pending_plan = p_plan
      AND COALESCE(v_sub.pending_billing_cycle, p_billing_cycle) = p_billing_cycle
      AND (v_sub.pending_provider_plan_id IS NULL OR v_sub.pending_provider_plan_id = p_plan_id)
      AND CASE
        WHEN v_sub.pending_razorpay_subscription_id IS NOT NULL
          THEN v_sub.pending_razorpay_subscription_id = p_subscription_id
        ELSE v_sub.razorpay_subscription_id = p_subscription_id
      END
      AND (
        v_sub.pending_effective_at IS NULL
        OR p_event_created_at >= v_sub.pending_effective_at - interval '5 minutes'
      );

    IF NOT v_completes_transition AND NOT (
      v_sub.razorpay_subscription_id = p_subscription_id
      AND v_sub.plan = p_plan
      AND v_sub.billing_cycle = p_billing_cycle
      AND (v_sub.pending_plan IS DISTINCT FROM 'free'
        OR v_sub.pending_effective_at IS NULL
        OR p_period_start < v_sub.pending_effective_at)
    ) THEN
      RETURN jsonb_build_object('applied', false, 'reason', 'charge_does_not_match_pending_transition');
    END IF;
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


  v_transition_id := v_sub.pending_transition_id;
  v_from_plan := CASE
    WHEN v_sub.plan IN ('starter', 'pro', 'agency')
     AND v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end > p_event_created_at
    THEN v_sub.plan ELSE 'free' END;
  v_effective_at := COALESCE(v_sub.pending_effective_at, p_event_created_at);

  UPDATE public.subscriptions SET
    plan = p_plan, billing_cycle = p_billing_cycle, status = 'active',
    razorpay_subscription_id = p_subscription_id, razorpay_plan_id = p_plan_id,
    currency = upper(p_currency), amount_paid = p_amount,
    current_period_start = p_period_start, current_period_end = p_period_end,
    cancelled_at = CASE WHEN v_completes_transition THEN NULL ELSE cancelled_at END,
    scheduled_downgrade = CASE WHEN v_completes_transition THEN NULL ELSE scheduled_downgrade END,
    pending_plan = CASE WHEN v_completes_transition THEN NULL ELSE pending_plan END,
    pending_billing_cycle = CASE WHEN v_completes_transition THEN NULL ELSE pending_billing_cycle END,
    pending_razorpay_subscription_id = CASE WHEN v_completes_transition THEN NULL ELSE pending_razorpay_subscription_id END,
    pending_change_type = CASE WHEN v_completes_transition THEN NULL ELSE pending_change_type END,
    pending_effective_at = CASE WHEN v_completes_transition THEN NULL ELSE pending_effective_at END,
    pending_previous_subscription_id = CASE
      WHEN v_completes_transition AND p_previous_subscription_id IS DISTINCT FROM p_subscription_id
        THEN p_previous_subscription_id
      WHEN v_completes_transition THEN NULL
      ELSE pending_previous_subscription_id END,
    provider_sync_required = false,
    provider_event_created_at = p_event_created_at,
    provider_event_type = p_event_type,
    entitlement_source = 'razorpay',
    entitlement_payment_id = p_payment_id,
    entitlement_verified_at = now(), updated_at = now()
  WHERE user_id = p_user_id;

  IF v_completes_transition THEN
    PERFORM public.archive_and_reset_transition_usage(
      p_user_id, 'paid:' || v_transition_id::text,
      v_from_plan, p_plan, v_effective_at,
      'verified_plan_transition', p_payment_id
    );
  END IF;

  UPDATE public.profiles SET plan_selected = true WHERE id = p_user_id;
  RETURN jsonb_build_object(
    'applied', true, 'plan', p_plan, 'payment_id', p_payment_id,
    'invoice_id', p_invoice_id, 'period_end', p_period_end,
    'transition_completed', v_completes_transition,
    'transition_id', CASE WHEN v_completes_transition THEN v_transition_id ELSE NULL END
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