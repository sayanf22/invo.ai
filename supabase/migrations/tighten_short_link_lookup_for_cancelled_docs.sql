-- Tighten lookup_session_by_short_id to also exclude documents that were
-- explicitly cancelled OR that were unlocked by the owner after sending
-- (status returns to 'active' with sent_at still set). This matches the
-- industry-standard DocuSign / Adobe Sign / HelloSign void-revoke-immediately
-- behavior — once an envelope is voided/cancelled, the recipient link returns
-- 404 immediately and no further interaction is possible.
--
-- Applied via Supabase MCP on 2026-05-16. This file is committed for
-- documentation and to keep all environments in sync if the project is
-- re-bootstrapped from migrations.

CREATE OR REPLACE FUNCTION public.lookup_session_by_short_id(short_id text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ds.id
  FROM document_sessions ds
  WHERE ds.id::text LIKE (short_id || '%')
    AND ds.status IN ('finalized', 'paid', 'signed')
    -- Defence-in-depth: explicitly exclude cancelled even though the IN-list
    -- already filters it out. Future status additions should follow this pattern.
    AND ds.status <> 'cancelled'
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.lookup_session_by_short_id(text) IS
  'Resolves a short link to a session ID for public /pay redirects. Only finalized/paid/signed sessions are returned. Cancelled or unlocked sessions return zero rows so the short link 404s.';
