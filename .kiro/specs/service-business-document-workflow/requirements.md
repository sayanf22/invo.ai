# Requirements Document

## Introduction

Clorefy currently supports 4 document types (invoice, contract, quotation, proposal) for service businesses. This spec expands the platform to 10 document types covering the full client-work lifecycle — from initial confidentiality agreements through onboarding, scoping, change management, billing, and payment follow-up.

The expansion adds 6 new document types: Quote (replacing "quotation" naming), SOW (Statement of Work), Change Order, NDA (Non-Disclosure Agreement), Client Onboarding Form, and Payment Follow-up/Reminder. The existing chat-first flow, intent classification, tier enforcement, signature workflow, document linking, PDF export, and history UI must all be extended to support the full set of 10 types without breaking any existing functionality.

Key design constraint: the existing split-screen layout, chat-only screen, onboarding flow, authentication, billing infrastructure, R2 storage, admin dashboard, and landing pages remain unchanged. Only the document-type layer and its integrations are expanded.

## Glossary

- **Clorefy**: The AI-powered document generation platform (product name).
- **Intent_Classifier**: The server-side module (`lib/intent-router.ts`) that analyzes user prompts and routes them to the appropriate document type or chat flow.
- **Document_Type_Detector**: The server-side module (`lib/server/document-type-detector.ts`) that detects document type from prompt keywords with confidence scoring.
- **Chat_System_Prompt**: The system prompt (`lib/chat-only-prompts.ts`) that governs AI behavior in chat-only sessions, including CREATE_CARD signal emission.
- **CREATE_CARD**: The inline signal `[CREATE_CARD:{"type":"...","summary":"..."}]` emitted by the AI to trigger document creation from chat.
- **Tier_System**: The subscription-based access control (`lib/cost-protection.ts`) that gates document types and usage limits by plan level.
- **Signature_Workflow**: The existing e-signature infrastructure (token-based signing, signature pad, email notifications) currently used for contracts.
- **Document_Linking**: The existing chain system that connects related documents (e.g., invoice linked to contract) via `chain_id`.
- **PDF_Template**: A React PDF renderer template (`lib/pdf-templates.tsx`) that defines the visual layout for a specific document type.
- **Session_History_Sidebar**: The sidebar component (`components/session-history-sidebar.tsx`) showing recent sessions with type-based icons and filters.
- **History_Page**: The full-page history view (`app/history/page.tsx`) showing all sessions grouped by chain/client.
- **Quote**: A binding price offer for specific work with line items, total, and validity period. Replaces the "quotation" naming.
- **SOW**: Statement of Work — detailed scope, deliverables, timeline, and milestones. A sub-document under a contract.
- **Change_Order**: An amendment to an existing SOW or contract that documents additions, removals, or modifications to agreed scope.
- **NDA**: Non-Disclosure Agreement — a confidentiality agreement with defined terms, obligations, and duration.
- **Client_Onboarding_Form**: An intake form structured as questions and answers to collect client details, project requirements, and preferences.
- **Payment_Followup**: A polite payment reminder referencing an existing invoice and its payment link.
- **Parent_Document**: The document that a Change Order or SOW references as its origin (a contract for SOW, a SOW/contract for Change Order).

## Requirements

### Requirement 1: Document Type Registry Expansion

**User Story:** As a service business owner, I want access to 10 document types covering my full client-work lifecycle, so that I can handle every stage from NDA through final payment within one platform.

#### Acceptance Criteria

1. THE Clorefy platform SHALL support exactly 10 document types: `invoice`, `contract`, `quote`, `proposal`, `sow`, `change_order`, `nda`, `client_onboarding_form`, `payment_followup`, `recurring_invoice`.
2. WHEN the system stores or reads a `document_type` value THEN the system SHALL accept all 10 type values in the `document_sessions.document_type` TEXT column without requiring a schema migration (the column has no CHECK constraint).
3. THE system SHALL treat `quote` as the canonical type value, replacing the previous `quotation` value. WHEN the system encounters a legacy `quotation` value in existing data THEN the system SHALL display it as "Quote" in the UI.
4. THE system SHALL define a centralized type registry (constants file) mapping each type to its display label, icon, color, description, and capabilities (supports_signature, supports_payment_link, supports_linking).
5. WHEN a new document type is referenced anywhere in the codebase THEN the system SHALL use the centralized registry as the single source of truth for type metadata.

### Requirement 2: Tier Access Control Update

**User Story:** As a platform operator, I want the tier system to gate access so that free users get invoice + contract + quote, while paid users get all 10 types, so that the free tier remains useful while incentivizing upgrades.

#### Acceptance Criteria

1. THE Tier_System SHALL enforce the following access rules: Free tier allows `invoice`, `contract`, and `quote` only; Starter, Pro, and Agency tiers allow all 10 document types. THE system SHALL ensure `invoice` is always accessible to free-tier users — invoice access SHALL never be denied on the basis of tier.
2. WHEN a free-tier user attempts to create or promote a session to a type not in their allowed set THEN the system SHALL return a 403 response with a clear upgrade message naming the restricted type and the minimum tier required.
3. WHEN a free-tier user asks the AI about a restricted type in chat THEN the AI SHALL explain the type, answer questions about it, but include a note that creating it requires a Starter plan or above.
4. THE `allowedDocTypes` arrays in `TIER_LIMITS` within `lib/cost-protection.ts` SHALL be updated to reflect the new type sets without changing the existing `checkDocumentTypeAllowed()` function signature.
5. WHEN the tier access rules change in the future THEN only the `TIER_LIMITS` constant needs updating — no other code paths SHALL contain hardcoded type-to-tier mappings.

### Requirement 3: Intent Classifier Extension

**User Story:** As a user describing my needs in natural language, I want the AI to correctly infer which of the 10 document types I need from my conversation, so that I get the right document without needing to know exact type names.

#### Acceptance Criteria

1. THE Intent_Classifier SHALL detect all 10 document types from user prompts using keyword and context analysis.
2. WHEN a user mentions price discussion, cost breakdown, or binding offer THEN the Intent_Classifier SHALL suggest `quote`.
3. WHEN a user mentions project pitch, selling capabilities, or winning work THEN the Intent_Classifier SHALL suggest `proposal`.
3a. WHEN keywords in a user prompt overlap across multiple document type categories THEN the Intent_Classifier SHALL be permitted to return more than one suggested document type, ranked by confidence, so the calling layer can disambiguate with the user.
4. WHEN a user mentions scope, legal terms, or service agreement THEN the Intent_Classifier SHALL suggest `contract`.
5. WHEN a user mentions detailed deliverables, milestones, or project timeline THEN the Intent_Classifier SHALL suggest `sow`.
6. WHEN a user mentions extra work after agreement, scope change, or amendment THEN the Intent_Classifier SHALL suggest `change_order`.
7. WHEN a user mentions confidentiality, sensitive information, or NDA THEN the Intent_Classifier SHALL suggest `nda`.
8. WHEN a user mentions starting a project, collecting client info, or intake THEN the Intent_Classifier SHALL suggest `client_onboarding_form`.
9. WHEN a user mentions payment reminder, overdue notice, or follow-up on unpaid invoice THEN the Intent_Classifier SHALL suggest `payment_followup`.
10. WHEN a user mentions billing, amount owed, or services rendered THEN the Intent_Classifier SHALL suggest `invoice`.
11. WHEN a user mentions monthly billing, weekly billing, or recurring charges THEN the Intent_Classifier SHALL suggest `recurring_invoice`.
12. THE Intent_Classifier SHALL remain deterministic and side-effect free, enabling unit testing with a fixed table of prompts mapped to expected types.

### Requirement 4: Document Type Detector Extension

**User Story:** As a developer maintaining the detection system, I want the keyword-based document type detector to recognize all 10 types with appropriate confidence scoring, so that the system can auto-detect types without AI calls.

#### Acceptance Criteria

1. THE Document_Type_Detector SHALL define keyword patterns for all 10 document types with weighted scoring.
2. WHEN the detector analyzes a prompt containing SOW-specific keywords (`statement of work`, `sow`, `deliverables`, `milestones`, `timeline`, `phases`) THEN the detector SHALL return `sow` with confidence proportional to keyword density.
3. WHEN the detector analyzes a prompt containing Change Order keywords (`change order`, `amendment`, `scope change`, `modification`, `revision`, `addendum`) THEN the detector SHALL return `change_order`.
4. WHEN the detector analyzes a prompt containing NDA keywords (`nda`, `non-disclosure`, `confidentiality`, `confidential`, `secret`, `proprietary`) THEN the detector SHALL return `nda`.
5. WHEN the detector analyzes a prompt containing onboarding form keywords (`onboarding`, `intake`, `client details`, `questionnaire`, `client form`, `project requirements`) THEN the detector SHALL return `client_onboarding_form`.
6. WHEN the detector analyzes a prompt containing payment follow-up keywords (`reminder`, `follow up`, `overdue`, `payment reminder`, `past due`, `outstanding`) THEN the detector SHALL return `payment_followup`.
7. WHEN the detector analyzes a prompt containing recurring invoice keywords (`recurring`, `monthly invoice`, `weekly billing`, `subscription billing`, `repeat invoice`) THEN the detector SHALL return `recurring_invoice`.
8. THE detector SHALL update the `DocumentType` type export to include all 10 types.
9. THE detector SHALL maintain backward compatibility — existing prompts that previously detected as `quotation` SHALL now detect as `quote`.

### Requirement 5: Chat System Prompt Update

**User Story:** As a user chatting with the AI, I want the assistant to know about all 10 document types and recommend the right one for my situation, so that I always end up with the most appropriate document.

#### Acceptance Criteria

1. THE Chat_System_Prompt SHALL list all 10 supported document types with brief descriptions of when each is appropriate.
2. THE Chat_System_Prompt SHALL instruct the AI to recommend `sow` when the user describes detailed project scope that goes beyond a simple contract.
3. THE Chat_System_Prompt SHALL instruct the AI to recommend `change_order` when the user describes modifications to an existing agreement.
4. THE Chat_System_Prompt SHALL instruct the AI to recommend `nda` when the user discusses confidentiality needs before sharing sensitive information.
5. THE Chat_System_Prompt SHALL instruct the AI to recommend `client_onboarding_form` when the user wants to collect structured information from a new client.
6. THE Chat_System_Prompt SHALL instruct the AI to recommend `payment_followup` when the user wants to remind a client about an unpaid invoice.
7. THE CREATE_CARD signal regex SHALL be updated to accept all 10 type values in the `type` field.
8. THE `ParsedCreateCard` type SHALL be updated to include all 10 document types as valid values.
9. THE Chat_System_Prompt SHALL instruct the AI to suggest document linking when appropriate (e.g., "I see you have a contract with this client — want me to create a SOW linked to it?").

### Requirement 6: Signature Workflow Extension

**User Story:** As a user creating NDAs, SOWs, or Change Orders, I want the same e-signature workflow that works for contracts to be available for these document types, so that I can get legally binding signatures without a different process.

#### Acceptance Criteria

1. THE Signature_Workflow SHALL be available for exactly 4 document types: `contract`, `nda`, `sow`, `change_order`.
2. WHEN a user generates an NDA, SOW, or Change Order THEN the system SHALL display the same "Request Signature" button and flow currently available for contracts.
3. THE signature token generation, email notification, signing page, and signature storage SHALL reuse the existing infrastructure without modification to the signing flow itself.
4. WHEN a document requiring signature is exported as PDF THEN the PDF SHALL include a signature block section appropriate to the document type (e.g., "Disclosing Party" and "Receiving Party" for NDA, "Client" and "Provider" for SOW). IF the signature block cannot be rendered into the exported PDF for any reason THEN the system SHALL block the export and surface an error to the user rather than producing a PDF without the signature section.
5. THE system SHALL NOT offer signature functionality for `invoice`, `quote`, `proposal`, `client_onboarding_form`, `payment_followup`, or `recurring_invoice`.
6. IF a user requests a signature on a non-signable document type THEN the AI SHALL explain that signatures are not applicable for that type and suggest the appropriate alternative.

### Requirement 7: Document Linking and Parent References

**User Story:** As a user managing a client engagement, I want my SOW to link to its parent contract and my Change Orders to link to their parent SOW, so that I can navigate the full document chain and maintain traceability.

#### Acceptance Criteria

1. THE Document_Linking system SHALL support the following parent-child relationships: SOW links to a parent Contract, Change Order links to a parent SOW or Contract.
2. WHEN a user creates a SOW THEN the system SHALL prompt for or auto-detect the parent contract from the same client chain and store the link via the existing `chain_id` mechanism.
3. WHEN a user creates a Change Order THEN the system SHALL require a reference to the parent document (SOW or Contract) and display what is being changed relative to the parent.
4. THE Change Order document SHALL include a structured diff section showing additions, removals, and modifications relative to the parent document scope.
5. WHEN a user views a Contract that has linked SOWs or Change Orders THEN the chain navigator SHALL display the full document tree for that engagement.
6. THE Payment_Followup document SHALL link to the original invoice it references and SHALL include the invoice's payment link URL.
7. WHEN a user creates a Payment Follow-up THEN the system SHALL auto-populate the referenced invoice number, amount, due date, and payment link from the linked invoice.

### Requirement 8: PDF Template Creation for New Types

**User Story:** As a user exporting documents, I want professional PDF templates for all 10 document types, so that every document I send to clients looks polished and type-appropriate.

#### Acceptance Criteria

1. THE system SHALL provide PDF templates for all 10 document types using the existing `@react-pdf/renderer` infrastructure.
2. THE SOW PDF template SHALL include sections for: project overview, scope of work, deliverables table, timeline/milestones, assumptions, acceptance criteria, and signature blocks.
3. THE Change Order PDF template SHALL include sections for: change order number, reference to parent document, description of changes (additions/removals/modifications), impact on timeline, impact on cost, and signature blocks.
4. THE NDA PDF template SHALL include sections for: parties identification, definition of confidential information, obligations, exclusions, term and duration, remedies, and signature blocks.
5. THE Client Onboarding Form PDF template SHALL include sections for: client contact details, project overview, requirements summary, timeline preferences, budget range, and any custom questions/answers.
6. THE Payment Follow-up PDF template SHALL include sections for: reference to original invoice (number, date, amount), payment status, payment link, polite reminder message, and contact details for questions.
7. THE Quote PDF template SHALL include sections for: quote number, validity period, line items with descriptions/quantities/rates, subtotal, tax, total, and terms/conditions. It SHALL reuse the existing quotation template structure with updated naming.
8. ALL PDF templates SHALL support the existing country-specific compliance rules and formatting (11 countries).
9. ALL PDF templates SHALL be responsive to content length — sections with no data SHALL be omitted rather than showing empty placeholders.

### Requirement 9: UI Updates for 10 Document Types

**User Story:** As a user navigating the platform, I want all screens (history, sidebar, start screen, documents page) to display proper icons, colors, and labels for all 10 document types, so that I can quickly identify and filter my documents.

#### Acceptance Criteria

1. THE History_Page SHALL display distinct icons and colors for all 10 document types using the centralized type registry.
2. THE Session_History_Sidebar SHALL display distinct icons and colors for all 10 document types.
3. THE History_Page filter pills SHALL include filters for the most common types. WHEN the filter list exceeds 6 items THEN the system SHALL group less common types under a "More" dropdown or show the top 6 with an expandable section.
4. THE Session_History_Sidebar filter pills SHALL match the History_Page filter structure.
5. THE start screen category pills SHALL display the top 5-6 most commonly used document types (not all 10) to avoid overwhelming new users. THE remaining types SHALL be accessible via an "All types" or "More" option.
6. THE documents page SHALL list and filter by all 10 document types.
7. WHEN a document type has no custom icon defined THEN the system SHALL fall back to a generic document icon with a neutral color, preventing UI errors.
8. ALL UI updates SHALL maintain full responsiveness on mobile devices (viewport width below 768px).

### Requirement 10: Editor Panel Support for New Types

**User Story:** As a user editing a generated document, I want the editor panel to support all 10 document types with appropriate field layouts, so that I can modify any part of my document before exporting.

#### Acceptance Criteria

1. WHILE the Editor_Panel is the active view for a session THE Editor_Panel SHALL render type-specific field layouts for all 10 document types. WHEN the Editor_Panel is not the active view THEN type-specific field layouts SHALL NOT be rendered.
2. WHEN editing a SOW THEN the editor SHALL display editable sections for: project overview, scope items (add/remove/reorder), deliverables table, milestones with dates, and assumptions.
3. WHEN editing a Change Order THEN the editor SHALL display: parent document reference (read-only link), change description fields, additions list, removals list, modifications list, and cost/timeline impact fields.
4. WHEN editing an NDA THEN the editor SHALL display: party names and details, confidential information definition, obligation terms, duration fields, and exclusion clauses.
5. WHEN editing a Client Onboarding Form THEN the editor SHALL display: client detail fields, question/answer pairs (add/remove/reorder), and section headers.
6. WHEN editing a Payment Follow-up THEN the editor SHALL display: linked invoice reference (read-only), reminder tone selector (polite/firm/urgent), custom message field, and payment link display.
7. WHEN editing a Quote THEN the editor SHALL display the same line-item editor as the existing quotation type with updated labeling. THE system SHALL treat `quote` and `quotation` as the same document type in the editor — both type values SHALL load the identical line-item editor layout.
8. THE editor SHALL validate required fields per document type before allowing export.

### Requirement 11: Document Data Schemas for New Types

**User Story:** As a developer building the generation and editing system, I want well-defined TypeScript data schemas for each new document type, so that the AI output, editor, and PDF renderer all share a consistent structure.

#### Acceptance Criteria

1. THE system SHALL define a Zod validation schema and TypeScript interface for each of the 6 new document types.
2. THE SOW schema SHALL include fields for: title, project_overview, scope_items (array), deliverables (array with description, due_date, acceptance_criteria), milestones (array with name, date, description), assumptions (array), and parent_contract_id.
3. THE Change Order schema SHALL include fields for: change_order_number, parent_document_id, parent_document_type, description, additions (array), removals (array), modifications (array with original, revised), cost_impact, timeline_impact, and effective_date.
4. THE NDA schema SHALL include fields for: parties (array with name, role, address), confidential_info_definition, obligations (array), exclusions (array), term_start, term_duration, term_unit, governing_law, and remedies.
5. THE Client Onboarding Form schema SHALL include fields for: client_name, client_email, client_phone, client_address, project_name, project_description, requirements (array), timeline_preference, budget_range, and custom_questions (array with question, answer).
6. THE Payment Follow-up schema SHALL include fields for: linked_invoice_id, invoice_number, invoice_amount, invoice_currency, due_date, days_overdue, payment_link_url, reminder_tone (polite|firm|urgent), and custom_message.
7. ALL schemas SHALL be validated at document generation time and at editor save time using the same Zod schema, ensuring consistency between AI output and user edits.

### Requirement 12: AI Document Generation for New Types

**User Story:** As a user asking the AI to create any of the 10 document types, I want the AI to generate complete, professional documents with all required sections filled in, so that I get a ready-to-use document from a single conversation.

#### Acceptance Criteria

1. THE document generation system (DeepSeek integration) SHALL produce valid structured JSON matching the defined schema for each of the 10 document types.
2. WHEN generating a SOW THEN the AI SHALL produce a complete document with realistic scope items, measurable deliverables, and a timeline based on the user's described project.
3. WHEN generating a Change Order THEN the AI SHALL reference the parent document context and clearly articulate what is changing, with before/after comparisons where applicable.
4. WHEN generating an NDA THEN the AI SHALL produce legally-structured clauses appropriate to the user's country and the nature of the confidential information described.
5. WHEN generating a Client Onboarding Form THEN the AI SHALL generate relevant questions based on the user's business type and the described project scope.
6. WHEN generating a Payment Follow-up THEN the AI SHALL produce a polite, professional reminder that references the specific invoice details and includes the payment link.
7. THE generation system SHALL apply country-specific compliance rules to all 10 document types using the existing RAG-based compliance retrieval system.
8. IF the AI generates a document that fails schema validation THEN the system SHALL retry generation once before returning an error to the user.

### Requirement 13: Mismatch Detection Extension

**User Story:** As a user who might confuse similar document types (e.g., SOW vs proposal, Change Order vs new contract), I want the AI to catch mismatches and guide me to the right type, so that I always create the most appropriate document.

#### Acceptance Criteria

1. THE mismatch detection system SHALL be extended with rules for the 6 new document types.
2. WHEN a user requests a `proposal` but describes detailed deliverables, milestones, and acceptance criteria THEN the system SHALL suggest `sow` instead.
3. WHEN a user requests a `contract` but describes changes to an existing agreement THEN the system SHALL suggest `change_order` instead.
4. WHEN a user requests an `invoice` but describes a payment reminder for an existing unpaid invoice THEN the system SHALL suggest `payment_followup` instead.
5. WHEN a user requests a `contract` but only needs confidentiality protection THEN the system SHALL suggest `nda` instead.
6. WHEN a user requests a `quote` but the work is already agreed and they need to collect payment THEN the system SHALL suggest `invoice` instead.
7. THE mismatch rules SHALL remain pure, stateless, and regex-based for deterministic unit testing.
8. IF the user rejects the mismatch suggestion and re-confirms their original choice THEN the system SHALL respect the user's explicit decision on the next turn.

### Requirement 14: Payment Link Integration Rules

**User Story:** As a platform operator, I want payment links to remain exclusive to invoices and recurring invoices, so that the payment collection flow stays simple and legally appropriate.

#### Acceptance Criteria

1. THE payment link system SHALL be available only for `invoice` and `recurring_invoice` document types.
2. THE system SHALL NOT display payment link buttons or options for `contract`, `quote`, `proposal`, `sow`, `change_order`, `nda`, `client_onboarding_form`, or `payment_followup`.
3. WHEN a Payment Follow-up document is generated THEN it SHALL include the payment link URL from the referenced invoice but SHALL NOT create a new payment link.
4. IF a user asks the AI to add a payment link to a non-invoice document THEN the AI SHALL explain that payment links are only available on invoices and suggest creating a linked invoice instead.

### Requirement 15: Mobile Responsiveness for All New Screens

**User Story:** As a mobile user, I want all new document type screens, editors, and previews to work perfectly on my phone, so that I can create and manage documents on the go.

#### Acceptance Criteria

1. ALL new editor panel layouts for the 6 new document types SHALL be fully functional on viewports below 768px width.
2. THE document preview for all 10 types SHALL be scrollable and readable on mobile without horizontal overflow.
3. THE start screen category pills SHALL wrap gracefully on mobile, showing 3-4 pills per row with horizontal scroll for overflow.
4. THE history page filters SHALL be horizontally scrollable on mobile when they exceed viewport width.
5. WHEN a user creates a document on mobile THEN the tab-based navigation (Chat / Preview / Editor) SHALL work identically for all 10 document types.
6. THE signature flow for NDA, SOW, and Change Order SHALL be fully functional on mobile touch devices, reusing the existing mobile signature pad implementation.

### Requirement 16: Quotation to Quote Migration

**User Story:** As an existing user with quotation documents, I want my existing documents to continue working seamlessly after the rename to "Quote", so that nothing breaks in my history or exports.

#### Acceptance Criteria

1. WHEN the system displays a document with `document_type = 'quotation'` THEN the UI SHALL render it with the label "Quote" and the quote icon/color.
2. THE Intent_Classifier SHALL treat `quotation` and `quote` keywords identically, mapping both to the `quote` type value.
3. WHEN a new document is created THEN the system SHALL store `quote` as the type value (never `quotation` for new documents).
4. THE existing PDF template for quotations SHALL be reused for the `quote` type with updated header text from "Quotation" to "Quote".
5. THE history filters SHALL show a single "Quote" filter that matches both `quote` and `quotation` type values in the database.
6. THE system SHALL NOT require a data migration to rename existing `quotation` rows — the display layer handles the mapping.

### Requirement 17: Export Support for All Types

**User Story:** As a user who needs to share documents in different formats, I want PDF, DOCX, and image export to work for all 10 document types, so that I can deliver documents in whatever format my clients prefer.

#### Acceptance Criteria

1. THE PDF export system SHALL support all 10 document types using their respective PDF templates.
2. THE DOCX export system SHALL support all 10 document types with appropriate section formatting.
3. THE image export system (PNG/JPG) SHALL support all 10 document types by rendering the document preview as an image.
4. WHEN exporting a document with signature blocks (contract, nda, sow, change_order) THEN the export SHALL include captured signatures if they exist, or empty signature lines if pending.
5. WHEN exporting a Payment Follow-up THEN the export SHALL include the payment link as both a clickable URL (in PDF) and plain text (in DOCX/image).
6. ALL exports SHALL include the document type label in the filename (e.g., `SOW_ProjectName_2026-01-15.pdf`).

