# Requirements Document

## Introduction

This feature adds a dedicated document upload screen to the onboarding flow, positioned before the existing conversational Q&A chat. Users can upload business-related documents (PDFs, images, documents) such as catalogues, business cards, letterheads, and invoices. The system extracts business information from these uploads using AI and passes the extracted data to the onboarding chat, reducing the number of questions the AI needs to ask.

## Glossary

- **Upload_Screen**: The new UI screen displayed before the onboarding Q&A chat where users can upload business documents
- **Document_Uploader**: The component responsible for handling file selection, validation, and upload to Supabase Storage
- **Extraction_Service**: The backend service that calls the existing `/api/ai/analyze-file` endpoint to extract business information from uploaded files
- **Onboarding_Flow**: The complete onboarding process including the Upload_Screen followed by the existing Q&A chat
- **Collected_Data**: The structured business profile data (business name, address, tax IDs, contact info, etc.) gathered from uploads and chat
- **Supabase_Storage**: The file storage backend used to persist uploaded documents

## Requirements

### Requirement 1: Upload Screen Placement in Onboarding Flow

**User Story:** As a new user, I want to see a document upload option before the Q&A chat begins, so that I can share my business documents upfront and speed up the onboarding process.

#### Acceptance Criteria

1. WHEN a user navigates to the onboarding page, THE Onboarding_Flow SHALL display the Upload_Screen before the existing Q&A chat section
2. WHEN the user completes or skips the Upload_Screen, THE Onboarding_Flow SHALL transition the user to the existing onboarding Q&A chat
3. THE Upload_Screen SHALL include a visible skip option that allows the user to proceed directly to the Q&A chat without uploading any documents
4. WHILE the Upload_Screen is displayed, THE Onboarding_Flow SHALL show the same header with the Clorefy logo and "Business Setup" label used by the existing onboarding page

### Requirement 2: File Upload Support

**User Story:** As a new user, I want to upload multiple business documents in various formats, so that the system can extract my business details automatically.

#### Acceptance Criteria

1. THE Document_Uploader SHALL accept files in PDF (application/pdf), PNG (image/png), and JPEG (image/jpeg) formats
2. THE Document_Uploader SHALL allow the user to upload multiple files in a single session
3. WHEN a user selects a file that exceeds 10MB, THE Document_Uploader SHALL display an error message indicating the file size limit
4. WHEN a user selects a file with an unsupported format, THE Document_Uploader SHALL display an error message listing the accepted formats
5. THE Document_Uploader SHALL support file selection via both a click-to-browse button and drag-and-drop interaction
6. WHILE files are being uploaded, THE Document_Uploader SHALL display a progress indicator for each file

### Requirement 3: File Storage

**User Story:** As a system operator, I want uploaded documents stored securely in Supabase Storage, so that they are associated with the correct user and available for processing.

#### Acceptance Criteria

1. WHEN a user uploads a file, THE Document_Uploader SHALL store the file in Supabase_Storage under a path scoped to the authenticated user's ID
2. THE Document_Uploader SHALL generate a unique filename for each uploaded file to prevent collisions
3. IF the upload to Supabase_Storage fails, THEN THE Document_Uploader SHALL display an error message and allow the user to retry the upload

### Requirement 4: AI-Powered Business Information Extraction

**User Story:** As a new user, I want the system to automatically extract business details from my uploaded documents, so that I do not have to type everything manually.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Extraction_Service SHALL send the file to the existing `/api/ai/analyze-file` endpoint for analysis
2. WHEN the `/api/ai/analyze-file` endpoint returns extracted data, THE Extraction_Service SHALL display a summary of the extracted fields to the user on the Upload_Screen
3. WHEN multiple files are uploaded, THE Extraction_Service SHALL merge extracted data from all files, with later uploads overriding conflicting fields from earlier uploads
4. THE Extraction_Service SHALL extract the following fields when present in documents: business name, owner name, email, phone, address, tax ID, country, currency, services, and bank details
5. IF the `/api/ai/analyze-file` endpoint returns an error, THEN THE Extraction_Service SHALL display an error message for that specific file and allow the user to continue with other files or proceed to the Q&A chat

### Requirement 5: Extracted Data Handoff to Onboarding Chat

**User Story:** As a new user, I want the information extracted from my documents to pre-fill the onboarding chat, so that the AI asks me fewer questions.

#### Acceptance Criteria

1. WHEN the user proceeds from the Upload_Screen to the Q&A chat, THE Onboarding_Flow SHALL pass all extracted Collected_Data to the OnboardingChat component as initial data
2. WHEN extracted data is provided, THE OnboardingChat component SHALL use the pre-filled fields to skip questions for fields that already have values
3. WHEN extracted data is provided, THE OnboardingChat component SHALL inform the user which fields were pre-filled and ask for confirmation or corrections
4. THE Onboarding_Flow SHALL preserve extracted data if the user navigates between the Upload_Screen and the Q&A chat within the same session

### Requirement 6: Upload Screen UI and User Experience

**User Story:** As a new user, I want the upload screen to be clear and easy to use, so that I understand what documents I can share and what will happen with them.

#### Acceptance Criteria

1. THE Upload_Screen SHALL display instructional text explaining that users can upload business documents such as catalogues, business cards, letterheads, and invoices
2. THE Upload_Screen SHALL display a list of uploaded files with their names, sizes, and extraction status (pending, processing, complete, or failed)
3. WHEN extraction is complete for a file, THE Upload_Screen SHALL display the number of fields successfully extracted from that file
4. THE Upload_Screen SHALL include a "Continue" button that becomes enabled after at least one file has been processed or the user chooses to skip
5. THE Upload_Screen SHALL be responsive and functional on both desktop and mobile screen sizes

### Requirement 7: Cloudflare Workers Free Tier Compatibility

**User Story:** As a system operator, I want the document upload feature to work within Cloudflare Workers free tier constraints, so that the feature does not incur unexpected infrastructure costs.

#### Acceptance Criteria

1. THE Document_Uploader SHALL upload files directly from the client to Supabase_Storage without routing file binary data through the Next.js API routes
2. THE Extraction_Service SHALL send files to the `/api/ai/analyze-file` endpoint directly from the client using FormData to avoid server-side memory constraints
3. IF a file analysis request is rate-limited (HTTP 429), THEN THE Extraction_Service SHALL wait 5 seconds and retry the request once before displaying an error

### Requirement 8: Security and Authentication

**User Story:** As a system operator, I want the upload feature to enforce authentication and input validation, so that only authorized users can upload files and the system is protected from abuse.

#### Acceptance Criteria

1. THE Upload_Screen SHALL only be accessible to authenticated users who have selected a plan
2. WHEN uploading to Supabase_Storage, THE Document_Uploader SHALL include the user's authentication token in the request
3. THE Document_Uploader SHALL validate file type and file size on the client side before initiating any upload
4. IF an unauthenticated request is made to the upload or extraction endpoints, THEN THE system SHALL return an HTTP 401 response
