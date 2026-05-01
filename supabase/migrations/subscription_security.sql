-- ============================================================================
-- SUBSCRIPTION & TIER SECURITY HARDENING
-- Applied: 2026-05-01
-- Purpose: Prevent users from bypassing plan limits via client-side manipulation
-- ============================================================================

-- ── 1. CHECK constraints on plan/tier columns ──────────────────────────

-- Subscriptions: only valid plan values allowed
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check 
  CHECK (plan IN ('free', 'starter', 'pro', 'agency'));

-- Profiles: only valid tier values allowed
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_tier_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_tier_check 
  CHECK (tier IN ('free', 'starter', 'pro', 'agency'));

-- ── 2. Subscriptions RLS policies ──────────────────────────────────────
-- Previous state: only a SELECT policy existed. Users could INSERT/UPDATE
-- any plan value (e.g., set plan='pro' without paying).

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own subscription" ON subscriptions;

-- SELECT: users can only read their own subscription
CREATE POLICY "sub_select_own" 
  ON subscriptions FOR SELECT 
  USING (auth.uid() = user_id);

-- INSERT: users can only create a FREE subscription for themselves
-- Paid plans are set by Razorpay webhook (uses service_role, bypasses RLS)
CREATE POLICY "sub_insert_free_only" 
  ON subscriptions FOR INSERT 
  WITH CHECK (
    auth.uid() = user_id 
    AND plan = 'free' 
    AND status = 'active'
  );

-- UPDATE: users can only downgrade themselves to free
-- Upgrades go through Razorpay webhook (service_role)
CREATE POLICY "sub_update_free_only" 
  ON subscriptions FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND plan = 'free'
  );

-- DELETE: deny all client-side deletes
CREATE POLICY "sub_no_delete" 
  ON subscriptions FOR DELETE 
  USING (false);

-- ── 3. Profiles tier protection trigger ────────────────────────────────
-- Prevents client-side modification of tier, tier_expires_at, suspended_at.
-- Only service_role (webhooks, admin) can change these columns.

CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- If the current role is NOT the service_role (i.e., it's a client request),
  -- prevent changes to sensitive columns by reverting them to OLD values
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    NEW.tier := OLD.tier;
    NEW.tier_expires_at := OLD.tier_expires_at;
    NEW.suspended_at := OLD.suspended_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profile_tier ON profiles;
CREATE TRIGGER protect_profile_tier 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW 
  EXECUTE FUNCTION protect_profile_sensitive_columns();
