-- ============================================================================
-- EMAIL SCHEDULES — Scheduled follow-up reminders for unpaid invoices
-- Industry standard sequence (FreshBooks/Stripe/invoicemojo.com):
--   Day +3:  First overdue reminder (polite)
--   Day +7:  Second reminder (firmer)
--   Day +14: Third reminder (urgent)
--   Day +30: Final notice
-- Stop conditions: paid, bounced, user_cancelled, max_reached
-- Tier limits: free=0, starter=2, pro=4, agency=4 follow-ups
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS email_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id        UUID NOT NULL REFERENCES document_sessions(id) ON DELETE CASCADE,
  recipient_email   TEXT NOT NULL,
  document_type     TEXT NOT NULL CHECK (document_type IN ('invoice', 'contract', 'quotation', 'proposal')),
  subject           TEXT,
  scheduled_for     TIMESTAMPTZ NOT NULL,
  sequence_step     INT NOT NULL DEFAULT 1,
  sequence_type     TEXT NOT NULL DEFAULT 'followup'
                    CHECK (sequence_type IN ('pre_due', 'due_today', 'followup', 'final')),
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'cancelled', 'failed', 'skipped')),
  cancelled_reason  TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_schedules_user_id     ON email_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_email_schedules_session_id  ON email_schedules(session_id);
CREATE INDEX IF NOT EXISTS idx_email_schedules_scheduled   ON email_schedules(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_schedules_status      ON email_schedules(status);

ALTER TABLE email_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own schedules"
  ON email_schedules FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedules"
  ON email_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules"
  ON email_schedules FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION cancel_email_schedules(
  p_session_id UUID,
  p_reason     TEXT DEFAULT 'user_cancelled'
)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cancelled_count INT;
BEGIN
  UPDATE email_schedules
  SET status = 'cancelled', cancelled_reason = p_reason, updated_at = NOW()
  WHERE session_id = p_session_id AND status = 'pending';
  GET DIAGNOSTICS cancelled_count = ROW_COUNT;
  RETURN cancelled_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_email_schedules(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_email_schedules(UUID, TEXT) TO service_role;

-- Daily cron at 8 AM UTC
SELECT cron.schedule(
  'process-email-schedules',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://tdeqauhtobtahncglqwq.supabase.co/functions/v1/process-email-schedules',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZXFhdWh0b2J0YWhuY2dscXdxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDM4ODA5MywiZXhwIjoyMDg1OTY0MDkzfQ.4BF86eizIXPdh1IM1dJ6UwnPi0FYNNy3kS0JygHE4Bw'),
    body := '{}'::jsonb
  );
  $$
);
