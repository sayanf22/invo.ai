-- ============================================================
-- MIGRATION: Revert increment_blog_view to SECURITY DEFINER
-- Applied: 2026-05-17
-- The previous migration switched it to SECURITY INVOKER, which broke
-- blog view counting because blog_posts has no UPDATE policy for
-- anon/authenticated users. SECURITY DEFINER is correct here — the
-- function is intentionally public (counts page views) and the security
-- risk (mutable search_path) was already fixed with SET search_path = public.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_blog_view(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.blog_posts
  SET view_count = view_count + 1
  WHERE slug = p_slug AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_blog_view(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_blog_view(text) TO authenticated;
