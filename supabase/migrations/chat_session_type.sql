-- Allow 'chat' as a document_type value in document_sessions.
-- This is a soft type — no CHECK constraint change needed since the column
-- is unconstrained TEXT. This migration documents the intent and adds an index.
CREATE INDEX IF NOT EXISTS idx_document_sessions_chat_type
  ON document_sessions(user_id, created_at DESC)
  WHERE document_type = 'chat';

COMMENT ON COLUMN document_sessions.document_type IS
  'Document type: invoice | contract | quotation | proposal | chat. '
  'chat = pre-document advisory conversation, never counts against quota.';
