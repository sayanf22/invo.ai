-- The signer_action column was originally constrained to {signed, declined,
-- revision_requested}. The cancellation feature added 'cancelled' as a fourth
-- value (set by /api/sessions/cancel, /api/sessions/unlock, /api/signatures/cancel
-- and others) but the check constraint was never updated. Every write of
-- 'cancelled' silently failed with a 23514 check_violation, leaving signing
-- tokens active even after the owner cancelled the document.
--
-- Fix: replace the constraint to include 'cancelled' as a valid signer action.
-- Applied via Supabase MCP on 2026-05-16. This file is committed for
-- documentation and to keep all environments in sync if the project is
-- re-bootstrapped from migrations.

ALTER TABLE public.signatures
  DROP CONSTRAINT IF EXISTS signatures_signer_action_check;

ALTER TABLE public.signatures
  ADD CONSTRAINT signatures_signer_action_check
  CHECK (signer_action IS NULL OR signer_action = ANY (ARRAY[
    'signed'::text,
    'declined'::text,
    'revision_requested'::text,
    'cancelled'::text
  ]));

COMMENT ON CONSTRAINT signatures_signer_action_check ON public.signatures IS
  'Valid signer_action values. cancelled was added when document cancellation/unlock flows were introduced — see /api/sessions/cancel and /api/sessions/unlock.';
