import type { UserTier } from "@/lib/cost-protection"

/**
 * Native onboarding uploads are a paid-plan feature.
 *
 * This decision is evaluated when the owner sends a form and then snapshotted
 * into onboarding_forms.allow_uploads. Existing links therefore keep the exact
 * entitlement they were created with, even if the owner's plan later changes.
 */
export function canUseNativeOnboardingUploads(tier: UserTier): boolean {
  return tier === "starter" || tier === "pro" || tier === "agency"
}
