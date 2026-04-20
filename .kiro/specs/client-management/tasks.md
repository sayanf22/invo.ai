# Implementation Plan: Client Management System

## Overview

Implement the full client management feature: database migration, TypeScript types, API routes, page, components, AI chat integration, CSV import/export, client selector in invoice-chat, navigation link, and middleware update. Each task builds incrementally toward a fully wired feature.

## Tasks

- [x] 1. Database migration and TypeScript types
  - Create Supabase migration file at `supabase/migrations/client_management.sql` with the `clients` table, `clients_user_id_idx` index, `update_updated_at_column` trigger function, `clients_updated_at` trigger, and all four RLS policies (select/insert/update/delete scoped to `auth.uid() = user_id`)
  - Add `Client` and `ClientInput` interfaces to `lib/invoice-types.ts` (or a new `lib/client-types.ts`)
  - Add `clientSchema` Zod validation schema (name required/max 200, email optional with format check, phone/address/tax_id/notes optional with max lengths)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 11.3_

- [ ] 2. API routes — core CRUD
  - [x] 2.1 Implement `GET /api/clients/route.ts`
    - Call `authenticateRequest()`, query `clients` table filtered by `user_id`, order by `name ASC`, return `{ clients: Client[] }`
    - _Requirements: 2.1, 11.1, 11.2, 11.4_

  - [x] 2.2 Implement `POST /api/clients/route.ts`
    - Call `authenticateRequest()`, parse and validate body with `clientSchema`, insert row with `user_id` set to authenticated user, return `{ client: Client }` or 400 on validation failure
    - _Requirements: 3.2, 1.4, 11.1, 11.4_

  - [x] 2.3 Implement `POST /api/clients/bulk/route.ts`
    - Call `authenticateRequest()`, accept `{ clients: ClientInput[] }`, filter out rows with empty name server-side, bulk-insert valid rows, return `{ inserted: number; skipped: number }`
    - _Requirements: 6.4, 6.5, 11.1_

  - [x] 2.4 Implement `PUT /api/clients/[id]/route.ts`
    - Call `authenticateRequest()`, validate body with `clientSchema`, update row only where `id` matches AND `user_id` matches authenticated user, return 404 if no row updated
    - _Requirements: 4.2, 11.2, 11.5_

  - [x] 2.5 Implement `DELETE /api/clients/[id]/route.ts`
    - Call `authenticateRequest()`, delete row only where `id` matches AND `user_id` matches authenticated user, return 404 if no row deleted
    - _Requirements: 5.2, 11.2, 11.5_

  - [ ]* 2.6 Write unit tests for API route auth and validation
    - Test 401 returned for unauthenticated requests to all five routes
    - Test 400 returned when name is empty on POST and PUT
    - Test 404 returned when client belongs to a different user on PUT and DELETE
    - _Requirements: 1.4, 11.4, 11.5_

- [x] 3. Checkpoint — API layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Core client types and search utility
  - [x] 4.1 Create `lib/client-utils.ts` with a `filterClients(clients: Client[], search: string): Client[]` function
    - Filter by case-insensitive substring match on name, email, or phone
    - Return full list when search is empty
    - _Requirements: 2.4_

  - [ ]* 4.2 Write property test for search filter (Property 3)
    - **Property 3: Search filter is a subset**
    - **Validates: Requirements 2.4**
    - Generate random client arrays and search strings with `fast-check`; assert every returned client contains the search string in name, email, or phone (case-insensitive) and the result is a subset of the input

- [x] 5. `ClientFormModal` component
  - Create `components/clients/client-form-modal.tsx` as a `"use client"` component
  - Use shadcn/ui `Dialog`, `react-hook-form` + `zodResolver(clientSchema)` for the form
  - Fields: name (required), email, phone, address, tax ID, notes
  - Accept `mode: "add" | "edit"`, `client?: Client`, `onSuccess(client: Client): void`, `onClose(): void` props
  - On submit: call `POST /api/clients` (add) or `PUT /api/clients/[id]` (edit), call `onSuccess` with returned client, show `sonner` toast
  - Display inline Zod validation errors; do not submit when name is empty
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [ ]* 5.1 Write unit tests for `ClientFormModal` validation
    - Test that submitting with empty name shows inline error and does not call the API
    - Test that valid submission calls `onSuccess` and closes modal
    - _Requirements: 3.3, 4.3_

- [x] 6. `ClientList` component
  - Create `components/clients/client-list.tsx` as a `"use client"` component
  - Accept `clients: Client[]`, `onEdit(client: Client): void`, `onDelete(client: Client): void` props
  - Render a responsive card grid; each card shows name, email, phone, and edit/delete action buttons (Lucide icons)
  - Render empty-state message with add-client prompt when `clients` is empty
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 7. `CSVImporter` component
  - Create `components/clients/csv-importer.tsx` as a `"use client"` component
  - Hidden `<input type="file" accept=".csv">` triggered by an "Import CSV" button
  - On file selection: parse client-side with manual `split('\n')` / `split(',')` (handle quoted fields), map headers case-insensitively to `{name, email, phone, address, tax_id, notes}`, skip rows with empty name, show preview table in a shadcn/ui `Dialog` with skip-count notice
  - On confirm: call `POST /api/clients/bulk`, call `onImportComplete()` prop, show toast with inserted/skipped counts
  - Show error dialog if file cannot be parsed; do not attempt insert
  - Also render a "Download Template" link that triggers download of a CSV template with the expected headers
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 7.1 Write property test for CSV import skip logic (Property 4)
    - **Property 4: CSV import skips nameless rows**
    - **Validates: Requirements 6.5**
    - Generate CSV strings with random mix of named/unnamed rows using `fast-check`; assert `inserted + skipped === total rows` and `skipped === rows with empty name`

- [x] 8. `CSVExporter` component
  - Create `components/clients/csv-exporter.tsx` as a `"use client"` component
  - Accept `clients: Client[]` prop
  - On click: if zero clients show informational toast and return; otherwise serialise to CSV (columns: name, email, phone, address, tax_id, notes, created_at), create `Blob`, trigger `<a download>` with filename `clients_export_YYYY-MM-DD.csv`
  - Null fields become empty strings in the CSV output
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 8.1 Write property test for CSV export round-trip (Property 5)
    - **Property 5: CSV export round-trip**
    - **Validates: Requirements 7.2, 7.3**
    - Generate random client arrays with `fast-check`; export to CSV string, re-parse with the importer's parsing logic, assert name/email/phone/address/tax_id/notes fields are identical to originals

- [x] 9. `ClientsPageClient` component and page
  - Create `components/clients/clients-page-client.tsx` as a `"use client"` component
  - State: `clients`, `search`, `modalState ({ mode, client? })`, `deleteTarget`, `isImporting`
  - Render: search bar (filters via `filterClients`), stats bar showing total client count, "Add Client" / "Import CSV" / "Export CSV" buttons, `ClientList`, `ClientFormModal`, shadcn/ui `AlertDialog` for delete confirmation, `ClientAIChat` or upgrade prompt based on tier
  - On delete confirm: call `DELETE /api/clients/[id]`, remove from state optimistically, show toast; on failure revert state and show error toast
  - Accept `initialClients: Client[]` and `userTier: string` props
  - Create `app/clients/page.tsx` as a Server Component: authenticate via `createServerClient`, redirect unauthenticated users to `/auth/login`, fetch initial client list, read user tier from profile, render `ClientsPageClient`
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.4, 5.1, 5.2, 5.3, 5.4, 8.1, 8.2, 10.1, 10.2_

- [x] 10. `ClientAIChat` component and AI route
  - Create `components/clients/client-ai-chat.tsx` as a `"use client"` component
  - Reuse `AIInputWithLoading` for the chat input; maintain `conversationHistory` state
  - Send messages to `POST /api/ai/clients`; stream response using the same SSE pattern as `/api/ai/stream`
  - On stream completion: call `onClientsUpdated()` prop to refresh the client list; display confirmation message in chat
  - When AI responds with `action: "clarify"`, display the clarifying question in chat without mutating any client
  - Create `app/api/ai/clients/route.ts`:
    - Call `authenticateRequest()`, check user tier — return 403 for free-tier users
    - Accept `{ message, conversationHistory }`, validate with Zod
    - Build DeepSeek V3 system prompt instructing extraction of `AIClientExtractionResult` JSON
    - On `action: "create"`: call insert logic; on `action: "update"`: search by `targetClientName` and call update logic; on `action: "clarify"`: stream clarifying question back
    - Stream response back to client using existing streaming infrastructure from `lib/deepseek.ts`
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11. Checkpoint — page and AI complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. `ClientSelector` component
  - Create `components/clients/client-selector.tsx` as a `"use client"` component
  - Render a "Select Client" button that opens a shadcn/ui `Popover` (Sheet on mobile)
  - Inside: search input + scrollable list of the user's clients fetched from `GET /api/clients`
  - On client selection: call `onChange({ toName, toEmail, toAddress, toPhone, toTaxId })` mapping null fields to empty strings, close the popover
  - Empty state: display prompt linking to `/clients`
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 12.1 Write property test for client selector Bill To mapping (Property 7)
    - **Property 7: Client selector populates all Bill To fields**
    - **Validates: Requirements 9.2**
    - Generate random `Client` objects with `fast-check`; assert `onChange` is called with all five Bill To fields populated and null fields mapped to empty string

- [x] 13. Wire `ClientSelector` into `invoice-chat.tsx`
  - Import and render `ClientSelector` near the Bill To section of `components/invoice-chat.tsx`
  - Pass an `onChange` handler that updates the relevant `invoiceData` fields (`toName`, `toEmail`, `toAddress`, `toPhone`, `toTaxId`) in the existing form state
  - _Requirements: 9.1, 9.2, 9.5_

- [x] 14. Navigation and middleware updates
  - Add a "Clients" `MenuItem` (use `Users` Lucide icon) to the "Navigation" `MenuSection` in `components/hamburger-menu.tsx`, inside the `{user && ...}` block, after "My Documents"
  - Add `/clients` to the protected routes in `middleware.ts` by ensuring it is NOT listed in `PUBLIC_PATHS` (it is already protected by default since only paths in `PUBLIC_PATHS` are public — verify and add a comment confirming `/clients` is protected)
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 15. Property-based tests for data model and round-trip
  - [ ]* 15.1 Write property test for client creation round-trip (Property 1)
    - **Property 1: Client creation round-trip**
    - **Validates: Requirements 1.1, 1.2, 3.2**
    - Generate random valid `ClientInput` objects with `fast-check`; mock the Supabase insert and fetch; assert returned record fields match inserted values exactly

  - [ ]* 15.2 Write property test for name-required validation (Property 2)
    - **Property 2: Name is required**
    - **Validates: Requirements 1.4, 3.3**
    - Generate empty strings and whitespace-only strings with `fast-check`; assert `clientSchema.safeParse` returns an error for every such input

  - [ ]* 15.3 Write property test for data isolation (Property 6)
    - **Property 6: Data isolation**
    - **Validates: Requirements 11.2, 11.3, 11.5**
    - Using mocked Supabase clients for two distinct users, assert that a client created by user A does not appear in user B's GET response, and that user B's PUT/DELETE on user A's client ID returns 404

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already available or add as a dev dependency)
- All API routes follow the existing `authenticateRequest()` pattern from `lib/api-auth.ts`
- Toast notifications use `sonner` consistent with the rest of the app
- The `/clients` route is protected by default — middleware only allows paths listed in `PUBLIC_PATHS`
- Free-tier check for AI chat: read `user_metadata.tier` or the `profiles` table, consistent with how other routes check tier
