# Requirements Document

## Introduction

This feature completes the document linking and usage tracking system for Invo.ai. It enables users to create related documents (Invoice, Contract, Quotation, Proposal) from an existing document while carrying over client context, forming a navigable chain of linked documents per company. It also enforces per-session message limits based on the user's subscription tier (Starter: 30, Pro: 50), provides a professional "limit reached" UI with options to create new documents, and tracks both message counts and document generation counts for paid users.

## Glossary

- **Chat_UI**: The chat input area within the InvoiceChat component where users type messages to the AI assistant
- **Message_Limit_Banner**: A UI component displayed when the per-session message cap is reached, replacing the chat input
- **NextStepsBar**: An existing component that shows options to create related documents (Invoice, Contract, Quotation, Proposal) after a document is generated
- **ChainNavigator**: An existing component that displays a horizontal pill bar of all linked documents in a chain, allowing navigation between them
- **Document_Chain**: A group of related document sessions sharing the same `chain_id`, linked to the same client/company
- **Cost_Protection_Module**: The `lib/cost-protection.ts` module that enforces document limits and message caps per subscription tier
- **Session**: A single document generation conversation tracked in the `document_sessions` table
- **Usage_Tracker**: The system that records per-session message counts and monthly document generation counts in the `user_usage` table
- **Tier**: The user's subscription plan — one of Free, Starter, Pro, or Agency
- **Stream_Route**: The `/api/ai/stream` API endpoint that handles AI message generation with streaming responses
- **Session_Create_Route**: The `/api/sessions/create` API endpoint that creates new document sessions
- **Linked_Session_Route**: The `/api/sessions/create-linked` API endpoint that creates a new session linked to a parent session

## Requirements

### Requirement 1: Update Per-Session Message Limits

**User Story:** As a paid user, I want my per-session message limits to match my plan (Starter: 30, Pro: 50), so that I have adequate room to refine my documents within a single session.

#### Acceptance Criteria

1. THE Cost_Protection_Module SHALL define the Starter tier message limit as 30 messages per session
2. THE Cost_Protection_Module SHALL define the Pro tier message limit as 50 messages per session
3. THE Cost_Protection_Module SHALL define the Free tier message limit as 10 messages per session
4. THE Cost_Protection_Module SHALL define the Agency tier message limit as 0 (unlimited) messages per session

### Requirement 2: Enforce Message Limit on AI Stream Requests

**User Story:** As a platform operator, I want message limits enforced server-side before AI generation, so that users cannot exceed their plan's per-session cap.

#### Acceptance Criteria

1. WHEN a user sends a message to the Stream_Route, THE Stream_Route SHALL call `checkMessageLimit` with the user ID, session ID, and user tier before processing the AI request
2. WHEN the message count for the current session equals or exceeds the tier limit, THE Stream_Route SHALL return a 429 response with a JSON body containing the fields `error`, `currentMessages`, `limit`, `tier`, and `sessionId`
3. THE Stream_Route SHALL count only messages with role "user" in the `chat_messages` table for the given session when determining the message count

### Requirement 3: Message Limit Reached UI

**User Story:** As a user who has reached the message limit, I want to see a professional notification and options to create a new document, so that I can continue working without confusion.

#### Acceptance Criteria

1. WHEN the Chat_UI receives a 429 response with error "Session message limit reached" from the Stream_Route, THE Chat_UI SHALL disable the text input field and hide the file upload button
2. WHEN the message limit is reached, THE Message_Limit_Banner SHALL display the text "You've reached the message limit for this session" along with the current message count and the tier limit
3. WHEN the message limit is reached, THE Message_Limit_Banner SHALL display buttons to create a new document of each type: Invoice, Contract, Quotation, and Proposal
4. WHEN the message limit is reached and a document has been generated in the current session, THE Message_Limit_Banner SHALL display a button to create the same document type as the current session
5. WHEN the user clicks a document type button on the Message_Limit_Banner, THE Chat_UI SHALL create a new session of the selected document type and navigate to the new session
6. IF the user clicks a document type button and the current session has a chain_id, THEN THE Chat_UI SHALL create a linked session via the Linked_Session_Route instead of a standalone session

### Requirement 4: Document Linking Context Propagation

**User Story:** As a user creating a related document, I want the new document to carry over client details from the parent document, so that I do not have to re-enter information.

#### Acceptance Criteria

1. WHEN a linked session is created via the Linked_Session_Route, THE Linked_Session_Route SHALL copy the following fields from the parent session context to the new session: client name, client email, client address, client phone, currency, business sender details (name, email, address, phone), and payment terms
2. WHEN the target document type is "invoice" or "quotation", THE Linked_Session_Route SHALL also copy line items (description, quantity, rate), tax rate, and tax label from the parent session context
3. WHEN a linked session is created, THE Linked_Session_Route SHALL set the new session's `chain_id` to the parent session's `chain_id`, or to the parent session's own ID if the parent has no `chain_id`
4. WHEN a linked session is created and the parent session has no `chain_id`, THE Linked_Session_Route SHALL update the parent session's `chain_id` to the parent session's own ID

### Requirement 5: Document Chain Navigation

**User Story:** As a user with multiple linked documents for the same client, I want to navigate between all documents in the chain, so that I can review and manage related documents easily.

#### Acceptance Criteria

1. WHEN a session has a `chain_id` and the chain contains more than one session, THE ChainNavigator SHALL display a horizontal pill bar showing all sessions in the chain ordered by creation date
2. WHEN the user clicks a session pill in the ChainNavigator, THE ChainNavigator SHALL switch the active session to the selected session and load its chat history and document preview
3. THE ChainNavigator SHALL display the client name extracted from the chain's sessions
4. THE ChainNavigator SHALL indicate the current active session with a highlighted pill style distinct from inactive session pills
5. THE ChainNavigator SHALL display a completion indicator (green dot) on sessions with status "completed"

### Requirement 6: Post-Generation Next Steps

**User Story:** As a user who has just generated a document, I want to see options to create related documents for the same client, so that I can quickly build a complete set of business documents.

#### Acceptance Criteria

1. WHEN a document has been successfully generated in the current session, THE NextStepsBar SHALL appear below the chat messages showing the client name and buttons for each document type except the current session's type
2. WHEN the user clicks a document type button on the NextStepsBar, THE NextStepsBar SHALL call the Linked_Session_Route to create a new linked session with the selected document type and the current session as the parent
3. WHEN a linked session is successfully created from the NextStepsBar, THE Chat_UI SHALL navigate to the new session and load the seed context into the document preview

### Requirement 7: Document Count Tracking

**User Story:** As a platform operator, I want to track the number of documents each paid user generates per month, so that I can enforce monthly document limits and display usage statistics.

#### Acceptance Criteria

1. WHEN a new document session is created via the Session_Create_Route, THE Session_Create_Route SHALL call `incrementDocumentCount` to increment the user's `documents_count` in the `user_usage` table for the current month
2. WHEN a new linked session is created via the Linked_Session_Route, THE Linked_Session_Route SHALL call `incrementDocumentCount` to increment the user's `documents_count` in the `user_usage` table for the current month
3. WHEN a user attempts to create a new session and the monthly document count equals or exceeds the tier limit, THE Session_Create_Route SHALL return a 429 response with the current usage count, the tier limit, and an upgrade suggestion message

### Requirement 8: Message Count Tracking Per Session

**User Story:** As a platform operator, I want to track the number of messages sent per session for paid users, so that I can enforce per-session message caps and monitor usage patterns.

#### Acceptance Criteria

1. THE Stream_Route SHALL count user messages in the `chat_messages` table for the active session before each AI generation request
2. WHEN the message count query fails, THE Stream_Route SHALL allow the request to proceed (fail-open behavior) and log the error to the server console
3. THE Cost_Protection_Module SHALL expose a `getSessionMessageCount` function that returns the current user message count for a given session ID

### Requirement 9: Usage Statistics API

**User Story:** As a paid user, I want to view my current usage statistics (documents generated, messages used), so that I can understand how much of my plan I have consumed.

#### Acceptance Criteria

1. WHEN a GET request is made to the Usage API, THE Usage API SHALL return the user's current month document count, document limit for the tier, AI request count, and subscription plan name
2. THE Usage API SHALL calculate and return a `documentsPercent` field representing the percentage of the monthly document limit consumed, capped at 100
3. WHEN the user is on the Agency tier, THE Usage API SHALL return 0 for `documentsLimit` and 0 for `documentsPercent` to indicate unlimited usage

### Requirement 10: Document Limit Enforcement on Session Creation

**User Story:** As a platform operator, I want document creation blocked when a user exceeds their monthly limit, so that the tier-based billing model is enforced.

#### Acceptance Criteria

1. WHEN a user on the Free tier has created 3 or more documents in the current month, THE Session_Create_Route SHALL reject new session creation with a 429 status and the message "Upgrade to Starter for 50 documents/month"
2. WHEN a user on the Starter tier has created 50 or more documents in the current month, THE Session_Create_Route SHALL reject new session creation with a 429 status and the message "Upgrade to Pro for 150 documents/month"
3. WHEN a user on the Pro tier has created 150 or more documents in the current month, THE Session_Create_Route SHALL reject new session creation with a 429 status and the message "Upgrade to Agency for unlimited documents"
4. WHEN a user on the Agency tier creates a session, THE Session_Create_Route SHALL allow the request regardless of document count
