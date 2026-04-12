# Requirements Document

## Introduction

This feature improves the profile update AI chat flow in the Clorefy application. The current implementation has several issues: file upload data replaces existing profile fields instead of merging, the AI loses context about the current profile state after updates, the follow-up call after file extraction uses a fragile setTimeout pattern, the file attachment UI in the profile update chat is inconsistent with the main invoice chat, and the AI does not gracefully handle ambiguous user input. This spec addresses all five areas to deliver a reliable, context-aware, and visually consistent profile update experience.

## Glossary

- **Profile_Update_Chat**: The React component (`components/profile-update-chat.tsx`) that provides a conversational interface for updating the user's business profile, operating in "full" mode (dialog with file upload) or "section" mode (inline, no file upload).
- **Profile_Update_API**: The server-side API route (`/api/ai/profile-update/route.ts`) that processes text-based profile update messages using DeepSeek V3 Chat and returns structured JSON with extracted data.
- **File_Analysis_API**: The server-side API route (`/api/ai/analyze-file/route.ts`) that uses OpenAI GPT-5.4 to extract structured business data from uploaded images and PDFs.
- **Data_Merger**: The logic responsible for combining newly extracted profile fields with existing profile data, preserving non-null existing values when new data does not provide a replacement.
- **AIInputWithLoading**: The shared input component (`components/ui/ai-input-with-loading.tsx`) used in the invoice chat that provides a styled textarea with staged file preview, attachment button, and loading states.
- **Current_Profile_State**: The latest snapshot of the user's business profile as stored in the Supabase `businesses` table, including all fields such as name, address, tax IDs, payment methods, and notes.
- **Clarification_Flow**: The conversational pattern where the AI asks the user for more information when a message is ambiguous, rather than silently failing or extracting incorrect data.
- **mapExtractedToDbUpdate**: The function in `profile-update-chat.tsx` that maps AI-extracted field names (camelCase) to database column names (snake_case) for Supabase updates.

## Requirements

### Requirement 1: Intelligent Data Merging on File Upload

**User Story:** As a user, I want uploaded file data to be merged with my existing profile so that new information supplements rather than overwrites what I already have.

#### Acceptance Criteria

1. WHEN the File_Analysis_API returns extracted data and the Current_Profile_State already contains a value for a given field, THE Data_Merger SHALL preserve the existing value and only overwrite the field if the extracted value is non-null and non-empty.
2. WHEN the File_Analysis_API returns an address object with only a subset of sub-fields populated (e.g., only `state`), THE Data_Merger SHALL merge the new sub-fields into the existing address object, preserving all existing sub-fields (e.g., `city`, `street`) that are not present in the extracted data.
3. WHEN the File_Analysis_API returns `bankDetails` with partial fields, THE Data_Merger SHALL merge the new bank detail fields into the existing `payment_methods.bank` object, preserving all existing bank fields not present in the extracted data.
4. WHEN the File_Analysis_API returns `tax_ids` data, THE Data_Merger SHALL merge the new tax ID entries into the existing `tax_ids` object using a shallow merge, preserving any existing tax ID keys not present in the extracted data.
5. WHEN the File_Analysis_API returns `clientCountries` as an array, THE Data_Merger SHALL produce a deduplicated union of the existing `client_countries` array and the newly extracted array.

### Requirement 2: AI-Guided Missing Field Completion After File Upload

**User Story:** As a user, I want the AI to review my profile after a file upload and guide me through completing any remaining missing fields so that my profile becomes fully populated.

#### Acceptance Criteria

1. WHEN the Profile_Update_Chat completes a file upload and applies extracted data, THE Profile_Update_Chat SHALL send a follow-up request to the Profile_Update_API with the merged Current_Profile_State (including the just-applied updates) and the file extraction context.
2. THE Profile_Update_API SHALL receive the merged profile state in the `currentProfile` field so that the system prompt accurately reflects which fields are filled and which are missing after the file upload.
3. WHEN the Profile_Update_API receives a follow-up request with `fileExtracted` context, THE Profile_Update_API SHALL generate a response that acknowledges the extracted fields and asks about the next most important missing field.
4. THE Profile_Update_Chat SHALL invoke the follow-up request using an `await`-based sequential call after the database update completes, not using `setTimeout` or any timer-based delay.

### Requirement 3: Continuous Profile State Awareness

**User Story:** As a user, I want the AI to always know the latest state of my profile so that it does not ask about fields I have already provided or miss fields that are still empty.

#### Acceptance Criteria

1. WHEN the Profile_Update_Chat applies an update to the database via `applyUpdates`, THE Profile_Update_Chat SHALL refresh the Current_Profile_State by calling `onProfileUpdated` and then use the refreshed state for all subsequent AI requests.
2. WHEN the Profile_Update_Chat sends a message to the Profile_Update_API, THE Profile_Update_Chat SHALL include the most recently known Current_Profile_State in the request body, reflecting all updates made during the current chat session.
3. WHILE the Profile_Update_Chat is in an active session, THE Profile_Update_Chat SHALL maintain a local reference to the latest profile state that is updated after every successful database write, so that the next AI call always receives the freshest data.

### Requirement 4: Graceful Clarification on Ambiguous Input

**User Story:** As a user, I want the AI to ask me a clear clarification question when it cannot determine which field I am updating so that I am never confused by incorrect extractions.

#### Acceptance Criteria

1. WHEN the Profile_Update_API returns `needsClarification` as `true`, THE Profile_Update_Chat SHALL display the AI's clarification message to the user without applying any data updates to the database.
2. WHEN the Profile_Update_API returns `needsClarification` as `true`, THE Profile_Update_Chat SHALL keep the chat input focused and ready for the user to respond to the clarification question.
3. THE Profile_Update_API system prompt SHALL instruct the AI to set `needsClarification` to `true` only when the user's message is genuinely ambiguous (e.g., "change it" without specifying a field or value), and to always attempt extraction first when the user provides a recognizable value.
4. WHEN the Profile_Update_API returns both `needsClarification` as `true` and a non-empty `extractedData` object, THE Profile_Update_Chat SHALL prioritize the clarification flag and SHALL NOT apply the extracted data until the user confirms.

### Requirement 5: Consistent File Attachment UI

**User Story:** As a user, I want the file upload experience in the profile update chat to look and behave the same as the main invoice chat so that the interface feels cohesive and familiar.

#### Acceptance Criteria

1. WHEN the Profile_Update_Chat is in "full" mode, THE Profile_Update_Chat SHALL use the AIInputWithLoading component as its text input and file attachment interface, replacing the current separate Input, Paperclip Button, and staged file bar.
2. THE Profile_Update_Chat SHALL pass the `showAttachButton` prop as `true`, the `stagedFile` state, the `onFileSelect` handler, and the `onFileRemove` handler to the AIInputWithLoading component, matching the same prop pattern used in the invoice chat.
3. WHEN a file is staged in the AIInputWithLoading component, THE Profile_Update_Chat SHALL display the file preview card inside the input area using the same inline card layout (file icon, file name, file size, remove button) as the AIInputWithLoading component renders.
4. WHEN the Profile_Update_Chat is in "section" mode, THE Profile_Update_Chat SHALL NOT display the file attachment button, consistent with the current behavior where section mode does not support file uploads.
5. THE Profile_Update_Chat SHALL display a loading state with the text "Analyzing file..." in the AIInputWithLoading status area while a file upload is in progress, matching the `isUploading` prop behavior.

### Requirement 6: Merged Profile State in System Prompt

**User Story:** As a developer, I want the profile update system prompt to explicitly instruct the AI to merge new data with existing data so that the AI never suggests replacing filled fields with empty values.

#### Acceptance Criteria

1. THE Profile_Update_API system prompt SHALL include an explicit instruction that new data from user messages or file extractions must be merged with existing profile data, and that existing non-empty values must not be overwritten with null or empty values.
2. WHEN the Profile_Update_API builds the system prompt, THE Profile_Update_API SHALL list each filled field with its current value and each missing field by name, so the AI has full visibility into the Current_Profile_State.
3. THE Profile_Update_API system prompt SHALL instruct the AI to only include fields in `extractedData` that the user explicitly mentioned or that were extracted from a document, and to never set a field to null or empty string if it already has a value in the current profile.
