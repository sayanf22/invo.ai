# INVO.AI - Onboarding Flow

## Overview

> **Critical Principle:** AI only extracts structured data from conversations. Never save actual chat messages.

### Data Extraction Process
1. Send user's message to DeepSeek V3 Chat (fast model)
2. AI extracts only the structured data fields needed
3. AI returns pure JSON with specific fields
4. Validate the extracted data
5. Save ONLY the structured fields to Supabase
6. Discard the conversation text completely

---

## Screen 1: Welcome

**Display:**
```
Hi! 👋 I'm Invo AI.

I help you create compliant invoices and contracts 
for clients worldwide.

Let's set up your business profile in 2 minutes.

[Start Setup]
```

---

## Question 1: Business Type

**AI Task:** Extract which type of business the user operates.

**Possible Values:**
- Freelancer or Consultant
- Software Developer
- Agency or Studio
- E-commerce Business
- Professional Services (Legal, Accounting)
- Other

**UI:** Button grid with icons OR conversational text input

**What Gets Saved:**
```json
{ "business_type": "freelancer" }
```

**Supabase Action:** Create new record in `business_profiles` table

---

## Question 2: Location

**AI Task:** Extract the country where user's business is located.

**Supported Countries:**
India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, Netherlands

**UI:** Smart search field with country flags

**What Gets Saved:**
```json
{
  "country": "IN",
  "state_province": "Maharashtra"
}
```

> ⚠️ **No web search triggered** - Just saves the country selection

---

## Question 3: Business Details

**AI Task:** Extract four key business identifiers.

**Required Information:**
- Business name
- Owner's full name
- Email address
- Phone number (with country code)

**Validation:**
- Email: must contain @ and domain
- Phone: include country code

**What Gets Saved:**
```json
{
  "business_name": "Acme Inc",
  "owner_name": "John Doe",
  "email": "john@acme.com",
  "phone": "+91-9876543210"
}
```

---

## Question 4: Business Address

**AI Task:** Extract complete mailing address.

**Required Fields:**
| Field | Description |
|-------|-------------|
| line1 | Street address |
| line2 | Suite, building (optional) |
| city | City name |
| state | State/province |
| postal_code | ZIP/postal code |

**What Gets Saved:**
```json
{
  "address": {
    "line1": "123 Main Street",
    "line2": "Suite 100",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001"
  }
}
```

---

## Question 5: Tax Registration

**AI Task:** Determine if user has tax registration and extract tax ID.

**Country-Specific Tax IDs:**

| Country | Tax ID | Format |
|---------|--------|--------|
| 🇮🇳 India | GSTIN | 2 digits + 10 chars (PAN) + 4 chars |
| 🇺🇸 USA | EIN | 2 digits + hyphen + 7 digits |
| 🇬🇧 UK | VAT | GB + 9 digits |
| 🇩🇪 Germany | Steuernummer | Tax number |
| 🇨🇦 Canada | BN | Business Number |
| 🇦🇺 Australia | ABN | 11 digits |
| 🇸🇬 Singapore | GST | Registration number |
| 🇦🇪 UAE | TRN | 15 digits |
| 🇵🇭 Philippines | TIN | Tax ID |
| 🇫🇷 France | SIRET | 14 digits |
| 🇳🇱 Netherlands | BTW | VAT number |

**UI Flow:**
1. Ask: "Do you have tax registration?" → Yes / No / Not sure
2. If Yes: Show input field with real-time format validation

**What Gets Saved:**
```json
{
  "tax_ids": {
    "gstin": "29ABCDE1234F1Z5"
  }
}
```

---

## Question 6: Client Countries

**AI Task:** Identify which countries the user's clients are located in.

**UI:** Multi-select checkboxes with flags for all 11 supported countries

> ⚠️ **CRITICAL: No web search - No background process**
> 
> Just save the selected countries. Compliance rules fetched by weekly cron job.

**UI Feedback:**
```
✓ Client countries saved: India, USA, UK
```

**What Gets Saved:**
```json
{
  "client_countries": ["IN", "US", "UK"]
}
```

---

## Question 7: Default Currency

**AI Task:** Determine which currency user typically invoices in.

**UI:** Dropdown with common currencies at top:
- INR (₹) Indian Rupee
- USD ($) US Dollar
- GBP (£) British Pound
- EUR (€) Euro
- Then all other currencies alphabetically

**What Gets Saved:**
```json
{ "default_currency": "INR" }
```

---

## Question 8: Payment Terms

**AI Task:** Determine user's standard payment timeline.

**Options:**
- Due on receipt (immediate)
- Net 15 (15 days)
- Net 30 (30 days)
- Net 60 (60 days)
- Custom: [X] days

**What Gets Saved:**
```json
{ "payment_terms": "net_30" }
```

---

## Question 9: Payment Methods

**AI Task:** Collect how clients can pay the user.

**Tabbed Interface:**

### Tab 1: Bank Transfer (Domestic)
- Bank name
- Account holder name
- Account number
- Routing/IFSC code
- Branch (optional)

### Tab 2: UPI (India only)
- UPI ID (username@bank)

### Tab 3: International Banking
- Account holder
- IBAN
- SWIFT/BIC code
- Bank name & address

### Tab 4: Payment Platforms
- PayPal (email)
- Stripe (connect)
- Wise (connect)
- Payoneer (email)

> "Skip for now" button available - Optional step

**What Gets Saved:**
```json
{
  "payment_methods": {
    "bank_transfer": {
      "bank_name": "HDFC",
      "account_number": "1234567890",
      "ifsc_code": "HDFC0001234"
    },
    "upi": "business@upi",
    "paypal": "email@example.com"
  }
}
```

---

## Question 10: Logo (Optional)

**Purpose:** Company logo for professional invoices.

**Specifications:**
- Formats: PNG, JPG, SVG
- Max size: 5MB
- Recommended: 500x200 pixels

**Upload Process:**
1. Validate file type and size
2. Upload to Supabase Storage → `logos/{user_id}/logo_{timestamp}.png`
3. Get public URL
4. Show preview on invoice

**What Gets Saved:**
```json
{ "logo_url": "https://supabase.storage/logos/..." }
```

---

## Question 11: Signature (Optional)

**Purpose:** Signature for contracts, NDAs, agreements.

**Three Options:**

| Option | Description |
|--------|-------------|
| Draw | Canvas with mouse/stylus |
| Upload | PNG with transparent background (2MB max) |
| Type | Text with font selection (Cursive, Elegant, Professional) |

**Processing:**
1. Convert to PNG with transparent background
2. Resize to 400x150 pixels
3. Upload to Supabase Storage → `signatures/{user_id}/signature_{timestamp}.png`

**What Gets Saved:**
```json
{ "signature_url": "https://supabase.storage/signatures/..." }
```

---

## Final Screen: Setup Complete

**Display:**
```
🎉 Setup complete!

Summary:
✓ Business: Acme Inc (India)
✓ Email: john@acme.com
✓ Tax ID: 29ABCDE1234F1Z5
✓ Currency: INR
✓ Client countries: India, USA, UK
✓ Logo uploaded
✓ Signature ready

Note: Compliance rules for your client countries will be 
automatically loaded within the next update cycle.

[Create First Invoice]  [Go to Dashboard]

You can edit all settings anytime in your profile.
```

---

## Data Saved Summary

| Field | Table | Type |
|-------|-------|------|
| business_type | business_profiles | TEXT |
| country, state_province | business_profiles | TEXT |
| business_name, owner_name, email, phone | business_profiles | TEXT |
| address | business_profiles | JSONB |
| tax_ids | business_profiles | JSONB |
| client_countries | business_profiles | TEXT[] |
| default_currency | business_profiles | TEXT |
| payment_terms | business_profiles | TEXT |
| payment_methods | business_profiles | JSONB |
| logo_url | business_profiles | TEXT |
| signature_url | business_profiles | TEXT |
