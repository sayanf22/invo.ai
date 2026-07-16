-- Allow trusted database maintenance/cron sessions to synchronize protected profile tier fields.
-- Browser/API roles remain unable to modify tier, expiry, or suspension state.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role text := COALESCE(current_setting('request.jwt.claims', true), '{}')::jsonb->>'role';
BEGIN
  IF v_jwt_role IS DISTINCT FROM 'service_role' AND session_user <> 'postgres' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.tier := 'free';
      NEW.tier_expires_at := NULL;
      NEW.suspended_at := NULL;
    ELSE
      NEW.tier := OLD.tier;
      NEW.tier_expires_at := OLD.tier_expires_at;
      NEW.suspended_at := OLD.suspended_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_profile_sensitive_columns() TO service_role, postgres;

-- Complete any profile synchronization that the original trigger blocked.
SELECT public.finalize_due_subscription_entitlements(5000);
