/**
 * Onboarding form field model + helpers.
 *
 * A "field" is one question/input the client fills on the public /onboard/<token>
 * page. Fields are derived from the onboarding document's customQuestions at send
 * time and snapshotted into `onboarding_forms.fields` so later edits to the
 * document never retro-change a link the client is already filling.
 */

import { randomUUID } from "crypto"
import { sanitizeText, safeExternalUrl } from "./sanitize"

export type OnboardingFieldType = "short_text" | "long_text" | "file" | "external_link"

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
  /** For external_link fields: the owner-provided URL the client opens to upload. */
  externalUrl?: string
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

export const FILE_FIELD_ID = "__attachments"
export const ASSET_LINK_FIELD_ID = "__asset_link"
export const CLIENT_LINK_FIELD_ID = "__client_link"
const ASSETS_SECTION = "Files & Assets"

interface RawQuestion {
  id?: string
  question?: string
  answer?: string
}

/**
 * Build the client-fillable field list from an onboarding document's context.
 * - Each customQuestion becomes a long-text field.
 * - Files & Assets section (when relevant):
 *   • external_link → owner's cloud folder (Drive/Dropbox) if they provided one
 *   • file          → native compressed upload (Pro+ only)
 *   • short_text    → the client's own file link (optional)
 */
export function buildOnboardingFields(
  context: Record<string, unknown>,
  opts: { allowUploads: boolean; assetUploadLink?: string | null },
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

  const assetLink = safeExternalUrl(opts.assetUploadLink)
  const hasAssetsSection = !!assetLink || opts.allowUploads

  if (assetLink && fields.length < MAX_FIELDS) {
    fields.push({
      id: ASSET_LINK_FIELD_ID,
      type: "external_link",
      label: "Upload your assets",
      required: false,
      placeholder: "Upload your logo, brand guide, and files to our shared folder",
      section: ASSETS_SECTION,
      externalUrl: assetLink,
    })
  }

  if (opts.allowUploads && fields.length < MAX_FIELDS) {
    fields.push({
      id: FILE_FIELD_ID,
      type: "file",
      label: "Brand assets & references",
      required: false,
      placeholder: "Upload your logo, brand guide, or example files",
      section: ASSETS_SECTION,
      accept: "image/png,image/jpeg,image/webp,image/gif,application/pdf",
      multiple: true,
    })
  }

  if (hasAssetsSection && fields.length < MAX_FIELDS) {
    fields.push({
      id: CLIENT_LINK_FIELD_ID,
      type: "short_text",
      label: "Or paste a link to your files (optional)",
      required: false,
      placeholder: "e.g. a Google Drive or Dropbox share link",
      section: ASSETS_SECTION,
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

  // Build a lookup from field-id → answer value. Field ids were assigned in
  // buildOnboardingFields (using q.id when present, otherwise q_<random>).
  // The original context's customQuestions[].id may be empty/missing, so we
  // also map by positional index as a fallback.
  // Only long_text fields map to customQuestions (asset/link fields are appended
  // after and must NOT interfere with the positional fallback).
  const questionFields = fields.filter((f) => f.type === "long_text")
  const answerByFieldId = new Map<string, string>()
  for (const f of questionFields) {
    const v = answers[f.id]
    if (typeof v === "string") answerByFieldId.set(f.id, v)
  }

  next.customQuestions = questions.map((q, idx) => {
    const qId = typeof q.id === "string" ? q.id : ""
    // Try direct id match first, then positional fallback (by question order).
    let answer: string | undefined
    if (qId && answerByFieldId.has(qId)) {
      answer = answerByFieldId.get(qId)
    } else if (idx < questionFields.length) {
      answer = answerByFieldId.get(questionFields[idx].id)
    }
    return { ...q, answer: answer ?? q.answer ?? "" }
  })

  // Capture the client's own file link + uploaded file names into DEDICATED
  // context fields — never into `notes`. `notes` is a plain free-text field
  // the owner edits directly in the editor panel (editor-panel.tsx), so
  // mixing file-tracking text into it meant an owner editing their notes
  // could garble or delete it, and the raw tracking text ("Client-uploaded
  // files: ...") showed up inside an editable textarea, which looked broken.
  // These fields have no editor UI binding, so they never surface there.
  const clientLink = typeof answers[CLIENT_LINK_FIELD_ID] === "string" ? (answers[CLIENT_LINK_FIELD_ID] as string).trim() : ""
  if (clientLink) next.clientFileLink = clientLink
  if (uploadedFileNames.length > 0) next.clientUploadedFileNames = uploadedFileNames

  return next
}
