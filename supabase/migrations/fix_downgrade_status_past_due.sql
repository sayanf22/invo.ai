-- Fix: check_subscription_expiry incorrectly marks ANY paid->paid scheduled
-- downgrade as status = 'past_due' instead of 'active' once the downgrade
-- completes (period expires). This causes resolveEffectiveTier() to demote
-- the user all the way to FREE instead of the lower paid tier they actually
-- downgraded to.
--
-- Fix: any successfully-applied scheduled downgrade (to 'free' OR to another
-- paid tier) SHALL set status = 'active', never 'past_due'. The unrelated
-- "no scheduled downgrade, mark past_due" branch (genuine payment failure)
-- is left untouched.
--
-- Bugfix spec: razorpay-downgrade-billing-fix
-- Validates: Requirements 2.5, 2.6, 3.5, 3.6 / Property 3, Property 4

CREATE OR REPLACE FUNCTION public.check_subscription_expiry(p_user_id uuid)
 RETURNS TABLE(plan text, status text, is_expired boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_sub RECORD;
BEGIN
    SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = p_user_id;

    -- No subscription = free
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'free'::TEXT, 'active'::TEXT, false;
        RETURN;
    END IF;

    -- If subscription has no end date, it's perpetual (e.g., migrated users)
    IF v_sub.current_period_end IS NULL THEN
        RETURN QUERY SELECT v_sub.plan, v_sub.status, false;
        RETURN;
    END IF;

    -- Check if subscription period has expired
    IF v_sub.current_period_end < NOW() THEN
        -- Check if there's a scheduled downgrade
        IF v_sub.scheduled_downgrade IS NOT NULL THEN
            -- Any completed scheduled downgrade (free OR another paid tier) is
            -- NOT a payment failure — it's a successful, user-initiated plan
            -- change. Always set status = 'active'.
            UPDATE public.subscriptions
            SET plan = v_sub.scheduled_downgrade,
                scheduled_downgrade = NULL,
                status = 'active',
                current_period_start = NOW(),
                current_period_end = CASE
                    WHEN v_sub.scheduled_downgrade = 'free' THEN NULL
                    ELSE NOW() + INTERVAL '1 month'
                END,
                updated_at = NOW()
            WHERE user_id = p_user_id;

            RETURN QUERY SELECT v_sub.scheduled_downgrade,
                'active'::TEXT,
                true;
        ELSE
            -- No downgrade scheduled — mark as past_due only if not already
            IF v_sub.status = 'active' THEN
                UPDATE public.subscriptions
                SET status = 'past_due', updated_at = NOW()
                WHERE user_id = p_user_id;
            END IF;

            RETURN QUERY SELECT v_sub.plan, 'past_due'::TEXT, true;
        END IF;
    ELSE
        -- Subscription is still active
        RETURN QUERY SELECT v_sub.plan, v_sub.status, false;
    END IF;
END;
$function$;
