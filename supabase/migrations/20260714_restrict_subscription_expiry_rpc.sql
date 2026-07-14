-- The app no longer calls this compatibility RPC. Keep it available only to
-- service-role reconciliation/tests so authenticated users cannot probe another
-- user's subscription metadata through a SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.check_subscription_expiry(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_subscription_expiry(uuid) TO service_role;