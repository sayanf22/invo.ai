# Requirements Document

## Introduction

The Client Management System adds a dedicated clients page to Clorefy where users can store, manage, and reuse client contact information. Clients can be added manually, imported via CSV, or (for paid tiers) created and edited through AI chat. When creating a document, users can select a saved client to auto-fill the "Bill To" section. This eliminates repetitive data entry and speeds up document creation for returning clients.

## Glossary

- **Client**: A contact record stored by a user, containing name, email, phone, address, tax ID, and optional notes.
- **Client_Manager**: The client management page and its associated UI components.
- **Client_API**: The set of API routes that handle CRUD operations on client records.
- **Client_AI**: The AI chat interface for creating and editing clients via natural language.
- **CSV_Importer**: The component that parses and validates a CSV file and bulk-inserts client records.
- **CSV_Exporter**: The component that serialises all client records into a downloadable CSV file.
- **Client_Selector**: The UI component embedded in the document creation flow that lets users pick a saved client to auto-fill the "Bill To" section.
- **Tier**: The user's subscription level — free, starter, pro, or agency.
- **Paid_Tier**: Any tier that is not free (starter, pro, or agency).
- **Bill_To**: The recipient section of an invoice, contract, quotation, or proposal (fields: toName, toEmail, toAddress, toPhone, toTaxId).

---

## Requirements

### Requirement 1: Client Data Model

**User Story:** As a user, I want each client to have a consistent set of fields, so that I can store all the information I need to generate documents.

#### Acceptance Criteria

1. THE Client_Manager SHALL store the following fields per client: name (required), email, phone, address, tax ID, and notes.
2. THE Client_Manager SHALL associate every client record with the authenticated user's ID so that clients are private to each user.
3. THE Client_Manager SHALL record a `created_at` and `updated_at` timestamp on every client record.
4. WHEN a client is created without a name, THE Client_API SHALL return a 400 error with a descriptive message.

---

### Requirement 2: View Clients

**User Story:** As a user, I want to see all my saved clients in one place, so that I can quickly find and manage them.

#### Acceptance Criteria

1. THE Client_Manager SHALL display all clients belonging to the authenticated user in a list or card layout.
2. WHEN the user has no clients, THE Client_Manager SHALL display an empty-state message with a prompt to add the first client.
3. THE Client_Manager SHALL show each client's name, email, and phone in the list view.
4. THE Client_Manager SHALL support a search input that filters the visible client list by name, email, or phone in real time.
5. THE Client_Manager SHALL display the total number of saved clients.

---

### Requirement 3: Add Client Manually

**User Story:** As a user, I want to add a new client via a form, so that I can save their details for future documents.

#### Acceptance Criteria

1. WHEN the user clicks "Add Client", THE Client_Manager SHALL open a modal form with fields for name, email, phone, address, tax ID, and notes.
2. WHEN the user submits the form with a valid name, THE Client_API SHALL insert the client record and THE Client_Manager SHALL display the new client without a full page reload.
3. IF the submitted name field is empty, THEN THE Client_Manager SHALL display an inline validation error and SHALL NOT submit the form.
4. WHEN the form is submitted successfully, THE Client_Manager SHALL close the modal and display a success toast notification.

---

### Requirement 4: Edit Client

**User Story:** As a user, I want to edit an existing client's details, so that I can keep their information up to date.

#### Acceptance Criteria

1. WHEN the user clicks the edit action on a client, THE Client_Manager SHALL open a pre-filled modal form with the client's current data.
2. WHEN the user saves the edited form, THE Client_API SHALL update the client record and THE Client_Manager SHALL reflect the changes immediately.
3. IF the edited name field is empty, THEN THE Client_Manager SHALL display an inline validation error and SHALL NOT submit the form.
4. WHEN the update is saved successfully, THE Client_Manager SHALL display a success toast notification.

---

### Requirement 5: Delete Client

**User Story:** As a user, I want to delete a client I no longer need, so that my client list stays clean.

#### Acceptance Criteria

1. WHEN the user clicks the delete action on a client, THE Client_Manager SHALL display a confirmation dialog before deleting.
2. WHEN the user confirms deletion, THE Client_API SHALL delete the client record and THE Client_Manager SHALL remove the client from the list without a full page reload.
3. WHEN the deletion is successful, THE Client_Manager SHALL display a success toast notification.
4. IF the deletion fails, THEN THE Client_Manager SHALL display an error toast notification and SHALL retain the client in the list.

---

### Requirement 6: CSV Import

**User Story:** As a user, I want to import clients from a CSV file, so that I can bulk-add my existing client list without manual entry.

#### Acceptance Criteria

1. THE Client_Manager SHALL provide a "Import CSV" button that opens a file picker accepting `.csv` files only.
2. WHEN a CSV file is selected, THE CSV_Importer SHALL parse the file client-side and map columns: name, email, phone, address, tax_id, notes (case-insensitive header matching).
3. WHEN the CSV contains at least one row with a non-empty name, THE CSV_Importer SHALL display a preview of the parsed rows before import.
4. WHEN the user confirms the import, THE Client_API SHALL bulk-insert all valid rows and THE Client_Manager SHALL refresh the client list.
5. IF a CSV row is missing a name, THEN THE CSV_Importer SHALL skip that row and SHALL report the number of skipped rows to the user after import.
6. IF the CSV file cannot be parsed, THEN THE CSV_Importer SHALL display an error message and SHALL NOT attempt to insert any records.
7. THE Client_Manager SHALL provide a downloadable CSV template file showing the expected column headers.

---

### Requirement 7: CSV Export

**User Story:** As a user, I want to export all my clients to a CSV file, so that I can use the data in other tools or keep a backup.

#### Acceptance Criteria

1. THE Client_Manager SHALL provide an "Export CSV" button that is always visible when at least one client exists.
2. WHEN the user clicks "Export CSV", THE CSV_Exporter SHALL generate a CSV file containing all of the user's clients with columns: name, email, phone, address, tax_id, notes, created_at.
3. THE CSV_Exporter SHALL trigger a browser download of the generated file with a filename of `clients_export_YYYY-MM-DD.csv`.
4. WHEN the export is triggered with zero clients, THE Client_Manager SHALL display an informational toast and SHALL NOT trigger a download.

---

### Requirement 8: AI Chat for Client Management (Paid Tiers Only)

**User Story:** As a paid-tier user, I want to add or edit clients by describing them in natural language, so that I can manage my client list faster without filling out forms.

#### Acceptance Criteria

1. WHILE the user's Tier is a Paid_Tier, THE Client_Manager SHALL display an AI chat input for client management.
2. WHEN a free-tier user accesses the clients page, THE Client_Manager SHALL display an upgrade prompt in place of the AI chat input, explaining that AI client management requires a paid plan.
3. WHEN a paid-tier user sends a message describing a new client, THE Client_AI SHALL extract the client fields and call THE Client_API to create the client record.
4. WHEN a paid-tier user sends a message requesting an edit to an existing client, THE Client_AI SHALL identify the target client by name and call THE Client_API to update the record.
5. WHEN THE Client_AI successfully creates or updates a client, THE Client_Manager SHALL refresh the client list and display a confirmation message in the chat.
6. IF THE Client_AI cannot identify a client field or target client, THEN THE Client_AI SHALL ask a clarifying question rather than creating an incomplete record.
7. THE Client_AI SHALL use the existing DeepSeek V3 model and streaming infrastructure consistent with the rest of the application.

---

### Requirement 9: Client Selection in Document Creation

**User Story:** As a user, I want to select a saved client when creating a document, so that the "Bill To" section is auto-filled without retyping.

#### Acceptance Criteria

1. WHEN the document creation flow is active, THE Client_Selector SHALL be accessible from the invoice-chat interface.
2. WHEN the user selects a client from THE Client_Selector, THE Client_Selector SHALL populate the Bill_To fields (toName, toEmail, toAddress, toPhone, toTaxId) with the selected client's data.
3. THE Client_Selector SHALL display a searchable list of the user's saved clients.
4. WHEN the user has no saved clients, THE Client_Selector SHALL display a prompt to add clients from the clients page.
5. WHEN a client is selected, THE Client_Selector SHALL close and the document form SHALL reflect the populated Bill_To fields immediately.

---

### Requirement 10: Navigation Access

**User Story:** As a user, I want to reach the clients page from the main navigation, so that I can access it from anywhere in the app.

#### Acceptance Criteria

1. THE Client_Manager SHALL be accessible at the route `/clients`.
2. THE Client_Manager page SHALL require authentication; unauthenticated users SHALL be redirected to the login page.
3. WHEN a logged-in user opens the hamburger menu, THE Client_Manager navigation link SHALL be visible under the "Navigation" section.

---

### Requirement 11: Security and Data Isolation

**User Story:** As a user, I want my client data to be private and secure, so that other users cannot access or modify my clients.

#### Acceptance Criteria

1. THE Client_API SHALL authenticate every request using the existing `authenticateRequest()` helper before performing any database operation.
2. THE Client_API SHALL enforce that all database queries are scoped to the authenticated user's ID.
3. THE Client_API SHALL apply Row Level Security policies on the `clients` table so that users can only SELECT, INSERT, UPDATE, and DELETE their own records.
4. IF an unauthenticated request is made to THE Client_API, THEN THE Client_API SHALL return a 401 response.
5. IF a user attempts to access or modify a client record belonging to another user, THEN THE Client_API SHALL return a 404 response (not 403, to avoid leaking existence).
