-- ============================================================
-- MIGRATION: Fix schema constraints, RLS performance, security
-- Applied: 2026-05-17
-- ============================================================

-- ─── 1. Fix notifications.type CHECK constraint ─────────────────────────────
-- The old constraint only had 6 types. The app inserts 15+ types including
-- payment_received, signature_signed, signature_completed, signature_declined,
-- signature_revision_requested, support_resolved, quote_accepted, etc.
-- All of these were silently failing (DB rejects the insert, code swallows error).
-- Solution: remove the enum constraint; validation is done at the application layer.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- ─── 2. Fix document_emails.document_type CHECK constraint ──────────────────
-- Old constraint only had: invoice, contract, quotation, proposal
-- App now supports 9 document types. Sending email for SOW/NDA/etc. fails.

ALTER TABLE public.document_emails
  DROP CONSTRAINT IF EXISTS document_emails_document_type_check;

ALTER TABLE public.document_emails
  ADD CONSTRAINT document_emails_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'invoice', 'contract', 'quote', 'quotation', 'proposal',
    'sow', 'change_order', 'nda', 'client_onboarding_form', 'payment_followup'
  ]));

-- ─── 3. Fix email_schedules.document_type CHECK constraint ──────────────────
-- Same issue as document_emails — only old 4 types were allowed.

ALTER TABLE public.email_schedules
  DROP CONSTRAINT IF EXISTS email_schedules_document_type_check;

ALTER TABLE public.email_schedules
  ADD CONSTRAINT email_schedules_document_type_check
  CHECK (document_type = ANY (ARRAY[
    'invoice', 'contract', 'quote', 'quotation', 'proposal',
    'sow', 'change_order', 'nda', 'client_onboarding_form', 'payment_followup'
  ]));

-- ─── 4. Fix error_logs INSERT policy ────────────────────────────────────────
-- "Anyone can insert error logs" used WITH CHECK (true), meaning any user
-- including anon could insert a row with any user_id (including spoofing another
-- user's ID). Fixed: only allow inserting rows where user_id matches the
-- authenticated user OR user_id is null (for unauthenticated error logging).

DROP POLICY IF EXISTS "Anyone can insert error logs" ON public.error_logs;

CREATE POLICY "Anyone can insert error logs"
  ON public.error_logs
  FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ─── 5. Fix RLS auth.uid() init plan issues (performance) ───────────────────
-- Replace bare auth.uid() calls with (SELECT auth.uid()) so Postgres evaluates
-- the function ONCE per query instead of once per row.

-- 5a. subscriptions
DROP POLICY IF EXISTS "sub_select_own" ON public.subscriptions;
CREATE POLICY "sub_select_own"
  ON public.subscriptions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "sub_insert_free_only" ON public.subscriptions;
CREATE POLICY "sub_insert_free_only"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND plan = 'free'
    AND status = 'active'
  );

DROP POLICY IF EXISTS "sub_update_free_only" ON public.subscriptions;
CREATE POLICY "sub_update_free_only"
  ON public.subscriptions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND plan = 'free');

-- 5b. generation_history
DROP POLICY IF EXISTS "Users can insert their own generation history" ON public.generation_history;
CREATE POLICY "Users can insert their own generation history"
  ON public.generation_history FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 5c. user_usage
DROP POLICY IF EXISTS "Users can insert their own usage" ON public.user_usage;
CREATE POLICY "Users can insert their own usage"
  ON public.user_usage FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own usage" ON public.user_usage;
CREATE POLICY "Users can update their own usage"
  ON public.user_usage FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 5d. profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- 5e. notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ─── 6. Fix SECURITY DEFINER function search_path ───────────────────────────
-- Trigger functions with mutable search_path can be exploited via schema injection.

CREATE OR REPLACE FUNCTION public.update_blog_posts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
    NEW.tier := OLD.tier;
    NEW.tier_expires_at := OLD.tier_expires_at;
    NEW.suspended_at := OLD.suspended_at;
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 7. Fix increment_blog_view: switch to SECURITY INVOKER ─────────────────
CREATE OR REPLACE FUNCTION public.increment_blog_view(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_view(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_blog_view(text) TO authenticated;

-- ─── 8. Add missing index on blog_topic_queue.generated_post_id ─────────────
CREATE INDEX IF NOT EXISTS idx_blog_topic_queue_generated_post_id
  ON public.blog_topic_queue(generated_post_id)
  WHERE generated_post_id IS NOT NULL;
