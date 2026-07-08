-- ============================================================================
-- Client-fillable onboarding forms (tokenized public link, like signatures).
--
-- The business generates an onboarding form document, then sends the client a
-- unique link (/onboard/<token>). The client fills it in the browser with NO
-- login on any device; every change autosaves (survives browser close); files
-- (logo / brand assets) upload to Cloudflare R2 immediately. On submit the
-- answers become immutable — not editable from the server side — while the
-- client can still view their submission. The owner has READ-ONLY access.
--
-- Client (public) writes go through a service-role API keyed by the token, so
-- RLS only needs owner read/manage policies. Additive only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS onboarding_forms (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id     uuid REFERENCES document_sessions(id) ON DELETE SET NULL,
  token          text NOT NULL UNIQUE,          -- onb_ + 32 hex
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'in_progress', 'submitted', 'expired')),
  -- Whether the client may upload files (logo/brand assets/colors). Snapshot of
  -- the owner's Pro+ entitlement at send time so downgrades don't retro-break links.
  allow_uploads  boolean NOT NULL DEFAULT false,
  -- Snapshot of the questions/sections the client fills:
  -- [{ id, type, label, required, placeholder?, options?, section?, accept?, multiple? }]
  fields         jsonb NOT NULL DEFAULT '[]'::jsonb,
  title          text,
  client_name    text,
  client_email   text,
  -- Autosaved partial answers (survives browser close). { fieldId: value }
  draft_answers  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Final immutable answers, set once on submit.
  answers        jsonb,
  submitted_at   timestamptz,
  expires_at     timestamptz,
  ip_address     text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_forms_user_id_idx    ON onboarding_forms(user_id);
CREATE INDEX IF NOT EXISTS onboarding_forms_session_id_idx ON onboarding_forms(session_id);
CREATE INDEX IF NOT EXISTS onboarding_forms_token_idx      ON onboarding_forms(token);

CREATE TABLE IF NOT EXISTS onboarding_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id      uuid NOT NULL REFERENCES onboarding_forms(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_id     text NOT NULL,
  file_key     text NOT NULL,          -- R2 object key
  file_name    text NOT NULL,
  mime_type    text NOT NULL,
  file_size    integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onboarding_files_form_id_idx ON onboarding_files(form_id);
CREATE INDEX IF NOT EXISTS onboarding_files_user_id_idx ON onboarding_files(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS onboarding_forms_updated_at ON onboarding_forms;
CREATE TRIGGER onboarding_forms_updated_at
  BEFORE UPDATE ON onboarding_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE onboarding_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding_forms_select_own" ON onboarding_forms;
CREATE POLICY "onboarding_forms_select_own" ON onboarding_forms
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_forms_delete_own" ON onboarding_forms;
CREATE POLICY "onboarding_forms_delete_own" ON onboarding_forms
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_files_select_own" ON onboarding_files;
CREATE POLICY "onboarding_files_select_own" ON onboarding_files
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "onboarding_files_delete_own" ON onboarding_files;
CREATE POLICY "onboarding_files_delete_own" ON onboarding_files
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
