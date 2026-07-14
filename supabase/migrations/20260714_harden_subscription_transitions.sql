-- Durable, recoverable Razorpay subscription transitions.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan text,
  ADD COLUMN IF NOT EXISTS pending_billing_cycle text,
  ADD COLUMN IF NOT EXISTS pending_razorpay_subscription_id text,
  ADD COLUMN IF NOT EXISTS pending_change_type text,
  ADD COLUMN IF NOT EXISTS pending_effective_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_previous_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_sync_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_event_type text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_plan_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pending_plan_check
      CHECK (pending_plan IS NULL OR pending_plan IN ('free', 'starter', 'pro', 'agency'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_billing_cycle_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pending_billing_cycle_check
      CHECK (pending_billing_cycle IS NULL OR pending_billing_cycle IN ('monthly', 'yearly'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_pending_change_type_check') THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pending_change_type_check
      CHECK (pending_change_type IS NULL OR pending_change_type IN ('upgrade', 'cycle_change', 'downgrade', 'cancellation', 'provider_sync'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subscriptions_pending_razorpay_id
  ON public.subscriptions (pending_razorpay_subscription_id)
  WHERE pending_razorpay_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.subscriptions.provider_sync_required IS
  'True when Razorpay accepted a mutation but local state still needs authoritative reconciliation.';