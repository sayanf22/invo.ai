-- Admin Dashboard Migration
-- Creates all tables, columns, indexes, and RLS policies required by the admin dashboard.

-- Admin sessions (tracks active admin logins)
CREATE TABLE admin_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email        TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  ip_address         INET
);
CREATE INDEX idx_admin_sessions_token_hash ON admin_sessions(session_token_hash);

-- Admin tier overrides (manual tier changes)
CREATE TABLE admin_tier_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier        TEXT NOT NULL,
  expires_at  TIMESTAMPTZ,
  reason      TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_admin_tier_overrides_user_id ON admin_tier_overrides(user_id);

-- System announcements (broadcast banners)
CREATE TABLE system_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT NOT NULL,
  active     BOOLEAN DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- IP blocklist
CREATE TABLE ip_blocklist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address INET NOT NULL UNIQUE,
  reason     TEXT,
  blocked_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Admin config (stores PIN hash and other admin settings)
CREATE TABLE admin_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- New columns on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tier           TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Enable Row Level Security on all new tables
ALTER TABLE admin_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tier_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_blocklist         ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_config         ENABLE ROW LEVEL SECURITY;

-- Deny-all RLS policies (service role bypasses RLS for admin API routes)
CREATE POLICY "deny_all_admin_sessions"  ON admin_sessions       FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_tier_overrides"  ON admin_tier_overrides FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_announcements"   ON system_announcements FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_ip_blocklist"    ON ip_blocklist         FOR ALL TO anon, authenticated USING (false);
CREATE POLICY "deny_all_admin_config"    ON admin_config         FOR ALL TO anon, authenticated USING (false);
