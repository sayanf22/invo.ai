-- Finalize expired paid entitlements reliably even when a terminal provider webhook is missed.
-- Historical paid plan/period evidence is retained; effective access is resolved from period_end.

CREATE OR REPLACE FUNCTION public.record_subscription_terminal_event(
  p_user_id uuid,
  p_subscription_id text,
  p_provider_status text,
  p_period_end timestamptz,
  p_event_type text,
  p_event_created_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_existing_rank integer;
  v_incoming_rank integer := 3;
  v_finalized boolean := false;
BEGIN
  IF p_subscription_id !~ '^sub_[A-Za-z0-9]+$'
     OR p_provider_status NOT IN ('cancelled', 'halted')
     OR p_event_type NOT IN ('subscription.cancelled', 'subscription.halted', 'provider.reconcile')
     OR p_event_created_at IS NULL THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'invalid_terminal_event');
  END IF;

  SELECT * INTO v_sub FROM public.subscriptions
  WHERE user_id = p_user_id
    AND (razorpay_subscription_id = p_subscription_id
      OR pending_razorpay_subscription_id = p_subscription_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'subscription_not_bound');
  END IF;

  v_existing_rank := CASE v_sub.provider_event_type
    WHEN 'subscription.cancelled' THEN 3 WHEN 'subscription.halted' THEN 3
    WHEN 'subscription.charged' THEN 2
    WHEN 'subscription.activated' THEN 1 WHEN 'subscription.updated' THEN 1
    ELSE 0 END;
  IF v_sub.provider_event_created_at IS NOT NULL AND (
    v_sub.provider_event_created_at > p_event_created_at OR
    (v_sub.provider_event_created_at = p_event_created_at AND v_existing_rank > v_incoming_rank)
  ) THEN
    RETURN jsonb_build_object('applied', false, 'stale', true, 'reason', 'stale_event');
  END IF;

  -- A terminal replacement that never became active must not alter the current paid row.
  IF v_sub.pending_razorpay_subscription_id = p_subscription_id
     AND v_sub.razorpay_subscription_id IS DISTINCT FROM p_subscription_id THEN
    UPDATE public.subscriptions SET
      pending_plan = NULL, pending_billing_cycle = NULL,
      pending_razorpay_subscription_id = NULL, pending_change_type = NULL,
      pending_effective_at = NULL, pending_previous_subscription_id = NULL,
      provider_sync_required = false, updated_at = now()
    WHERE user_id = p_user_id
      AND pending_razorpay_subscription_id = p_subscription_id;
    RETURN jsonb_build_object('applied', true, 'pending_cleared', true, 'finalized', false);
  END IF;
  -- Never shorten or extend a captured paid period from a terminal lifecycle event.
  UPDATE public.subscriptions SET
    status = CASE WHEN p_provider_status = 'cancelled' THEN 'cancelled' ELSE 'past_due' END,
    cancelled_at = CASE WHEN p_provider_status = 'cancelled'
      THEN COALESCE(cancelled_at, p_event_created_at) ELSE cancelled_at END,
    provider_sync_required = false,
    provider_event_created_at = p_event_created_at,
    provider_event_type = p_event_type,
    updated_at = now()
  WHERE user_id = p_user_id;

  IF v_sub.current_period_end IS NOT NULL AND v_sub.current_period_end <= now() THEN
    UPDATE public.subscriptions SET
      scheduled_downgrade = CASE WHEN scheduled_downgrade = 'free' THEN NULL ELSE scheduled_downgrade END,
      pending_plan = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_plan END,
      pending_billing_cycle = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_billing_cycle END,
      pending_change_type = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_change_type END,
      pending_effective_at = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_effective_at END,
      pending_razorpay_subscription_id = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_razorpay_subscription_id END,
      pending_previous_subscription_id = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_previous_subscription_id END,
      updated_at = now()
    WHERE user_id = p_user_id;

    UPDATE public.profiles SET tier = 'free', tier_expires_at = NULL, updated_at = now()
    WHERE id = p_user_id;
    UPDATE public.recurring_invoices SET is_active = false, updated_at = now()
    WHERE user_id = p_user_id AND is_active = true;
    UPDATE public.email_schedules SET
      status = 'cancelled', cancelled_reason = 'subscription_ended', updated_at = now()
    WHERE user_id = p_user_id AND status = 'pending';
    v_finalized := true;
  END IF;

  RETURN jsonb_build_object(
    'applied', true, 'stale', false, 'finalized', v_finalized,
    'period_end', v_sub.current_period_end,
    'provider_period_end', p_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_subscription_terminal_event(
  uuid, text, text, timestamptz, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_subscription_terminal_event(
  uuid, text, text, timestamptz, text, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_due_subscription_entitlements(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
  v_count integer := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RETURN jsonb_build_object('finalized', 0, 'reason', 'invalid_limit');
  END IF;

  FOR v_sub IN
    SELECT * FROM public.subscriptions
    WHERE plan IN ('starter', 'pro', 'agency')
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
      AND (
        COALESCE(status, '') NOT IN ('cancelled', 'past_due')
        OR scheduled_downgrade = 'free'
        OR pending_plan = 'free'
        OR provider_sync_required = true
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = subscriptions.user_id AND COALESCE(p.tier, 'free') <> 'free'
        )
        OR EXISTS (
          SELECT 1 FROM public.recurring_invoices ri
          WHERE ri.user_id = subscriptions.user_id AND ri.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.email_schedules es
          WHERE es.user_id = subscriptions.user_id AND es.status = 'pending'
        )
      )
    ORDER BY current_period_end, user_id
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  LOOP
    UPDATE public.subscriptions SET
      status = CASE
        WHEN status = 'cancelled' OR scheduled_downgrade = 'free' OR pending_plan = 'free'
          THEN 'cancelled'
        ELSE 'past_due' END,
      cancelled_at = CASE
        WHEN status = 'cancelled' OR scheduled_downgrade = 'free' OR pending_plan = 'free'
          THEN COALESCE(cancelled_at, current_period_end)
        ELSE cancelled_at END,
      scheduled_downgrade = CASE WHEN scheduled_downgrade = 'free' THEN NULL ELSE scheduled_downgrade END,
      pending_billing_cycle = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_billing_cycle END,
      pending_change_type = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_change_type END,
      pending_effective_at = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_effective_at END,
      pending_razorpay_subscription_id = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_razorpay_subscription_id END,
      pending_previous_subscription_id = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_previous_subscription_id END,
      pending_plan = CASE WHEN pending_plan = 'free' THEN NULL ELSE pending_plan END,
      provider_sync_required = false,
      updated_at = now()
    WHERE user_id = v_sub.user_id;

    UPDATE public.profiles SET tier = 'free', tier_expires_at = NULL, updated_at = now()
    WHERE id = v_sub.user_id;
    UPDATE public.recurring_invoices SET is_active = false, updated_at = now()
    WHERE user_id = v_sub.user_id AND is_active = true;
    UPDATE public.email_schedules SET
      status = 'cancelled', cancelled_reason = 'subscription_ended', updated_at = now()
    WHERE user_id = v_sub.user_id AND status = 'pending';
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('finalized', v_count, 'as_of', now());
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_due_subscription_entitlements(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_due_subscription_entitlements(integer)
  TO service_role, postgres;

-- Restore the intended service-only access after the later entitlement migration recreated it.
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry(uuid) TO service_role;

-- Database-local, secret-free safety net. Webhooks remain the fast path.
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
DECLARE v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job
  WHERE jobname = 'finalize-subscription-expiry' LIMIT 1;
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
END;
$$;
SELECT cron.schedule(
  'finalize-subscription-expiry',
  '*/5 * * * *',
  $cron$SELECT public.finalize_due_subscription_entitlements(500);$cron$
);

-- Repair rows that were already due before this migration.
SELECT public.finalize_due_subscription_entitlements(5000);
