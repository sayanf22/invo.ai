-- ============================================================================
-- EMAIL SENDING TIER LIMITS
-- Adds emails_count to user_usage and an atomic increment function
--
-- Tier limits:
--   free    →   5 emails/month  (1:1 with doc limit)
--   starter →  75 emails/month  (1.5× doc limit, allows resends)
--   pro     → 300 emails/month  (2× doc limit, comfortable for follow-ups)
--   agency  → unlimited
-- ============================================================================

-- 1. Add emails_count column to user_usage
ALTER TABLE user_usage
  ADD COLUMN IF NOT EXISTS emails_count INT NOT NULL DEFAULT 0;

-- 2. Atomic increment function for email count
CREATE OR REPLACE FUNCTION increment_email_count(
  p_user_id UUID,
  p_month   TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_usage (user_id, month, emails_count)
  VALUES (p_user_id, p_month, 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET
    emails_count = user_usage.emails_count + 1,
    updated_at   = NOW();
END;
$$;

-- 3. Grant execute to authenticated users (SECURITY DEFINER handles the write)
GRANT EXECUTE ON FUNCTION increment_email_count(UUID, TEXT) TO authenticated;
