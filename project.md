═══════════════════════════════════════════════════════════════════
INVO.AI - COMPLETE BUILD SPECIFICATION
AI-Powered Invoice & Contract Builder for 11 Countries
═══════════════════════════════════════════════════════════════════

PRODUCT OVERVIEW
─────────────────────────────────────────────────────────────────

Invo.ai is a global AI-first platform that generates compliant 
invoices, contracts, and NDAs through conversational prompts.

User Flow:
User describes what they need → AI generates complete document → 
User edits if needed → Export in multiple formats

SUPPORTED COUNTRIES (Equal Priority - No Prioritization):
🇮🇳 India | 🇺🇸 USA | 🇬🇧 UK | 🇩🇪 Germany | 🇨🇦 Canada | 🇦🇺 Australia
🇸🇬 Singapore | 🇦🇪 UAE | 🇵🇭 Philippines | 🇫🇷 France | 🇳🇱 Netherlands

═══════════════════════════════════════════════════════════════════
CORE PRINCIPLES
═══════════════════════════════════════════════════════════════════

1. AI writes complete documents from scratch (not templates)
2. Compliance rules stored in Supabase using RAG (vector search)
3. Everything is editable by users after generation
4. Business data asked once during onboarding, stored permanently
5. Only structured data saved (no chat conversation logs)
6. Multi-layer validation before showing document to user
7. Automated compliance monitoring every 7 days via cron job
8. All 11 countries treated equally with same priority
9. Backend powered entirely by Supabase

═══════════════════════════════════════════════════════════════════
AI MODEL STRATEGY (Cost-Optimized)
═══════════════════════════════════════════════════════════════════

THREE-LAYER AI ARCHITECTURE:

LAYER 1: ONBOARDING FLOW
────────────────────────────────────────────────────────────────
Model: DeepSeek V3 Chat (deepseek-chat)
Purpose: Extract structured business data from user conversations
Frequency: One-time per user
Cost: Approximately $0.005 per user
Reasoning: Fast response time for interactive chat, accurate enough
for data extraction with follow-up validation

NO WEB SEARCH DURING ONBOARDING
User simply selects client countries from list
No compliance rules fetched at this stage
Compliance rules loaded later by automated cron job

LAYER 2: DOCUMENT GENERATION
────────────────────────────────────────────────────────────────
Model: DeepSeek V3 Reasoning (deepseek-reasoner)
Purpose: Generate invoices, contracts, NDAs from prompts
Frequency: Every document creation
Reasoning: Reasoning model for accurate, compliant document generation
Pricing Structure:
- Input tokens with cache hit: $0.028 per 1 million tokens
- Input tokens with cache miss: $0.28 per 1 million tokens
- Output tokens: $0.42 per 1 million tokens
Cost: Approximately $0.00094 per invoice (assuming 70% cache hit rate)
Reasoning: 68% cheaper than alternatives while maintaining quality

Uses RAG to fetch compliance rules from Supabase vector store

Cache Optimization Strategy:
- System instructions remain constant and get cached
- Business profile per user gets cached
- Compliance rules per country get cached
- Only user's unique prompt is not cached

LAYER 3: COMPLIANCE MONITORING
────────────────────────────────────────────────────────────────
Model: DeepSeek V3 Reasoning (deepseek-reasoner)
Purpose: Monitor legal/tax changes across all countries
Frequency: Automated cron job every 7 days
Cost: Approximately $1 per month for all 11 countries
Reasoning: Advanced reasoning at lower cost for compliance analysis

DOUBLE VERIFICATION PROCESS:
1. First search: Get initial compliance data
2. Second search: Verify the data is correct
3. Only then save to database

SMART UPDATE LOGIC:
- If changes detected: DELETE old rules, INSERT new rules
- If NO changes detected: Keep existing data unchanged
- Never update timestamps unless actual data changed

═══════════════════════════════════════════════════════════════════
BACKEND ARCHITECTURE (SUPABASE ONLY)
═══════════════════════════════════════════════════════════════════

ALL BACKEND SERVICES PROVIDED BY SUPABASE:

1. PostgreSQL Database with pgvector extension
2. Authentication and user management
3. File storage for logos and signatures
4. Edge Functions for serverless logic
5. Real-time subscriptions
6. Vector embeddings for RAG
7. Row Level Security (RLS) policies

No separate backend server needed - Supabase handles everything

═══════════════════════════════════════════════════════════════════
DATABASE ARCHITECTURE (SUPABASE)
═══════════════════════════════════════════════════════════════════

Four main tables in Supabase PostgreSQL:

TABLE 1: BUSINESS_PROFILES
────────────────────────────────────────────────────────────────
Stores permanent business information collected during onboarding.

Required Fields:
- Unique ID for each profile
- Reference to authenticated user
- Business type (freelancer, agency, SaaS, ecommerce, professional)
- Business name, owner name, email, phone
- Country code (2-letter ISO standard like IN, US, UK)
- State or province
- Complete address stored as structured JSON with fields:
  line1, line2, city, state, postal_code
- Tax IDs stored as JSON with country-specific formats:
  India: GSTIN, USA: EIN, UK: VAT, Australia: ABN, etc.
- Default currency (3-letter ISO code like INR, USD, GBP)
- Default payment terms (net_30, net_15, net_60, immediate)
- Payment methods stored as JSON containing:
  bank transfer details, UPI, international banking, payment platforms
- Logo URL (link to uploaded logo in Supabase Storage)
- Signature URL (link to uploaded signature in Supabase Storage)
- Array of client countries (ISO codes)
- Timestamps for creation and updates

Indexes needed on user_id for fast lookups.

TABLE 2: COMPLIANCE_RULES
────────────────────────────────────────────────────────────────
Stores legal/tax requirements with vector embeddings for RAG.

Required Fields:
- Unique ID for each rule set
- Country code (2-letter ISO)
- Document type (invoice, contract, NDA)
- Complete rules stored as structured JSON containing:
  * Required fields with validation formats
  * Tax rules for domestic and export scenarios
  * Legal notice templates required by law
  * Invoice format requirements
- Array of source URLs (government websites)
- Confidence score (0 to 1) from AI extraction
- Timestamp of last update
- Who validated it (AI or human email)
- Boolean flag if human review needed
- Vector embedding (1536 dimensions) for semantic RAG search
- Creation timestamp

CRITICAL: Vector embedding allows semantic search using RAG
AI can query: "What are India's export invoice requirements?"
Supabase returns most relevant compliance rules using vector similarity

Indexes needed:
- Country + document_type combination
- Last_updated for monitoring staleness
- Vector index (ivfflat) for fast similarity search

TABLE 3: GENERATED_DOCUMENTS
────────────────────────────────────────────────────────────────
Stores every document created by users for history and auditing.

Required Fields:
- Unique ID for each document
- Reference to user who created it
- Document type (invoice, contract, NDA)
- Complete document data stored as JSON with all fields:
  invoice number, dates, seller/buyer info, line items, totals, etc.
- AI model used for generation
- Version of compliance rules used
- Confidence score from validation
- Validation results stored as JSON showing which checks passed
- Boolean flag if human review required
- Boolean flag if user edited the document
- Array of edit history if user made changes
- Array of export formats used (PDF, DOCX, PNG, JPG)
- Creation and update timestamps

Indexes needed on user_id and created_at for user document history.

TABLE 4: COMPLIANCE_ALERTS
────────────────────────────────────────────────────────────────
Stores detected changes in laws/regulations for admin review.

Required Fields:
- Unique ID for each alert
- Country code where change detected
- Summary of what changed
- Severity level (low, medium, high)
- Array of source URLs
- Effective date of change
- Status (pending_review, approved, rejected)
- Who reviewed it and when
- Creation timestamp

Indexes needed on status and created_at for admin dashboard.

═══════════════════════════════════════════════════════════════════
RAG IMPLEMENTATION WITH SUPABASE
═══════════════════════════════════════════════════════════════════

HOW RAG WORKS FOR COMPLIANCE RULES:

Step 1: Store Rules with Embeddings
When compliance rules are saved (from weekly cron job):
1. Store complete rules as JSON in compliance_rules table
2. Generate vector embedding of rules using OpenAI embeddings
3. Store 1536-dimension vector in embedding column
4. Supabase pgvector extension enables similarity search

Step 2: Query Rules Using RAG
When generating invoice:
1. User's prompt: "Create invoice for Indian client"
2. AI extracts intent: Need India invoice compliance rules
3. Generate embedding for search query: "India invoice requirements"
4. Supabase performs vector similarity search
5. Returns most relevant compliance rules instantly
6. AI uses these rules to generate compliant invoice

Benefits of RAG Approach:
- Semantic search (understands meaning, not just keywords)
- Fast retrieval (milliseconds)
- Always uses most up-to-date rules
- Can handle natural language queries
- More accurate than simple database queries

═══════════════════════════════════════════════════════════════════
ONBOARDING WORKFLOW (NO WEB SEARCH)
═══════════════════════════════════════════════════════════════════

CRITICAL CHANGE: During onboarding, NO web search is performed.
User simply provides information and selects countries.
Compliance rules are fetched later by automated cron job.

CRITICAL PRINCIPLE: AI only extracts structured data from 
conversations. Never save the actual chat messages.

HOW DATA EXTRACTION WORKS:

For every user response during onboarding:
1. Send user's message to DeepSeek V3 Chat (fast model)
2. AI extracts only the structured data fields needed
3. AI returns pure JSON with specific fields
4. Validate the extracted data
5. Save ONLY the structured fields to Supabase database
6. Discard the conversation text completely

If AI cannot extract data with high confidence:
- Return a flag indicating clarification needed
- Ask a specific follow-up question
- Do NOT save partial or uncertain data

═══════════════════════════════════════════════════════════════════

SCREEN 1: WELCOME
────────────────────────────────────────────────────────────────

Display clean centered layout with:

Message:
"Hi! 👋 I'm Invo AI.

I help you create compliant invoices and contracts 
for clients worldwide.

Let's set up your business profile in 2 minutes."

Single button: "Start Setup"

═══════════════════════════════════════════════════════════════════

QUESTION 1: BUSINESS TYPE
────────────────────────────────────────────────────────────────

AI Task:
Take user input and extract which type of business they operate.

Possible Values:
- Freelancer or Consultant
- Software Developer
- Agency or Studio
- E-commerce Business
- Professional Services (Legal, Accounting, etc.)
- Other

UI Display Options:
Show button grid with icons for each business type
OR allow conversational text input

AI Processing:
Send user input to DeepSeek V3 Chat asking it to extract business type
Return JSON containing business_type and confidence score
If confidence is low, ask for clarification

What Gets Saved:
Single field: business_type with one of the allowed values
Chat conversation is NOT saved

Supabase Action:
Create new business profile record in business_profiles table
Link to authenticated user via user_id foreign key

═══════════════════════════════════════════════════════════════════

QUESTION 2: LOCATION
────────────────────────────────────────────────────────────────

AI Task:
Extract the country where user's business is located.

Supported Countries:
India, USA, UK, Germany, Canada, Australia, Singapore, UAE, 
Philippines, France, Netherlands

UI Display:
Smart search field with country flags
User can type country name and see filtered results

AI Processing:
Extract country code (2-letter ISO), full country name, and 
state/province if mentioned
Return JSON with country_code, country_name, state_province

What Gets Saved:
- country: 2-letter ISO code (IN, US, UK, etc.)
- state_province: state or region name
Chat conversation is NOT saved

Supabase Action:
Update business_profiles table with country and state_province
Use Supabase client update query

NO WEB SEARCH TRIGGERED
Previously this would fetch compliance rules
Now it just saves the country selection
Compliance rules will be loaded by weekly cron job

═══════════════════════════════════════════════════════════════════

QUESTION 3: BUSINESS DETAILS
────────────────────────────────────────────────────────────────

AI Task:
Extract four key business identifiers from conversation.

Required Information:
- Business name (company or individual name)
- Owner's full name
- Email address
- Phone number

UI Display:
Can show as four separate questions asked one at a time
OR show as a form with four fields
OR accept conversational input and extract all at once

AI Processing:
Extract each field from user input
Validate email format (must contain @ and domain)
Validate phone format (include country code)
If any field missing, ask specifically for it

What Gets Saved:
Four fields: business_name, owner_name, email, phone
Chat conversation is NOT saved

Supabase Action:
Update business_profiles table with these four fields

═══════════════════════════════════════════════════════════════════

QUESTION 4: BUSINESS ADDRESS
────────────────────────────────────────────────────────────────

AI Task:
Extract complete mailing address for invoices.

Required Fields:
- Address line 1 (street address)
- Address line 2 (optional - suite, building, etc.)
- City
- State or province
- Postal code or ZIP code

UI Display:
Standard address form with labeled fields
Country field pre-filled and locked (from Question 2)

AI Processing:
Can extract from conversational input or form input
Validate postal code format for the user's country

What Gets Saved:
Complete address as structured JSON object with all five fields
Chat conversation is NOT saved

Supabase Action:
Update business_profiles table with address JSONB field

═══════════════════════════════════════════════════════════════════

QUESTION 5: TAX REGISTRATION
────────────────────────────────────────────────────────────────

AI Task:
Determine if user has tax registration and extract tax ID numbers.

Country-Specific Tax IDs:
- India: GSTIN (GST Identification Number)
- USA: EIN (Employer Identification Number)
- UK: VAT Registration Number
- Germany: Steuernummer (Tax Number)
- Canada: Business Number (BN)
- Australia: ABN (Australian Business Number)
- Singapore: GST Registration Number
- UAE: TRN (Tax Registration Number)
- Philippines: TIN (Tax Identification Number)
- France: SIRET Number
- Netherlands: BTW Number (VAT)

UI Display:
First ask: "Do you have tax registration?"
Options: Yes / No / Not sure

If Yes, show input field for that country's specific tax ID format

Real-Time Validation:
As user types tax ID, validate format using regex patterns:
- India GSTIN: 2 digits + 10 characters (PAN) + 4 more characters
- US EIN: 2 digits + hyphen + 7 digits
- UK VAT: GB prefix + 9 digits
- And so on for each country

External API Validation (Optional):
After format validation, can call government API to verify:
- India: GST API to verify GSTIN is registered
- Other countries: Similar validation APIs

What Gets Saved:
Tax IDs stored as JSON object with country-specific field names
Example: {"gstin": "29ABCDE1234F1Z5"} for India
Chat conversation is NOT saved

Supabase Action:
Update business_profiles table tax_ids JSONB field

═══════════════════════════════════════════════════════════════════

QUESTION 6: CLIENT COUNTRIES (NO WEB SEARCH)
────────────────────────────────────────────────────────────────

AI Task:
Identify which countries the user's clients are located in.

Purpose:
Simply records which countries to monitor for compliance.
Actual compliance rules fetched later by automated cron job.

UI Display:
Show all 11 supported countries as multi-select checkboxes with flags:
India, USA, UK, Germany, Canada, Australia, Singapore, UAE, 
Philippines, France, Netherlands

User can select multiple countries (most users will select 2-4)

CRITICAL CHANGE: NO BACKGROUND PROCESS TRIGGERED

Previously: Selecting countries would trigger immediate web search
Now: Just save the selected countries to database
Compliance rules will be fetched by weekly cron job (every 7 days)

UI Feedback:
Simple confirmation: "Client countries saved: India, USA, UK"
No loading animation
No "fetching rules" message
Just move to next question

What Gets Saved:
- client_countries: Array of country codes in business profile
Chat conversation is NOT saved

NO compliance rules saved at this stage
NO web search performed
NO compliance_rules table entries created

Supabase Action:
Update business_profiles table with client_countries array

═══════════════════════════════════════════════════════════════════

QUESTION 7: DEFAULT CURRENCY
────────────────────────────────────────────────────────────────

AI Task:
Determine which currency user typically invoices in.

UI Display:
Dropdown menu with common currencies at top:
- INR (₹) Indian Rupee
- USD ($) US Dollar
- GBP (£) British Pound
- EUR (€) Euro

Then separator line, then all other 150+ currencies alphabetically

What Gets Saved:
- default_currency: 3-letter ISO currency code (INR, USD, GBP, etc.)

Supabase Action:
Update business_profiles table with default_currency

Note to User:
Explain they can change currency for any individual invoice later

═══════════════════════════════════════════════════════════════════

QUESTION 8: PAYMENT TERMS
────────────────────────────────────────────────────────────────

AI Task:
Determine user's standard payment due timeline.

UI Display:
Radio button options:
- Due on receipt (immediate payment)
- Net 15 (payment due in 15 days)
- Net 30 (payment due in 30 days)
- Net 60 (payment due in 60 days)
- Custom: [input field for number] days

What Gets Saved:
- payment_terms: string like "net_30", "net_15", "immediate", etc.

Supabase Action:
Update business_profiles table with payment_terms

Note to User:
Explain this is the default but can be customized per client

═══════════════════════════════════════════════════════════════════

QUESTION 9: PAYMENT METHODS
────────────────────────────────────────────────────────────────

AI Task:
Collect how clients can pay the user.

UI Display:
Tabbed interface with four tabs:

Tab 1: Bank Transfer (Domestic)
Fields: Bank name, account holder name, account number, 
routing/IFSC code, branch (optional)

Tab 2: UPI (India only)
Field: UPI ID (username@bank format)

Tab 3: International Banking
Fields: Account holder, IBAN, SWIFT/BIC code, bank name, bank address

Tab 4: Payment Platforms
Checkboxes: PayPal (email), Stripe (connect account), 
Wise (connect account), Payoneer (email)

Allow Skipping:
Show "Skip for now" button since this is optional
User can add payment details later in settings

What Gets Saved:
- payment_methods: JSON object containing all filled methods
Example: {"bank_transfer": {fields...}, "upi": "user@bank", 
"paypal": "email@example.com"}

Supabase Action:
Update business_profiles table with payment_methods JSONB field

═══════════════════════════════════════════════════════════════════

QUESTION 10: LOGO (Optional)
────────────────────────────────────────────────────────────────

Purpose:
Allow users to upload company logo for professional invoices.

UI Display:
Drag-and-drop upload area with specifications:
- Accepted formats: PNG, JPG, SVG
- Maximum file size: 5MB
- Recommended dimensions: 500x200 pixels

Show "Skip for now" button since this is optional

File Upload Process:
1. User selects or drops file
2. Validate file type and size client-side
3. Upload to Supabase Storage bucket named "logos"
4. Generate unique filename: {user_id}/logo_{timestamp}.png
5. Supabase Storage returns public URL
6. Show preview of how logo will appear on invoice

What Gets Saved:
- logo_url: Full Supabase Storage URL to uploaded file

Supabase Actions:
1. Upload file to Supabase Storage "logos" bucket
2. Update business_profiles table with logo_url

Note to User:
Explain they can change logo anytime in settings

═══════════════════════════════════════════════════════════════════

QUESTION 11: SIGNATURE (Optional)
────────────────────────────────────────────────────────────────

Purpose:
Collect signature for contracts, NDAs, and formal agreements.

UI Display:
Three options as tabs:

Tab 1: Draw Signature
Canvas area where user can draw with mouse or stylus
Buttons: Clear, Undo

Tab 2: Upload Image
Drag-and-drop area for signature image
Recommend PNG with transparent background
Max size: 2MB

Tab 3: Type Name
Text input field for full name
Dropdown to select font style (Cursive, Elegant, Professional)
Show live preview of typed signature

Processing:
For drawn or uploaded signatures:
1. Convert to PNG format client-side
2. Ensure transparent background
3. Resize to standard dimensions (e.g., 400x150 pixels)
4. Upload to Supabase Storage "signatures" bucket
5. Generate unique filename: {user_id}/signature_{timestamp}.png
6. Get public URL from Supabase

For typed signatures:
1. Render text in selected font as image client-side
2. Save as PNG with transparent background
3. Upload to Supabase Storage

What Gets Saved:
- signature_url: Full Supabase Storage URL to signature file

Supabase Actions:
1. Upload file to Supabase Storage "signatures" bucket
2. Update business_profiles table with signature_url

Note to User:
Explain signature will appear on contracts when needed

═══════════════════════════════════════════════════════════════════

FINAL SCREEN: SETUP COMPLETE
────────────────────────────────────────────────────────────────

Display:
Celebration message: "🎉 Setup complete!"

Show Summary:
List everything saved:
- Business location and name
- Email and contact info
- Tax ID if provided
- Default currency and payment terms
- Client countries selected
- Logo and signature (if provided)

Show Checkmarks:
✓ Business profile saved
✓ Client countries recorded
✓ Payment details secured
✓ Logo and signature ready (if provided)

IMPORTANT NOTE TO USER:
"Compliance rules for your client countries will be automatically 
loaded within the next update cycle. You can start creating 
documents immediately."

Action Buttons:
Two prominent buttons:
1. "Create First Invoice" - Goes directly to invoice builder
2. "Go to Dashboard" - Shows main application interface

Small Text Below:
"You can edit all settings anytime in your profile"

═══════════════════════════════════════════════════════════════════
INVOICE GENERATION FLOW (USES RAG)
═══════════════════════════════════════════════════════════════════

CRITICAL PRINCIPLE: Never search web during invoice generation.
Always use cached compliance rules from Supabase via RAG.

USER STARTS WITH PROMPT:

Example: "Create invoice for $5,000 to US client for web development"

═══════════════════════════════════════════════════════════════════

STEP 1: EXTRACT INTENT
────────────────────────────────────────────────────────────────

AI Task:
Parse user's natural language prompt to extract invoice details.

Send prompt to DeepSeek V3 asking it to extract:
- Document type (invoice, contract, NDA)
- Client's country
- Amount and currency
- Service or product description
- Any other details mentioned

AI returns structured JSON with extracted fields.

Cost: Very low (approximately $0.0003 per request)

═══════════════════════════════════════════════════════════════════

STEP 2: FETCH COMPLIANCE RULES USING RAG
────────────────────────────────────────────────────────────────

RAG Process:

1. Generate search query embedding
   Take extracted client country (e.g., "US")
   Create semantic query: "United States invoice compliance requirements"
   Generate vector embedding using OpenAI embeddings API

2. Perform vector similarity search in Supabase
   Query compliance_rules table using pgvector
   Find most similar compliance rules based on embedding
   Filter by: country = 'US' AND document_type = 'invoice'
   Order by vector similarity (cosine distance)
   Return top result

3. Validate rules freshness
   Check if last_updated is within 7 days
   If rules older than 7 days: Flag as potentially stale
   If rules don't exist: Return error, wait for cron job to populate

4. Return compliance rules as JSON
   Complete rules ready for invoice generation

Cost: Zero (Supabase query only, no AI call)
Speed: Milliseconds (vector similarity search is very fast)

Benefits of RAG Approach:
- Semantic understanding (AI understands intent, not just keywords)
- Fast retrieval (pgvector optimized for speed)
- Always uses latest rules from database
- Can handle complex queries naturally

═══════════════════════════════════════════════════════════════════

STEP 3: ASK CLARIFYING QUESTIONS
────────────────────────────────────────────────────────────────

AI Determines What's Missing:
Compare extracted intent against compliance requirements.

Identify missing required fields such as:
- Client company name
- Client address
- Specific service description
- Any country-specific required fields

Ask Questions One at a Time:
"I need a few more details:"
1. "What's your client's company name?"
2. "What's their address in the USA?"
3. "What specific service did you provide?"

User Responds Conversationally:
User can type natural answers
AI extracts structured data from each response
Process continues until all required fields collected

═══════════════════════════════════════════════════════════════════

STEP 4: GENERATE COMPLETE INVOICE
────────────────────────────────────────────────────────────────

Use DeepSeek V3 with Caching Strategy:

Provide AI with four components:

Component 1: System Instructions (CACHED)
Permanent instructions about being an invoice generator
These never change so they get cached

Component 2: Business Profile (CACHED)
User's complete business information from Supabase
This is same for all of user's invoices so it gets cached

Component 3: Compliance Rules (CACHED)
Complete compliance requirements for destination country
Retrieved via RAG from Supabase
These are same for all invoices to this country so they get cached

Component 4: User's Specific Request (NOT CACHED)
The unique details of this particular invoice
Only this part is not cached

AI Processing:
DeepSeek V3 combines all four components to generate complete 
invoice as structured JSON containing:
- Invoice number (auto-generated sequential)
- Invoice date
- Due date (based on payment terms)
- Seller information (from business profile)
- Buyer information (from user input)
- Line items with descriptions, quantities, prices
- Subtotals and tax calculations
- Total amounts
- Currency and exchange rates if needed
- Legal notices required by compliance rules
- Payment instructions

Result: Complete invoice data as structured JSON

Cost: Approximately $0.0009 per invoice due to 70% cache hit rate

═══════════════════════════════════════════════════════════════════

STEP 5: MULTI-LAYER VALIDATION
────────────────────────────────────────────────────────────────

CRITICAL: Never show document to user without validation.

Run Five Validation Checks:

Validation 1: Schema Validation
Check that JSON matches expected invoice structure
Verify all required fields are present
Confirm correct data types for each field

Validation 2: Compliance Check
Compare generated invoice against compliance rules from RAG
Verify all country-specific required fields included
Check that legal notices match requirements
Validate tax calculations match rules

Validation 3: Mathematical Validation
Verify all arithmetic is correct:
- Line item totals (quantity × price)
- Subtotals (sum of line items)
- Tax calculations (rate × applicable amount)
- Final total (subtotal + taxes - discounts)
- Currency conversions if applicable

Validation 4: Second AI Review
Send generated invoice back to AI (DeepSeek V3 Reasoning)
Ask AI to review for errors, ambiguities, or compliance issues
AI returns list of any problems found and confidence score

Validation 5: Rule-Based Checks
Run programmatic validations:
- Tax ID format matches country's regex pattern
- Date formats are correct
- Currency codes are valid ISO codes
- Required field lengths are within limits

Calculate Aggregate Confidence:
Average confidence scores from all validations
Result is single score from 0 to 1

Decision Rules:
- If confidence ≥ 0.95: Show to user (high confidence)
- If 0.85 ≤ confidence < 0.95: Show with warning flag
- If confidence < 0.85: Block generation, escalate to human review

═══════════════════════════════════════════════════════════════════

STEP 6: PRESENT TO USER (EDITABLE INTERFACE)
────────────────────────────────────────────────────────────────

Two-Panel Layout:

LEFT PANEL: Editable Form
Display all invoice fields as editable form inputs:
- Invoice number (can be changed)
- Dates with calendar pickers
- Seller details (pre-filled from Supabase, editable)
- Buyer details (editable)
- Line items in editable table with add/remove buttons
- Currency dropdown
- Tax calculations (auto-update when amounts change)
- Totals (auto-calculate)
- Payment terms (editable dropdown)
- Payment method selection
- Notes field (optional)

Every field is editable by user.

RIGHT PANEL: Live Preview
Show real-time rendered document exactly as it will export
Preview updates immediately as user edits left panel
Styled professionally with logo from Supabase Storage
Shows pagination if multi-page
Click any section in preview to jump to that field in editor

Bottom Bar:
Show validation status with confidence score
Display: "✓ Compliance Check Passed (96%)"
If flagged: "⚠️ Please review - human verification recommended"

Action Buttons:
- Save as Draft (stores in Supabase generated_documents table)
- Export as PDF
- Export as DOCX  
- Export as PNG
- Export as JPG

═══════════════════════════════════════════════════════════════════

STEP 7: EXPORT DOCUMENTS
────────────────────────────────────────────────────────────────

When user clicks export button:

Use Supabase Edge Function to handle exports:

For PDF Export:
1. Edge Function uses headless browser (Puppeteer/Playwright)
2. Render HTML version with embedded CSS
3. Include logo from Supabase Storage
4. Include signature from Supabase Storage
5. Generate high-quality PDF (300 DPI)
6. Add metadata (document ID, generation date, etc.)
7. Flatten PDF (make non-editable)
8. Add disclaimer footer: "Generated by AI - review recommended"
9. Upload PDF to Supabase Storage "exports" bucket
10. Return download URL

For DOCX Export:
1. Edge Function converts invoice data to Word format
2. Preserve formatting and styling
3. Include images from Supabase Storage
4. Keep tables properly formatted
5. Make fully editable
6. Upload to Supabase Storage
7. Return download URL

For PNG/JPG Export:
1. Edge Function renders as high-resolution image
2. Include all visual elements
3. Optimize file size
4. Upload to Supabase Storage
5. Return download URL

Save to Supabase Database:
Store complete generated document in generated_documents table:
- Document data as JSONB
- AI model used
- Compliance rules version
- Validation scores
- Export formats used
- Edit history if user modified
- Timestamps

Provide Download:
Return Supabase Storage URL to user for immediate download
Document also appears in user's history for later access

═══════════════════════════════════════════════════════════════════
COMPLIANCE MONITORING SYSTEM (EVERY 7 DAYS)
═══════════════════════════════════════════════════════════════════

AUTOMATED CHECKS EVERY 7 DAYS:

Schedule:
Run Supabase Edge Function (cron trigger) every 7 days
Not tied to specific day (Sunday) - just every 7 days from first run
Low-traffic time recommended (e.g., 3:00 AM UTC)

Process:
Automatically check all 11 countries for legal/tax changes
DOUBLE VERIFICATION before saving
SMART UPDATE: Only change database if actual changes detected

═══════════════════════════════════════════════════════════════════

HOW 7-DAY MONITORING WORKS:

Supabase Edge Function triggered every 7 days

For Each of 11 Countries:

STEP 1: FIRST SEARCH (Initial Data Gathering)
────────────────────────────────────────────────────────────────

Construct Search Query:
"Search for official tax and invoice law changes in [country name]
in the last 7 days.

Focus on:
- Invoice requirements changes
- Tax rate modifications  
- New compliance mandates
- Invoice format requirement updates

Search ONLY official government sources."

Use DeepSeek V3 Reasoning:
Enable Google Grounding to search real-time web
AI searches specifically for:
- Government websites (.gov, .gov.uk, .gov.in, etc.)
- Official tax authority sites
- Legal gazette publications
- Central bank announcements

AI Returns First Result Set:
- Boolean flag: Did anything change?
- Text summary: What changed
- New compliance rules as structured JSON
- Array of source URLs (government links)
- Effective date: When change takes effect

STEP 2: SECOND SEARCH (Verification)
────────────────────────────────────────────────────────────────

CRITICAL: Never trust first search result alone.
Perform second independent search to verify accuracy.

Verification Search Query:
"Verify the following compliance information for [country name]:
[First search results]

Confirm:
1. Are these changes actually implemented?
2. Are the tax rates correct?
3. Are the source URLs legitimate government sources?
4. Is the effective date accurate?

Search official sources to verify."

Use DeepSeek V3 Reasoning Again:
Independent search with different query formulation
Cross-reference results from first search

AI Returns Verification Result:
- Boolean: Is first search verified?
- Confidence score: How confident in verification (0-1)
- Discrepancies: Any differences found
- Additional sources: More authoritative links

STEP 3: COMPARE WITH EXISTING DATA
────────────────────────────────────────────────────────────────

Fetch Current Compliance Rules from Supabase:
Query compliance_rules table for this country

Compare Fields:
Check if ANY field is different:
- Required fields array
- Tax rates
- Legal notices
- Format requirements
- Any other compliance data

Calculate Change Detection:
If EXACT MATCH: No changes, existing data is current
If ANY DIFFERENCE: Changes detected, need to update

STEP 4: SMART DATABASE UPDATE
────────────────────────────────────────────────────────────────

IF NO CHANGES DETECTED:
- Do NOT update database
- Do NOT change last_updated timestamp
- Do NOT modify any existing data
- Log: "No changes for [country] - data remains current"
- Move to next country

IF CHANGES DETECTED AND VERIFIED:
1. DELETE old compliance rules entry for this country
   Remove entire row from compliance_rules table
   
2. INSERT new compliance rules entry
   Create fresh row with:
   - New compliance data from verified search
   - New vector embedding generated from new rules
   - Current timestamp as last_updated
   - Marked as validated_by: "AI-automated"
   - Confidence score from verification

3. Create alert in compliance_alerts table:
   - Country code
   - Summary of changes
   - Severity level (calculated by AI)
   - Source URLs from both searches
   - Effective date
   - Status: "approved" (since double-verified)
   - Current timestamp

4. Send notifications (Supabase Edge Function):
   - Email admin about changes
   - Log to admin dashboard
   - Record in audit trail

CRITICAL: This is a complete replacement, not an update.
Old data is deleted, new data inserted fresh.
This ensures no partial updates or data corruption.

STEP 5: GENERATE NEW VECTOR EMBEDDING
────────────────────────────────────────────────────────────────

For new compliance rules:
1. Convert entire rules JSON to text representation
2. Send to OpenAI Embeddings API
3. Get 1536-dimension vector embedding
4. Store in embedding column of compliance_rules table
5. Supabase pgvector index automatically updated

This allows RAG queries to find new rules immediately

═══════════════════════════════════════════════════════════════════

EXAMPLE: India GST Rate Change

Day 0: Existing Rule in Database
{
  "country": "IN",
  "tax_rules": {"gst_rate": 18},
  "last_updated": "2025-02-01"
}

Day 7: Cron Job Runs

First Search:
"India GST rate changed to 20% effective March 1"

Second Search (Verification):
"Confirmed: India GST rate 18% → 20% effective March 1, 2025
Source: gst.gov.in official notification"

Comparison:
OLD: gst_rate = 18
NEW: gst_rate = 20
RESULT: Change detected ✓

Database Action:

DELETE FROM compliance_rules 
WHERE country = 'IN' AND document_type = 'invoice';

INSERT INTO compliance_rules VALUES (
  country: 'IN',
  rules: {"gst_rate": 20, ...},
  last_updated: '2025-02-08',
  embedding: [new vector]
);

All future invoices now use 20% GST automatically.

═══════════════════════════════════════════════════════════════════

Cost of 7-Day Monitoring:

Per Check (Every 7 Days):
- 11 countries × 2 searches each (first + verification) = 22 searches
- DeepSeek V3 Reasoning (deepseek-reasoner)

Approximate Costs per Check:
- Grounded search requests: ~$0.75
- Input tokens: ~$0.15
- Output tokens: ~$0.15
- Vector embedding generation: ~$0.10
- Total per check: ~$1.15

Monthly Cost (4 checks):
$1.15 × 4 = $4.60/month

This ensures high-accuracy, double-verified compliance updates.

═══════════════════════════════════════════════════════════════════

ADMIN REVIEW (OPTIONAL):

Although system is automated with double verification,
admin can still review changes via dashboard.

Admin Dashboard (Supabase hosted):
View all compliance_alerts with status "approved"
See what changed, when, and source URLs
Can manually override if needed

Manual Override Process:
If admin disagrees with automated change:
1. Admin marks alert as "rejected"
2. Manually edits compliance_rules table
3. System uses manual rules until next check

═══════════════════════════════════════════════════════════════════
MONTHLY COST PROJECTION
═══════════════════════════════════════════════════════════════════

Example Scenario:
500 new users onboard
10,000 invoices generated
All running smoothly

Cost Breakdown:

1. ONBOARDING (DeepSeek V3 Reasoning)
500 new users × $0.03 per user = $15.00

2. INVOICE GENERATION (DeepSeek V3 + RAG)
10,000 invoices × $0.00094 per invoice = $9.40
(Assumes 70% cache hit rate for optimal cost)
RAG queries: Free (Supabase database queries)

3. COMPLIANCE MONITORING (DeepSeek V3 Reasoning + Double Verification)
Every 7 days automated checks = $4.60/month

4. VECTOR EMBEDDINGS (OpenAI)
New compliance rules: ~$0.50/month
Invoice queries: Cached, minimal cost

5. INFRASTRUCTURE (SUPABASE ONLY)
Supabase Pro Plan: $25.00/month includes:
- PostgreSQL database with pgvector
- Authentication
- Storage (logos, signatures, exports)
- Edge Functions (serverless)
- Real-time subscriptions
- 50GB bandwidth
- 8GB database space

6. HOSTING
Vercel Hobby (frontend only): $0 (free tier sufficient)
OR Vercel Pro: $20/month if needed

TOTAL MONTHLY COST: $54.50 - $74.50

═══════════════════════════════════════════════════════════════════
TECHNICAL IMPLEMENTATION STACK
═══════════════════════════════════════════════════════════════════

Frontend Framework:
Next.js 15 with App Router architecture
Styling with Tailwind CSS
UI components from shadcn/ui library
Form handling with React Hook Form and Zod validation
Rich text editing with TipTap

Backend (SUPABASE ONLY):
Supabase PostgreSQL for all data storage
Supabase Auth for user authentication
Supabase Storage for files (logos, signatures, exports)
Supabase Edge Functions for serverless logic:
- Document export (PDF, DOCX, PNG, JPG generation)
- Compliance monitoring cron job
- AI API calls (DeepSeek, OpenAI)
- Vector embedding generation
- Email notifications

Supabase pgvector extension for RAG:
- Vector similarity search
- Semantic querying
- Fast retrieval (milliseconds)

Supabase Real-time for:
- Live document preview updates
- Multi-user collaboration (future feature)

AI Integration:
DeepSeek V3 API for document generation
DeepSeek V3 Reasoning API for onboarding and compliance monitoring
OpenAI Embeddings API for vector generation (RAG)

Document Rendering (via Edge Functions):
Puppeteer or Playwright for PDF generation
react-pdf for client-side PDF preview
DOCX.js library for Word document export

Deployment:
Vercel for Next.js frontend hosting
Supabase Cloud for all backend services
Cloudflare for CDN (optional, Vercel includes CDN)

Monitoring:
Supabase Dashboard for database monitoring
Vercel Analytics for frontend performance
Custom logging via Supabase Edge Functions
Sentry for error tracking (optional)

═══════════════════════════════════════════════════════════════════
CRITICAL IMPLEMENTATION NOTES
═══════════════════════════════════════════════════════════════════

1. COUNTRY EQUALITY
All 11 countries treated with equal priority
No preferential treatment or ordering
Compliance rules equally important for each

2. NO WEB SEARCH DURING ONBOARDING
User selects client countries from checkboxes
No compliance rules fetched at this stage
No loading animations or "fetching rules" messages
Just save country selection to Supabase

3. COMPLIANCE RULES LOADED BY CRON JOB ONLY
7-day automated Supabase Edge Function
Double verification (two searches per country)
Smart update (only change database if actual changes)
Complete replacement (delete old, insert new)

4. RAG FOR FAST RETRIEVAL
Supabase pgvector for semantic search
Vector embeddings generated by OpenAI
Millisecond query times
Semantic understanding of queries

5. SMART UPDATE LOGIC
If NO changes: Don't touch database at all
If changes detected: DELETE old entry, INSERT new entry
Never do partial updates
Prevents data corruption and inconsistency

6. DOUBLE VERIFICATION MANDATORY
First search: Get initial data
Second search: Verify first search results
Only save if both searches agree
Reduces false positives and errors

7. BACKEND IS SUPABASE ONLY
No separate Node.js server
No Express or Fastify
All backend logic in Supabase Edge Functions
All data in Supabase PostgreSQL
All files in Supabase Storage
All auth via Supabase Auth

8. COST OPTIMIZATION
Onboarding: DeepSeek V3 Reasoning (one-time, cost-effective)
Generation: Cheap DeepSeek V3 (high volume, must be cheap)
Monitoring: DeepSeek V3 Reasoning every 7 days (infrequent, accuracy critical)
RAG: Free (Supabase database queries)

9. DATA PRIVACY
Save only structured extracted data
Never store raw chat conversations
Supabase Row Level Security (RLS) for data protection
Users can only access their own data

10. EDITABILITY REQUIREMENT
Every field in generated document must be editable
Users can override any AI decision
Changes tracked in edit_history JSONB array
Stored in Supabase generated_documents table

11. VALIDATION IS MANDATORY
Never show document without passing validation
Multiple validation layers required
Human review flag for low confidence (<0.95)
All validation results logged in Supabase

12. CACHE STRATEGY CRITICAL
Structure AI prompts to maximize cache hit rates
Target 70% or higher cache hit rate
Monitor in Supabase logs
Optimize prompt structure if cache rate drops

13. AUDIT TRAIL
Every document stores in Supabase:
- Which AI model generated it
- Which compliance rules version used
- Validation scores
- Whether user edited it
- Edit history
- Export formats used
- All with timestamps

14. DISCLAIMERS REQUIRED
Every exported document includes disclaimer:
"This document was generated using AI technology. While validated 
for compliance, we recommend review by qualified professionals 
before use."

═══════════════════════════════════════════════════════════════════
END OF SPECIFICATION
═══════════════════════════════════════════════════════════════════

This complete specification describes exactly how the system works.

KEY CHANGES FROM PREVIOUS VERSION:
1. ✅ NO web search during onboarding (Question 6)
2. ✅ Compliance monitoring every 7 days (not weekly on Sundays)
3. ✅ Double verification (two searches before saving)
4. ✅ Smart update (only if changes detected)
5. ✅ Complete replacement (delete old, insert new)
6. ✅ RAG implementation with Supabase pgvector
7. ✅ Backend is Supabase only (no separate server)

All principles, workflows, and requirements must be followed exactly 
as specified for optimal results.

Build according to these guidelines to create Invo.ai successfully.