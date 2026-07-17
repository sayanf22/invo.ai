-- Prepared 2026-07-19. Apply only after application validation.
-- Makes recipient decisions single-use, first-view notifications idempotent,
-- and signature certificate generation durable and retryable.
BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.quotation_responses
    GROUP BY session_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one quotation response per session: duplicates require manual historical review';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.signature_audit_events
    WHERE action = 'signature.viewed' AND signature_id IS NOT NULL
    GROUP BY signature_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one first-view event per signature: duplicates require manual historical review';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.document_links
    WHERE relationship = 'auto_invoice'
    GROUP BY parent_session_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one auto-invoice per parent: duplicates require manual historical review';
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS quotation_responses_one_per_session
  ON public.quotation_responses (session_id);

DROP POLICY IF EXISTS quotation_responses_insert_public
  ON public.quotation_responses;
REVOKE INSERT ON TABLE public.quotation_responses FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_quotation_response(
  p_public_id text,
  p_response_type text,
  p_client_name text,
  p_client_email text,
  p_reason text,
  p_ip_address inet,
  p_user_agent text
)
RETURNS TABLE(outcome text, response_type text, responded_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_session public.document_sessions%ROWTYPE;
  v_existing public.quotation_responses%ROWTYPE;
  v_context jsonb;
  v_reference text;
  v_doc_label text;
  v_action_label text;
  v_now timestamptz := now();
BEGIN
  IF p_public_id IS NULL OR p_public_id !~ '^[0-9a-f]{64}$'
     OR p_response_type NOT IN ('accepted', 'declined', 'changes_requested')
     OR p_client_name IS NULL OR length(btrim(p_client_name)) NOT BETWEEN 1 AND 200
     OR p_client_email IS NULL OR length(btrim(p_client_email)) NOT BETWEEN 3 AND 254
     OR p_client_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     OR length(coalesce(p_reason, '')) > 2000
     OR (p_response_type = 'changes_requested' AND btrim(coalesce(p_reason, '')) = '') THEN
    RETURN QUERY SELECT 'invalid_request'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT ds.* INTO v_session
  FROM public.document_sessions ds
  WHERE ds.public_id = p_public_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT qr.* INTO v_existing
  FROM public.quotation_responses qr
  WHERE qr.session_id = v_session.id;
  IF FOUND THEN
    RETURN QUERY SELECT 'already_responded'::text,
      v_existing.response_type, v_existing.responded_at;
    RETURN;
  END IF;

  v_context := coalesce(v_session.context, '{}'::jsonb);
  IF v_session.document_type NOT IN ('quote', 'quotation', 'proposal')
     OR v_session.status <> 'finalized' OR v_session.sent_at IS NULL THEN
    RETURN QUERY SELECT 'not_available'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_context->'allowClientResponse' = 'false'::jsonb THEN
    RETURN QUERY SELECT 'response_disabled'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_context->'showSignatureFields' IS DISTINCT FROM 'false'::jsonb THEN
    RETURN QUERY SELECT 'signature_required'::text, NULL::text, NULL::timestamptz;
    RETURN;
  END IF;

  INSERT INTO public.quotation_responses (
    session_id, response_type, client_name, client_email, reason,
    ip_address, user_agent, responded_at
  ) VALUES (
    v_session.id, p_response_type, btrim(p_client_name), lower(btrim(p_client_email)),
    NULLIF(btrim(p_reason), ''), p_ip_address, left(p_user_agent, 1000), v_now
  );

  v_reference := coalesce(v_context->>'referenceNumber', v_context->>'invoiceNumber', '');
  v_doc_label := CASE v_session.document_type
    WHEN 'proposal' THEN 'Proposal' ELSE 'Quote' END;
  v_action_label := CASE p_response_type
    WHEN 'accepted' THEN 'accepted'
    WHEN 'declined' THEN 'declined'
    ELSE 'requested changes on' END;

  INSERT INTO public.notifications (
    user_id, type, title, message, read, metadata
  ) VALUES (
    v_session.user_id,
    v_session.document_type || '_' || p_response_type,
    btrim(p_client_name) || ' ' || v_action_label || ' your ' || v_doc_label,
    CASE WHEN NULLIF(btrim(p_reason), '') IS NOT NULL
      THEN '"' || btrim(p_reason) || '"'
      ELSE btrim(p_client_name) || ' ' || v_action_label || ' your ' ||
        v_doc_label || CASE WHEN v_reference <> '' THEN ' ' || v_reference ELSE '' END || '.' END,
    false,
    jsonb_build_object(
      'session_id', v_session.id, 'response', p_response_type,
      'client_name', btrim(p_client_name), 'client_email', lower(btrim(p_client_email)),
      'reference_number', v_reference, 'reason', NULLIF(btrim(p_reason), '')
    )
  );

  RETURN QUERY SELECT 'recorded'::text, p_response_type, v_now;
EXCEPTION WHEN unique_violation THEN
  SELECT qr.* INTO v_existing FROM public.quotation_responses qr
  WHERE qr.session_id = v_session.id;
  RETURN QUERY SELECT 'already_responded'::text,
    v_existing.response_type, v_existing.responded_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_quotation_response(
  text, text, text, text, text, inet, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_quotation_response(
  text, text, text, text, text, inet, text
) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS signature_audit_first_view_once
  ON public.signature_audit_events (signature_id)
  WHERE action = 'signature.viewed' AND signature_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_signature_first_view(
  p_signature_id uuid,
  p_ip_address text,
  p_user_agent text,
  p_viewed_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_signature public.signatures%ROWTYPE;
  v_session public.document_sessions%ROWTYPE;
  v_inserted uuid;
  v_doc_label text;
BEGIN
  IF p_signature_id IS NULL OR p_viewed_at IS NULL THEN RETURN false; END IF;

  SELECT s.* INTO v_signature FROM public.signatures s
  WHERE s.id = p_signature_id;
  IF NOT FOUND OR v_signature.session_id IS NULL THEN RETURN false; END IF;

  SELECT ds.* INTO v_session FROM public.document_sessions ds
  WHERE ds.id = v_signature.session_id;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.signature_audit_events (
    signature_id, document_id, session_id, action, actor_email,
    ip_address, user_agent, metadata, created_at
  ) VALUES (
    v_signature.id, v_signature.document_id, v_session.id, 'signature.viewed',
    v_signature.signer_email, NULLIF(p_ip_address, 'unknown'), left(p_user_agent, 1000),
    jsonb_build_object('viewed_at', p_viewed_at), p_viewed_at
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NULL THEN RETURN false; END IF;

  v_doc_label := CASE v_session.document_type
    WHEN 'sow' THEN 'Statement of Work'
    WHEN 'nda' THEN 'NDA'
    WHEN 'change_order' THEN 'Change Order'
    ELSE initcap(coalesce(v_session.document_type, 'document')) END;

  INSERT INTO public.notifications (
    user_id, type, title, message, read, metadata
  ) VALUES (
    v_session.user_id, 'signature_viewed', 'Document Viewed',
    coalesce(v_signature.signer_name, 'Signer') || ' viewed your ' || v_doc_label || ' for signing.',
    false,
    jsonb_build_object(
      'session_id', v_session.id, 'signature_id', v_signature.id,
      'signer_name', coalesce(v_signature.signer_name, 'Signer'),
      'document_type', v_session.document_type
    )
  );
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_signature_first_view(
  uuid, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_signature_first_view(
  uuid, text, text, timestamptz
) TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS document_links_one_auto_invoice_per_parent
  ON public.document_links (parent_session_id)
  WHERE relationship = 'auto_invoice';

ALTER TABLE public.document_sessions
  ADD COLUMN IF NOT EXISTS certificate_status text,
  ADD COLUMN IF NOT EXISTS certificate_key text,
  ADD COLUMN IF NOT EXISTS certificate_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS certificate_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificate_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS certificate_last_error text,
  ADD COLUMN IF NOT EXISTS certificate_claim_id uuid;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'document_sessions_certificate_status_check'
      AND conrelid = 'public.document_sessions'::regclass
  ) THEN
    ALTER TABLE public.document_sessions
      ADD CONSTRAINT document_sessions_certificate_status_check
      CHECK (certificate_status IS NULL OR certificate_status IN ('pending', 'generating', 'completed', 'failed'));
  END IF;
END
$migration$;

CREATE OR REPLACE FUNCTION public.queue_signature_certificate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed' THEN
    NEW.certificate_status := 'pending';
    NEW.certificate_last_error := NULL;
    NEW.certificate_claim_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS queue_signature_certificate_on_completion
  ON public.document_sessions;
CREATE TRIGGER queue_signature_certificate_on_completion
BEFORE UPDATE OF status ON public.document_sessions
FOR EACH ROW EXECUTE FUNCTION public.queue_signature_certificate();

UPDATE public.document_sessions
SET certificate_status = 'pending'
WHERE status = 'signed' AND certificate_status IS NULL;

CREATE OR REPLACE FUNCTION public.claim_signature_certificate(
  p_session_id uuid,
  p_force_repair boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_claim_id uuid := extensions.gen_random_uuid();
BEGIN
  UPDATE public.document_sessions
  SET certificate_status = 'generating',
      certificate_attempts = certificate_attempts + 1,
      certificate_last_attempt_at = now(),
      certificate_last_error = NULL,
      certificate_claim_id = v_claim_id
  WHERE id = p_session_id AND status = 'signed'
    AND (
      certificate_status IN ('pending', 'failed')
      OR (certificate_status = 'generating' AND certificate_last_attempt_at < now() - interval '5 minutes')
      OR (p_force_repair AND certificate_status = 'completed')
    );
  IF FOUND THEN RETURN v_claim_id; END IF;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_signature_certificate(uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_signature_certificate(uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.finish_signature_certificate(
  p_session_id uuid,
  p_claim_id uuid,
  p_certificate_key text,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_session_id IS NULL OR p_claim_id IS NULL THEN RETURN false; END IF;

  IF p_error IS NULL AND p_certificate_key IS NOT NULL AND btrim(p_certificate_key) <> '' THEN
    UPDATE public.document_sessions
    SET certificate_status = 'completed', certificate_key = btrim(p_certificate_key),
        certificate_generated_at = now(), certificate_last_error = NULL,
        certificate_claim_id = NULL
    WHERE id = p_session_id AND certificate_status = 'generating'
      AND certificate_claim_id = p_claim_id;
  ELSE
    UPDATE public.document_sessions
    SET certificate_status = 'failed',
        certificate_last_error = left(coalesce(NULLIF(btrim(p_error), ''), 'Certificate generation failed'), 500),
        certificate_claim_id = NULL
    WHERE id = p_session_id AND certificate_status = 'generating'
      AND certificate_claim_id = p_claim_id;
  END IF;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.finish_signature_certificate(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_signature_certificate(uuid, uuid, text, text)
  TO service_role;

COMMIT;
