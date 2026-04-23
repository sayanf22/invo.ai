-- Document Emails Migration
-- Stores email delivery records for documents sent via Mailtrap

CREATE TABLE document_emails (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id          UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  recipient_email     TEXT NOT NULL,
  document_type       TEXT NOT NULL CHECK (document_type IN ('invoice', 'contract', 'quotation', 'proposal')),
  personal_message    TEXT,
  mailtrap_message_id TEXT,
  status              TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('sent', 'delivered', 'opened', 'bounced', 'failed')),
  subject             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at        TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  bounced_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX idx_document_emails_user_id    ON document_emails(user_id);
CREATE INDEX idx_document_emails_session_id ON document_emails(session_id);
CREATE INDEX idx_document_emails_mailtrap_id ON document_emails(mailtrap_message_id)
  WHERE mailtrap_message_id IS NOT NULL;
CREATE INDEX idx_document_emails_status     ON document_emails(status);

-- Enable Row Level Security
ALTER TABLE document_emails ENABLE ROW LEVEL SECURITY;

-- Users can read their own email records
CREATE POLICY "Users can read own emails"
  ON document_emails FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own email records (via authenticated API)
CREATE POLICY "Users can insert own emails"
  ON document_emails FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Webhook handler uses Supabase service role for updates (bypasses RLS)
-- No UPDATE policy needed for regular users
