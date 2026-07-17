import { describe, expect, it } from "vitest"
import { canUseNativeOnboardingUploads } from "@/lib/onboarding-entitlements"
import { buildOnboardingFields, FILE_FIELD_ID } from "@/lib/onboarding-fields"
import type { UserTier } from "@/lib/cost-protection"

const CASES: Array<{ tier: UserTier; allowed: boolean }> = [
  { tier: "free", allowed: false },
  { tier: "starter", allowed: true },
  { tier: "pro", allowed: true },
  { tier: "agency", allowed: true },
]

describe("native onboarding upload entitlement", () => {
  it.each(CASES)("returns $allowed for $tier", ({ tier, allowed }) => {
    expect(canUseNativeOnboardingUploads(tier)).toBe(allowed)
  })

  it.each(CASES)("builds the snapshotted file field for $tier", ({ tier, allowed }) => {
    const fields = buildOnboardingFields(
      { customQuestions: [{ id: "q1", question: "What does success look like?", answer: "" }] },
      { allowUploads: canUseNativeOnboardingUploads(tier) },
    )

    expect(fields.some((field) => field.id === FILE_FIELD_ID)).toBe(allowed)
  })
})
