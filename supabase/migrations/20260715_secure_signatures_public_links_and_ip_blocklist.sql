-- Prepared 2026-07-15. Review before applying to production.
-- Secures public document capabilities, signing tokens, signature RLS,
-- IP blocklist checks, and payment-gateway verification evidence.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- CREATE EXTENSION IF NOT EXISTS does not move an extension that was installed
-- previously in another schema. Normalize it before using schema-qualified calls.
DO $migration$
DECLARE
  v_pgcrypto_schema text;
BEGIN
  SELECT n.nspname INTO v_pgcrypto_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pgcrypto';

  IF v_pgcrypto_schema IS NULL THEN
    RAISE EXCEPTION 'pgcrypto extension is required';
  END IF;

  IF v_pgcrypto_schema <> 'extensions' THEN
    ALTER EXTENSION pgcrypto SET SCHEMA extensions;
  END IF;

  IF to_regprocedure('extensions.gen_random_bytes(integer)') IS NULL
     OR to_regprocedure('extensions.gen_random_uuid()') IS NULL
     OR to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'pgcrypto functions are not available in the extensions schema';
  END IF;
END
$migration$;

-- 256-bit recipient capability. Internal UUIDs remain owner-only identifiers.
ALTER TABLE public.document_sessions
  ADD COLUMN IF NOT EXISTS public_id text;

UPDATE public.document_sessions
SET public_id = encode(extensions.gen_random_bytes(32), 'hex')
WHERE public_id IS NULL;

ALTER TABLE public.document_sessions
  ALTER COLUMN public_id SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_sessions_public_id_key
  ON public.document_sessions (public_id);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_sessions_public_id_format_check'
      AND conrelid = 'public.document_sessions'::regclass
  ) THEN
    ALTER TABLE public.document_sessions
      ADD CONSTRAINT document_sessions_public_id_format_check
      CHECK (public_id ~ '^[0-9a-f]{64}$');
  END IF;
END
$migration$;

-- Store only SHA-256 signing-token hashes. Raw tokens leave the server once.
ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Legacy schemas declared token NOT NULL; raw tokens must be removable.
ALTER TABLE public.signatures
  ALTER COLUMN token DROP NOT NULL;

UPDATE public.signatures
SET token_hash = encode(extensions.digest(convert_to(token, 'UTF8'), 'sha256'), 'hex')
WHERE token IS NOT NULL AND token_hash IS NULL;

UPDATE public.signatures SET token = NULL WHERE token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS signatures_token_hash_key
  ON public.signatures (token_hash)
  WHERE token_hash IS NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'signatures_token_hash_format_check'
      AND conrelid = 'public.signatures'::regclass
  ) THEN
    ALTER TABLE public.signatures
      ADD CONSTRAINT signatures_token_hash_format_check
      CHECK (token_hash IS NULL OR token_hash ~ '^[0-9a-f]{64}$');
  END IF;
END
$migration$;

-- Explicit signing cohorts separate the current invitation generation from
-- historical cancelled, declined, revised, or superseded requests.
ALTER TABLE public.document_sessions
  ADD COLUMN IF NOT EXISTS active_signature_cohort_id uuid;

ALTER TABLE public.signatures
  ADD COLUMN IF NOT EXISTS signing_cohort_id uuid;

-- Preserve any currently active multi-signer envelope as one cohort. Historical
-- rows receive isolated cohorts so they can never block a replacement envelope.
WITH active_cohorts AS (
  SELECT ds.id AS session_id, extensions.gen_random_uuid() AS cohort_id
  FROM public.document_sessions ds
  WHERE ds.status = 'finalized'
    AND EXISTS (
      SELECT 1 FROM public.signatures s
      WHERE s.session_id = ds.id AND s.signer_action IS NULL
    )
)
UPDATE public.document_sessions ds
SET active_signature_cohort_id = active.cohort_id
FROM active_cohorts active
WHERE ds.id = active.session_id
  AND ds.active_signature_cohort_id IS NULL;

UPDATE public.signatures s
SET signing_cohort_id = ds.active_signature_cohort_id
FROM public.document_sessions ds
WHERE s.session_id = ds.id
  AND s.signing_cohort_id IS NULL
  AND s.signer_action IS NULL
  AND ds.active_signature_cohort_id IS NOT NULL;

UPDATE public.signatures
SET signing_cohort_id = extensions.gen_random_uuid()
WHERE signing_cohort_id IS NULL;

ALTER TABLE public.signatures
  ALTER COLUMN signing_cohort_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS signatures_session_cohort_idx
  ON public.signatures (session_id, signing_cohort_id);

-- Remove every historical token-based/public policy, then recreate owner-only RLS.
DO $migration$
DECLARE policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'signatures'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.signatures', policy_row.policyname);
  END LOOP;
END
$migration$;

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY signatures_owner_select ON public.signatures
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.businesses b ON b.id = d.business_id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY signatures_owner_insert ON public.signatures
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.businesses b ON b.id = d.business_id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY signatures_owner_update ON public.signatures
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.businesses b ON b.id = d.business_id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.businesses b ON b.id = d.business_id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    )
  );

CREATE POLICY signatures_owner_delete ON public.signatures
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.document_sessions ds
      WHERE ds.id = signatures.session_id AND ds.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.businesses b ON b.id = d.business_id
      WHERE d.id = signatures.document_id AND b.user_id = auth.uid()
    )
  );

-- Remove weak UUID-prefix resolvers and their public grants without assuming
-- either historical function exists on every deployment.
DO $migration$
BEGIN
  IF to_regprocedure('public.lookup_session_by_short_id(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.lookup_session_by_short_id(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP FUNCTION public.lookup_session_by_short_id(text)';
  END IF;
  IF to_regprocedure('public.lookup_session_id_by_short_id(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.lookup_session_id_by_short_id(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'DROP FUNCTION public.lookup_session_id_by_short_id(text)';
  END IF;
END
$migration$;

-- Public recipient access is capability-gated through server-side routes. The
-- legacy table policy exposed every finalized/paid/signed session to anon,
-- because RLS cannot require a caller to include a particular public_id filter.
DROP POLICY IF EXISTS "Public can look up session id for short link redirect"
  ON public.document_sessions;
REVOKE SELECT ON TABLE public.document_sessions FROM anon;

-- RLS-safe boolean blocklist check for edge middleware.
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip inet)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ip_blocklist
    WHERE ip_address = p_ip
      AND (expires_at IS NULL OR expires_at > now())
  );
$function$;

REVOKE ALL ON FUNCTION public.is_ip_blocked(inet) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(inet) TO anon, authenticated, service_role;

-- Persisted evidence for truthful gateway connection state.
ALTER TABLE public.user_payment_settings
  ADD COLUMN IF NOT EXISTS razorpay_credentials_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_local_webhook_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_provider_webhook_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_credentials_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_webhook_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashfree_credentials_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashfree_local_webhook_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cashfree_webhook_verified_at timestamptz;

-- Create the signing request and finalize its parent session under one lock.
-- Sending email remains external; rollback_unsent_signature_request safely
-- removes a request whose delivery failed and restores the locked snapshot only
-- when no concurrent request or owner transition has superseded it.
CREATE OR REPLACE FUNCTION public.create_signature_request(
  p_signature_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_document_id uuid,
  p_signer_email text,
  p_signer_name text,
  p_party text,
  p_token_hash text,
  p_created_at timestamptz,
  p_expires_at timestamptz,
  p_document_hash text,
  p_verification_url text,
  p_client_name text
)
RETURNS TABLE(
  outcome text,
  signature_id uuid,
  previous_status text,
  previous_sent_at timestamptz,
  previous_client_name text,
  previous_signature_cohort_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session public.document_sessions%ROWTYPE;
  v_cohort_id uuid;
BEGIN
  IF p_signature_id IS NULL OR p_user_id IS NULL OR p_session_id IS NULL
     OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_signer_email IS NULL OR btrim(p_signer_email) = ''
     OR p_signer_name IS NULL OR btrim(p_signer_name) = ''
     OR p_party IS NULL OR btrim(p_party) = ''
     OR p_created_at IS NULL OR p_expires_at IS NULL
     OR p_expires_at <= p_created_at
     OR p_document_hash IS NULL OR btrim(p_document_hash) = ''
     OR p_verification_url IS NULL OR btrim(p_verification_url) = '' THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::text,
      NULL::timestamptz, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  SELECT ds.* INTO v_session
  FROM public.document_sessions ds
  WHERE ds.id = p_session_id AND ds.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text,
      NULL::timestamptz, NULL::text, NULL::uuid;
    RETURN;
  END IF;
  IF v_session.status NOT IN ('active', 'finalized') THEN
    RETURN QUERY SELECT 'invalid_status'::text, NULL::uuid, v_session.status,
      v_session.sent_at, v_session.client_name, v_session.active_signature_cohort_id;
    RETURN;
  END IF;
  IF p_document_id IS DISTINCT FROM v_session.document_id THEN
    RETURN QUERY SELECT 'conflict'::text, NULL::uuid, v_session.status,
      v_session.sent_at, v_session.client_name, v_session.active_signature_cohort_id;
    RETURN;
  END IF;

  -- Additional signers sent while the document remains finalized join the same
  -- envelope. A resend after unlock/cancellation starts a fresh cohort.
  v_cohort_id := CASE
    WHEN v_session.status = 'finalized' AND v_session.active_signature_cohort_id IS NOT NULL
      THEN v_session.active_signature_cohort_id
    ELSE p_signature_id
  END;

  INSERT INTO public.signatures (
    id, document_id, signer_email, signer_name, party, token, token_hash,
    created_at, expires_at, document_hash, session_id, verification_url,
    signing_cohort_id
  ) VALUES (
    p_signature_id, p_document_id, btrim(p_signer_email), btrim(p_signer_name),
    btrim(p_party), NULL, p_token_hash, p_created_at, p_expires_at,
    p_document_hash, p_session_id, p_verification_url, v_cohort_id
  );

  UPDATE public.document_sessions
  SET status = 'finalized', sent_at = p_created_at,
      client_name = p_client_name, updated_at = p_created_at,
      active_signature_cohort_id = v_cohort_id
  WHERE id = p_session_id;

  RETURN QUERY SELECT 'created'::text, p_signature_id, v_session.status,
    v_session.sent_at, v_session.client_name, v_session.active_signature_cohort_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_signature_request(
  uuid, uuid, uuid, uuid, text, text, text, text, timestamptz,
  timestamptz, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_signature_request(
  uuid, uuid, uuid, uuid, text, text, text, text, timestamptz,
  timestamptz, text, text, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.rollback_unsent_signature_request(
  p_signature_id uuid,
  p_token_hash text,
  p_transitioned_at timestamptz,
  p_previous_status text,
  p_previous_sent_at timestamptz,
  p_previous_client_name text,
  p_previous_signature_cohort_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session_id uuid;
  v_request_cohort_id uuid;
BEGIN
  IF p_signature_id IS NULL OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_transitioned_at IS NULL OR p_previous_status IS NULL THEN
    RETURN false;
  END IF;

  SELECT s.session_id, s.signing_cohort_id
  INTO v_session_id, v_request_cohort_id
  FROM public.signatures s
  WHERE s.id = p_signature_id AND s.token_hash = p_token_hash
    AND s.signed_at IS NULL AND s.signer_action IS NULL;
  IF v_session_id IS NULL OR v_request_cohort_id IS NULL THEN RETURN false; END IF;

  PERFORM 1 FROM public.document_sessions ds
  WHERE ds.id = v_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  DELETE FROM public.signatures s
  WHERE s.id = p_signature_id AND s.token_hash = p_token_hash
    AND s.session_id = v_session_id
    AND s.signing_cohort_id = v_request_cohort_id
    AND s.signed_at IS NULL AND s.signer_action IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Restore the exact snapshot only if this request is still the latest parent
  -- transition. A concurrent request, owner action, or completion changes one of
  -- these guards and therefore wins without being overwritten.
  UPDATE public.document_sessions ds
  SET status = p_previous_status,
      sent_at = p_previous_sent_at,
      client_name = p_previous_client_name,
      active_signature_cohort_id = p_previous_signature_cohort_id,
      updated_at = now()
  WHERE ds.id = v_session_id
    AND ds.status = 'finalized'
    AND ds.sent_at = p_transitioned_at
    AND ds.active_signature_cohort_id = v_request_cohort_id;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.rollback_unsent_signature_request(
  uuid, text, timestamptz, text, timestamptz, text, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_unsent_signature_request(
  uuid, text, timestamptz, text, timestamptz, text, uuid
) TO service_role;

-- Atomically claim a signing attempt by token hash.
CREATE OR REPLACE FUNCTION public.claim_signature_attempt(p_token_hash text)
RETURNS TABLE(
  signature_id uuid,
  attempt_count integer,
  signed_at timestamptz,
  signer_action text,
  expires_at timestamptz,
  document_hash text,
  session_id uuid,
  verification_url text,
  document_id uuid,
  parent_status text,
  parent_sent_at timestamptz,
  parent_public_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN RETURN; END IF;

  RETURN QUERY
  UPDATE public.signatures s
  SET attempt_count = COALESCE(s.attempt_count, 0) + 1
  FROM public.document_sessions ds
  WHERE s.token_hash = p_token_hash
    AND ds.id = s.session_id
  RETURNING s.id, s.attempt_count, s.signed_at, s.signer_action,
    s.expires_at, s.document_hash, s.session_id, s.verification_url,
    s.document_id, ds.status, ds.sent_at, ds.public_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_signature_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signature_attempt(text) TO service_role;

-- Atomically record a recipient response while rechecking the parent session.
CREATE OR REPLACE FUNCTION public.respond_to_signature(
  p_token_hash text,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS TABLE(
  outcome text,
  signature_id uuid,
  signer_name text,
  signer_email text,
  session_id uuid,
  document_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_signature_id uuid;
  v_signer_name text;
  v_signer_email text;
  v_session_id uuid;
  v_document_id uuid;
  v_signature_cohort_id uuid;
  v_signed_at timestamptz;
  v_signer_action text;
  v_expires_at timestamptz;
  v_status text;
  v_active_cohort_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_action IS NULL OR p_action NOT IN ('declined', 'revision_requested') THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT s.id, s.signer_name, s.signer_email, s.session_id, s.document_id,
         s.signing_cohort_id, s.signed_at, s.signer_action, s.expires_at
  INTO v_signature_id, v_signer_name, v_signer_email, v_session_id, v_document_id,
       v_signature_cohort_id, v_signed_at, v_signer_action, v_expires_at
  FROM public.signatures s
  WHERE s.token_hash = p_token_hash;

  IF v_signature_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, NULL::text, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT ds.status, ds.active_signature_cohort_id
  INTO v_status, v_active_cohort_id
  FROM public.document_sessions ds WHERE ds.id = v_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_status IN ('signed', 'completed') OR v_signed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_signed'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_status IN ('active', 'cancelled') THEN
    RETURN QUERY SELECT 'parent_cancelled'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_status <> 'finalized' THEN
    RETURN QUERY SELECT 'conflict'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_active_cohort_id IS DISTINCT FROM v_signature_cohort_id THEN
    RETURN QUERY SELECT 'conflict'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_signer_action IS NOT NULL THEN
    RETURN QUERY SELECT 'already_responded'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.signatures s
  SET signer_action = p_action, signer_reason = NULLIF(btrim(p_reason), '')
  WHERE s.id = v_signature_id
    AND s.signing_cohort_id = v_active_cohort_id
    AND s.signed_at IS NULL
    AND s.signer_action IS NULL
    AND (s.expires_at IS NULL OR s.expires_at > now())
  RETURNING 'updated'::text, s.id, s.signer_name, s.signer_email, s.session_id, s.document_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'conflict'::text, v_signature_id, NULL::text, NULL::text, v_session_id, v_document_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.respond_to_signature(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_signature(text, text, text) TO service_role;

-- Complete signing and, under the same parent-row lock, transition a fully
-- signed session. This closes cancel/unlock and multi-signer races.
CREATE OR REPLACE FUNCTION public.complete_signature_signing(
  p_signature_id uuid,
  p_token_hash text,
  p_signature_image_url text,
  p_signed_at timestamptz,
  p_ip_address inet,
  p_user_agent text
)
RETURNS TABLE(
  outcome text,
  signature_id uuid,
  session_id uuid,
  document_id uuid,
  verification_url text,
  completed_session boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session_id uuid;
  v_document_id uuid;
  v_signature_cohort_id uuid;
  v_signed_at timestamptz;
  v_signer_action text;
  v_expires_at timestamptz;
  v_attempt_count integer;
  v_verification_url text;
  v_parent_status text;
  v_active_cohort_id uuid;
  v_all_signed boolean;
  v_completed boolean := false;
BEGIN
  IF p_signature_id IS NULL OR p_token_hash IS NULL
     OR p_token_hash !~ '^[0-9a-f]{64}$'
     OR p_signature_image_url IS NULL OR btrim(p_signature_image_url) = ''
     OR p_signed_at IS NULL OR p_user_agent IS NULL THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  SELECT s.session_id, s.document_id, s.signing_cohort_id, s.signed_at,
         s.signer_action, s.expires_at, coalesce(s.attempt_count, 0),
         s.verification_url
  INTO v_session_id, v_document_id, v_signature_cohort_id, v_signed_at,
       v_signer_action, v_expires_at, v_attempt_count, v_verification_url
  FROM public.signatures s
  WHERE s.id = p_signature_id AND s.token_hash = p_token_hash;
  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  SELECT ds.status, ds.active_signature_cohort_id,
         coalesce(v_document_id, ds.document_id)
  INTO v_parent_status, v_active_cohort_id, v_document_id
  FROM public.document_sessions ds WHERE ds.id = v_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_parent_status IN ('signed', 'completed') OR v_signed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_signed'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_parent_status IN ('active', 'cancelled') THEN
    RETURN QUERY SELECT 'parent_cancelled'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_parent_status <> 'finalized' THEN
    RETURN QUERY SELECT 'conflict'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_active_cohort_id IS DISTINCT FROM v_signature_cohort_id THEN
    RETURN QUERY SELECT 'stale_request'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_signer_action IS NOT NULL THEN
    RETURN QUERY SELECT 'already_responded'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;
  IF v_attempt_count NOT BETWEEN 1 AND 5 THEN
    RETURN QUERY SELECT 'attempts_exceeded'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;

  UPDATE public.signatures s
  SET signature_image_url = p_signature_image_url,
      signed_at = p_signed_at,
      ip_address = p_ip_address,
      user_agent = left(p_user_agent, 1000)
  WHERE s.id = p_signature_id
    AND s.token_hash = p_token_hash
    AND s.signing_cohort_id = v_active_cohort_id
    AND s.signed_at IS NULL
    AND s.signer_action IS NULL
    AND COALESCE(s.attempt_count, 0) BETWEEN 1 AND 5
    AND (s.expires_at IS NULL OR s.expires_at > now());

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'conflict'::text, p_signature_id, v_session_id,
      v_document_id, v_verification_url, false;
    RETURN;
  END IF;

  -- Every member of the active cohort must actually sign. A decline or revision
  -- remains unsigned and therefore prevents false envelope completion.
  SELECT NOT EXISTS (
    SELECT 1 FROM public.signatures pending
    WHERE pending.session_id = v_session_id
      AND pending.signing_cohort_id = v_active_cohort_id
      AND pending.signed_at IS NULL
  ) INTO v_all_signed;

  IF v_all_signed THEN
    UPDATE public.document_sessions
    SET status = 'signed', completed_at = COALESCE(completed_at, p_signed_at),
        updated_at = p_signed_at
    WHERE id = v_session_id AND status = 'finalized'
      AND active_signature_cohort_id = v_active_cohort_id;
    v_completed := FOUND;

    IF v_completed AND v_document_id IS NOT NULL THEN
      UPDATE public.documents SET status = 'signed' WHERE id = v_document_id;
    END IF;
  END IF;

  RETURN QUERY SELECT 'signed'::text, p_signature_id, v_session_id,
    v_document_id, v_verification_url, v_completed;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_signature_signing(uuid, text, text, timestamptz, inet, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_signature_signing(uuid, text, text, timestamptz, inet, text)
  TO service_role;

-- Cancel the current signing envelope under the same parent-row lock used by
-- signing. A completed signature in the active cohort is a permanent record and
-- prevents cancellation; otherwise every still-pending member is revoked and
-- the document becomes editable in one transaction.
CREATE OR REPLACE FUNCTION public.cancel_signature_request(
  p_signature_id uuid,
  p_user_id uuid,
  p_cancelled_at timestamptz
)
RETURNS TABLE(
  outcome text,
  signature_id uuid,
  session_id uuid,
  document_id uuid,
  signer_name text,
  cancelled_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session_id uuid;
  v_document_id uuid;
  v_signer_name text;
  v_signature_cohort_id uuid;
  v_signed_at timestamptz;
  v_signer_action text;
  v_parent_status text;
  v_active_cohort_id uuid;
  v_has_signed boolean;
  v_cancelled_count integer := 0;
BEGIN
  IF p_signature_id IS NULL OR p_user_id IS NULL OR p_cancelled_at IS NULL THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;

  SELECT s.session_id
  INTO v_session_id
  FROM public.signatures s
  WHERE s.id = p_signature_id;

  IF v_session_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;

  SELECT ds.status, ds.active_signature_cohort_id, ds.document_id
  INTO v_parent_status, v_active_cohort_id, v_document_id
  FROM public.document_sessions ds
  WHERE ds.id = v_session_id AND ds.user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;

  -- Re-read after taking the parent lock. Recipient responses and signing use
  -- the same lock, so their latest state is now stable for this transaction.
  SELECT coalesce(s.document_id, v_document_id), s.signer_name,
         s.signing_cohort_id, s.signed_at, s.signer_action
  INTO v_document_id, v_signer_name, v_signature_cohort_id,
       v_signed_at, v_signer_action
  FROM public.signatures s
  WHERE s.id = p_signature_id AND s.session_id = v_session_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::uuid,
      NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;
  IF v_parent_status IN ('signed', 'completed', 'paid') OR v_signed_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_signed'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;
  IF v_signature_cohort_id IS DISTINCT FROM v_active_cohort_id THEN
    RETURN QUERY SELECT 'stale_request'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;
  IF v_signer_action IS NOT NULL THEN
    RETURN QUERY SELECT 'already_responded'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;
  IF v_parent_status IN ('active', 'cancelled') THEN
    RETURN QUERY SELECT 'parent_cancelled'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;
  IF v_parent_status <> 'finalized' THEN
    RETURN QUERY SELECT 'conflict'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.signatures signed
    WHERE signed.session_id = v_session_id
      AND signed.signing_cohort_id = v_active_cohort_id
      AND signed.signed_at IS NOT NULL
  ) INTO v_has_signed;

  IF v_has_signed THEN
    RETURN QUERY SELECT 'cohort_partially_signed'::text, p_signature_id,
      v_session_id, v_document_id, v_signer_name, 0;
    RETURN;
  END IF;

  UPDATE public.signatures pending
  SET signer_action = 'cancelled'
  WHERE pending.session_id = v_session_id
    AND pending.signing_cohort_id = v_active_cohort_id
    AND pending.signed_at IS NULL
    AND pending.signer_action IS NULL;
  GET DIAGNOSTICS v_cancelled_count = ROW_COUNT;

  IF v_cancelled_count = 0 THEN
    RETURN QUERY SELECT 'conflict'::text, p_signature_id, v_session_id,
      v_document_id, v_signer_name, 0;
    RETURN;
  END IF;

  UPDATE public.document_sessions ds
  SET status = 'active', active_signature_cohort_id = NULL,
      updated_at = p_cancelled_at
  WHERE ds.id = v_session_id
    AND ds.status = 'finalized'
    AND ds.active_signature_cohort_id = v_active_cohort_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'signature parent changed while locked';
  END IF;

  RETURN QUERY SELECT 'cancelled'::text, p_signature_id, v_session_id,
    v_document_id, v_signer_name, v_cancelled_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_signature_request(uuid, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_signature_request(uuid, uuid, timestamptz)
  TO service_role;

-- Fix the mutable search_path warning on the known shared trigger function.
DO $migration$
BEGIN
  IF to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_catalog, public';
  END IF;
END
$migration$;

-- Aggregate the admin overview inside Postgres so the API never downloads
-- unbounded platform tables. Only the service role may execute this function.
CREATE OR REPLACE FUNCTION public.get_admin_overview_snapshot(
  p_period text,
  p_timezone text,
  p_now timestamptz,
  p_bounds_start timestamptz DEFAULT NULL,
  p_bounds_end timestamptz DEFAULT NULL,
  p_previous_start timestamptz DEFAULT NULL,
  p_previous_end timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_timezone text := coalesce(nullif(p_timezone, ''), 'UTC');
  v_today_start timestamptz := date_trunc('day', p_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
  v_week_start timestamptz := date_trunc('week', p_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
  v_month_start timestamptz := date_trunc('month', p_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
  v_year_start timestamptz := date_trunc('year', p_now AT TIME ZONE v_timezone) AT TIME ZONE v_timezone;
  v_today_end timestamptz;
  v_week_end timestamptz;
  v_month_end timestamptz;
  v_year_end timestamptz;
  v_six_month_start timestamptz;
  -- user_usage.month is a UTC calendar key (YYYY-MM) across all writers.
  -- Dashboard display timezone must not change which immutable usage bucket is read.
  v_current_month text := to_char(p_now AT TIME ZONE 'UTC', 'YYYY-MM');
  v_current_year text := to_char(p_now AT TIME ZONE 'UTC', 'YYYY');
  v_total_users bigint;
  v_signups_period bigint;
  v_signups_previous bigint;
  v_signups_today bigint;
  v_signups_week bigint;
  v_signups_month bigint;
  v_signups_year bigint;
  v_active_period bigint;
  v_dau bigint;
  v_wau bigint;
  v_mau bigint;
  v_free bigint;
  v_starter bigint;
  v_pro bigint;
  v_agency bigint;
  v_active_paid bigint;
  v_docs_period bigint;
  v_docs_previous bigint;
  v_docs_all bigint;
  v_docs_today bigint;
  v_docs_week bigint;
  v_docs_month bigint;
  v_docs_year bigint;
  v_messages_all bigint;
  v_messages_period bigint;
  v_messages_today bigint;
  v_messages_week bigint;
  v_messages_month bigint;
  v_emails_period bigint;
  v_emails_all bigint;
  v_emails_today bigint;
  v_emails_week bigint;
  v_emails_month bigint;
  v_emails_year bigint;
  v_emails_opened bigint;
  v_emails_delivered bigint;
  v_emails_bounced bigint;
  v_month_opened bigint;
  v_month_delivered bigint;
  v_month_bounced bigint;
  v_ai_requests bigint;
  v_ai_tokens bigint;
  v_ai_cost numeric;
  v_ai_cost_available boolean;
  v_month_ai_requests bigint;
  v_month_ai_tokens bigint;
  v_month_ai_cost numeric;
  v_tiers jsonb;
  v_doc_types jsonb;
  v_mrr jsonb;
  v_arr jsonb;
  v_signup_trend jsonb;
  v_document_trend jsonb;
  v_revenue_trend jsonb;
  v_recent_activity jsonb;
BEGIN
  IF p_period NOT IN ('today', 'week', 'month', 'year', 'all', 'custom') THEN
    RAISE EXCEPTION 'invalid admin overview period';
  END IF;
  IF p_period <> 'all' AND (p_bounds_start IS NULL OR p_bounds_end IS NULL) THEN
    RAISE EXCEPTION 'admin overview bounds are required for this period';
  END IF;
  IF (p_bounds_start IS NULL) <> (p_bounds_end IS NULL)
     OR (p_bounds_start IS NOT NULL AND p_bounds_start >= p_bounds_end) THEN
    RAISE EXCEPTION 'invalid admin overview bounds';
  END IF;
  IF (p_previous_start IS NULL) <> (p_previous_end IS NULL)
     OR (p_previous_start IS NOT NULL AND p_previous_start >= p_previous_end) THEN
    RAISE EXCEPTION 'invalid previous admin overview bounds';
  END IF;

  v_today_end := (date_trunc('day', p_now AT TIME ZONE v_timezone) + interval '1 day') AT TIME ZONE v_timezone;
  v_week_end := (date_trunc('week', p_now AT TIME ZONE v_timezone) + interval '1 week') AT TIME ZONE v_timezone;
  v_month_end := (date_trunc('month', p_now AT TIME ZONE v_timezone) + interval '1 month') AT TIME ZONE v_timezone;
  v_year_end := (date_trunc('year', p_now AT TIME ZONE v_timezone) + interval '1 year') AT TIME ZONE v_timezone;
  v_six_month_start := (date_trunc('month', p_now AT TIME ZONE v_timezone) - interval '5 months') AT TIME ZONE v_timezone;

  SELECT count(*),
    count(*) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE p_previous_start IS NOT NULL AND created_at >= p_previous_start AND created_at < p_previous_end),
    count(*) FILTER (WHERE created_at >= v_today_start AND created_at < v_today_end),
    count(*) FILTER (WHERE created_at >= v_week_start AND created_at < v_week_end),
    count(*) FILTER (WHERE created_at >= v_month_start AND created_at < v_month_end),
    count(*) FILTER (WHERE created_at >= v_year_start AND created_at < v_year_end)
  INTO v_total_users, v_signups_period, v_signups_previous, v_signups_today,
       v_signups_week, v_signups_month, v_signups_year
  FROM public.profiles;

  SELECT
    count(DISTINCT user_id) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(DISTINCT user_id) FILTER (WHERE created_at >= v_today_start AND created_at < v_today_end),
    count(DISTINCT user_id) FILTER (WHERE created_at >= v_week_start AND created_at < v_week_end),
    count(DISTINCT user_id) FILTER (WHERE created_at >= v_month_start AND created_at < v_month_end)
  INTO v_active_period, v_dau, v_wau, v_mau
  FROM public.login_events;

  WITH latest_subscription AS (
    SELECT DISTINCT ON (s.user_id) s.user_id, s.plan
    FROM public.subscriptions s
    WHERE s.status = 'active' AND s.plan IN ('starter', 'pro', 'agency')
      AND s.current_period_end > p_now
    ORDER BY s.user_id, s.created_at DESC, s.id DESC
  ), latest_override AS (
    SELECT DISTINCT ON (o.user_id) o.user_id, o.tier
    FROM public.admin_tier_overrides o
    WHERE o.expires_at IS NULL OR o.expires_at > p_now
    ORDER BY o.user_id, o.created_at DESC, o.id DESC
  ), effective AS (
    SELECT p.id, CASE
      WHEN o.tier IN ('free', 'starter', 'pro', 'agency') THEN o.tier
      WHEN s.plan IN ('starter', 'pro', 'agency') THEN s.plan
      ELSE 'free'
    END AS tier
    FROM public.profiles p
    LEFT JOIN latest_subscription s ON s.user_id = p.id
    LEFT JOIN latest_override o ON o.user_id = p.id
  ), counts AS (
    SELECT tier, count(*)::bigint AS count FROM effective GROUP BY tier
  )
  SELECT
    coalesce(max(count) FILTER (WHERE tier = 'free'), 0),
    coalesce(max(count) FILTER (WHERE tier = 'starter'), 0),
    coalesce(max(count) FILTER (WHERE tier = 'pro'), 0),
    coalesce(max(count) FILTER (WHERE tier = 'agency'), 0),
    coalesce(sum(count) FILTER (WHERE tier <> 'free'), 0),
    coalesce(jsonb_agg(jsonb_build_object('tier', tier, 'count', count) ORDER BY tier), '[]'::jsonb)
  INTO v_free, v_starter, v_pro, v_agency, v_active_paid, v_tiers
  FROM counts;

  SELECT
    count(*) FILTER (WHERE success IS TRUE AND (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE success IS TRUE AND p_previous_start IS NOT NULL AND created_at >= p_previous_start AND created_at < p_previous_end),
    count(*) FILTER (WHERE success IS TRUE),
    count(*) FILTER (WHERE success IS TRUE AND created_at >= v_today_start AND created_at < v_today_end),
    count(*) FILTER (WHERE success IS TRUE AND created_at >= v_week_start AND created_at < v_week_end),
    count(*) FILTER (WHERE success IS TRUE AND created_at >= v_month_start AND created_at < v_month_end),
    count(*) FILTER (WHERE success IS TRUE AND created_at >= v_year_start AND created_at < v_year_end),
    count(*) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    coalesce(sum(tokens_used) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)), 0)
  INTO v_docs_period, v_docs_previous, v_docs_all, v_docs_today, v_docs_week,
       v_docs_month, v_docs_year, v_ai_requests, v_ai_tokens
  FROM public.generation_history;

  SELECT count(*),
    count(*) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE created_at >= v_today_start AND created_at < v_today_end),
    count(*) FILTER (WHERE created_at >= v_week_start AND created_at < v_week_end),
    count(*) FILTER (WHERE created_at >= v_month_start AND created_at < v_month_end)
  INTO v_messages_all, v_messages_period, v_messages_today, v_messages_week, v_messages_month
  FROM public.chat_messages;

  SELECT
    count(*) FILTER (WHERE (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*),
    count(*) FILTER (WHERE created_at >= v_today_start AND created_at < v_today_end),
    count(*) FILTER (WHERE created_at >= v_week_start AND created_at < v_week_end),
    count(*) FILTER (WHERE created_at >= v_month_start AND created_at < v_month_end),
    count(*) FILTER (WHERE created_at >= v_year_start AND created_at < v_year_end),
    count(*) FILTER (WHERE status = 'opened' AND (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE status IN ('delivered', 'opened') AND (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE status = 'bounced' AND (p_bounds_start IS NULL OR created_at >= p_bounds_start) AND (p_bounds_end IS NULL OR created_at < p_bounds_end)),
    count(*) FILTER (WHERE status = 'opened' AND created_at >= v_month_start AND created_at < v_month_end),
    count(*) FILTER (WHERE status IN ('delivered', 'opened') AND created_at >= v_month_start AND created_at < v_month_end),
    count(*) FILTER (WHERE status = 'bounced' AND created_at >= v_month_start AND created_at < v_month_end)
  INTO v_emails_period, v_emails_all, v_emails_today, v_emails_week, v_emails_month,
       v_emails_year, v_emails_opened, v_emails_delivered, v_emails_bounced,
       v_month_opened, v_month_delivered, v_month_bounced
  FROM public.document_emails;

  SELECT coalesce(sum(ai_requests_count), 0), coalesce(sum(ai_tokens_used), 0),
         coalesce(sum(estimated_cost_usd), 0)
  INTO v_month_ai_requests, v_month_ai_tokens, v_month_ai_cost
  FROM public.user_usage WHERE month = v_current_month;

  v_ai_cost_available := p_period IN ('month', 'year', 'all');
  IF p_period = 'all' THEN
    SELECT coalesce(sum(estimated_cost_usd), 0) INTO v_ai_cost FROM public.user_usage;
  ELSIF p_period = 'year' THEN
    SELECT coalesce(sum(estimated_cost_usd), 0) INTO v_ai_cost
    FROM public.user_usage WHERE month LIKE v_current_year || '-%';
  ELSIF p_period = 'month' THEN
    v_ai_cost := v_month_ai_cost;
  ELSE
    v_ai_cost := NULL;
  END IF;

  SELECT coalesce(jsonb_object_agg(currency, monthly_amount), '{}'::jsonb),
         coalesce(jsonb_object_agg(currency, monthly_amount * 12), '{}'::jsonb)
  INTO v_mrr, v_arr
  FROM (
    SELECT upper(currency) AS currency,
      coalesce(sum((amount_paid::numeric / CASE
        WHEN upper(currency) IN ('CLF','UYW') THEN 10000
        WHEN upper(currency) IN ('BHD','IQD','JOD','KWD','LYD','OMR','TND') THEN 1000
        WHEN upper(currency) IN ('BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') THEN 1
        ELSE 100 END) / CASE WHEN billing_cycle = 'yearly' THEN 12 ELSE 1 END), 0) AS monthly_amount
    FROM public.subscriptions
    WHERE status = 'active'
      AND plan IN ('starter', 'pro', 'agency')
      AND current_period_end > p_now
      AND billing_cycle IN ('monthly', 'yearly')
      AND entitlement_source = 'razorpay'
      AND razorpay_subscription_id IS NOT NULL
      AND amount_paid IS NOT NULL AND amount_paid > 0
      AND currency IS NOT NULL AND btrim(currency) <> ''
    GROUP BY upper(currency)
  ) amounts;

  SELECT coalesce(jsonb_agg(jsonb_build_object('type', document_type, 'count', count) ORDER BY count DESC), '[]'::jsonb)
  INTO v_doc_types
  FROM (
    SELECT coalesce(document_type, 'unknown') AS document_type, count(*)::bigint AS count
    FROM public.generation_history WHERE success IS TRUE GROUP BY coalesce(document_type, 'unknown')
  ) grouped;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', count) ORDER BY day), '[]'::jsonb)
  INTO v_signup_trend
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_timezone)::date, 'YYYY-MM-DD') AS day, count(*)::bigint AS count
    FROM public.profiles WHERE created_at >= p_now - interval '60 days'
    GROUP BY (created_at AT TIME ZONE v_timezone)::date
  ) grouped;

  SELECT coalesce(jsonb_agg(jsonb_build_object('date', day, 'count', count) ORDER BY day), '[]'::jsonb)
  INTO v_document_trend
  FROM (
    SELECT to_char((created_at AT TIME ZONE v_timezone)::date, 'YYYY-MM-DD') AS day, count(*)::bigint AS count
    FROM public.generation_history
    WHERE success IS TRUE AND created_at >= p_now - interval '60 days'
    GROUP BY (created_at AT TIME ZONE v_timezone)::date
  ) grouped;

  WITH months AS (
    SELECT month_start, to_char(month_start, 'YYYY-MM') AS month_key
    FROM generate_series(
      date_trunc('month', p_now AT TIME ZONE v_timezone) - interval '5 months',
      date_trunc('month', p_now AT TIME ZONE v_timezone), interval '1 month'
    ) AS month_start
  ), currencies AS (
    SELECT 'INR'::text AS currency
    UNION SELECT upper(currency) FROM public.subscriptions
      WHERE status = 'active' AND plan IN ('starter', 'pro', 'agency')
        AND current_period_end > p_now
        AND billing_cycle IN ('monthly', 'yearly')
        AND entitlement_source = 'razorpay'
        AND razorpay_subscription_id IS NOT NULL
        AND amount_paid IS NOT NULL AND amount_paid > 0
        AND currency IS NOT NULL AND btrim(currency) <> ''
    UNION SELECT upper(currency) FROM public.payment_history
      WHERE status = 'captured' AND created_at >= v_six_month_start
        AND currency IS NOT NULL AND btrim(currency) <> ''
  ), paid AS (
    SELECT upper(currency) AS currency,
      to_char(created_at AT TIME ZONE v_timezone, 'YYYY-MM') AS month_key,
      sum(amount::numeric / CASE
        WHEN upper(currency) IN ('CLF','UYW') THEN 10000
        WHEN upper(currency) IN ('BHD','IQD','JOD','KWD','LYD','OMR','TND') THEN 1000
        WHEN upper(currency) IN ('BIF','CLP','DJF','GNF','ISK','JPY','KMF','KRW','PYG','RWF','UGX','VND','VUV','XAF','XOF','XPF') THEN 1
        ELSE 100 END) AS amount
    FROM public.payment_history
    WHERE status = 'captured' AND created_at >= v_six_month_start
      AND currency IS NOT NULL AND btrim(currency) <> ''
    GROUP BY upper(currency), to_char(created_at AT TIME ZONE v_timezone, 'YYYY-MM')
  ), points AS (
    SELECT c.currency,
      jsonb_agg(jsonb_build_object('month', m.month_key, 'amount', coalesce(p.amount, 0)) ORDER BY m.month_start) AS values
    FROM currencies c CROSS JOIN months m
    LEFT JOIN paid p ON p.currency = c.currency AND p.month_key = m.month_key
    GROUP BY c.currency
  )
  SELECT coalesce(jsonb_object_agg(currency, values), '{}'::jsonb) INTO v_revenue_trend FROM points;

  SELECT coalesce(jsonb_agg(to_jsonb(activity) ORDER BY activity.created_at DESC), '[]'::jsonb)
  INTO v_recent_activity
  FROM (
    SELECT a.action, a.created_at, a.user_id, a.ip_address, a.metadata,
      coalesce(p.email, p.full_name, a.user_id::text, 'system') AS user_email
    FROM public.audit_logs a LEFT JOIN public.profiles p ON p.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 20
  ) activity;

  RETURN jsonb_build_object(
    'totalUsers', v_total_users,
    'signupsInPeriod', v_signups_period,
    'signupsPrevious', v_signups_previous,
    'newSignupsToday', v_signups_today,
    'newSignupsThisWeek', v_signups_week,
    'newSignupsThisMonth', v_signups_month,
    'newSignupsThisYear', v_signups_year,
    'activeInPeriod', v_active_period,
    'dailyActiveUsers', v_dau,
    'weeklyActiveUsers', v_wau,
    'monthlyActiveUsers', v_mau,
    'activePaidUsers', v_active_paid,
    'freeUsers', v_free,
    'starterUsers', v_starter,
    'proUsers', v_pro,
    'agencyUsers', v_agency,
    'tierDistribution', v_tiers,
    'totalDocuments', v_docs_period,
    'documentsPrevious', v_docs_previous,
    'totalDocumentsAllTime', v_docs_all,
    'totalDocumentsToday', v_docs_today,
    'totalDocumentsThisWeek', v_docs_week,
    'totalDocumentsThisMonth', v_docs_month,
    'totalDocumentsThisYear', v_docs_year,
    'docTypeBreakdown', v_doc_types,
    'totalMessagesAllTime', v_messages_all,
    'totalMessagesToday', v_messages_today,
    'totalMessagesThisWeek', v_messages_week,
    'totalMessagesThisMonth', v_messages_month,
    'totalMessagesInPeriod', v_messages_period,
    'totalEmailsSent', v_emails_period,
    'totalEmailsAllTime', v_emails_all,
    'totalEmailsToday', v_emails_today,
    'totalEmailsThisWeek', v_emails_week,
    'totalEmailsThisMonth', v_emails_month,
    'totalEmailsThisYear', v_emails_year
  ) || jsonb_build_object(
    'emailsOpened', v_emails_opened,
    'emailsDelivered', v_emails_delivered,
    'emailsBounced', v_emails_bounced,
    'emailsOpenedThisMonth', v_month_opened,
    'emailsDeliveredThisMonth', v_month_delivered,
    'emailsBouncedThisMonth', v_month_bounced,
    'aiRequests', v_ai_requests,
    'aiTokens', v_ai_tokens,
    'aiCostUSD', v_ai_cost,
    'aiCostAvailable', v_ai_cost_available,
    'totalAIRequestsThisMonth', v_month_ai_requests,
    'totalTokensThisMonth', v_month_ai_tokens,
    'estimatedAICostThisMonth', v_month_ai_cost,
    'mrrByCurrency', v_mrr,
    'arrByCurrency', v_arr,
    'currentMRRINR', coalesce((v_mrr ->> 'INR')::numeric, 0),
    'arrINR', coalesce((v_arr ->> 'INR')::numeric, 0),
    'signupsTrend', v_signup_trend,
    'documentsTrend', v_document_trend,
    'revenueTrendByCurrency', v_revenue_trend,
    'revenueTrendINR', coalesce(v_revenue_trend -> 'INR', '[]'::jsonb),
    'recentActivity', v_recent_activity
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_overview_snapshot(text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_overview_snapshot(text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz)
  TO service_role;

-- Fail before creating the aggregate if repository prerequisites are absent.
-- The transaction then rolls back all earlier changes instead of leaving a
-- partially applied security migration.
DO $migration$
DECLARE
  v_column text;
BEGIN
  IF to_regclass('public.email_events') IS NULL THEN
    RAISE EXCEPTION 'required table public.email_events is missing; apply its schema migration first';
  END IF;
  IF to_regclass('public.user_email_send_log') IS NULL THEN
    RAISE EXCEPTION 'required table public.user_email_send_log is missing; apply its schema migration first';
  END IF;
  IF to_regclass('public.onboarding_progress') IS NULL THEN
    RAISE EXCEPTION 'required table public.onboarding_progress is missing; apply its schema migration first';
  END IF;

  FOREACH v_column IN ARRAY ARRAY[
    'email', 'event', 'event_at', 'id', 'message_id', 'reason', 'subject', 'tag', 'user_id'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'email_events'
        AND column_name = v_column
    ) THEN
      RAISE EXCEPTION 'required column public.email_events.% is missing', v_column;
    END IF;
  END LOOP;

  FOREACH v_column IN ARRAY ARRAY[
    'last_login_at', 'last_login_device', 'last_login_ip', 'last_login_location'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = v_column
    ) THEN
      RAISE EXCEPTION 'required column public.profiles.% is missing', v_column;
    END IF;
  END LOOP;
END
$migration$;

-- Support bounded, case-insensitive recipient lookups for the admin campaign
-- snapshot. The API receives one page plus exact aggregate counts.
CREATE INDEX IF NOT EXISTS idx_email_events_lower_email_event_at
  ON public.email_events (lower(email), event_at DESC);

CREATE OR REPLACE FUNCTION public.get_admin_email_campaign_snapshot(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_search text DEFAULT NULL,
  p_category text DEFAULT 'all',
  p_email_status text DEFAULT 'all',
  p_now timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 50), 1), 100);
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_category text := coalesce(nullif(lower(btrim(p_category)), ''), 'all');
  v_email_status text := coalesce(nullif(lower(btrim(p_email_status)), ''), 'all');
  v_now timestamptz := coalesce(p_now, now());
BEGIN
  IF v_category NOT IN ('all', 'dropoff', 'inactive', 'active', 'stopped') THEN
    RAISE EXCEPTION 'invalid campaign category';
  END IF;
  IF v_email_status NOT IN ('all', 'emailed', 'never', 'opened', 'notopened') THEN
    RAISE EXCEPTION 'invalid campaign email status';
  END IF;

  RETURN (
    WITH base AS MATERIALIZED (
      SELECT
        p.id,
        p.email,
        p.full_name,
        coalesce(p.onboarding_complete, false) AS onboarding_complete,
        coalesce(p.plan_selected, false) AS plan_selected,
        p.last_active_at,
        coalesce(p.created_at, v_now) AS created_at,
        coalesce(p.tier, 'free') AS tier,
        p.last_login_location,
        p.last_login_at,
        p.last_login_ip,
        p.last_login_device,
        CASE
          WHEN NOT coalesce(p.onboarding_complete, false)
               AND coalesce(p.created_at, v_now) <= v_now - interval '2 days' THEN 'dropoff'
          WHEN coalesce(p.onboarding_complete, false)
               AND coalesce(p.last_active_at, p.created_at, v_now) <= v_now - interval '7 days' THEN 'inactive'
          ELSE 'active'
        END AS category,
        EXISTS (
          SELECT 1 FROM public.user_email_send_log sl
          WHERE sl.user_id = p.id AND sl.email_type IN ('inactive_2', 'dropoff_2')
        ) AS auto_stopped,
        EXISTS (
          SELECT 1 FROM public.email_events ee
          WHERE lower(ee.email) = lower(p.email)
            AND (ee.tag IS NULL OR ee.tag !~* '(diagnostic|test)')
        ) AS emailed,
        EXISTS (
          SELECT 1 FROM public.email_events ee
          WHERE lower(ee.email) = lower(p.email)
            AND ee.event IN ('opened', 'uniqueOpened')
            AND (ee.tag IS NULL OR ee.tag !~* '(diagnostic|test)')
        ) AS opened
      FROM public.profiles p
      WHERE p.email IS NOT NULL AND btrim(p.email) <> ''
    ), filtered AS MATERIALIZED (
      SELECT b.* FROM base b
      WHERE (v_search IS NULL
             OR position(v_search IN lower(b.email)) > 0
             OR position(v_search IN lower(coalesce(b.full_name, ''))) > 0)
        AND (
          v_category = 'all'
          OR (v_category = 'stopped' AND b.auto_stopped)
          OR (v_category <> 'stopped' AND b.category = v_category)
        )
        AND (
          v_email_status = 'all'
          OR (v_email_status = 'emailed' AND b.emailed)
          OR (v_email_status = 'never' AND NOT b.emailed)
          OR (v_email_status = 'opened' AND b.opened)
          OR (v_email_status = 'notopened' AND b.emailed AND NOT b.opened)
        )
    ), paged AS MATERIALIZED (
      SELECT f.* FROM filtered f
      ORDER BY f.created_at DESC, f.id
      LIMIT v_page_size OFFSET (v_page - 1) * v_page_size
    ), enriched AS (
      SELECT
        u.created_at AS sort_created_at,
        u.id AS sort_id,
        jsonb_build_object(
          'id', u.id,
          'email', u.email,
          'name', u.full_name,
          'onboarding_complete', u.onboarding_complete,
          'plan_selected', u.plan_selected,
          'onboarding_phase', progress.current_phase,
          'last_active_at', u.last_active_at,
          'created_at', u.created_at,
          'tier', u.tier,
          'category', u.category,
          'auto_stopped', u.auto_stopped,
          'never_emailed', NOT u.emailed,
          'opened', u.opened,
          'docs_count', coalesce(docs.count, 0),
          'sent_emails', coalesce(send_logs.rows, '[]'::jsonb),
          'sent_email_log_count', coalesce(send_logs.total_count, 0),
          'sent_emails_truncated', coalesce(send_logs.total_count, 0) > 50,
          'auto_sent_count', coalesce(history.auto_sent_count, 0),
          'manual_sent_count', coalesce(history.manual_sent_count, 0),
          'total_sent_count', coalesce(history.total_sent_count, 0),
          'last_manual_sent_at', history.last_manual_sent_at,
          'last_sent_at', history.last_sent_at,
          'email_history', coalesce(history.email_history, '[]'::jsonb),
          'email_history_truncated', coalesce(history.total_sent_count, 0) > 50,
          'open_count', coalesce(history.open_count, 0),
          'clicked_count', coalesce(history.click_count, 0),
          'last_opened_at', history.last_opened_at,
          'last_email_event', recent.last_event,
          'delivered_count', coalesce(recent.delivered_count, 0),
          'bounced', coalesce(recent.bounced_count, 0) > 0,
          'last_login_at', u.last_login_at,
          'last_login_location', u.last_login_location,
          'last_login_ip', u.last_login_ip,
          'last_login_device', u.last_login_device
        ) AS row
      FROM paged u
      LEFT JOIN public.onboarding_progress progress ON progress.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT count(*)::bigint AS count
        FROM public.document_sessions ds WHERE ds.user_id = u.id
      ) docs ON true
      LEFT JOIN LATERAL (
        SELECT
          (SELECT count(*)::bigint
           FROM public.user_email_send_log all_logs
           WHERE all_logs.user_id = u.id) AS total_count,
          coalesce((
            SELECT jsonb_agg(
              jsonb_build_object('email_type', recent_logs.email_type, 'sent_at', recent_logs.sent_at)
              ORDER BY recent_logs.sent_at DESC
            )
            FROM (
              SELECT sl.email_type, sl.sent_at
              FROM public.user_email_send_log sl
              WHERE sl.user_id = u.id
              ORDER BY sl.sent_at DESC
              LIMIT 50
            ) recent_logs
          ), '[]'::jsonb) AS rows
      ) send_logs ON true
      LEFT JOIN LATERAL (
        SELECT
          count(*)::bigint AS total_sent_count,
          count(*) FILTER (WHERE mh.is_manual)::bigint AS manual_sent_count,
          count(*) FILTER (WHERE NOT mh.is_manual)::bigint AS auto_sent_count,
          max(mh.sent_at) AS last_sent_at,
          max(mh.sent_at) FILTER (WHERE mh.is_manual) AS last_manual_sent_at,
          coalesce(sum(mh.open_count), 0)::bigint AS open_count,
          coalesce(sum(mh.click_count), 0)::bigint AS click_count,
          max(mh.last_opened_at) AS last_opened_at,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'kind', CASE WHEN mh.is_manual THEN 'manual' ELSE 'auto' END,
                'label', CASE WHEN mh.is_manual THEN 'Direct email' ELSE 'Lifecycle email' END,
                'subject', mh.subject,
                'sent_at', mh.sent_at,
                'open_count', mh.open_count,
                'click_count', mh.click_count,
                'opens', mh.opens,
                'last_opened_at', mh.last_opened_at
              ) ORDER BY mh.sent_at DESC
            ) FILTER (WHERE mh.history_rank <= 50),
            '[]'::jsonb
          ) AS email_history
        FROM (
          SELECT
            min(ee.event_at) AS sent_at,
            max(ee.subject) AS subject,
            bool_or(coalesce(ee.tag, '') ~* '(admin|dashboard|direct)') AS is_manual,
            count(*) FILTER (WHERE ee.event IN ('opened', 'uniqueOpened'))::bigint AS open_count,
            count(*) FILTER (WHERE ee.event = 'click')::bigint AS click_count,
            coalesce(
              jsonb_agg(to_jsonb(ee.event_at) ORDER BY ee.event_at)
                FILTER (WHERE ee.event IN ('opened', 'uniqueOpened')),
              '[]'::jsonb
            ) AS opens,
            max(ee.event_at) FILTER (WHERE ee.event IN ('opened', 'uniqueOpened')) AS last_opened_at,
            row_number() OVER (ORDER BY min(ee.event_at) DESC) AS history_rank
          FROM public.email_events ee
          WHERE lower(ee.email) = lower(u.email)
            AND (ee.tag IS NULL OR ee.tag !~* '(diagnostic|test)')
          GROUP BY coalesce(ee.message_id, coalesce(ee.subject, '') || '|' || ee.event_at::text)
        ) mh
      ) history ON true
      LEFT JOIN LATERAL (
        SELECT
          (
            SELECT jsonb_build_object('event', latest.event, 'event_at', latest.event_at)
            FROM public.email_events latest
            WHERE lower(latest.email) = lower(u.email)
              AND latest.event_at >= v_now - interval '30 days'
            ORDER BY latest.event_at DESC LIMIT 1
          ) AS last_event,
          count(*) FILTER (WHERE ee.event = 'delivered')::bigint AS delivered_count,
          count(*) FILTER (WHERE ee.event IN ('hardBounce', 'softBounce', 'blocked'))::bigint AS bounced_count
        FROM public.email_events ee
        WHERE lower(ee.email) = lower(u.email)
          AND ee.event_at >= v_now - interval '30 days'
      ) recent ON true
    ), summary AS (
      SELECT jsonb_build_object(
        'totalUsers', count(*),
        'dropoffUsers', count(*) FILTER (WHERE category = 'dropoff'),
        'inactiveUsers', count(*) FILTER (WHERE category = 'inactive'),
        'activeUsers', count(*) FILTER (WHERE category = 'active'),
        'neverEmailedUsers', count(*) FILTER (WHERE NOT emailed),
        'stoppedUsers', count(*) FILTER (WHERE auto_stopped)
      ) AS value FROM base
    ), email_summary AS (
      SELECT coalesce(jsonb_object_agg(event, count), '{}'::jsonb) AS value
      FROM (
        SELECT ee.event, count(*)::bigint AS count
        FROM public.email_events ee
        WHERE ee.event_at >= v_now - interval '30 days'
        GROUP BY ee.event
      ) grouped
    ), recent_events AS (
      SELECT coalesce(jsonb_agg(to_jsonb(events) ORDER BY events.event_at DESC), '[]'::jsonb) AS value
      FROM (
        SELECT ee.id, ee.email, ee.event, ee.subject, ee.tag, ee.event_at, ee.reason, ee.user_id
        FROM public.email_events ee
        ORDER BY ee.event_at DESC LIMIT 50
      ) events
    )
    SELECT jsonb_build_object(
      'users', coalesce((
        SELECT jsonb_agg(enriched.row ORDER BY enriched.sort_created_at DESC, enriched.sort_id)
        FROM enriched
      ), '[]'::jsonb),
      'pagination', jsonb_build_object(
        'page', v_page,
        'pageSize', v_page_size,
        'total', (SELECT count(*) FROM filtered),
        'totalPages', greatest(1, ceil((SELECT count(*) FROM filtered)::numeric / v_page_size)::integer)
      ),
      'summary', (SELECT value FROM summary),
      'emailSummary', (SELECT value FROM email_summary),
      'sentToday', (
        SELECT count(*) FROM public.user_email_send_log sl
        WHERE sl.sent_at >= date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
          AND sl.sent_at < (date_trunc('day', v_now AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC'
      ),
      'recentEvents', (SELECT value FROM recent_events)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_email_campaign_snapshot(integer, integer, text, text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_email_campaign_snapshot(integer, integer, text, text, text, timestamptz)
  TO service_role;

COMMENT ON COLUMN public.document_sessions.public_id IS
  '256-bit random recipient capability; never derive it from the internal UUID.';
COMMENT ON COLUMN public.signatures.token_hash IS
  'Lowercase SHA-256 hash of the one-time raw signing token; raw token is not stored.';
COMMENT ON COLUMN public.signatures.signing_cohort_id IS
  'Invitation generation containing signers that must complete the same envelope.';
COMMENT ON COLUMN public.document_sessions.active_signature_cohort_id IS
  'Current signing envelope; historical cohorts cannot block or complete it.';

COMMIT;
