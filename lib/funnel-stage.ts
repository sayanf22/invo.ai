/**
 * Funnel stage detection — works out exactly where a user is in the journey
 * and, if they stalled, where they got stuck.
 *
 * Real signup → app journey (derived from the auth/session-sync flow):
 *   1. signed_up        — account created
 *   2. returned         — logged in again after signup
 *   3. choose_plan      — must pick a plan (profiles.plan_selected = false)
 *   4. onboarding       — building business profile (onboarding_progress.current_phase)
 *   5. activated        — onboarding done, first document not yet created
 *   6. active           — creating documents
 *
 * Pure function — no DB calls, no side effects. Safe for tests and edge runtime.
 */

export interface FunnelInputs {
  createdAt: string
  lastActiveAt: string | null
  planSelected: boolean
  onboardingComplete: boolean
  onboardingPhase: string | null // onboarding_progress.current_phase
  docsCount: number
}

export type FunnelStageId =
  | "signed_up_no_return"
  | "choose_plan"
  | "onboarding"
  | "activated_no_docs"
  | "active"

export interface FunnelStage {
  id: FunnelStageId
  /** Short label for a badge/column. */
  label: string
  /** Human sentence describing exactly where they are / got stuck. */
  detail: string
  /** True when the user appears stalled at this step (not progressing). */
  stuck: boolean
}

/** Friendly names for the onboarding sub-phases. */
const PHASE_LABELS: Record<string, string> = {
  upload: "document upload",
  chat: "the AI chat",
  logo: "logo upload",
  payments: "payment setup",
  completed: "wrapping up onboarding",
}

function phaseLabel(phase: string | null): string {
  if (!phase) return "onboarding"
  return PHASE_LABELS[phase.toLowerCase()] ?? phase
}

/**
 * Returns the user's current funnel stage. The `nowMs` arg is injectable for tests.
 */
export function computeFunnelStage(input: FunnelInputs, nowMs: number = Date.now()): FunnelStage {
  const created = new Date(input.createdAt).getTime()
  const lastActive = input.lastActiveAt ? new Date(input.lastActiveAt).getTime() : created
  const daysSinceActive = Math.floor((nowMs - lastActive) / 86400000)
  // "Returned" = was active more than ~3 minutes after signing up.
  const hasReturned = lastActive - created > 3 * 60 * 1000

  // 6 / 5 — onboarding complete
  if (input.onboardingComplete) {
    if (input.docsCount > 0) {
      return {
        id: "active",
        label: "Active",
        detail: `Onboarded and creating documents (${input.docsCount} so far).`,
        stuck: false,
      }
    }
    return {
      id: "activated_no_docs",
      label: "No documents yet",
      detail: "Finished onboarding but hasn't created a single document yet.",
      stuck: daysSinceActive >= 2,
    }
  }

  // 4 — onboarding in progress (plan already chosen)
  if (input.planSelected) {
    const label = phaseLabel(input.onboardingPhase)
    return {
      id: "onboarding",
      label: input.onboardingPhase ? `Onboarding · ${input.onboardingPhase}` : "Onboarding",
      detail: input.onboardingPhase
        ? `Stuck partway through onboarding — last seen at ${label}.`
        : "Started onboarding but hasn't completed their business profile.",
      stuck: daysSinceActive >= 1,
    }
  }

  // 3 — hasn't picked a plan yet
  if (hasReturned) {
    return {
      id: "choose_plan",
      label: "Choosing plan",
      detail: "Logged in but hasn't selected a plan yet (stuck at the choose-plan step).",
      stuck: daysSinceActive >= 1,
    }
  }

  // 1/2 — signed up, never meaningfully returned
  return {
    id: "signed_up_no_return",
    label: "Signed up",
    detail: "Created an account but never really came back after signup.",
    stuck: daysSinceActive >= 2,
  }
}
