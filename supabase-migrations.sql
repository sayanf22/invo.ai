-- ============================================================================
-- SECURITY ENHANCEMENTS MIGRATION
-- Adds tables and functions for cost protection, audit logging, and rate limiting
-- ============================================================================

-- ============================================================================
-- 1. USER USAGE TRACKING (Cost Protection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_usage (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: 'YYYY-MM'
    ai_requests_count INT NOT NULL DEFAULT 0,
    ai_tokens_used BIGINT NOT NULL DEFAULT 0,
    estimated_cost_usd DECIMAL(10,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, month)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_usage_month ON user_usage(month);
CREATE INDEX IF NOT EXISTS idx_user_usage_cost ON user_usage(estimated_cost_usd);

-- RLS Policies for user_usage
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own usage"
    ON user_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own usage"
    ON user_usage FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage"
    ON user_usage FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to increment user usage atomically
CREATE OR REPLACE FUNCTION increment_user_usage(
    p_user_id UUID,
    p_month TEXT,
    p_requests INT DEFAULT 1,
    p_tokens BIGINT DEFAULT 0,
    p_cost DECIMAL(10,4) DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO user_usage (user_id, month, ai_requests_count, ai_tokens_used, estimated_cost_usd)
    VALUES (p_user_id, p_month, p_requests, p_tokens, p_cost)
    ON CONFLICT (user_id, month)
    DO UPDATE SET
        ai_requests_count = user_usage.ai_requests_count + p_requests,
        ai_tokens_used = user_usage.ai_tokens_used + p_tokens,
        estimated_cost_usd = user_usage.estimated_cost_usd + p_cost,
        updated_at = NOW();
END;
$$;

-- ============================================================================
-- 2. AUDIT LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS Policies for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs"
    ON audit_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (true); -- Allow inserts from service role

-- ============================================================================
-- 3. RATE LIMITING (Enhanced)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address INET,
    category TEXT NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limit_user_category ON rate_limit_log(user_id, category, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_category ON rate_limit_log(ip_address, category, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_created_at ON rate_limit_log(created_at);

-- Function to check and record rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_user_id UUID,
    p_category TEXT,
    p_max_requests INT,
    p_window_seconds INT
)
RETURNS TABLE(
    allowed BOOLEAN,
    remaining INT,
    retry_after INT,
    error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INT;
    v_remaining INT;
BEGIN
    -- Calculate window start time
    v_window_start := NOW() - (p_window_seconds || ' seconds')::INTERVAL;
    
    -- Get current request count in this window
    SELECT COALESCE(SUM(request_count), 0)
    INTO v_current_count
    FROM rate_limit_log
    WHERE user_id = p_user_id
      AND category = p_category
      AND window_start >= v_window_start;
    
    -- Check if limit exceeded
    IF v_current_count >= p_max_requests THEN
        RETURN QUERY SELECT 
            FALSE,
            0,
            p_window_seconds,
            'Rate limit exceeded'::TEXT;
        RETURN;
    END IF;
    
    -- Record this request
    INSERT INTO rate_limit_log (user_id, category, request_count, window_start)
    VALUES (p_user_id, p_category, 1, NOW());
    
    -- Calculate remaining requests
    v_remaining := p_max_requests - v_current_count - 1;
    
    RETURN QUERY SELECT 
        TRUE,
        v_remaining,
        0,
        NULL::TEXT;
END;
$$;

-- Cleanup old rate limit logs (run periodically via cron)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM rate_limit_log
    WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- ============================================================================
-- 4. CSRF TOKEN STORAGE (Optional - for server-side validation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS csrf_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_user ON csrf_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at);

-- RLS Policies
ALTER TABLE csrf_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own CSRF tokens"
    ON csrf_tokens FOR ALL
    USING (auth.uid() = user_id);

-- Cleanup expired CSRF tokens
CREATE OR REPLACE FUNCTION cleanup_expired_csrf_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM csrf_tokens
    WHERE expires_at < NOW();
END;
$$;

-- ============================================================================
-- 5. SECURITY VIEWS (Read-only aggregated data)
-- ============================================================================

-- View: User usage summary
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT 
    u.user_id,
    u.month,
    u.ai_requests_count,
    u.ai_tokens_used,
    u.estimated_cost_usd,
    CASE 
        WHEN u.estimated_cost_usd >= 50 THEN 'exceeded'
        WHEN u.estimated_cost_usd >= 40 THEN 'warning'
        ELSE 'normal'
    END as status,
    u.updated_at
FROM user_usage u;

-- View: Recent audit activity
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT 
    a.id,
    a.user_id,
    a.action,
    a.resource_type,
    a.resource_id,
    a.created_at
FROM audit_logs a
WHERE a.created_at >= NOW() - INTERVAL '30 days'
ORDER BY a.created_at DESC;

-- ============================================================================
-- 6. TRIGGERS FOR AUTOMATIC CLEANUP
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_usage_updated_at
    BEFORE UPDATE ON user_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON user_usage TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON rate_limit_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON csrf_tokens TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION increment_user_usage TO authenticated;
GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_csrf_tokens TO service_role;

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_usage IS 'Tracks AI API usage and costs per user per month for cost protection';
COMMENT ON TABLE audit_logs IS 'Audit trail for all sensitive operations';
COMMENT ON TABLE rate_limit_log IS 'Rate limiting tracking for API endpoints';
COMMENT ON TABLE csrf_tokens IS 'CSRF token storage for additional security';

COMMENT ON FUNCTION increment_user_usage IS 'Atomically increments user usage counters';
COMMENT ON FUNCTION check_rate_limit IS 'Checks and records rate limit for a user/category';
COMMENT ON FUNCTION cleanup_old_rate_limits IS 'Removes rate limit logs older than 1 hour';
COMMENT ON FUNCTION cleanup_expired_csrf_tokens IS 'Removes expired CSRF tokens';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- To apply this migration:
-- 1. Connect to your Supabase project
-- 2. Go to SQL Editor
-- 3. Paste and run this entire script
-- 4. Verify tables were created: SELECT * FROM user_usage LIMIT 1;


-- ============================================================================
-- ONBOARDING SESSION PERSISTENCE (Auto-delete after 3 days)
-- ============================================================================

-- Create onboarding_sessions table for temporary storage
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    collected_data JSONB DEFAULT '{}'::jsonb,
    messages JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY "Users can manage their own onboarding sessions"
ON onboarding_sessions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Function to auto-delete old sessions (older than 3 days)
CREATE OR REPLACE FUNCTION cleanup_old_onboarding_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM onboarding_sessions
    WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_user_id ON onboarding_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_created_at ON onboarding_sessions(created_at);

-- Note: To run cleanup automatically, set up a cron job or call this function periodically:
-- SELECT cleanup_old_onboarding_sessions();


-- ============================================================================
-- AI PROMPTS AND CONFIGURATION STORAGE
-- Store all AI prompts, system messages, and configurations in database
-- ============================================================================

-- Table: AI System Prompts (for different document types)
CREATE TABLE IF NOT EXISTS ai_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL UNIQUE, -- 'invoice', 'contract', 'nda', 'agreement', 'onboarding'
    system_prompt TEXT NOT NULL,
    instructions TEXT,
    examples JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: AI Configuration (global AI settings)
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_key TEXT NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: Welcome Messages (for different document types)
CREATE TABLE IF NOT EXISTS welcome_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type TEXT NOT NULL UNIQUE,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_document_type ON ai_prompts(document_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_config_key ON ai_config(config_key);
CREATE INDEX IF NOT EXISTS idx_welcome_messages_type ON welcome_messages(document_type);

-- RLS Policies (read-only for authenticated users, admin can modify)
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read prompts
CREATE POLICY "Authenticated users can read AI prompts"
    ON ai_prompts FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read AI config"
    ON ai_config FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read welcome messages"
    ON welcome_messages FOR SELECT
    USING (auth.role() = 'authenticated');

-- Service role can modify (for admin updates)
CREATE POLICY "Service role can manage AI prompts"
    ON ai_prompts FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage AI config"
    ON ai_config FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage welcome messages"
    ON welcome_messages FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE TRIGGER update_ai_prompts_updated_at
    BEFORE UPDATE ON ai_prompts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_config_updated_at
    BEFORE UPDATE ON ai_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_welcome_messages_updated_at
    BEFORE UPDATE ON welcome_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Insert default AI prompts
-- ============================================================================

-- Invoice prompt
INSERT INTO ai_prompts (document_type, system_prompt, instructions) VALUES (
    'invoice',
    'You are an expert invoice assistant. Be intelligent, efficient, and professional.

CRITICAL RULES:
1. ALWAYS use the business profile data provided below for ALL "from" fields (fromName, fromEmail, fromAddress, etc.)
2. ONLY ask about CLIENT information (toName, toEmail, toAddress) and INVOICE DETAILS (services, amounts)
3. NEVER ask about business information - it''s already provided
4. Be smart - if user gives you enough info in one message, generate immediately
5. Don''t be repetitive - ask concise, focused questions

WHAT TO ASK:
- Client name and contact (email or address)
- What services/products are being invoiced
- Quantity and price/rate
- Any special terms or notes

WHAT NOT TO ASK:
- Your business name (already have it)
- Your email (already have it)
- Your address (already have it)
- Payment terms (use from business profile)
- Currency (use from business profile)

SMART GENERATION:
If user provides: "Invoice for [Client] for [Service] at [Amount]" - you have enough to generate!
Example: "Invoice for Acme Corp for web development, $2500" → Generate immediately',
    'TAX RULES (CRITICAL - READ CAREFULLY):
- DEFAULT: taxRate = 0 (NO TAX)
- ONLY add tax if:
  1. User explicitly says "add 18% GST" or "include tax" or similar
  2. OR country template specifically requires it
- If tax_ids in business profile is empty or null → taxRate MUST be 0
- If user says "no tax", "no GST", "tax-free" → taxRate MUST be 0
- taxLabel should be "Tax" (or country-specific like "GST", "VAT", "HST")
- NEVER assume tax should be added - always default to 0

EXAMPLES:
- User: "Invoice for $1000" → taxRate: 0 (no tax mentioned)
- User: "Invoice for $1000 with 18% GST" → taxRate: 18
- User: "Invoice for $1000, no tax" → taxRate: 0
- Business has no GST number → taxRate: 0

BE SMART:
- If user gives complete info in first message → generate immediately
- Don''t ask unnecessary questions
- Be concise and professional
- Generate as soon as you have: client name + service description + amount'
) ON CONFLICT (document_type) DO NOTHING;

-- Contract prompt
INSERT INTO ai_prompts (document_type, system_prompt, instructions) VALUES (
    'contract',
    'You are a professional contract assistant with expertise in contract law for 11 countries: India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands.

YOUR ROLE: Have a natural conversation to gather ALL necessary information before generating the contract.

CONVERSATION FLOW:
1. Ask about the type of contract (service agreement, employment, partnership, etc.)
2. Ask about the parties involved (names, roles, addresses)
3. Ask about the scope of work or services
4. Ask about compensation and payment terms
5. Ask about duration (start date, end date, or ongoing)
6. Ask about any special terms or conditions
7. Only generate when you have complete information',
    'REQUIRED INFORMATION:
- Contract type and purpose
- Party A and Party B details (names, addresses)
- Scope of work/services
- Compensation/payment terms
- Duration (start date, end date)
- Key terms and conditions

CONVERSATION STYLE:
- Professional and clear
- Ask focused questions
- Confirm understanding
- Only generate when user confirms readiness'
) ON CONFLICT (document_type) DO NOTHING;

-- NDA prompt
INSERT INTO ai_prompts (document_type, system_prompt, instructions) VALUES (
    'nda',
    'You are a professional NDA assistant with expertise in confidentiality agreements for 11 countries: India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands.

YOUR ROLE: Have a natural conversation to gather ALL necessary information before generating the NDA.

CONVERSATION FLOW:
1. Ask if it''s mutual or one-way NDA
2. Ask about the parties involved (names, companies, addresses)
3. Ask about the purpose of disclosure
4. Ask about duration of confidentiality (1 year, 2 years, 5 years, etc.)
5. Ask about any exclusions or special terms
6. Only generate when you have complete information',
    'REQUIRED INFORMATION:
- NDA type (mutual or one-way)
- Disclosing party details
- Receiving party details
- Purpose of disclosure
- Duration of confidentiality
- Any special terms

CONVERSATION STYLE:
- Professional and clear
- Explain legal concepts simply
- Ask focused questions
- Only generate when user confirms readiness'
) ON CONFLICT (document_type) DO NOTHING;

-- Agreement prompt
INSERT INTO ai_prompts (document_type, system_prompt, instructions) VALUES (
    'agreement',
    'You are a professional legal document assistant with expertise in agreements for 11 countries: India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands.

YOUR ROLE: Have a natural conversation to gather ALL necessary information before generating the agreement.

CONVERSATION FLOW:
1. Ask about the type of agreement
2. Ask about the parties involved
3. Ask about the purpose and terms
4. Ask about duration and conditions
5. Ask about any special clauses
6. Only generate when you have complete information',
    'REQUIRED INFORMATION:
- Agreement type and purpose
- Parties involved (names, addresses)
- Key terms and conditions
- Duration and effective date
- Special clauses or requirements

CONVERSATION STYLE:
- Professional and helpful
- Ask clear questions
- Confirm understanding
- Only generate when user confirms readiness'
) ON CONFLICT (document_type) DO NOTHING;

-- ============================================================================
-- SEED DATA: Insert welcome messages
-- ============================================================================

INSERT INTO welcome_messages (document_type, message) VALUES
('invoice', 'Hi! I''ll help you create an invoice. Just tell me:
• Client name
• What you''re invoicing for
• Amount

Example: "Invoice for Acme Corp for web development, $2,500"'),
('contract', 'Hi! I''ll help you create a contract. Tell me:
• Type of contract (service agreement, employment, etc.)
• Parties involved
• Key terms'),
('nda', 'Hi! I''ll help you create an NDA. Tell me:
• Is it mutual or one-way?
• Parties involved
• Purpose of disclosure'),
('agreement', 'Hi! I''ll help you create an agreement. Tell me:
• Type of agreement
• Parties involved
• Purpose and key terms')
ON CONFLICT (document_type) DO NOTHING;

-- ============================================================================
-- SEED DATA: Insert AI configuration
-- ============================================================================

INSERT INTO ai_config (config_key, config_value, description) VALUES
('deepseek_model', '{"model": "deepseek-chat", "temperature": 0.3, "max_tokens": 4000}'::jsonb, 'DeepSeek AI model configuration'),
('tax_default_rate', '{"rate": 0, "label": "Tax"}'::jsonb, 'Default tax rate (0 = no tax)'),
('supported_countries', '["IN", "US", "GB", "DE", "CA", "AU", "SG", "AE", "PH", "FR", "NL"]'::jsonb, 'List of supported country codes'),
('default_currency', '{"currency": "USD", "symbol": "$"}'::jsonb, 'Default currency settings'),
('payment_terms_options', '["Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90"]'::jsonb, 'Available payment terms')
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get active prompt for document type
CREATE OR REPLACE FUNCTION get_ai_prompt(p_document_type TEXT)
RETURNS TABLE(
    system_prompt TEXT,
    instructions TEXT,
    examples JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
    RETURN QUERY
    SELECT 
        ap.system_prompt,
        ap.instructions,
        ap.examples
    FROM ai_prompts ap
    WHERE ap.document_type = p_document_type
      AND ap.is_active = true
    LIMIT 1;
END;
$;

-- Function to get welcome message
CREATE OR REPLACE FUNCTION get_welcome_message(p_document_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    v_message TEXT;
BEGIN
    SELECT message INTO v_message
    FROM welcome_messages
    WHERE document_type = p_document_type
      AND is_active = true
    LIMIT 1;
    
    RETURN COALESCE(v_message, 'Hi! How can I help you today?');
END;
$;

-- Function to get AI config value
CREATE OR REPLACE FUNCTION get_ai_config(p_config_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    v_value JSONB;
BEGIN
    SELECT config_value INTO v_value
    FROM ai_config
    WHERE config_key = p_config_key
      AND is_active = true
    LIMIT 1;
    
    RETURN v_value;
END;
$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_ai_prompt TO authenticated;
GRANT EXECUTE ON FUNCTION get_welcome_message TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_config TO authenticated;

-- Comments
COMMENT ON TABLE ai_prompts IS 'Stores AI system prompts for different document types';
COMMENT ON TABLE ai_config IS 'Stores global AI configuration settings';
COMMENT ON TABLE welcome_messages IS 'Stores welcome messages for different document types';
COMMENT ON FUNCTION get_ai_prompt IS 'Retrieves active AI prompt for a document type';
COMMENT ON FUNCTION get_welcome_message IS 'Retrieves welcome message for a document type';
COMMENT ON FUNCTION get_ai_config IS 'Retrieves AI configuration value by key';

-- ============================================================================
-- AI PROMPTS MIGRATION COMPLETE
-- ============================================================================
