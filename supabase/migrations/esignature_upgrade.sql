-- ============================================================================
-- E-SIGNATURE UPGRADE MIGRATION
-- Adds new columns to signatures, creates signature_audit_events and
-- quotation_responses tables, and applies RLS policies.
-- Requirements: 2.6, 2.7, 2.8, 8.3, 10.8, 10.9
-- ============================================================================

-- ============================================================================
-- 1. ADD NEW COLUMNS TO signatures TABLE
-- ============================================================================

-- document_hash already exists per database.types.ts; skip it.
-- Add the remaining new columns.

ALTER TABLE signatures
  ADD COLUMN IF NOT EXISTS attempt_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_url TEXT,
  ADD COLUMN IF NOT EXISTS session_id       UUID REFERENCES document_sessions(id);

-- Index for session-based lookups
CREATE INDEX IF NOT EXISTS idx_signatures_session_id ON signatures(session_id);

-- ============================================================================
-- 2. CREATE signature_audit_events TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS signature_audit_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID        REFERENCES signatures(id) ON DELETE RESTRICT,
  document_id  UUID        REFERENCES documents(id) ON DELETE RESTRICT,
  session_id   UUID        REFERENCES document_sessions(id) ON DELETE RESTRICT,
  action       TEXT        NOT NULL,
  actor_email  TEXT,
  ip_address   TEXT,
  user_agent   TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_sig_audit_signature_id ON signature_audit_events(signature_id);
CREATE INDEX IF NOT EXISTS idx_sig_audit_session_id   ON signature_audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_sig_audit_action        ON signature_audit_events(action);
CREATE INDEX IF NOT EXISTS idx_sig_audit_created_at    ON signature_audit_events(created_at DESC);

-- ============================================================================
-- 3. CREATE quotation_responses TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS quotation_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  response_type TEXT        NOT NULL CHECK (response_type IN ('accepted', 'declined', 'changes_requested')),
  client_name   TEXT        NOT NULL,
  client_email  TEXT        NOT NULL,
  reason        TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  responded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_quotation_responses_session_id ON quotation_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_quotation_responses_created_at ON quotation_responses(created_at DESC);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE signature_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_responses     ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES FOR signature_audit_events
-- ============================================================================

-- INSERT: service_role only (all public signing endpoints use service role)
CREATE POLICY "audit_events_insert_service_only"
  ON signature_audit_events
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- SELECT: document owner only (via session_id → document_sessions.user_id)
CREATE POLICY "audit_events_select_owner"
  ON signature_audit_events
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM document_sessions WHERE user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies — append-only by design (denied by default)

-- ============================================================================
-- 6. RLS POLICIES FOR quotation_responses
-- ============================================================================

-- INSERT: anon and authenticated users, but only for quotation-type sessions
CREATE POLICY "quotation_responses_insert_public"
  ON quotation_responses
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    session_id IN (
      SELECT id FROM document_sessions WHERE document_type = 'quotation'
    )
  );

-- SELECT: document owner only (via session_id → document_sessions.user_id)
CREATE POLICY "quotation_responses_select_owner"
  ON quotation_responses
  FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM document_sessions WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE signature_audit_events IS 'Append-only audit trail for all e-signature lifecycle events';
COMMENT ON TABLE quotation_responses     IS 'Client responses (accept/decline/changes) to quotation documents';

COMMENT ON COLUMN signatures.attempt_count    IS 'Number of signature submission attempts; capped at 5 before token is invalidated';
COMMENT ON COLUMN signatures.verification_url IS 'Public URL for verifying this signature: https://clorefy.com/verify/[id]';
COMMENT ON COLUMN signatures.session_id       IS 'FK to document_sessions; preferred over document_id for new signing requests';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
