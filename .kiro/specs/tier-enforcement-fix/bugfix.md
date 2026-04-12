# Bugfix Requirements Document

## Introduction

The Invo.ai platform has three related tier enforcement bugs that allow free-tier users to bypass subscription limits. Free users can access AI-powered profile editing (should be manual-only), create unlimited documents (should be capped at 3/month) of any type (should be limited to invoice + contract), and see no upgrade prompt when limits are hit. Together these bugs undermine the entire subscription monetization model.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a free-tier user clicks Edit on any profile section THEN the system renders the `SectionChatBar` AI chat component unconditionally, allowing the user to update their profile via AI without any tier check

1.2 WHEN a free-tier user calls `POST /api/ai/profile-update` THEN the system processes the AI request without validating the user's subscription tier, allowing free users to use AI profile editing

1.3 WHEN any user calls `POST /api/sessions/create` to create a new document session THEN the system inserts the session and calls `incrementDocumentCount()` without first calling `checkDocumentLimit()`, allowing unlimited document creation regardless of tier

1.4 WHEN a free-tier user calls `POST /api/sessions/create` with `documentType` set to "quotation" or "proposal" THEN the system creates the session without calling `checkDocumentTypeAllowed()`, allowing free users to create document types restricted to paid tiers

1.5 WHEN any API endpoint returns a 429 status with tier/limit information (e.g., from `/api/ai/stream` message limit check) THEN the frontend (`InvoiceChat` component) displays a plain text message in the chat but does not show an upgrade prompt or modal directing the user to the billing/pricing page

### Expected Behavior (Correct)

2.1 WHEN a free-tier user clicks Edit on any profile section THEN the system SHALL hide the `SectionChatBar` AI chat component and only allow manual field editing; the AI chat bar SHALL only be rendered for users on starter tier or above

2.2 WHEN a free-tier user calls `POST /api/ai/profile-update` THEN the system SHALL check the user's subscription tier and return a 403 response with an upgrade message, blocking the AI request for free-tier users (note: during onboarding via `/api/ai/onboarding`, AI SHALL remain available for all tiers)

2.3 WHEN any user calls `POST /api/sessions/create` THEN the system SHALL call `checkDocumentLimit()` before inserting the session, and return a 429 response with usage info and an upgrade message if the user's monthly document limit is exceeded

2.4 WHEN a free-tier user calls `POST /api/sessions/create` with `documentType` set to "quotation" or "proposal" THEN the system SHALL call `checkDocumentTypeAllowed()` before inserting the session, and return a 403 response indicating the document type is not available on the free plan

2.5 WHEN any API endpoint returns a 429 (limit exceeded) or 403 (tier restricted) response with tier information THEN the frontend SHALL display a clear upgrade modal/dialog showing the user's current usage, their plan limits, and a call-to-action button linking to the billing page

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user on starter, pro, or agency tier clicks Edit on any profile section THEN the system SHALL CONTINUE TO render the `SectionChatBar` AI chat component alongside manual editing fields

3.2 WHEN any user accesses the onboarding flow via `/api/ai/onboarding` THEN the system SHALL CONTINUE TO allow AI-powered profile setup for all tiers regardless of subscription plan

3.3 WHEN a user creates a document session and their usage is within their tier's monthly limit THEN the system SHALL CONTINUE TO create the session successfully and increment the document count

3.4 WHEN a free-tier user creates a session with `documentType` "invoice" or "contract" and is within their document limit THEN the system SHALL CONTINUE TO create the session successfully

3.5 WHEN a paid-tier user creates a session with any valid document type (invoice, contract, quotation, proposal) THEN the system SHALL CONTINUE TO create the session successfully regardless of document type

3.6 WHEN the `/api/ai/stream` endpoint returns a successful response THEN the frontend SHALL CONTINUE TO display the AI-generated content normally without showing any upgrade prompt

3.7 WHEN the per-session message limit is reached in `/api/ai/stream` THEN the system SHALL CONTINUE TO return a 429 response with the current message count, limit, and tier information
