-- Add the new "estimate" document type (and the previously-missing
-- "recurring_invoice") to the document_type CHECK constraints so sending and
-- scheduling emails for these types succeeds. document_sessions.document_type
-- is plain TEXT (no constraint), so no change is needed there.
--
-- Applied to project tdeqauhtobtahncglqwq via Supabase MCP on 2026-07-20.

ALTER TABLE public.document_emails
  DROP CONSTRAINT IF EXISTS document_emails_document_type_check;
ALTER TABLE public.document_emails
  ADD CONSTRAINT document_emails_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'invoice','contract','quote','quotation','estimate','proposal',
    'sow','change_order','nda','client_onboarding_form','payment_followup','recurring_invoice'
  ]));

ALTER TABLE public.email_schedules
  DROP CONSTRAINT IF EXISTS email_schedules_document_type_check;
ALTER TABLE public.email_schedules
  ADD CONSTRAINT email_schedules_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'invoice','contract','quote','quotation','estimate','proposal',
    'sow','change_order','nda','client_onboarding_form','payment_followup','recurring_invoice'
  ]));
