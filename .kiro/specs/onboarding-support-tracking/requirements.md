# Requirements Document

## Introduction

This feature adds a comprehensive onboarding support, error tracking, and admin visibility system to Clorefy. It introduces a contextual support button visible throughout the onboarding flow, enhances the admin dashboard with detailed onboarding progress tracking per user, improves the existing support and error sections with richer user context and onboarding state, and adds filtering and search capabilities across all admin views. The goal is to reduce user drop-off during onboarding, give admins full visibility into where users struggle, and streamline support resolution.

## Glossary

- **Onboarding_Flow**: The 4-phase business setup wizard at `/app/onboarding/page.tsx` that new users complete after signup. Phases are: Upload, Chat, Logo, Payments.
- **Support_Button**: A small, monochromatic, mobile-friendly button rendered on the onboarding screen that opens a support message form.
- **Support_Form**: A lightweight modal or sheet UI that allows users to type and submit a support message during onboarding.
- **Support_Message**: A record in the `support_messages` database table containing user feedback, the onboarding phase context, and status metadata.
- **Admin_Dashboard**: The admin control panel at `/app/clorefy-ctrl-8x2m/(dashboard)/` used to manage users, view analytics, and handle support.
- **Admin_Support_Page**: The admin page at `/app/clorefy-ctrl-8x2m/(dashboard)/support/page.tsx` that displays support messages.
- **Admin_Errors_Page**: The admin page at `/app/clorefy-ctrl-8x2m/(dashboard)/errors/page.tsx` that displays application error logs.
- **Admin_Onboarding_Page**: A new admin page that displays onboarding progress and completion status for all users.
- **Onboarding_Phase**: One of the four sequential steps in the Onboarding_Flow: `upload`, `chat`, `logo`, or `payments`.
- **Tracked_Field**: One of the 12 business profile fields collected during the Chat phase: businessType, country, businessName, ownerName, email, phone, address, taxDetails, services, clientCountries, defaultCurrency, bankDetails.
- **Onboarding_Status**: The overall state of a user's onboarding: `completed`, `in-progress`, or `dropped-off`.
- **Drop_Off**: A state where a user started onboarding but has not completed it and has not been active for more than 48 hours.
- **Error_Log**: A record in the `error_logs` database table containing error context, message, user reference, and metadata.
- **Service_Role_Client**: A Supabase client initialized with the service role key that bypasses Row Level Security, used exclusively in admin API routes.

## Requirements

### Requirement 1: Onboarding Support Button Visibility

**User Story:** As a user going through onboarding, I want to see a support button on every step of the onboarding flow, so that I can ask for help whenever I get stuck.

#### Acceptance Criteria

1. WHILE the Onboarding_Flow is active, THE Support_Button SHALL be rendered on every Onboarding_Phase (upload, chat, logo, payments).
2. THE Support_Button SHALL use a monochromatic icon style consistent with the existing onboarding UI and occupy no more than 40x40 pixels of screen space.
3. WHEN the user's viewport width is 480 pixels or less, THE Support_Button SHALL remain fully visible and tappable with a minimum touch target of 44x44 CSS pixels.
4. WHEN the user completes onboarding and is redirected away from the Onboarding_Flow, THE Support_Button SHALL no longer be rendered.
5. THE Support_Button SHALL be positioned in a fixed location (bottom-right corner) that does not overlap with the primary onboarding content or input fields.

### Requirement 2: Onboarding Support Form Submission

**User Story:** As a user on the onboarding screen, I want to open a simple form and send a support message, so that I can describe my issue without leaving the onboarding flow.

#### Acceptance Criteria

1. WHEN the user clicks the Support_Button, THE Support_Form SHALL open as a modal or bottom sheet overlay without navigating away from the current Onboarding_Phase.
2. THE Support_Form SHALL contain a text area for the message (minimum 3 characters, maximum 2000 characters) and a submit button.
3. WHEN the user submits the Support_Form with a valid message, THE Onboarding_Flow SHALL insert a Support_Message record into the `support_messages` table with the user's ID, the message text, the current Onboarding_Phase, and a status of `unread`.
4. WHEN the Support_Message is successfully inserted, THE Support_Form SHALL display a confirmation message and close automatically after 2 seconds.
5. IF the Support_Message insertion fails, THEN THE Support_Form SHALL display an error message describing the failure and keep the form open with the user's text preserved.
6. WHEN the user submits the Support_Form, THE Onboarding_Flow SHALL include the current Onboarding_Phase value (`upload`, `chat`, `logo`, or `payments`) in the Support_Message metadata.
7. THE Support_Form SHALL pre-fill the user's email address from the authenticated session when available.

### Requirement 3: Admin Support Page — Message Display with User Context

**User Story:** As an admin, I want to see support messages with full user details and onboarding context, so that I can understand who needs help and where they are stuck.

#### Acceptance Criteria

1. THE Admin_Support_Page SHALL display each Support_Message with the sender's full name, email address, and the Onboarding_Phase from which the message was sent.
2. WHEN a Support_Message includes an Onboarding_Phase in its metadata, THE Admin_Support_Page SHALL display a badge or label indicating the phase (e.g., "Upload", "Chat", "Logo", "Payments").
3. WHEN a Support_Message has no associated user profile, THE Admin_Support_Page SHALL display "Anonymous" as the sender name and omit the email field.
4. THE Admin_Support_Page SHALL sort messages by creation date in descending order (newest first) by default.

### Requirement 4: Admin Support Page — Message Status Management

**User Story:** As an admin, I want to mark support messages as read or resolved, so that I can track which issues have been addressed.

#### Acceptance Criteria

1. WHEN an admin clicks a status action on a Support_Message, THE Admin_Support_Page SHALL update the message status to the selected value (`read` or `resolved`).
2. THE Admin_Support_Page SHALL visually distinguish between `unread`, `read`, and `resolved` messages using color-coded indicators.
3. WHEN the status update fails, THE Admin_Support_Page SHALL display an error toast notification and revert the status indicator to its previous state.
4. THE Admin_Support_Page SHALL allow admins to add or edit admin notes on each Support_Message.

### Requirement 5: Admin Onboarding Tracking — User Progress Overview

**User Story:** As an admin, I want to see detailed onboarding progress for all users, so that I can identify where users drop off and which steps cause friction.

#### Acceptance Criteria

1. THE Admin_Onboarding_Page SHALL display a table of all users with columns for: user email, full name, Onboarding_Status, current or last Onboarding_Phase, number of Tracked_Fields completed out of 12, and the timestamp of last activity.
2. WHEN a user has completed all four Onboarding_Phases and has `onboarding_complete = true` in their profile, THE Admin_Onboarding_Page SHALL display their Onboarding_Status as "Completed".
3. WHEN a user has started onboarding but has not completed it and was last active within 48 hours, THE Admin_Onboarding_Page SHALL display their Onboarding_Status as "In Progress".
4. WHEN a user has started onboarding but has not completed it and was last active more than 48 hours ago, THE Admin_Onboarding_Page SHALL display their Onboarding_Status as "Dropped Off".
5. THE Admin_Onboarding_Page SHALL paginate results with 25 users per page.

### Requirement 6: Admin Onboarding Tracking — Per-User Detail View

**User Story:** As an admin, I want to drill into a specific user's onboarding progress, so that I can see exactly which fields they completed and how they provided their data.

#### Acceptance Criteria

1. WHEN an admin clicks on a user row in the Admin_Onboarding_Page, THE Admin_Onboarding_Page SHALL expand or navigate to a detail view showing completion status for each of the 12 Tracked_Fields.
2. THE detail view SHALL indicate for each Tracked_Field whether it is completed (has a value) or pending (empty).
3. THE detail view SHALL show which Onboarding_Phase the user is currently on or the last phase they reached before dropping off.
4. THE detail view SHALL indicate whether the user used document extraction (file upload in the Upload phase) or typed their information manually (skipped the Upload phase).
5. WHEN the user has a business record in the `businesses` table, THE detail view SHALL display the actual values of each Tracked_Field.

### Requirement 7: Onboarding State Persistence for Admin Tracking

**User Story:** As a system operator, I want onboarding progress to be tracked in the database, so that admin dashboards can query it without relying on client-side localStorage.

#### Acceptance Criteria

1. WHEN a user transitions between Onboarding_Phases, THE Onboarding_Flow SHALL record the new phase in the user's profile or a dedicated tracking record in the database.
2. THE Onboarding_Flow SHALL record whether the user used document extraction (uploaded a file) or skipped the Upload phase.
3. WHEN the Chat phase updates a Tracked_Field, THE Onboarding_Flow SHALL persist the field completion status to the database so that the Admin_Onboarding_Page can query it.
4. THE Onboarding_Flow SHALL update the user's `last_active_at` timestamp in the `profiles` table each time the user interacts with an onboarding step.

### Requirement 8: Admin Errors Page — Enhanced User Context

**User Story:** As an admin, I want to see proper user details alongside error logs, so that I can identify which users are experiencing issues and contact them if needed.

#### Acceptance Criteria

1. THE Admin_Errors_Page SHALL display each Error_Log with the associated user's email address and full name when a user_id is present.
2. WHEN an Error_Log has an `error_context` value that starts with "onboarding", THE Admin_Errors_Page SHALL display the Onboarding_Phase extracted from the error metadata alongside the error details.
3. WHEN an Error_Log has no associated user (null user_id), THE Admin_Errors_Page SHALL display "System / Anonymous" as the user identifier.

### Requirement 9: Onboarding Error Logging

**User Story:** As a system operator, I want onboarding-specific errors to be automatically logged with the user's current onboarding state, so that admins can diagnose issues in context.

#### Acceptance Criteria

1. WHEN an error occurs during any Onboarding_Phase, THE Onboarding_Flow SHALL call the `logErrorToDatabase` function with the error context set to `onboarding_{phase}` (e.g., `onboarding_upload`, `onboarding_chat`, `onboarding_logo`, `onboarding_payments`).
2. THE error metadata logged by the Onboarding_Flow SHALL include the current Onboarding_Phase, the number of Tracked_Fields completed at the time of the error, and whether the user used document extraction.
3. WHEN the AI onboarding API returns a non-200 response, THE Onboarding_Flow SHALL log the error with context `onboarding_chat_ai_error` and include the HTTP status code in the metadata.

### Requirement 10: Admin Onboarding Tracking — Filtering

**User Story:** As an admin, I want to filter the onboarding tracking list by status, phase, and error presence, so that I can quickly find users who need attention.

#### Acceptance Criteria

1. THE Admin_Onboarding_Page SHALL provide a filter for Onboarding_Status with options: All, Completed, In Progress, Dropped Off.
2. THE Admin_Onboarding_Page SHALL provide a filter for Onboarding_Phase with options: All, Upload, Chat, Logo, Payments.
3. THE Admin_Onboarding_Page SHALL provide a filter for error status with options: All, Users with Errors, Users without Errors.
4. THE Admin_Onboarding_Page SHALL provide a search input that filters users by email address using a case-insensitive partial match.
5. WHEN multiple filters are applied simultaneously, THE Admin_Onboarding_Page SHALL combine them with AND logic (all conditions must match).

### Requirement 11: Admin Errors Page — Filtering by Onboarding Step

**User Story:** As an admin, I want to filter error logs by onboarding step, so that I can identify which phases of onboarding are causing the most issues.

#### Acceptance Criteria

1. THE Admin_Errors_Page SHALL provide a filter for error context with options: All, Upload, Chat, Logo, Payments, and Non-Onboarding.
2. WHEN the "Upload" filter is selected, THE Admin_Errors_Page SHALL display only Error_Logs where `error_context` contains "onboarding_upload".
3. WHEN the "Non-Onboarding" filter is selected, THE Admin_Errors_Page SHALL display only Error_Logs where `error_context` does not start with "onboarding".
4. THE Admin_Errors_Page SHALL provide a search input that filters errors by user email using a case-insensitive partial match.

### Requirement 12: Support Message Schema Extension

**User Story:** As a system operator, I want the support messages table to store onboarding context, so that admins can see where users were when they asked for help.

#### Acceptance Criteria

1. THE `support_messages` table SHALL include an `onboarding_phase` column of type TEXT that stores the Onboarding_Phase value when the message is sent from the Onboarding_Flow.
2. THE `onboarding_phase` column SHALL accept values: `upload`, `chat`, `logo`, `payments`, or NULL (for messages not sent from onboarding).
3. THE `support_messages` table SHALL include a `metadata` column of type JSONB that stores additional context such as the number of completed fields and the user's email at the time of submission.

### Requirement 13: Onboarding Tracking Database Schema

**User Story:** As a system operator, I want a database structure that tracks onboarding progress per user, so that admin queries can efficiently retrieve onboarding state.

#### Acceptance Criteria

1. THE database SHALL store each user's current or last Onboarding_Phase in a queryable column or table.
2. THE database SHALL store whether the user used document extraction (file upload) or skipped the Upload phase.
3. THE database SHALL store the completion timestamp for each Onboarding_Phase transition.
4. THE database schema SHALL support efficient queries for filtering users by Onboarding_Status, current phase, and field completion count without requiring full table scans (appropriate indexes).
