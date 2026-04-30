-- ============================================================================
-- SUPPORT MESSAGES & ERROR LOGS
-- Adds tables for tracking user feedback and application errors
-- ============================================================================

-- ============================================================================
-- 1. SUPPORT MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_status ON support_messages(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(created_at DESC);

-- Enable RLS
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can insert their own messages
CREATE POLICY "Users can insert their own support messages"
    ON support_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can view their own messages
CREATE POLICY "Users can view their own support messages"
    ON support_messages FOR SELECT
    USING (auth.uid() = user_id);

-- Service role / admins can manage all
CREATE POLICY "Service role can manage support messages"
    ON support_messages FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================================
-- 2. ERROR LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    error_context TEXT NOT NULL, -- e.g., 'onboarding', 'document_generation'
    error_message TEXT NOT NULL,
    metadata JSONB,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_context ON error_logs(error_context);
CREATE INDEX IF NOT EXISTS idx_error_logs_status ON error_logs(status);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

-- Enable RLS
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone (even unauthenticated) can insert an error log to ensure capture before login
CREATE POLICY "Anyone can insert error logs"
    ON error_logs FOR INSERT
    WITH CHECK (true);

-- Users can view their own error logs (optional, but good for debugging)
CREATE POLICY "Users can view their own error logs"
    ON error_logs FOR SELECT
    USING (auth.uid() = user_id);

-- Service role / admins can manage all
CREATE POLICY "Service role can manage error logs"
    ON error_logs FOR ALL
    USING (auth.role() = 'service_role');


-- ============================================================================
-- 3. TRIGGERS
-- ============================================================================

CREATE TRIGGER update_support_messages_updated_at
    BEFORE UPDATE ON support_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_error_logs_updated_at
    BEFORE UPDATE ON error_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
