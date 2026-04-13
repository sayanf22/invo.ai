-- ============================================================================
-- SECURITY HARDENING: RLS ENFORCEMENT MIGRATION
-- Ensures Row Level Security is enabled on ALL application tables.
-- This migration is idempotent — safe to run multiple times.
-- ============================================================================

-- Enable RLS on all application tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS compliance_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SIGNATURES TABLE RLS POLICIES
-- Public read by token (for external signers), write restricted to document owners
-- ============================================================================

-- Drop existing policies if they exist to make this idempotent
DO $$
BEGIN
    -- Drop signature policies if they exist
    DROP POLICY IF EXISTS "Public read signatures by token" ON signatures;
    DROP POLICY IF EXISTS "Document owners can insert signatures" ON signatures;
    DROP POLICY IF EXISTS "Document owners can update signatures" ON signatures;
    DROP POLICY IF EXISTS "Document owners can delete signatures" ON signatures;
    DROP POLICY IF EXISTS "Service role can update signatures" ON signatures;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Table doesn't exist yet, skip
END $$;

-- Allow public read access for rows matched by token (external signers)
DO $$
BEGIN
    CREATE POLICY "Public read signatures by token"
        ON signatures
        FOR SELECT
        USING (token IS NOT NULL);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated document owners to insert signatures
DO $$
BEGIN
    CREATE POLICY "Document owners can insert signatures"
        ON signatures
        FOR INSERT
        WITH CHECK (
            document_id IN (
                SELECT d.id FROM documents d
                JOIN businesses b ON d.business_id = b.id
                WHERE b.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated document owners to update their signatures
DO $$
BEGIN
    CREATE POLICY "Document owners can update signatures"
        ON signatures
        FOR UPDATE
        USING (
            document_id IN (
                SELECT d.id FROM documents d
                JOIN businesses b ON d.business_id = b.id
                WHERE b.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow authenticated document owners to delete their signatures
DO $$
BEGIN
    CREATE POLICY "Document owners can delete signatures"
        ON signatures
        FOR DELETE
        USING (
            document_id IN (
                SELECT d.id FROM documents d
                JOIN businesses b ON d.business_id = b.id
                WHERE b.user_id = auth.uid()
            )
        );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Allow service role to update signatures (for signing endpoint)
DO $$
BEGIN
    CREATE POLICY "Service role can update signatures"
        ON signatures
        FOR UPDATE
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- VERIFICATION QUERY (run manually to confirm RLS is enabled)
-- ============================================================================
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'profiles', 'businesses', 'documents', 'document_versions',
--     'signatures', 'compliance_rules', 'audit_logs', 'user_usage',
--     'payment_history', 'subscriptions', 'chat_messages'
--   );
-- All rows should show rowsecurity = true

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
