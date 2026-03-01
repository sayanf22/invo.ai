-- Seed Document Templates for All 11 Countries
-- This script populates the document_templates table with compliance requirements

-- ============================================================================
-- UNITED STATES (US) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'US', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "due_date", "type": "date", "required": true},
        {"name": "seller_name", "type": "string", "required": true},
        {"name": "seller_address", "type": "string", "required": true},
        {"name": "buyer_name", "type": "string", "required": true},
        {"name": "buyer_address", "type": "string", "required": true},
        {"name": "ein", "type": "string", "required": false},
        {"name": "sales_tax_rate", "type": "number", "required": false},
        {"name": "payment_terms", "type": "string", "required": true}
    ]'::jsonb,
    '{
        "sales_tax": "State-specific, varies by location",
        "no_federal_vat": true,
        "1099_threshold": 600,
        "payment_terms_common": ["Net 30", "Net 60", "Due on Receipt"]
    }'::jsonb,
    'INV-YYYY-NNNN',
    'Generate US-compliant invoices with clear payment terms, state sales tax if applicable, and EIN if available. No federal VAT. Include detailed line items and totals.',
    'No federal invoice requirements. State sales tax varies. 1099 reporting required for contractors over $600/year.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- UNITED KINGDOM (GB) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'GB', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "vat_number", "type": "string", "pattern": "^GB[0-9]{9}$", "required": false},
        {"name": "company_registration", "type": "string", "required": false},
        {"name": "seller_address", "type": "string", "required": true},
        {"name": "buyer_address", "type": "string", "required": true},
        {"name": "vat_rate", "type": "number", "enum": [0, 5, 20], "required": true},
        {"name": "net_amount", "type": "number", "required": true},
        {"name": "vat_amount", "type": "number", "required": true},
        {"name": "gross_amount", "type": "number", "required": true}
    ]'::jsonb,
    '{
        "vat_rates": {"standard": 20, "reduced": 5, "zero": 0},
        "reverse_charge": "Applicable for certain B2B services",
        "vat_registration_threshold": 90000
    }'::jsonb,
    'INV-NNNN',
    'Generate UK VAT-compliant invoices with proper VAT breakdown (20% standard, 5% reduced, 0% zero-rated). Include VAT number if registered, company registration number if limited company. Show net, VAT, and gross amounts clearly.',
    'VAT Act 1994. Must show VAT number if registered. Company registration number required for limited companies.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- GERMANY (DE) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'DE', 'invoice', '1.0',
    '[
        {"name": "rechnungsnummer", "type": "string", "required": true},
        {"name": "rechnungsdatum", "type": "date", "required": true},
        {"name": "ust_idnr", "type": "string", "pattern": "^DE[0-9]{9}$", "required": false},
        {"name": "steuernummer", "type": "string", "required": false},
        {"name": "leistungsdatum", "type": "date", "required": true},
        {"name": "nettobetrag", "type": "number", "required": true},
        {"name": "umsatzsteuer_satz", "type": "number", "enum": [0, 7, 19], "required": true},
        {"name": "umsatzsteuer", "type": "number", "required": true},
        {"name": "bruttobetrag", "type": "number", "required": true}
    ]'::jsonb,
    '{
        "umsatzsteuer_rates": {"standard": 19, "reduced": 7, "zero": 0},
        "reverse_charge_text": "Steuerschuldnerschaft des Leistungsempfängers",
        "kleinunternehmer_threshold": 22000
    }'::jsonb,
    'RE-YYYY-NNNN',
    'Generate German UStG-compliant invoices (Rechnung) with USt-IdNr or Steuernummer, Leistungsdatum (service date), and proper Umsatzsteuer breakdown (19% standard, 7% reduced). Include reverse charge notice if applicable. Prefer German language for domestic invoices.',
    'UStG (Umsatzsteuergesetz). Must include tax number or VAT ID. Sequential numbering required. Reverse charge for B2B services.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- INDIA (IN) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'IN', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "maxLength": 16, "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "gstin_supplier", "type": "string", "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", "required": true},
        {"name": "gstin_recipient", "type": "string", "pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$", "required": false},
        {"name": "place_of_supply", "type": "string", "required": true},
        {"name": "hsn_sac_code", "type": "string", "required": true},
        {"name": "taxable_value", "type": "number", "required": true},
        {"name": "cgst_rate", "type": "number", "required": false},
        {"name": "sgst_rate", "type": "number", "required": false},
        {"name": "igst_rate", "type": "number", "required": false}
    ]'::jsonb,
    '{
        "gst_rates": [0, 5, 12, 18, 28],
        "intra_state": "CGST + SGST",
        "inter_state": "IGST",
        "reverse_charge": "If applicable, mention on invoice",
        "eway_bill_threshold": 50000,
        "hsn_requirements": {
            "below_1_5_cr": "Optional",
            "1_5_to_5_cr": "2 digits",
            "above_5_cr": "4 digits"
        }
    }'::jsonb,
    'INV/YYYY/NNN',
    'Generate GST-compliant invoices for India with GSTIN for both parties, HSN/SAC codes, place of supply with state code, and proper tax breakdown (CGST+SGST for intra-state, IGST for inter-state). Invoice number must be unique and sequential (max 16 chars). Include e-way bill note if amount exceeds ₹50,000.',
    'GST Act 2017. GSTIN mandatory. Sequential numbering required. HSN/SAC code based on turnover. E-invoicing mandatory for turnover > ₹5 crores.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- CANADA (CA) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'CA', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "business_number", "type": "string", "pattern": "^[0-9]{9}$", "required": false},
        {"name": "gst_hst_number", "type": "string", "required": false},
        {"name": "province", "type": "string", "required": true},
        {"name": "gst_rate", "type": "number", "required": false},
        {"name": "pst_rate", "type": "number", "required": false},
        {"name": "hst_rate", "type": "number", "required": false}
    ]'::jsonb,
    '{
        "tax_by_province": {
            "ON": {"type": "HST", "rate": 13},
            "QC": {"type": "GST+QST", "gst": 5, "qst": 9.975},
            "AB": {"type": "GST", "rate": 5},
            "BC": {"type": "GST+PST", "gst": 5, "pst": 7},
            "SK": {"type": "GST+PST", "gst": 5, "pst": 6},
            "MB": {"type": "GST+PST", "gst": 5, "pst": 7},
            "NB": {"type": "HST", "rate": 15},
            "NS": {"type": "HST", "rate": 15},
            "PE": {"type": "HST", "rate": 15},
            "NL": {"type": "HST", "rate": 15},
            "YT": {"type": "GST", "rate": 5},
            "NT": {"type": "GST", "rate": 5},
            "NU": {"type": "GST", "rate": 5}
        },
        "registration_threshold": 30000
    }'::jsonb,
    'INV-YYYY-NNNN',
    'Generate Canadian tax-compliant invoices with correct provincial tax rates. Use HST (13-15%) for harmonized provinces (ON, NB, NS, PE, NL), GST (5%) only for AB/territories, or GST+PST for BC/SK/MB. Quebec uses GST+QST. Include GST/HST registration number if registered. Show tax breakdown clearly.',
    'Excise Tax Act. GST/HST registration required if annual revenue exceeds $30,000 CAD. Provincial tax rates vary.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- AUSTRALIA (AU) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'AU', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "abn", "type": "string", "pattern": "^[0-9]{11}$", "required": true},
        {"name": "buyer_abn", "type": "string", "pattern": "^[0-9]{11}$", "required": false},
        {"name": "gst_amount", "type": "number", "required": false},
        {"name": "total_including_gst", "type": "number", "required": true}
    ]'::jsonb,
    '{
        "gst_rate": 10,
        "gst_free_items": ["Basic food", "Medical services", "Education", "Exports"],
        "tax_invoice_threshold": 82.50,
        "buyer_identity_threshold": 1000
    }'::jsonb,
    'INV-YYYYMMDD-NNN',
    'Generate Australian GST-compliant invoices with ABN (11 digits) mandatory. Apply 10% GST on most goods/services. Must state "Tax Invoice" if GST included and amount > $82.50. For invoices > $1,000, include buyer''s ABN or identity. Show amounts excluding GST, GST amount, and total including GST separately.',
    'A New Tax System (Goods and Services Tax) Act 1999. ABN mandatory. GST 10% on most supplies. Registration required if turnover > $75,000.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- SINGAPORE (SG) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'SG', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "gst_registration_number", "type": "string", "required": false},
        {"name": "customer_gst_number", "type": "string", "required": false},
        {"name": "supply_date", "type": "date", "required": true},
        {"name": "gst_rate", "type": "number", "enum": [0, 9], "required": true}
    ]'::jsonb,
    '{
        "gst_rate": 9,
        "registration_threshold": 1000000,
        "tax_invoice_requirement": "Must state Tax Invoice if GST charged",
        "issue_deadline": "30 days from supply date"
    }'::jsonb,
    'INV-YYYY-NNNN',
    'Generate Singapore GST-compliant invoices with 9% GST rate (updated 2024). Must state "Tax Invoice" if GST charged. Include GST registration numbers for both parties if B2B. Show supply date, invoice date, and issue within 30 days. Display amounts excluding GST, GST amount (9%), and total including GST.',
    'Goods and Services Tax Act. GST rate 9% (from Jan 2024). Registration required if annual revenue > S$1 million. InvoiceNow (Peppol) voluntary from May 2025.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- UAE (AE) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'AE', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "supplier_trn", "type": "string", "pattern": "^[0-9]{15}$", "required": true},
        {"name": "customer_trn", "type": "string", "pattern": "^[0-9]{15}$", "required": false},
        {"name": "supply_date", "type": "date", "required": true},
        {"name": "vat_rate", "type": "number", "enum": [0, 5], "required": true}
    ]'::jsonb,
    '{
        "vat_rate": 5,
        "tax_invoice_threshold": 10000,
        "issue_deadline": "14 days from supply date",
        "currency": "AED"
    }'::jsonb,
    'TAX-INV-YYYY-NNNN',
    'Generate UAE VAT-compliant invoices with 5% VAT rate. Must clearly state "Tax Invoice" in both English and Arabic. Include supplier TRN (15 digits), customer TRN if B2B and amount > AED 10,000. Show supply date and invoice date. Issue within 14 days of supply. Display amounts in AED with VAT shown separately.',
    'Federal Decree-Law No. 8 of 2017 on VAT. TRN mandatory. VAT 5%. Tax invoice required for B2B > AED 10,000. Bilingual (English/Arabic) preferred.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- PHILIPPINES (PH) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'PH', 'invoice', '1.0',
    '[
        {"name": "invoice_number", "type": "string", "required": true},
        {"name": "invoice_date", "type": "date", "required": true},
        {"name": "seller_tin", "type": "string", "pattern": "^[0-9]{3}-[0-9]{3}-[0-9]{3}-[0-9]{3}$", "required": true},
        {"name": "buyer_tin", "type": "string", "required": false},
        {"name": "bir_permit_number", "type": "string", "required": true},
        {"name": "vat_rate", "type": "number", "enum": [0, 12], "required": true}
    ]'::jsonb,
    '{
        "vat_rate": 12,
        "invoice_types": ["VAT Invoice", "VAT Official Receipt"],
        "bir_requirements": "Must be printed by BIR-accredited printer",
        "serial_control": "Sequential numbering required"
    }'::jsonb,
    'INV-YYYY-NNNN',
    'Generate Philippines BIR-compliant invoices with 12% VAT. Include TIN for both parties (format: XXX-XXX-XXX-XXX), BIR permit number, and sequential invoice number. State "VAT Invoice" or "VAT Official Receipt" clearly. Show amounts excluding VAT, VAT amount (12%), and total including VAT. Note: Must be printed by BIR-accredited printer.',
    'NIRC §237 & §238. TIN mandatory. VAT 12%. BIR permit required. Sequential numbering. E-invoicing (EIS) mandatory from 2024 (XML/JSON format).'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- FRANCE (FR) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'FR', 'invoice', '1.0',
    '[
        {"name": "facture_number", "type": "string", "required": true},
        {"name": "date_emission", "type": "date", "required": true},
        {"name": "siret", "type": "string", "pattern": "^[0-9]{14}$", "required": true},
        {"name": "numero_tva", "type": "string", "pattern": "^FR[0-9A-Z]{2}[0-9]{9}$", "required": false},
        {"name": "tva_rate", "type": "number", "enum": [0, 2.1, 5.5, 10, 20], "required": true}
    ]'::jsonb,
    '{
        "tva_rates": {
            "standard": 20,
            "reduced": 10,
            "super_reduced": 5.5,
            "special": 2.1
        },
        "mentions_legales": "Required legal mentions on invoice",
        "sequential_numbering": "Continuous without gaps"
    }'::jsonb,
    'FACT-YYYY-NNNN',
    'Generate French TVA-compliant invoices (facture) with SIRET (14 digits) and TVA number if registered. Use TVA rates: 20% standard, 10% reduced, 5.5% super-reduced. Sequential numbering without gaps required. Include mentions légales. Show amounts HT (excluding VAT) and TTC (including VAT). Invoice mandatory for services > €25 or upon customer request.',
    'Code Général des Impôts. SIRET mandatory. TVA rates: 20%/10%/5.5%/2.1%. Sequential numbering required. E-invoicing mandatory from 2026.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- NETHERLANDS (NL) - INVOICE
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES (
    'NL', 'invoice', '1.0',
    '[
        {"name": "factuur_number", "type": "string", "required": true},
        {"name": "factuur_datum", "type": "date", "required": true},
        {"name": "btw_nummer", "type": "string", "pattern": "^NL[0-9]{9}B[0-9]{2}$", "required": false},
        {"name": "kvk_nummer", "type": "string", "pattern": "^[0-9]{8}$", "required": false},
        {"name": "btw_rate", "type": "number", "enum": [0, 9, 21], "required": true}
    ]'::jsonb,
    '{
        "btw_rates": {
            "standard": 21,
            "reduced": 9,
            "zero": 0
        },
        "issue_deadline": "15th day of following month",
        "sequential_numbering": "Required for VAT purposes"
    }'::jsonb,
    'FACT-YYYY-NNNN',
    'Generate Dutch BTW-compliant invoices (factuur) with BTW-nummer (VAT number) and KvK-nummer (Chamber of Commerce number) if registered. Use BTW rates: 21% standard, 9% reduced. Sequential numbering required. Issue by 15th of following month. Show amounts excluding BTW, BTW amount, and total including BTW. Include reverse charge notice if applicable.',
    'Dutch VAT Act Article 35. BTW rates: 21%/9%. Sequential numbering required. Invoice deadline: 15th of following month. KvK number recommended.'
) ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- ALL COUNTRIES - CONTRACT TEMPLATES
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES 
    ('US', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate US contracts with consideration clause, governing law (state), dispute resolution, and signature blocks. Include effective date, termination terms, and jurisdiction.', 'State law governs. Include choice of law clause.'),
    ('GB', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate UK contracts with entire agreement clause, jurisdiction (England & Wales/Scotland/NI), UK GDPR compliance, and signature blocks.', 'UK contract law. GDPR compliance required.'),
    ('DE', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'VERT-YYYY-NNN', 'Generate German contracts (Vertrag) with clear terms, jurisdiction, GDPR compliance. Prefer German language for domestic contracts.', 'BGB (German Civil Code). GDPR compliance.'),
    ('IN', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Indian contracts with stamp duty consideration, jurisdiction clause, and notarization requirements if needed. Include Indian Contract Act compliance.', 'Indian Contract Act 1872. Stamp duty varies by state.'),
    ('CA', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Canadian contracts with provincial law consideration, bilingual option (English/French for Quebec), and clear terms.', 'Provincial law governs. Quebec uses Civil Code.'),
    ('AU', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Australian contracts with state/territory law, fair work compliance if employment-related, and clear dispute resolution.', 'Australian Contract Law. Fair Work Act for employment.'),
    ('SG', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Singapore contracts with Singapore law jurisdiction, PDPA compliance for data, and clear terms.', 'Singapore Contract Law. PDPA compliance required.'),
    ('AE', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate UAE contracts with UAE law jurisdiction, bilingual option (English/Arabic), and Sharia compliance considerations.', 'UAE Civil Code. Arabic version may be required.'),
    ('PH', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Philippines contracts with Philippine law jurisdiction, notarization requirements, and clear terms.', 'Civil Code of the Philippines. Notarization often required.'),
    ('FR', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate French contracts (contrat) with French law jurisdiction, GDPR compliance, and clear terms. Prefer French language.', 'Code Civil. GDPR compliance required.'),
    ('NL', 'contract', '1.0', '[]'::jsonb, '{}'::jsonb, 'CONT-YYYY-NNN', 'Generate Dutch contracts (overeenkomst) with Dutch law jurisdiction, GDPR compliance, and clear terms.', 'Dutch Civil Code. GDPR compliance required.')
ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- ALL COUNTRIES - QUOTATION TEMPLATES
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES 
    ('US', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate US quotations with clear pricing, validity period, payment terms, and terms & conditions. Include state sales tax if applicable.', 'No specific federal requirements. State sales tax may apply.'),
    ('GB', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate UK quotations with VAT breakdown if registered, validity period, and clear pricing. Include company registration if limited company.', 'VAT Act 1994. Include VAT if registered.'),
    ('DE', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'ANG-YYYY-NNN', 'Generate German quotations (Angebot) with clear pricing, USt if applicable, validity period. Prefer German language for domestic quotes.', 'UStG. Include tax if registered.'),
    ('IN', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate Indian quotations with GST breakdown if registered, validity period, and clear pricing in INR.', 'GST Act 2017. Include GSTIN if registered.'),
    ('CA', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate Canadian quotations with provincial tax rates, validity period, and clear pricing in CAD.', 'Provincial tax rates vary. Include GST/HST if registered.'),
    ('AU', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate Australian quotations with GST if registered, ABN, validity period, and clear pricing in AUD.', 'GST Act 1999. Include ABN.'),
    ('SG', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate Singapore quotations with GST (9%) if registered, validity period, and clear pricing in SGD.', 'GST Act. 9% GST from 2024.'),
    ('AE', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate UAE quotations with VAT (5%) if registered, validity period, and pricing in AED. Bilingual option (English/Arabic).', 'VAT Decree-Law. 5% VAT.'),
    ('PH', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'QUO-YYYY-NNN', 'Generate Philippines quotations with VAT (12%) if registered, validity period, and clear pricing in PHP.', 'NIRC. 12% VAT if registered.'),
    ('FR', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'DEV-YYYY-NNN', 'Generate French quotations (devis) with TVA if registered, validity period, and clear pricing in EUR. Prefer French language.', 'Code Civil. TVA if registered.'),
    ('NL', 'quotation', '1.0', '[]'::jsonb, '{}'::jsonb, 'OFF-YYYY-NNN', 'Generate Dutch quotations (offerte) with BTW if registered, validity period, and clear pricing in EUR.', 'Dutch VAT Act. BTW if registered.')
ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- ALL COUNTRIES - PROPOSAL TEMPLATES
-- ============================================================================
INSERT INTO document_templates (
    country_code, document_type, template_version,
    required_fields, tax_requirements, numbering_format,
    generation_prompt, compliance_notes
) VALUES 
    ('US', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate US business proposals with executive summary, scope of work, timeline, budget, and terms. Include state jurisdiction.', 'State law governs. Clear terms required.'),
    ('GB', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate UK business proposals with executive summary, scope, timeline, budget, and UK GDPR compliance if data involved.', 'UK contract law. GDPR if applicable.'),
    ('DE', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'VORSCH-YYYY-NNN', 'Generate German business proposals (Vorschlag) with clear scope, timeline, budget, and GDPR compliance. Prefer German language.', 'BGB. GDPR compliance if applicable.'),
    ('IN', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Indian business proposals with scope, timeline, budget in INR, and jurisdiction clause.', 'Indian Contract Act. Clear terms required.'),
    ('CA', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Canadian business proposals with scope, timeline, budget in CAD, and provincial law consideration.', 'Provincial law governs.'),
    ('AU', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Australian business proposals with scope, timeline, budget in AUD, and state/territory law.', 'Australian Contract Law.'),
    ('SG', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Singapore business proposals with scope, timeline, budget in SGD, and PDPA compliance if data involved.', 'Singapore Contract Law. PDPA if applicable.'),
    ('AE', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate UAE business proposals with scope, timeline, budget in AED, and bilingual option (English/Arabic).', 'UAE Civil Code. Arabic may be required.'),
    ('PH', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Philippines business proposals with scope, timeline, budget in PHP, and clear terms.', 'Civil Code. Clear terms required.'),
    ('FR', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate French business proposals (proposition) with scope, timeline, budget in EUR, and GDPR compliance. Prefer French language.', 'Code Civil. GDPR if applicable.'),
    ('NL', 'proposal', '1.0', '[]'::jsonb, '{}'::jsonb, 'PROP-YYYY-NNN', 'Generate Dutch business proposals (voorstel) with scope, timeline, budget in EUR, and GDPR compliance.', 'Dutch Civil Code. GDPR if applicable.')
ON CONFLICT (country_code, document_type, template_version) DO NOTHING;

-- ============================================================================
-- INITIALIZE UPDATE SCHEDULE FOR ALL TEMPLATES
-- ============================================================================
INSERT INTO template_update_schedule (template_id, check_interval_days, next_check_date)
SELECT id, 7, CURRENT_DATE + INTERVAL '7 days'
FROM document_templates
ON CONFLICT (template_id) DO NOTHING;

SELECT 'All 44 templates seeded successfully (11 countries × 4 document types)' as status;
