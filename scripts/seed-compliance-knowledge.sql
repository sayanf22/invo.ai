-- =====================================================
-- COMPLIANCE KNOWLEDGE BASE - COMPREHENSIVE UPDATE
-- Generated: February 12, 2026
-- Purpose: Store up-to-date compliance requirements for all 11 countries
-- =====================================================

-- Drop existing table if needed (for fresh start)
-- DROP TABLE IF EXISTS compliance_knowledge CASCADE;

-- Create comprehensive compliance knowledge table
CREATE TABLE IF NOT EXISTS compliance_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    document_type TEXT NOT NULL, -- invoice, contract, quotation, proposal
    category TEXT NOT NULL, -- mandatory_fields, tax_rates, legal_requirements, formatting, deadlines
    requirement_key TEXT NOT NULL,
    requirement_value JSONB NOT NULL,
    description TEXT,
    source_url TEXT,
    last_verified_date DATE DEFAULT CURRENT_DATE,
    effective_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country, document_type, category, requirement_key)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_compliance_country_doctype ON compliance_knowledge(country, document_type);
CREATE INDEX IF NOT EXISTS idx_compliance_category ON compliance_knowledge(category);
CREATE INDEX IF NOT EXISTS idx_compliance_verified ON compliance_knowledge(last_verified_date);

-- =====================================================
-- INDIA - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

-- India Invoice Requirements
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('India', 'invoice', 'tax_rates', 'gst_rates', 
'{"standard": 18, "reduced_5": 5, "reduced_12": 12, "reduced_28": 28, "zero": 0, "exempt": 0}',
'GST rates in India: 0% (exempt), 5%, 12%, 18% (standard), 28% (luxury/sin goods)', '2025-04-01'),

('India', 'invoice', 'mandatory_fields', 'supplier_details',
'{"fields": ["legal_name", "trade_name", "full_address", "state", "pin_code", "gstin", "contact_details"]}',
'Supplier must provide legal name, trade name (if any), full address with state and PIN, GSTIN (15-digit), and contact details', '2025-04-01'),

('India', 'invoice', 'mandatory_fields', 'invoice_metadata',
'{"fields": ["invoice_number", "invoice_date", "serial_number_format", "financial_year_unique"]}',
'Invoice number must be consecutive, unique for financial year, up to 16 characters (alphanumeric with - or /)', '2025-04-01'),

('India', 'invoice', 'mandatory_fields', 'buyer_details',
'{"fields": ["legal_name", "address", "state", "gstin_if_registered", "place_of_supply"]}',
'Buyer details: legal name, address, state, GSTIN (if registered), place of supply for tax calculation', '2025-04-01'),

('India', 'invoice', 'mandatory_fields', 'line_items',
'{"fields": ["description", "hsn_sac_code", "quantity", "unit", "unit_price", "taxable_value", "tax_rate", "tax_amount"]}',
'Each line item must have description, HSN/SAC code (4-8 digits), quantity, unit, rate, taxable value, tax rate, and tax amount', '2025-04-01'),

('India', 'invoice', 'mandatory_fields', 'tax_breakdown',
'{"fields": ["cgst", "sgst", "igst", "cess_if_applicable", "total_tax", "grand_total"]}',
'Tax breakdown: CGST + SGST (intra-state) OR IGST (inter-state), cess if applicable, total tax, grand total', '2025-04-01'),

('India', 'invoice', 'legal_requirements', 'e_invoicing',
'{"threshold": "10_crore_annual_turnover", "upload_deadline": "30_days", "irp_validation": true}',
'E-invoicing mandatory for businesses with turnover > ₹10 crore. Must upload to IRP within 30 days', '2025-04-01'),

('India', 'invoice', 'legal_requirements', 'reverse_charge',
'{"applicable": true, "note_required": "Reverse charge applicable", "buyer_pays_tax": true}',
'For reverse charge transactions, invoice must state "Reverse charge applicable" and buyer pays tax', '2025-04-01'),

('India', 'invoice', 'formatting', 'language',
'{"primary": "English", "regional": "allowed", "numbers": "arabic_numerals"}',
'Invoices can be in English or regional languages. Use Arabic numerals for amounts', '2025-04-01'),

-- India Contract Requirements
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('India', 'contract', 'legal_requirements', 'indian_contract_act',
'{"act": "Indian Contract Act 1872", "essential_elements": ["offer", "acceptance", "consideration", "free_consent", "capacity", "lawful_object", "not_void"]}',
'Contracts must comply with Indian Contract Act 1872: offer, acceptance, consideration, free consent, capacity, lawful object', '1872-09-01'),

('India', 'contract', 'mandatory_fields', 'parties',
'{"fields": ["full_legal_name", "address", "pan_number", "authorized_signatory", "designation"]}',
'Parties: full legal name, address, PAN number, authorized signatory name and designation', '2025-01-01'),

('India', 'contract', 'mandatory_fields', 'terms',
'{"fields": ["scope_of_work", "duration", "payment_terms", "termination_clause", "dispute_resolution", "jurisdiction"]}',
'Essential terms: scope, duration, payment, termination, dispute resolution, jurisdiction (Indian courts)', '2025-01-01'),

('India', 'contract', 'legal_requirements', 'stamp_duty',
'{"required": true, "varies_by_state": true, "e_stamping": "available", "penalty_for_non_compliance": "10x_stamp_duty"}',
'Stamp duty required (varies by state). E-stamping available. Penalty for non-compliance: 10x stamp duty', '2025-01-01'),

('India', 'contract', 'legal_requirements', 'registration',
'{"required_for": ["immovable_property", "lease_above_11_months"], "optional_for": "other_contracts"}',
'Registration mandatory for immovable property and leases > 11 months. Optional for other contracts', '2025-01-01'),

-- India Quotation Requirements
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('India', 'quotation', 'mandatory_fields', 'basic_info',
'{"fields": ["quotation_number", "quotation_date", "validity_period", "supplier_details", "client_details"]}',
'Quotation must include: unique number, date, validity period, supplier and client details with GSTIN if registered', '2025-01-01'),

('India', 'quotation', 'mandatory_fields', 'pricing',
'{"fields": ["item_description", "hsn_sac_code", "quantity", "unit_price", "gst_rate", "total"]}',
'Pricing: item description, HSN/SAC code, quantity, unit price, applicable GST rate, and total amount', '2025-01-01'),

('India', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "GST Act 2017", "gst_if_registered": true, "validity_standard": "30 days typical", "currency": "INR"}',
'Quotations should include GST if registered. Standard validity 30 days. Prices in INR for domestic quotes', '2025-01-01');

-- =====================================================
-- USA - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('USA', 'invoice', 'tax_rates', 'sales_tax',
'{"federal_vat": "none", "state_sales_tax": "0-10.25%", "varies_by_state": true, "local_additions": true}',
'No federal VAT. State sales tax 0-10.25% (varies by state + local). 5 states have no sales tax', '2026-01-01'),

('USA', 'invoice', 'mandatory_fields', 'basic_info',
'{"fields": ["seller_name", "seller_address", "buyer_name", "buyer_address", "invoice_number", "invoice_date", "payment_terms"]}',
'Basic info: seller/buyer name and address, invoice number, date, payment terms. No federal mandate on format', '2026-01-01'),

('USA', 'invoice', 'mandatory_fields', 'line_items',
'{"fields": ["description", "quantity", "unit_price", "total", "sales_tax_if_applicable"]}',
'Line items: description, quantity, unit price, total. Sales tax shown separately if applicable', '2026-01-01'),

('USA', 'invoice', 'legal_requirements', 'ein_requirement',
'{"required_for": "businesses", "format": "XX-XXXXXXX", "issued_by": "IRS"}',
'EIN (Employer Identification Number) recommended for businesses. Format: XX-XXXXXXX', '2026-01-01'),

('USA', 'invoice', 'legal_requirements', 'state_specific',
'{"california": "7.25% base + local", "texas": "6.25% base + local", "new_york": "4% base + local", "oregon": "no sales tax", "delaware": "no sales tax"}',
'State-specific rates: CA 7.25%+, TX 6.25%+, NY 4%+, OR/DE no sales tax', '2026-01-01'),

('USA', 'contract', 'legal_requirements', 'ucc',
'{"applicable": "sale of goods", "article_2": true, "written_required_over": "$500"}',
'UCC Article 2 governs sale of goods. Written contract required for transactions > $500', '2026-01-01'),

('USA', 'contract', 'mandatory_fields', 'essential_terms',
'{"fields": ["parties", "consideration", "offer_acceptance", "terms_conditions", "signatures", "date"]}',
'Essential: parties, consideration, offer/acceptance, terms, signatures, date. State law governs enforceability', '2026-01-01'),

('USA', 'quotation', 'legal_requirements', 'tax_compliance',
'{"state_sales_tax": true, "varies_by_state": true, "validity_standard": "30 days typical", "currency": "USD"}',
'Quotations should include state sales tax if applicable. Standard validity 30 days. Prices in USD', '2026-01-01');

-- =====================================================
-- UK - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('UK', 'invoice', 'tax_rates', 'vat_rates',
'{"standard": 20, "reduced": 5, "zero": 0}',
'VAT rates: 20% (standard), 5% (reduced - energy, children goods), 0% (zero-rated - food, books)', '2026-01-01'),

('UK', 'invoice', 'mandatory_fields', 'vat_invoice',
'{"fields": ["supplier_name", "supplier_address", "supplier_vat_number", "invoice_number", "invoice_date", "time_of_supply", "customer_name", "customer_address"]}',
'VAT invoice must include: supplier name, address, VAT number, invoice number, date, time of supply, customer details', '2026-01-01'),

('UK', 'invoice', 'mandatory_fields', 'line_items',
'{"fields": ["description", "quantity", "unit_price", "net_amount", "vat_rate", "vat_amount", "gross_amount"]}',
'Line items: description, quantity, unit price, net amount, VAT rate %, VAT amount, gross amount', '2026-01-01'),

('UK', 'invoice', 'legal_requirements', 'making_tax_digital',
'{"mandatory_from": "2026-04-06", "threshold": "£50000_income", "software_required": true, "digital_records": true}',
'Making Tax Digital (MTD) mandatory from April 6, 2026 for income > £50k. Must use MTD-compatible software', '2026-04-06'),

('UK', 'invoice', 'legal_requirements', 'e_invoicing_2029',
'{"mandatory_from": "2029-04-01", "structured_format": true, "b2b_b2g": true}',
'Mandatory e-invoicing from April 1, 2029 for all VAT B2B and B2G transactions. Structured format required', '2029-04-01'),

('UK', 'invoice', 'formatting', 'simplified_invoice',
'{"allowed_under": "£250", "fields": ["supplier_name", "vat_number", "date", "description", "total_inc_vat"]}',
'Simplified invoice allowed for transactions under £250: supplier name, VAT number, date, description, total inc VAT', '2026-01-01'),

('UK', 'contract', 'legal_requirements', 'english_law',
'{"governed_by": "English Contract Law", "essential_elements": ["offer", "acceptance", "consideration", "intention", "capacity"]}',
'Contracts governed by English law. Essential: offer, acceptance, consideration, intention to create legal relations, capacity', '2026-01-01'),

('UK', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "VAT Act 1994", "vat_if_registered": true, "validity_standard": "30 days typical", "currency": "GBP"}',
'Quotations should include VAT if registered. Standard validity 30 days. Prices in GBP', '2026-01-01');

-- =====================================================
-- GERMANY - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Germany', 'invoice', 'tax_rates', 'vat_rates',
'{"standard": 19, "reduced": 7, "zero": 0}',
'VAT rates: 19% (standard), 7% (reduced - food, books, public transport), 0% (exports)', '2026-01-01'),

('Germany', 'invoice', 'mandatory_fields', 'rechnung',
'{"fields": ["vollständiger_name", "vollständige_anschrift", "steuernummer_oder_ust_idnr", "rechnungsnummer", "rechnungsdatum", "lieferdatum", "menge", "art", "entgelt", "steuersatz", "steuerbetrag"]}',
'Rechnung must include: full name, full address, tax number/VAT ID, invoice number, date, delivery date, quantity, description, amount, tax rate, tax amount', '2026-01-01'),

('Germany', 'invoice', 'legal_requirements', 'e_invoicing',
'{"mandatory_from": "2025-01-01", "receive_capability": "2025-01-01", "issue_requirement": "2027-2028", "format": "EN_16931_XRechnung_ZUGFeRD"}',
'E-invoicing: Must receive e-invoices from Jan 1, 2025. Must issue from 2027-2028 (based on turnover). Format: XRechnung or ZUGFeRD', '2025-01-01'),

('Germany', 'invoice', 'legal_requirements', 'invoice_language',
'{"primary": "German", "eu_languages_allowed": true, "english_allowed": "if_clear_and_unambiguous"}',
'Invoices primarily in German. EU languages allowed if clear and unambiguous. English acceptable for international transactions', '2026-01-01'),

('Germany', 'invoice', 'legal_requirements', 'retention',
'{"period": "10 years", "format": "original_format", "electronic_storage": "allowed"}',
'Invoice retention: 10 years in original format. Electronic storage allowed if compliant', '2026-01-01'),

('Germany', 'contract', 'legal_requirements', 'bgb',
'{"governed_by": "Bürgerliches Gesetzbuch (BGB)", "written_form": "recommended", "notarization": "required_for_real_estate"}',
'Contracts governed by BGB (German Civil Code). Written form recommended. Notarization required for real estate', '2026-01-01'),

('Germany', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "UStG", "ust_if_registered": true, "validity_standard": "30 days typical", "currency": "EUR"}',
'Quotations (Angebot) should include USt if registered. Standard validity 30 days. Prices in EUR', '2026-01-01');

-- =====================================================
-- CANADA - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Canada', 'invoice', 'tax_rates', 'gst_hst',
'{"gst": 5, "hst_ontario": 13, "hst_nova_scotia": 15, "hst_new_brunswick": 15, "hst_pei": 15, "hst_newfoundland": 15, "qst_quebec": 9.975, "pst_bc": 7, "pst_saskatchewan": 6, "pst_manitoba": 7}',
'GST 5% (federal). HST 13-15% (ON, NS, NB, PE, NL). QST 9.975% (QC). PST 6-7% (BC, SK, MB)', '2026-01-01'),

('Canada', 'invoice', 'mandatory_fields', 'gst_hst_invoice',
'{"fields": ["supplier_name", "supplier_address", "supplier_gst_hst_number", "invoice_date", "customer_name", "description", "total_amount", "gst_hst_amount", "gst_hst_rate"]}',
'GST/HST invoice: supplier name, address, GST/HST number, date, customer name, description, total, GST/HST amount and rate', '2026-01-01'),

('Canada', 'invoice', 'legal_requirements', 'registration_threshold',
'{"threshold": "CAD_30000", "period": "4_consecutive_quarters", "mandatory_registration": "within_29_days"}',
'Must register for GST/HST when taxable revenue exceeds CAD $30,000 in 4 consecutive quarters. Register within 29 days', '2026-01-01'),

('Canada', 'invoice', 'legal_requirements', 'zero_rated_exports',
'{"exports": "zero_rated", "documentation": "proof_of_export_required", "gst_hst": "0%"}',
'Exports are zero-rated (0% GST/HST). Proof of export required for documentation', '2026-01-01'),

('Canada', 'invoice', 'formatting', 'bilingual',
'{"federal_requirement": "English_and_French", "provincial": "varies", "quebec": "French_mandatory"}',
'Federal: English and French. Quebec: French mandatory. Other provinces: varies', '2026-01-01'),

('Canada', 'contract', 'legal_requirements', 'provincial_law',
'{"governed_by": "provincial_law", "common_law": "9_provinces", "civil_law": "Quebec", "written_recommended": true}',
'Contracts governed by provincial law. Common law (9 provinces), Civil law (Quebec). Written form recommended', '2026-01-01'),

('Canada', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "provincial_law", "gst_hst_if_registered": true, "validity_standard": "30 days typical", "currency": "CAD"}',
'Quotations should include GST/HST/PST based on province. Standard validity 30 days. Prices in CAD', '2026-01-01');

-- Continue with remaining countries...

-- =====================================================
-- FRANCE - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('France', 'invoice', 'tax_rates', 'tva_rates',
'{"standard": 20, "reduced_10": 10, "reduced_5.5": 5.5, "super_reduced": 2.1, "zero": 0}',
'TVA rates: 20% (standard), 10% (reduced - restaurants, transport), 5.5% (food, books), 2.1% (medicines, press)', '2026-01-01'),

('France', 'invoice', 'mandatory_fields', 'facture',
'{"fields": ["nom_fournisseur", "adresse_fournisseur", "numero_tva", "numero_facture", "date_facture", "nom_client", "adresse_client", "description", "quantite", "prix_unitaire", "montant_ht", "taux_tva", "montant_tva", "montant_ttc"]}',
'Facture must include: supplier name, address, TVA number, invoice number, date, customer details, description, quantity, unit price, amount HT, TVA rate, TVA amount, amount TTC', '2026-01-01'),

('France', 'invoice', 'legal_requirements', 'e_invoicing',
'{"mandatory_from": "2026-09-01", "large_companies": "2026-09-01", "medium_companies": "2027", "smes": "2028", "format": "Factur-X_or_XML", "platform": "PDP_or_PPF"}',
'Mandatory e-invoicing: Large companies Sept 2026, medium 2027, SMEs 2028. Format: Factur-X or XML via PDP/PPF', '2026-09-01'),

('France', 'invoice', 'legal_requirements', 'e_reporting',
'{"b2b_domestic": "e_invoicing", "b2b_cross_border": "e_reporting", "b2c": "e_reporting", "real_time": true}',
'E-reporting: B2B domestic via e-invoicing, B2B cross-border and B2C via e-reporting. Real-time transmission', '2026-09-01'),

('France', 'invoice', 'formatting', 'language',
'{"primary": "French", "bilingual": "allowed", "amounts": "euros"}',
'Invoices primarily in French. Bilingual allowed. Amounts in euros', '2026-01-01'),

('France', 'contract', 'legal_requirements', 'code_civil',
'{"governed_by": "Code Civil", "written_form": "recommended", "notarization": "required_for_real_estate"}',
'Contracts governed by Code Civil. Written form recommended. Notarization required for real estate', '2026-01-01'),

('France', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "Code General des Impots", "tva_if_registered": true, "validity_standard": "30 days typical", "currency": "EUR"}',
'Quotations (devis) should include TVA if registered. Standard validity 30 days. Prices in EUR', '2026-01-01');

-- =====================================================
-- NETHERLANDS - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Netherlands', 'invoice', 'tax_rates', 'btw_rates',
'{"standard": 21, "reduced": 9, "zero": 0}',
'BTW rates: 21% (standard), 9% (reduced - food, medicines, books, transport), 0% (exports)', '2026-01-01'),

('Netherlands', 'invoice', 'mandatory_fields', 'factuur',
'{"fields": ["naam_leverancier", "adres_leverancier", "btw_nummer", "factuurnummer", "factuurdatum", "naam_klant", "adres_klant", "omschrijving", "hoeveelheid", "eenheidsprijs", "bedrag_excl_btw", "btw_tarief", "btw_bedrag", "totaalbedrag"]}',
'Factuur must include: supplier name, address, BTW number, invoice number, date, customer details, description, quantity, unit price, amount excl BTW, BTW rate, BTW amount, total', '2026-01-01'),

('Netherlands', 'invoice', 'legal_requirements', 'sequential_numbering',
'{"required": true, "consecutive": true, "unique": true, "no_gaps": true}',
'Invoice numbering must be sequential, consecutive, unique, with no gaps. Critical for VAT compliance', '2026-01-01'),

('Netherlands', 'invoice', 'legal_requirements', 'deadline',
'{"issue_by": "15th_of_following_month", "customer_request": "sooner_if_requested"}',
'Invoices must be issued by 15th of month following supply, or sooner if customer requests', '2026-01-01'),

('Netherlands', 'invoice', 'legal_requirements', 'intra_community',
'{"customer_vat_required": true, "reverse_charge": true, "note": "Reverse charge applies"}',
'Intra-Community supplies: customer VAT ID required, reverse charge applies, note on invoice', '2026-01-01'),

('Netherlands', 'contract', 'legal_requirements', 'dutch_civil_code',
'{"governed_by": "Burgerlijk Wetboek", "written_form": "recommended", "notarization": "required_for_real_estate"}',
'Contracts governed by Burgerlijk Wetboek (Dutch Civil Code). Written form recommended. Notarization for real estate', '2026-01-01'),

('Netherlands', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "Dutch VAT Act", "btw_if_registered": true, "validity_standard": "30 days typical", "currency": "EUR"}',
'Quotations (offerte) should include BTW if registered. Standard validity 30 days. Prices in EUR', '2026-01-01');

-- =====================================================
-- AUSTRALIA - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Australia', 'invoice', 'tax_rates', 'gst_rates',
'{"standard": 10, "gst_free": 0}',
'GST rates: 10% (standard), 0% (GST-free - exports, basic food, medical, education)', '2026-01-01'),

('Australia', 'invoice', 'mandatory_fields', 'tax_invoice',
'{"fields": ["supplier_name", "supplier_abn", "invoice_date", "description", "quantity", "price", "gst_amount", "total"]}',
'Tax invoice: supplier name, ABN, date, description, quantity, price, GST amount (if applicable), total', '2026-01-01'),

('Australia', 'invoice', 'mandatory_fields', 'over_1000',
'{"additional_fields": ["buyer_name", "buyer_abn_or_address"], "threshold": "AUD_1000"}',
'For invoices over AUD $1,000: must include buyer name and ABN (or address if no ABN)', '2026-01-01'),

('Australia', 'invoice', 'legal_requirements', 'abn_requirement',
'{"required": true, "format": "XX XXX XXX XXX", "issued_by": "ATO"}',
'ABN (Australian Business Number) required. Format: XX XXX XXX XXX. Issued by ATO', '2026-01-01'),

('Australia', 'invoice', 'legal_requirements', 'gst_registration',
'{"threshold": "AUD_75000", "mandatory": true, "voluntary_below": true}',
'GST registration mandatory if turnover ≥ AUD $75,000. Voluntary registration allowed below threshold', '2026-01-01'),

('Australia', 'invoice', 'formatting', 'simplified_invoice',
'{"allowed_under": "AUD_1000", "fields": ["supplier_name", "abn", "date", "description", "total_inc_gst"]}',
'Simplified invoice allowed under AUD $1,000: supplier name, ABN, date, description, total inc GST', '2026-01-01'),

('Australia', 'contract', 'legal_requirements', 'australian_law',
'{"governed_by": "Australian Contract Law", "written_recommended": true, "electronic_signatures": "valid"}',
'Contracts governed by Australian law. Written form recommended. Electronic signatures valid', '2026-01-01'),

('Australia', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "GST Act 1999", "gst_if_registered": true, "abn_required": true, "validity_standard": "30 days typical", "currency": "AUD"}',
'Quotations should include GST (10%) if registered. ABN required. Standard validity 30 days. Prices in AUD', '2026-01-01');

-- =====================================================
-- SINGAPORE - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Singapore', 'invoice', 'tax_rates', 'gst_rates',
'{"standard": 9, "zero": 0}',
'GST rates: 9% (standard, increased from 8% in 2024), 0% (zero-rated - exports, international services)', '2024-01-01'),

('Singapore', 'invoice', 'mandatory_fields', 'tax_invoice',
'{"fields": ["supplier_name", "supplier_address", "supplier_gst_number", "invoice_number", "invoice_date", "customer_name", "customer_address", "description", "quantity", "unit_price", "total_excl_gst", "gst_amount", "total_incl_gst"]}',
'Tax invoice: supplier name, address, GST number, invoice number, date, customer details, description, quantity, unit price, total excl GST, GST amount, total incl GST', '2026-01-01'),

('Singapore', 'invoice', 'legal_requirements', 'invoicenow',
'{"mandatory_from": "2025-11-01", "new_registrants": "2025-11-01", "voluntary_registrants": "2026-04-01", "format": "Peppol_UBL", "platform": "InvoiceNow"}',
'InvoiceNow mandatory: New compulsory registrants Nov 2025, voluntary registrants Apr 2026. Format: Peppol UBL', '2025-11-01'),

('Singapore', 'invoice', 'legal_requirements', 'mandatory_data_elements',
'{"uuid_required": true, "currency_codes": "ISO_4217", "fatal_errors": "from_May_2026"}',
'Mandatory Data Elements (MDEs): UUID required, ISO 4217 currency codes. Fatal errors enforced from May 2026', '2026-05-01'),

('Singapore', 'invoice', 'legal_requirements', 'gst_registration',
'{"threshold": "SGD_1_million", "mandatory": true, "voluntary_below": true}',
'GST registration mandatory if turnover ≥ SGD $1 million. Voluntary registration allowed below threshold', '2026-01-01'),

('Singapore', 'contract', 'legal_requirements', 'singapore_law',
'{"governed_by": "Singapore Contract Law", "written_recommended": true, "electronic_signatures": "valid"}',
'Contracts governed by Singapore law. Written form recommended. Electronic signatures valid under Electronic Transactions Act', '2026-01-01'),

('Singapore', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "GST Act", "gst_9_percent": true, "validity_standard": "30 days typical", "currency": "SGD"}',
'Quotations should include GST (9%) if registered. Standard validity 30 days. Prices in SGD', '2026-01-01');

-- =====================================================
-- UAE - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('UAE', 'invoice', 'tax_rates', 'vat_rates',
'{"standard": 5, "zero": 0, "exempt": 0}',
'VAT rates: 5% (standard), 0% (zero-rated - exports, international transport, precious metals), exempt (residential property, local transport)', '2026-01-01'),

('UAE', 'invoice', 'mandatory_fields', 'tax_invoice',
'{"fields": ["supplier_name", "supplier_address", "supplier_trn", "invoice_number", "invoice_date", "customer_name", "customer_address", "customer_trn", "description", "quantity", "unit_price", "total_excl_vat", "vat_rate", "vat_amount", "total_incl_vat"]}',
'Tax invoice: supplier name, address, TRN, invoice number, date, customer details, customer TRN, description, quantity, unit price, total excl VAT, VAT rate, VAT amount, total incl VAT', '2026-01-01'),

('UAE', 'invoice', 'legal_requirements', 'e_invoicing',
'{"pilot_phase": "2026-07-01", "mandatory_large": "2027-01-01", "threshold": "AED_50_million", "asp_required": true, "format": "PINT_AE"}',
'E-invoicing: Pilot July 2026, mandatory for large businesses (≥ AED 50M) from Jan 2027. ASP required. Format: PINT AE', '2026-07-01'),

('UAE', 'invoice', 'legal_requirements', 'asp_appointment',
'{"deadline": "2026-07-31", "for_businesses": "revenue_≥_AED_50M", "accredited_by": "FTA"}',
'Businesses with revenue ≥ AED 50M must appoint Accredited Service Provider (ASP) by July 31, 2026', '2026-07-31'),

('UAE', 'invoice', 'formatting', 'language',
'{"primary": "Arabic_or_English", "bilingual": "recommended", "amounts": "AED"}',
'Invoices in Arabic or English. Bilingual recommended. Amounts in AED', '2026-01-01'),

('UAE', 'contract', 'legal_requirements', 'uae_law',
'{"governed_by": "UAE Civil Code", "written_recommended": true, "notarization": "required_for_certain_contracts"}',
'Contracts governed by UAE Civil Code. Written form recommended. Notarization required for certain contracts', '2026-01-01'),

('UAE', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "VAT Decree-Law", "vat_5_percent": true, "validity_standard": "30 days typical", "currency": "AED"}',
'Quotations should include VAT (5%) if registered. Standard validity 30 days. Prices in AED. Bilingual option', '2026-01-01');

-- =====================================================
-- PHILIPPINES - COMPREHENSIVE COMPLIANCE DATA
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, effective_date) VALUES
('Philippines', 'invoice', 'tax_rates', 'vat_rates',
'{"standard": 12, "zero": 0, "exempt": 0}',
'VAT rates: 12% (standard), 0% (zero-rated - exports), exempt (basic necessities, education, health)', '2026-01-01'),

('Philippines', 'invoice', 'mandatory_fields', 'vat_invoice',
'{"fields": ["supplier_name", "supplier_address", "supplier_tin", "invoice_number", "invoice_date", "customer_name", "customer_address", "customer_tin_if_over_1000", "description", "quantity", "unit_price", "total_sales", "vat_amount", "total_amount_due"]}',
'VAT invoice: supplier name, address, TIN, invoice number, date, customer details (TIN if ≥ PHP 1,000), description, quantity, unit price, total sales, VAT amount, total due', '2026-01-01'),

('Philippines', 'invoice', 'legal_requirements', 'bir_registration',
'{"atp_required": true, "accredited_printer": true, "serial_control": true, "eis_enrollment": "for_e_invoicing"}',
'BIR registration: ATP (Authority to Print) required, accredited printer, serial control. EIS enrollment for e-invoicing', '2026-01-01'),

('Philippines', 'invoice', 'legal_requirements', 'eis_electronic_invoicing',
'{"extended_deadline": "2026-12-31", "mandatory_for": "covered_taxpayers", "bir_validation": true}',
'Electronic Invoicing System (EIS): Extended deadline Dec 31, 2026 for covered taxpayers. BIR validation required', '2026-12-31'),

('Philippines', 'invoice', 'legal_requirements', 'corrections',
'{"erasures_prohibited": true, "corrections": "preserve_audit_trail", "credit_debit_memo": "for_adjustments"}',
'Erasures/overwriting prohibited. Corrections must preserve audit trail. Use credit/debit memos for adjustments', '2026-01-01'),

('Philippines', 'contract', 'legal_requirements', 'philippine_law',
'{"governed_by": "Civil Code of the Philippines", "written_recommended": true, "notarization": "recommended_for_enforceability"}',
'Contracts governed by Civil Code of the Philippines. Written form recommended. Notarization recommended for enforceability', '2026-01-01'),

('Philippines', 'quotation', 'legal_requirements', 'tax_compliance',
'{"governed_by": "NIRC", "vat_12_percent": true, "validity_standard": "30 days typical", "currency": "PHP"}',
'Quotations should include VAT (12%) if registered. Standard validity 30 days. Prices in PHP', '2026-01-01');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get compliance requirements for a country and document type
CREATE OR REPLACE FUNCTION get_compliance_requirements(
    p_country TEXT,
    p_document_type TEXT
)
RETURNS TABLE (
    category TEXT,
    requirement_key TEXT,
    requirement_value JSONB,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ck.category,
        ck.requirement_key,
        ck.requirement_value,
        ck.description
    FROM compliance_knowledge ck
    WHERE ck.country = p_country
    AND ck.document_type = p_document_type
    AND (ck.effective_date IS NULL OR ck.effective_date <= CURRENT_DATE)
    ORDER BY ck.category, ck.requirement_key;
END;
$$ LANGUAGE plpgsql;

-- Function to get all mandatory fields for a document type in a country
CREATE OR REPLACE FUNCTION get_mandatory_fields(
    p_country TEXT,
    p_document_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_object_agg(requirement_key, requirement_value)
    INTO v_result
    FROM compliance_knowledge
    WHERE country = p_country
    AND document_type = p_document_type
    AND category = 'mandatory_fields'
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE);
    
    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Function to get tax rates for a country
CREATE OR REPLACE FUNCTION get_tax_rates(
    p_country TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT requirement_value
    INTO v_result
    FROM compliance_knowledge
    WHERE country = p_country
    AND document_type = 'invoice'
    AND category = 'tax_rates'
    AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
    LIMIT 1;
    
    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Count total compliance rules
SELECT COUNT(*) as total_rules FROM compliance_knowledge;

-- Count rules by country
SELECT country, COUNT(*) as rule_count 
FROM compliance_knowledge 
GROUP BY country 
ORDER BY country;

-- Count rules by document type
SELECT document_type, COUNT(*) as rule_count 
FROM compliance_knowledge 
GROUP BY document_type 
ORDER BY document_type;

-- Sample: Get India invoice requirements
SELECT * FROM get_compliance_requirements('India', 'invoice');

-- Sample: Get tax rates for all countries
SELECT country, get_tax_rates(country) as tax_rates
FROM (SELECT DISTINCT country FROM compliance_knowledge) countries
ORDER BY country;

COMMENT ON TABLE compliance_knowledge IS 'Comprehensive compliance knowledge base for 11 countries covering invoices, contracts, NDAs, and agreements. Updated February 12, 2026.';
