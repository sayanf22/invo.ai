-- ============================================================
-- Account suspend / delete infrastructure
-- Applied to project tdeqauhtobtahncglqwq.
--
-- 1. blocked_emails table  → prevents re-registration of suspended/deleted emails
-- 2. trigger on auth.users  → blocks signup (email + OAuth) for blocked emails
-- 3. delete_user_account()  → atomic full cascade wipe of a user's data
-- ============================================================

-- ── 1. Blocked emails table ──────────────────────────────────────────
create table if not exists public.blocked_emails (
  email      text primary key,
  reason     text,
  blocked_by text,
  created_at timestamptz not null default now()
);

alter table public.blocked_emails enable row level security;
-- No RLS policies → only the service role (which bypasses RLS) can read/write.

comment on table public.blocked_emails is
  'Emails blocked from registering. Populated on admin suspend and admin/user delete. Checked by trg_prevent_blocked_email_signup on auth.users insert.';

-- ── 2. Block re-registration trigger on auth.users ───────────────────
create or replace function public.prevent_blocked_email_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null
     and exists (select 1 from public.blocked_emails be where lower(be.email) = lower(new.email)) then
    raise exception 'This email address is not permitted to register.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_blocked_email_signup on auth.users;
create trigger trg_prevent_blocked_email_signup
  before insert on auth.users
  for each row execute function public.prevent_blocked_email_signup();

-- ── 3. Full cascade delete of a single user's data ───────────────────
-- SECURITY DEFINER so it can delete across all tables regardless of RLS.
-- Deletes everything in dependency order (children → parents). Does NOT
-- touch auth.users — the caller removes that via the Auth Admin API after
-- this function returns, so the FK references are already cleared.
create or replace function public.delete_user_account(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from signature_audit_events
   where signature_id in (
           select id from signatures
            where session_id in (select id from document_sessions where user_id = target_user_id)
               or document_id in (
                    select d.id from documents d
                    join businesses b on d.business_id = b.id
                    where b.user_id = target_user_id)
         )
      or session_id in (select id from document_sessions where user_id = target_user_id)
      or document_id in (
           select d.id from documents d
           join businesses b on d.business_id = b.id
           where b.user_id = target_user_id);

  delete from signatures
   where session_id in (select id from document_sessions where user_id = target_user_id)
      or document_id in (
           select d.id from documents d
           join businesses b on d.business_id = b.id
           where b.user_id = target_user_id);

  delete from quotation_responses
   where session_id in (select id from document_sessions where user_id = target_user_id);

  delete from document_links
   where parent_session_id in (select id from document_sessions where user_id = target_user_id)
      or child_session_id  in (select id from document_sessions where user_id = target_user_id);

  delete from chat_messages
   where session_id in (select id from document_sessions where user_id = target_user_id);

  delete from generation_history
   where user_id = target_user_id
      or session_id in (select id from document_sessions where user_id = target_user_id);

  delete from email_schedules
   where user_id = target_user_id
      or session_id in (select id from document_sessions where user_id = target_user_id);

  delete from document_emails
   where user_id = target_user_id
      or session_id in (select id from document_sessions where user_id = target_user_id);

  delete from invoice_payments
   where user_id = target_user_id
      or session_id in (select id from document_sessions where user_id = target_user_id);

  delete from recurring_invoices
   where user_id = target_user_id
      or source_session_id in (select id from document_sessions where user_id = target_user_id);

  delete from document_versions
   where created_by = target_user_id
      or document_id in (
           select d.id from documents d
           join businesses b on d.business_id = b.id
           where b.user_id = target_user_id)
      or document_id in (
           select document_id from document_sessions
           where user_id = target_user_id and document_id is not null);

  delete from document_sessions where user_id = target_user_id;

  delete from documents
   where business_id in (select id from businesses where user_id = target_user_id);

  delete from businesses where user_id = target_user_id;

  delete from user_payment_settings  where user_id = target_user_id;
  delete from subscriptions          where user_id = target_user_id;
  delete from payment_history        where user_id = target_user_id;
  delete from notifications          where user_id = target_user_id;
  delete from clients                where user_id = target_user_id;
  delete from webhook_events         where user_id = target_user_id;
  delete from user_usage             where user_id = target_user_id;
  delete from rate_limit_log         where user_id = target_user_id;
  delete from csrf_tokens            where user_id = target_user_id;
  delete from error_logs             where user_id = target_user_id;
  delete from email_events           where user_id = target_user_id;
  delete from user_email_send_log    where user_id = target_user_id;
  delete from login_events           where user_id = target_user_id;
  delete from support_messages       where user_id = target_user_id;
  delete from onboarding_progress    where user_id = target_user_id;
  delete from admin_tier_overrides   where user_id = target_user_id;
  delete from audit_logs             where user_id = target_user_id;

  delete from profiles where id = target_user_id;
end;
$$;

revoke all on function public.delete_user_account(uuid) from public, anon, authenticated;

-- The trigger function is never meant to be called directly via PostgREST RPC.
revoke all on function public.prevent_blocked_email_signup() from public, anon, authenticated;
