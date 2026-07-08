/**
 * Onboarding form field model + helpers.
 *
 * A "field" is one question/input the client fills on the public /onboard/<token>
 * page. Fields are derived from the onboarding document's customQuestions at send
 * time and snapshotted into `onboarding_forms.fields` so later edits to the
 * document never retro-change a link the client is already filling.
 */

import { randomUUID } from "crypto"
import { sanitizeText } from "./sanitize"

export type OnboardingFieldType = "short_text" | "long_text" | "file"

export interface OnboardingField {
  id: string
  type: OnboardingFieldType
  label: string
  required: boolean
  placeholder?: string
  section?: string
  /** For file fields: accepted MIME types (comma-separated) + multiple flag. */
  accept?: string
  multiple?: boolean
}

/** Public token format: `onb_` + 32 lowercase hex chars. */
export const ONBOARD_TOKEN_REGEX = /^onb_[0-9a-f]{32}$/

export function generateOnboardingToken(): string {
  return `onb_${randomUUID().replace(/-/g, "")}`
}

// ── Limits (defense-in-depth against abuse) ──────────────────────────────────
export const MAX_FIELDS = 40
export const MAX_ANSWER_CHARS = 10_000
export const MAX_FILES_PER_FORM = 15
export const ONBOARD_EXPIRY_DAYS = 14

const FILE_FIELD_ID = "__attachments"

interface RawQuestion {
  id?: string
  question?: string
  answer?: string
}

/**
 * Build the client-fillable field list from an onboarding document's context.
 * - Each customQuestion becomes a long-text field.
 * - When uploads are allowed, a single multi-file field is appended for
 *   brand assets / references (logos, brand guides, examples).
 */
export function buildOnboardingFields(
  context: Record<string, unknown>,
  opts: { allowUploads: boolean },
): OnboardingField[] {
  const fields: OnboardingField[] = []

  const questions = Array.isArray(context.customQuestions)
    ? (context.customQuestions as RawQuestion[])
    : []

  for (const q of questions) {
    const label = typeof q.question === "string" ? q.question.trim() : ""
    if (!label) continue
    fields.push({
      id: typeof q.id === "string" && q.id ? q.id : `q_${randomUUID().slice(0, 8)}`,
      type: "long_text",
      label,
      required: false,
      placeholder: "Type your answer…",
      section: "Questions",
    })
    if (fields.length >= MAX_FIELDS) break
  }

  if (opts.allowUploads && fields.length < MAX_FIELDS) {
    fields.push({
      id: FILE_FIELD_ID,
      type: "file",
      label: "Brand assets & references",
      required: false,
      placeholder: "Upload your logo, brand guide, or example files",
      section: "Files",
      accept: "image/png,image/jpeg,image/webp,image/gif,application/pdf",
      multiple: true,
    })
  }

  return fields
}

export function isFileField(field: OnboardingField): boolean {
  return field.type === "file"
}

export interface FileRef {
  fileId: string
  fileName: string
}

/**
 * Sanitize a client-submitted answers map against the form's known fields.
 * Drops unknown keys, caps string lengths, and normalizes file-field values to
 * an array of `{ fileId, fileName }` refs. Never throws.
 */
export function sanitizeOnboardingAnswers(
  fields: OnboardingField[],
  raw: Record<string, unknown>,
): Record<string, string | FileRef[]> {
  const byId = new Map(fields.map((f) => [f.id, f]))
  const out: Record<string, string | FileRef[]> = {}
  for (const [key, value] of Object.entries(raw || {})) {
    const field = byId.get(key)
    if (!field) continue
    if (field.type === "file") {
      if (Array.isArray(value)) {
        out[key] = value
          .slice(0, MAX_FILES_PER_FORM)
          .map((v: any): FileRef => ({
            fileId: typeof v?.fileId === "string" ? v.fileId.slice(0, 64) : "",
            fileName: typeof v?.fileName === "string" ? sanitizeText(v.fileName).slice(0, 255) : "",
          }))
          .filter((v) => v.fileId)
      }
    } else {
      out[key] = typeof value === "string" ? sanitizeText(value).slice(0, MAX_ANSWER_CHARS) : ""
    }
  }
  return out
}

/**
 * Merge submitted answers back into the document context so the owner's
 * generated PDF shows the completed answers (customQuestions[].answer) and a
 * short note listing any uploaded files. Returns a NEW context object; never
 * mutates the input.
 */
export function applyAnswersToContext(
  context: Record<string, unknown>,
  fields: OnboardingField[],
  answers: Record<string, unknown>,
  uploadedFileNames: string[],
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...context }

  const questions = Array.isArray(context.customQuestions)
    ? (context.customQuestions as RawQuestion[])
    : []

  next.customQuestions = questions.map((q) => {
    const id = typeof q.id === "string" ? q.id : ""
    const raw = id && typeof answers[id] === "string" ? (answers[id] as string) : q.answer ?? ""
    return { ...q, answer: raw }
  })

  if (uploadedFileNames.length > 0) {
    const existingNotes = typeof next.notes === "string" ? next.notes : ""
    const filesLine = `Client-uploaded files: ${uploadedFileNames.join(", ")}`
    next.notes = existingNotes ? `${existingNotes}\n\n${filesLine}` : filesLine
  }

  return next
}
