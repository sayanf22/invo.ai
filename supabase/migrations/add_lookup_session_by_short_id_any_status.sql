-- Add a permissive RPC that resolves a short link to a session id PLUS its
-- current status. Unlike the strict `lookup_session_by_short_id` (which only
-- returns finalized/paid/signed sessions), this variant also returns rows for
-- cancelled or unlocked sessions so the recipient is taken to a clear
-- "this document is no longer available" screen instead of being silently
-- redirected back to the homepage.
--
-- This matches DocuSign / Adobe Sign / HelloSign void-recipient behaviour:
--   • Voided envelope → recipient sees a "Voided" page (not 404, not redirect)
--   • Cancelled link  → recipient sees a "No longer available" page
--   • Active link     → recipient sees the document
--
-- The strict RPC stays in place because some flows (e.g. payment redirects)
-- want a hard "no row" signal for cancelled documents. Both RPCs coexist.
--
-- Applied via Supabase MCP on 2026-05-16. This file is committed for
-- documentation and to keep all environments in sync if the project is
-- re-bootstrapped from migrations.

CREATE OR REPLACE FUNCTION public.lookup_session_id_by_short_id(short_id text)
RETURNS TABLE(id uuid, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT ds.id, ds.status::text
  FROM document_sessions ds
  WHERE ds.id::text LIKE (short_id || '%')
    -- Only sessions that were ever sent OR completed — exclude pure drafts
    AND (ds.sent_at IS NOT NULL OR ds.status IN ('paid', 'signed', 'finalized', 'cancelled'))
  LIMIT 1;
$function$;

COMMENT ON FUNCTION public.lookup_session_id_by_short_id(text) IS
  'Permissive short-link resolver. Returns id+status for any session that has been sent or reached a terminal state, including cancelled. Used by middleware to drive recipients to the correct status-aware page rather than silently redirecting them home.';

-- Allow anon + authenticated to call this RPC. SECURITY DEFINER runs as the
-- function owner so RLS does not block the lookup.
GRANT EXECUTE ON FUNCTION public.lookup_session_id_by_short_id(text) TO anon, authenticated;
