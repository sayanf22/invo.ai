-- Subscription reads must never mutate paid state or synthesize billing periods.
-- Razorpay webhooks/reconciliation are the source of truth for plan transitions.
CREATE OR REPLACE FUNCTION public.check_subscription_expiry(p_user_id uuid)
RETURNS TABLE(plan text, status text, is_expired boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub public.subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'free'::text, 'active'::text, false;
    RETURN;
  END IF;

  IF v_sub.current_period_end IS NULL THEN
    RETURN QUERY SELECT v_sub.plan, v_sub.status, false;
    RETURN;
  END IF;

  IF v_sub.current_period_end <= now() THEN
    -- Do not grant a scheduled paid tier without provider confirmation, and do
    -- not rewrite yearly periods as one month. Callers should reconcile.
    RETURN QUERY SELECT 'free'::text, 'past_due'::text, true;
    RETURN;
  END IF;

  -- Future paid time remains entitled even if a cancellation/halt arrived early.
  RETURN QUERY SELECT v_sub.plan, v_sub.status, false;
END;
$$;

REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry(uuid) TO service_role;