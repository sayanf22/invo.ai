/**
 * Pure utility functions for onboarding support tracking.
 * No side effects, no database calls — used in API routes and property tests.
 */

import type { Json } from "@/lib/database.types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** The four onboarding phases in order. */
export const ONBOARDING_PHASES = ["upload", "chat", "logo", "payments"] as const
export type OnboardingPhase = (typeof ONBOARDING_PHASES)[number]

/**
 * Maps each tracked field name to its corresponding `businesses` table column.
 * 12 fields total.
 */
export const TRACKED_FIELDS = {
  businessType: "business_type",
  country: "country",
  businessName: "name",
  ownerName: "owner_name",
  email: "email",
  phone: "phone",
  address: "address",
  taxDetails: "tax_ids",
  services: "additional_notes",
  clientCountries: "client_countries",
  defaultCurrency: "default_currency",
  bankDetails: "payment_methods",
} as const

export type TrackedFieldName = keyof typeof TRACKED_FIELDS

// ---------------------------------------------------------------------------
// Type helpers (lightweight shapes used by the pure functions)
// ---------------------------------------------------------------------------

export interface OnboardingProfile {
  onboarding_complete: boolean
  last_active_at: string | null
}

export interface OnboardingProgress {
  current_phase: string
  completed_at: string | null
  updated_at?: string
}

/** Minimal business record shape matching the `businesses` table columns. */
export interface BusinessRecord {
  business_type?: string | null
  country?: string | null
  name?: string | null
  owner_name?: string | null
  email?: string | null
  phone?: string | null
  address?: Json | null
  tax_ids?: Json | null
  additional_notes?: string | null
  client_countries?: string[] | null
  default_currency?: string | null
  payment_methods?: Json | null
}

export interface ErrorLogRecord {
  error_context: string
  [key: string]: unknown
}

export interface EmailRecord {
  email?: string | null
  [key: string]: unknown
}

export interface OnboardingRecord extends EmailRecord {
  onboarding_status?: "completed" | "in-progress" | "dropped-off"
  current_phase?: string | null
  has_errors?: boolean
}

export interface OnboardingFilters {
  status?: string
  phase?: string
  errors?: string
  search?: string
}

// ---------------------------------------------------------------------------
// Error context filter options
// ---------------------------------------------------------------------------

export const ERROR_CONTEXT_FILTERS = [
  "All",
  "Upload",
  "Chat",
  "Logo",
  "Payments",
  "Non-Onboarding",
] as const
export type ErrorContextFilter = (typeof ERROR_CONTEXT_FILTERS)[number]

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Returns `true` if the trimmed message length is between 3 and 2000
 * characters inclusive.
 */
export function validateSupportMessage(message: string): boolean {
  const trimmed = message.trim()
  return trimmed.length >= 3 && trimmed.length <= 2000
}

/**
 * Computes the onboarding status from a profile and optional progress record.
 *
 * - `"completed"` — profile.onboarding_complete is true AND progress.completed_at is set
 * - `"dropped-off"` — no progress record, or last activity > 48 hours ago
 * - `"in-progress"` — otherwise
 */
export function computeOnboardingStatus(
  profile: OnboardingProfile,
  progress: OnboardingProgress | null
): "completed" | "in-progress" | "dropped-off" {
  if (profile.onboarding_complete && progress?.completed_at) return "completed"
  if (!progress) return "dropped-off" // never started tracking
  const lastActive = new Date(
    profile.last_active_at || progress.updated_at || new Date().toISOString()
  )
  const hoursSinceActive =
    (Date.now() - lastActive.getTime()) / (1000 * 60 * 60)
  if (hoursSinceActive > 48) return "dropped-off"
  return "in-progress"
}

// ---------------------------------------------------------------------------
// Field completion helpers
// ---------------------------------------------------------------------------

/** Check whether a value is a non-empty string. */
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0
}

/** Check whether a JSONB value has at least one non-empty string value. */
function hasNonEmptyJsonValue(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== "object" || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return Object.values(obj).some(
    (v) => typeof v === "string" && v.trim().length > 0
  )
}

/** Check whether a JSONB value has at least one key. */
function hasAtLeastOneKey(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value !== "object" || Array.isArray(value)) return false
  return Object.keys(value as Record<string, unknown>).length > 0
}

/** Check whether a value is a non-empty array. */
function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

/**
 * Checks each of the 12 tracked fields against the business record and
 * returns a map of field completion booleans plus the total count.
 */
export function getFieldCompletion(business: BusinessRecord): {
  fields: Record<TrackedFieldName, boolean>
  count: number
} {
  const fields: Record<TrackedFieldName, boolean> = {
    businessType: isNonEmptyString(business.business_type),
    country: isNonEmptyString(business.country),
    businessName: isNonEmptyString(business.name),
    ownerName: isNonEmptyString(business.owner_name),
    email: isNonEmptyString(business.email),
    phone: isNonEmptyString(business.phone),
    address: hasNonEmptyJsonValue(business.address),
    taxDetails: hasAtLeastOneKey(business.tax_ids),
    services: isNonEmptyString(business.additional_notes),
    clientCountries: isNonEmptyArray(business.client_countries),
    defaultCurrency: isNonEmptyString(business.default_currency),
    bankDetails: hasAtLeastOneKey(business.payment_methods),
  }

  const count = Object.values(fields).filter(Boolean).length

  return { fields, count }
}

// ---------------------------------------------------------------------------
// Filtering functions
// ---------------------------------------------------------------------------

/**
 * Case-insensitive partial match on the `email` field.
 * Returns only records whose email contains the search string.
 */
export function filterByEmailSearch<T extends EmailRecord>(
  records: T[],
  search: string
): T[] {
  if (!search || search.trim().length === 0) return records
  const lowerSearch = search.toLowerCase()
  return records.filter((r) => {
    const email = r.email
    if (!email) return false
    return email.toLowerCase().includes(lowerSearch)
  })
}

/**
 * Filters error logs by onboarding phase or non-onboarding context.
 *
 * - `"All"` — returns all logs unfiltered
 * - `"Upload"` / `"Chat"` / `"Logo"` / `"Payments"` — returns only logs
 *   where `error_context` contains `"onboarding_{phase}"`
 * - `"Non-Onboarding"` — returns only logs where `error_context` does NOT
 *   start with `"onboarding"`
 */
export function filterErrorsByContext<T extends ErrorLogRecord>(
  errors: T[],
  contextFilter: string
): T[] {
  if (!contextFilter || contextFilter === "All") return errors

  if (contextFilter === "Non-Onboarding") {
    return errors.filter(
      (e) => !e.error_context.toLowerCase().startsWith("onboarding")
    )
  }

  // Phase-specific filter: Upload, Chat, Logo, Payments
  const phase = contextFilter.toLowerCase()
  const target = `onboarding_${phase}`
  return errors.filter((e) =>
    e.error_context.toLowerCase().includes(target)
  )
}

/**
 * Combines status, phase, error, and search filters with AND logic.
 * Every record in the result satisfies ALL active filter conditions.
 */
export function applyOnboardingFilters<T extends OnboardingRecord>(
  records: T[],
  filters: OnboardingFilters
): T[] {
  let result = records

  // Status filter
  if (filters.status && filters.status !== "all") {
    result = result.filter((r) => r.onboarding_status === filters.status)
  }

  // Phase filter
  if (filters.phase && filters.phase !== "all") {
    result = result.filter(
      (r) =>
        r.current_phase?.toLowerCase() === filters.phase!.toLowerCase()
    )
  }

  // Error filter
  if (filters.errors && filters.errors !== "all") {
    if (filters.errors === "with-errors") {
      result = result.filter((r) => r.has_errors === true)
    } else if (filters.errors === "without-errors") {
      result = result.filter((r) => r.has_errors !== true)
    }
  }

  // Email search filter
  if (filters.search && filters.search.trim().length > 0) {
    result = filterByEmailSearch(result, filters.search)
  }

  return result
}
