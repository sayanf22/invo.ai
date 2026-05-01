-- ============================================================================
-- ONBOARDING SUPPORT TRACKING MIGRATION
-- Creates the onboarding_progress table for server-side onboarding state
-- tracking and extends support_messages with onboarding context columns.
-- ============================================================================

-- ============================================================================
-- 1. ONBOARDING PROGRESS TABLE
-- ============================================================================

CREATE TABLE onboarding_progress (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    current_phase       TEXT NOT NULL DEFAULT 'upload'
        CHECK (current_phase IN ('upload', 'chat', 'logo', 'payments', 'completed')),
    used_extraction     BOOLEAN NOT NULL DEFAULT false,
    fields_completed    INTEGER NOT NULL DEFAULT 0
        CHECK (fields_completed >= 0 AND fields_completed <= 12),
    upload_started_at   TIMESTAMPTZ,
    chat_started_at     TIMESTAMPTZ,
    logo_started_at     TIMESTAMPTZ,
    payments_started_at TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for admin filtering and lookups
CREATE INDEX idx_onboarding_progress_user_id       ON onboarding_progress(user_id);
CREATE INDEX idx_onboarding_progress_current_phase  ON onboarding_progress(current_phase);
CREATE INDEX idx_onboarding_progress_updated_at     ON onboarding_progress(updated_at DESC);

-- Auto-update updated_at on row changes
CREATE TRIGGER onboarding_progress_updated_at
    BEFORE UPDATE ON onboarding_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Deny-all RLS policy (service role bypasses RLS for admin/API routes)
CREATE POLICY "deny_all_onboarding_progress"
    ON onboarding_progress FOR ALL TO anon, authenticated USING (false);

-- ============================================================================
-- 2. EXTEND SUPPORT MESSAGES WITH ONBOARDING CONTEXT
-- ============================================================================

-- Add onboarding_phase column to tag messages with the phase they were sent from
ALTER TABLE support_messages
    ADD COLUMN IF NOT EXISTS onboarding_phase TEXT
        CHECK (onboarding_phase IN ('upload', 'chat', 'logo', 'payments') OR onboarding_phase IS NULL);

-- Add metadata column for additional context (fields completed, email, etc.)
ALTER TABLE support_messages
    ADD COLUMN IF NOT EXISTS metadata JSONB;
