-- =====================================================
-- COMPLIANCE KNOWLEDGE EXPANSION — 2026 REFRESH
-- =====================================================
-- Adds proposals coverage, penalties, retention periods,
-- contract clauses, and corrects out-of-date thresholds
-- across all 11 supported countries.
--
-- Sources (last verified 2026-05-12):
--   India       : tallysolutions.com, easedesk.com, gst.gov.in
--   USA         : IRS Pub 1099 (2026), avalara, state DoR pages
--   UK          : gov.uk MTD, HMRC VAT Notice 700
--   Germany     : cleartax.de, BMF e-invoicing circular
--   France      : impots.gouv.fr, chorus-pro.gouv
--   Netherlands : belastingdienst.nl
--   Canada      : canada.ca GST/HST memoranda
--   Australia   : ato.gov.au
--   Singapore   : iras.gov.sg InvoiceNow / Peppol AU
--   UAE         : tax.gov.ae Cabinet Decision 106
--   Philippines : bir.gov.ph EIS guidelines
--
-- Safe to run multiple times — uses ON CONFLICT DO UPDATE.
-- =====================================================

-- Ensure the table exists (no-op if already present)
CREATE TABLE IF NOT EXISTS compliance_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country TEXT NOT NULL,
    document_type TEXT NOT NULL,
    category TEXT NOT NULL,
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

-- =====================================================
-- CORRECTIONS — threshold / date updates
-- =====================================================

-- India: e-invoicing threshold is ₹5 crore (since August 2023), NOT ₹10 crore
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
('India', 'invoice', 'legal_requirements', 'e_invoicing',
 '{"threshold_inr": "5_crore_annual_turnover", "previous_threshold": "10_crore", "upload_deadline_days": 30, "irp_validation_required": true, "irn_and_qr_mandatory": true, "cancellation_window_hours": 24}',
 'E-invoicing mandatory for businesses with aggregate turnover > ₹5 crore (August 2023 onwards). Must upload to IRP and obtain IRN+QR within 30 days of invoice date. Cancellation only within 24 hours.',
 'https://tallysolutions.com/accounting/e-invoicing-rules-in-india/',
 '2023-08-01')
ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- Germany: correct turnover threshold to €800k, receive-capability since 2025-01-01
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
('Germany', 'invoice', 'legal_requirements', 'e_invoicing',
 '{"receive_capability_mandatory": "2025-01-01", "issue_mandatory_large": "2027-01-01", "issue_mandatory_all": "2028-01-01", "large_business_threshold_eur": 800000, "kleinunternehmer_exemption_eur": 22000, "formats": ["XRechnung", "ZUGFeRD_2.1_plus", "Peppol_BIS_3.0", "EN_16931"], "retention_years": 8}',
 'E-invoicing: all businesses must receive e-invoices from 2025-01-01. Issue mandatory from 2027-01-01 for turnover > €800,000; all businesses by 2028-01-01. Small businesses under §19 UStG (≤ €22,000) exempt. Formats: XRechnung / ZUGFeRD 2.1+ / Peppol BIS 3.0. 8-year archive.',
 'https://www.cleartax.com/de/en/b2b-e-invoicing-germany',
 '2025-01-01')
ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- UK: add MTD income tax tiers + VAT threshold
INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
('UK', 'invoice', 'legal_requirements', 'making_tax_digital',
 '{"mtd_vat_mandatory_since": "2019-04-01", "mtd_itsa_tier_1_income_gbp": 50000, "mtd_itsa_tier_1_date": "2026-04-06", "mtd_itsa_tier_2_income_gbp": 30000, "mtd_itsa_tier_2_date": "2027-04-06", "mtd_itsa_tier_3_income_gbp": 20000, "mtd_itsa_tier_3_date": "2028-04-06", "vat_registration_threshold_gbp": 90000, "software_required": true, "digital_records_required": true}',
 'MTD for VAT: mandatory since April 2019 for all VAT-registered. MTD for Income Tax: £50k income from 6 Apr 2026, £30k from 6 Apr 2027, £20k from 6 Apr 2028. VAT registration threshold £90,000.',
 'https://www.gov.uk/government/publications/making-tax-digital',
 '2026-04-06')
ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- =====================================================
-- UNIVERSAL PROPOSAL STRUCTURE (applies to all countries)
-- =====================================================
-- Business proposals are not tax-regulated documents —
-- the structure is universal; only the jurisdiction clause
-- and currency change per country.
-- =====================================================

-- Shared proposal sections — inserted per country below
-- Sections: executive_summary, company_background, scope_of_work,
--           deliverables, timeline, pricing, terms_conditions,
--           acceptance_signature, validity, confidentiality, ip_ownership

-- Helper: loop-insert would be cleaner, but plain inserts keep the file portable.
-- We insert a `mandatory_sections` row for each country.

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
-- India
('India', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "problem_statement", "proposed_solution", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "assumptions_exclusions", "terms_conditions", "confidentiality", "ip_ownership", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (Indian context). Include GSTIN on cover, INR pricing, jurisdiction = Indian courts. Reference Indian Contract Act 1872 for binding acceptance.',
 'https://sprintlaw.com.au/articles/crafting-a-winning-business-proposal-australian-legal-template-guide/',
 '2026-01-01'),

('India', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "acceptance_creates_contract": true, "governing_law": "Indian Contract Act 1872", "jurisdiction": "Indian courts", "currency": "INR", "gst_inclusive_note_required": true, "stamp_duty_on_acceptance": "applies_if_contract_formed"}',
 'In India a proposal is an offer under §2(a) of Indian Contract Act 1872 — unconditional acceptance forms a binding contract. Include GST-inclusive pricing note. Validity typically 30 days.',
 'https://www.indiacode.nic.in/handle/123456789/2187',
 '2026-01-01'),

-- USA
('USA', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "problem_statement", "proposed_solution", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "assumptions_exclusions", "terms_conditions", "confidentiality", "ip_ownership", "warranty_liability", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (USA). Include EIN on cover, USD pricing, UCC Art. 2 applies to goods. State-specific jurisdiction clause.',
 'https://qwilr.com/blog/business-proposal-examples/',
 '2026-01-01'),

('USA', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "firm_offer_ucc_2_205_merchants": "up_to_3_months", "governing_law_per_state": true, "jurisdiction_clause_required": true, "currency": "USD", "sales_tax_nexus_rule": "$100000_per_state", "form_1099_NEC_threshold_usd": 2000}',
 'In the US a written proposal is an offer. Under UCC §2-205 merchants can give firm offers for up to 3 months without consideration. Include governing-state clause. 1099-NEC threshold raised to $2,000 for tax year 2026 (OBBBA).',
 'https://www.irs.gov/publications/p1099',
 '2026-01-01'),

-- UK
('UK', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "data_protection_gdpr", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (UK). Include company number + VAT number on cover, GBP pricing, UK GDPR/DPA 2018 data-protection clause.',
 'https://sprintlaw.co.uk/articles/how-to-draft-a-legally-compliant-bid-proposal-template-for-your-business/',
 '2026-01-01'),

('UK', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "English Contract Law", "jurisdiction": "courts of England and Wales", "currency": "GBP", "vat_inclusive_note_required": true, "gdpr_clause_required": true, "companies_act_2006": "registered_office_and_number_on_all_business_communications"}',
 'Proposals in England governed by common-law offer-acceptance rules. Companies Act 2006 requires company name, registration number, and registered office on all business communications including proposals.',
 'https://www.gov.uk/running-a-limited-company/company-names',
 '2026-01-01'),

-- Germany
('Germany', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["deckblatt", "zusammenfassung", "unternehmensvorstellung", "leistungsumfang", "termine_meilensteine", "preise_zahlungsbedingungen", "allgemeine_geschaeftsbedingungen_agb", "vertraulichkeit", "urheberrechte", "gueltigkeitsdauer", "annahme_unterschrift"]}',
 'Required proposal (Angebot) sections (Germany). Include Steuernummer/USt-IdNr and Handelsregisternummer on cover. AGB (general T&Cs) typically attached.',
 'https://www.cleartax.com/de/en/e-invoicing-germany',
 '2026-01-01'),

('Germany', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "bgb_145_binding_unless_stated": true, "freibleibend_note_to_make_non_binding": true, "governing_law": "Bürgerliches Gesetzbuch (BGB)", "jurisdiction": "German courts", "currency": "EUR", "ust_inclusive_note_required": true, "widerrufsrecht_consumer_14_days": true}',
 'Under §145 BGB an Angebot is binding unless explicitly marked "freibleibend". Consumer contracts include 14-day right of withdrawal (Widerrufsrecht). Handelsregister data mandatory.',
 'https://www.gesetze-im-internet.de/bgb/__145.html',
 '2026-01-01'),

-- France
('France', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["page_de_couverture", "resume_executif", "presentation_entreprise", "perimetre_prestation", "livrables", "planning_jalons", "tarifs_modalites_paiement", "conditions_generales_de_vente", "confidentialite", "propriete_intellectuelle", "validite", "acceptation_signature"]}',
 'Required proposal (devis) sections (France). Include SIRET, numéro TVA on cover. CGV (general terms of sale) usually attached. EUR pricing.',
 'https://www.economie.gouv.fr/entreprises/devis-obligatoire',
 '2026-01-01'),

('France', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"devis_acceptance_forms_contract": true, "offer_validity_default_days": 30, "code_civil_1113_to_1122": true, "governing_law": "Code Civil", "jurisdiction": "tribunaux français", "currency": "EUR", "tva_inclusive_note_required": true, "consumer_retraction_14_days": true, "mentions_legales_required": ["SIRET", "TVA", "RCS"]}',
 'In France an accepted devis forms a contract under Art. 1113-1122 Code Civil. Mandatory legal mentions: SIRET, TVA number, RCS. Consumers have a 14-day cooling-off period for distance contracts.',
 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032040929',
 '2026-01-01'),

-- Netherlands
('Netherlands', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["voorblad", "samenvatting", "bedrijfsprofiel", "werkomschrijving", "opleverbare_items", "planning", "tarieven_betaling", "algemene_voorwaarden", "vertrouwelijkheid", "ip_rechten", "geldigheidsduur", "acceptatie_handtekening"]}',
 'Required proposal (offerte) sections (Netherlands). Include KvK number + BTW number on cover. General terms (Algemene Voorwaarden) typically attached.',
 'https://www.kvk.nl/ondernemen/offerte-en-factuur-maken/',
 '2026-01-01'),

('Netherlands', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offerte_binding_unless_vrijblijvend": true, "offer_validity_default_days": 30, "governing_law": "Burgerlijk Wetboek Boek 6", "jurisdiction": "Nederlandse rechter", "currency": "EUR", "btw_inclusive_note_required": true, "consumer_ontbinding_14_days": true, "kvk_and_btw_mandatory_on_business_docs": true}',
 'Dutch offerte binding unless marked "vrijblijvend". Consumers have 14-day right of dissolution (ontbindingsrecht). KvK and BTW numbers mandatory on business correspondence.',
 'https://wetten.overheid.nl/BWBR0005290/',
 '2026-01-01'),

-- Canada
('Canada', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "bilingual_clause_if_quebec", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (Canada). Include BN/GST-HST number on cover. Quebec: French-language version mandatory under Charter of the French Language (Bill 96).',
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses.html',
 '2026-01-01'),

('Canada', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "provincial_contract_law_or_quebec_civil_code", "jurisdiction_per_province": true, "currency": "CAD", "gst_hst_inclusive_note_required": true, "quebec_bill_96_french_required": true, "consumer_cooling_off_per_province": true}',
 'Provincial common-law governs contract formation (Civil Code in Quebec). In Quebec, Bill 96 requires contracts offered to a consumer to be drafted in French (English version may follow if expressly agreed).',
 'https://www.legisquebec.gouv.qc.ca/en/document/cs/c-11',
 '2026-01-01'),

-- Australia
('Australia', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "australian_consumer_law_clause", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (Australia). Include ABN on cover, AUD pricing. Australian Consumer Law clause mandatory for B2C proposals.',
 'https://sprintlaw.com.au/articles/crafting-a-winning-business-proposal-australian-legal-template-guide/',
 '2026-01-01'),

('Australia', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "Australian_common_law_and_state_legislation", "jurisdiction": "courts_of_nominated_state", "currency": "AUD", "gst_inclusive_note_required": true, "abn_required": true, "australian_consumer_law_applies_to_b2c": true, "unfair_contract_terms_regime": "from_9_Nov_2023"}',
 'Proposals = offers under common law. ABN required. Australian Consumer Law (ACL) consumer guarantees apply to B2C. Unfair Contract Terms regime (strengthened 9 Nov 2023) applies to small business contracts ≤ AUD 5M.',
 'https://www.accc.gov.au/business/business-rights-and-protections/unfair-contract-terms',
 '2023-11-09'),

-- Singapore
('Singapore', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "pdpa_clause", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (Singapore). Include UEN + GST number on cover, SGD pricing. PDPA (Personal Data Protection Act) clause required if any personal data is processed.',
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)',
 '2026-01-01'),

('Singapore', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "Singapore_Contract_Law_based_on_English_common_law", "jurisdiction": "Singapore_courts_or_SIAC", "currency": "SGD", "gst_rate": 9, "uen_required_on_business_docs": true, "electronic_transactions_act_valid": true, "pdpa_consent_required_for_personal_data": true}',
 'Singapore contract law follows English common law. UEN required on all business documents. Electronic signatures valid under Electronic Transactions Act 2010. PDPA consent required before processing personal data.',
 'https://sso.agc.gov.sg/Act/ETA2010',
 '2026-01-01'),

-- UAE
('UAE', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page_bilingual_recommended", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (UAE). Include TRN + trade license number on cover, AED pricing. Arabic language recommended (mandatory if any party requests). Bilingual Arabic/English common.',
 'https://tax.gov.ae/',
 '2026-01-01'),

('UAE', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "UAE_Federal_Civil_Transactions_Law_1985", "jurisdiction": "UAE_courts_or_DIFC_ADGM_for_offshore", "currency": "AED", "vat_inclusive_note_required": true, "trn_required_if_vat_registered": true, "arabic_language_penalty_aed": 5000, "trade_license_number_on_business_docs": true}',
 'Contracts governed by Federal Law No. 5 of 1985 (Civil Transactions Law). TRN mandatory on all VAT-related documents. Failure to submit tax documents in Arabic when required → AED 5,000 fine (reduced from AED 20,000 in 2025 reform).',
 'https://www.middleeastbriefing.com/news/uae-reduces-tax-penalties-unified-compliance-framework/',
 '2026-01-01'),

-- Philippines
('Philippines', 'proposal', 'mandatory_fields', 'sections',
 '{"sections": ["cover_page", "executive_summary", "company_background", "scope_of_work", "deliverables", "timeline_milestones", "pricing_breakdown", "payment_schedule", "terms_conditions", "confidentiality", "ip_ownership", "data_privacy_act_clause", "validity_period", "acceptance_signature"]}',
 'Required proposal sections (Philippines). Include BIR TIN + DTI/SEC registration on cover, PHP pricing. Data Privacy Act 2012 (RA 10173) clause required if any personal information is processed.',
 'https://www.bir.gov.ph/',
 '2026-01-01'),

('Philippines', 'proposal', 'legal_requirements', 'binding_acceptance',
 '{"offer_validity_default_days": 30, "governing_law": "Civil_Code_of_the_Philippines_RA_386", "jurisdiction": "Philippine_courts", "currency": "PHP", "vat_12_percent_inclusive_note": true, "tin_and_dti_sec_required": true, "data_privacy_act_ra_10173_compliance": true, "notarization_recommended_for_enforceability": true}',
 'Proposals governed by Civil Code (RA 386). TIN, DTI/SEC number, and business permit required. Notarization recommended for enforceability. Data Privacy Act compliance required for personal data.',
 'https://www.officialgazette.gov.ph/constitutions/the-new-civil-code-of-the-philippines/',
 '2026-01-01')

ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();


-- =====================================================
-- CONTRACT ESSENTIAL CLAUSES — per country
-- =====================================================
-- Complete clause checklist for every jurisdiction, based on
-- local common practice + statutory minima.
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
-- India
('India', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_identification_with_pan", "recitals_background", "scope_of_work", "term_and_commencement", "consideration_payment_terms", "deliverables_and_acceptance", "representations_and_warranties", "confidentiality", "intellectual_property_ownership", "indemnification", "limitation_of_liability", "termination_for_cause_and_convenience", "force_majeure", "dispute_resolution_arbitration", "governing_law_indian_contract_act_1872", "jurisdiction", "notices", "entire_agreement", "severability", "amendment_and_waiver", "counterparts_and_electronic_signature", "stamp_duty_clause"]}',
 'Indian contracts should contain all listed clauses. Stamp duty clause required (varies by state, typically 0.1-0.25%). Arbitration under Arbitration and Conciliation Act 1996 is standard for commercial contracts.',
 'https://www.indiacode.nic.in/handle/123456789/2187',
 '2026-01-01'),

('India', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"stamp_duty_non_compliance_penalty": "up_to_10x_stamp_duty", "registration_required_for": ["immovable_property", "lease_above_11_months", "gift_deeds"], "limitation_period_years": 3, "electronic_signature_valid": "IT_Act_2000", "notarization_optional_but_evidentiary": true, "msme_delayed_payment_interest": "3x_bank_rate"}',
 'Non-payment of stamp duty → up to 10x penalty and inadmissibility in court. Limitation Act 1963 — 3 years for most contract claims. MSME Act 2006: delayed payment interest = 3x RBI bank rate.',
 'https://www.indiacode.nic.in/handle/123456789/1362',
 '2026-01-01'),

-- USA
('USA', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_state_of_incorporation", "recitals", "scope_of_services_or_goods", "term", "compensation_payment_terms", "deliverables_acceptance", "representations_and_warranties", "confidentiality_non_disclosure", "intellectual_property_and_work_for_hire", "non_solicitation_and_non_compete_if_valid_in_state", "indemnification", "limitation_of_liability_and_disclaimers", "termination", "assignment", "force_majeure", "dispute_resolution_arbitration_or_court", "choice_of_law_and_venue", "notices", "entire_agreement", "severability", "waiver", "counterparts_electronic_signature_esign_act"]}',
 'US contracts should include all listed clauses. Non-compete enforceability varies by state — California, North Dakota, Oklahoma, Minnesota largely prohibit; FTC non-compete ban (2024) stayed by courts in 2024. ESIGN Act 2000 makes electronic signatures valid nationwide.',
 'https://www.ftc.gov/legal-library/browse/federal-register-notices/non-compete-clause-rulemaking',
 '2026-01-01'),

('USA', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"statute_of_frauds_writing_required_for": ["sale_of_land", "goods_above_500_usd_ucc_2_201", "contracts_not_performable_within_1_year"], "statute_of_limitations_years_per_state": "3_to_10", "electronic_signature_valid": "ESIGN_Act_2000_and_state_UETA", "unconscionability_doctrine_applies": true, "late_payment_interest_federal_prompt_pay_act": "government_contractors_only"}',
 'Statute of Frauds requires writing for certain contracts (land, goods > $500, > 1-year). SOL varies 3-10 years by state. ESIGN Act + state UETA = electronic signatures fully valid.',
 'https://www.law.cornell.edu/uscode/text/15/7001',
 '2026-01-01'),

-- UK
('UK', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_company_number", "recitals", "definitions", "scope_of_work", "term", "fees_and_payment", "deliverables", "warranties", "confidentiality", "intellectual_property", "data_protection_uk_gdpr", "indemnity", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution", "governing_law_england_wales", "jurisdiction", "notices", "entire_agreement", "severability", "third_party_rights_contracts_rights_of_third_parties_act_1999", "counterparts_electronic_signature"]}',
 'UK contracts should include all listed clauses. Contracts (Rights of Third Parties) Act 1999 clause is standard — either expressly excludes or permits third-party rights. UK GDPR + Data Protection Act 2018 clause required if any personal data is processed.',
 'https://www.legislation.gov.uk/ukpga/1999/31',
 '2026-01-01'),

('UK', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"limitation_act_1980_simple_contract_years": 6, "limitation_act_1980_deed_years": 12, "electronic_signature_valid": "Electronic_Communications_Act_2000", "unfair_contract_terms_act_1977": true, "consumer_rights_act_2015": "b2c_contracts", "late_payment_of_commercial_debts_interest_act_1998": "base_rate_plus_8_percent"}',
 'Simple contract SOL = 6 years; deeds = 12 years. Late Payment of Commercial Debts (Interest) Act 1998 allows statutory interest at Bank of England base rate + 8% on overdue B2B invoices.',
 'https://www.legislation.gov.uk/ukpga/1998/20',
 '2026-01-01'),

-- Germany
('Germany', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["vertragsparteien_mit_handelsregister", "vertragsgegenstand", "leistungsumfang", "vergütung_zahlungsbedingungen", "leistungszeit", "gewährleistung", "haftung", "vertraulichkeit", "urheberrechte_und_nutzungsrechte", "datenschutz_dsgvo", "kündigung_ordentlich_und_außerordentlich", "höhere_gewalt", "schriftformklausel", "salvatorische_klausel", "gerichtsstand", "anwendbares_recht_bgb", "schlussbestimmungen", "widerrufsbelehrung_wenn_verbraucher"]}',
 'German contracts should include all listed clauses. Schriftformklausel (written-form) and Salvatorische Klausel (severability) are standard. GDPR compliance mandatory.',
 'https://www.gesetze-im-internet.de/bgb/',
 '2026-01-01'),

('Germany', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"regelverjährung_years": 3, "verjährung_baumangel_years": 5, "verjährung_grundstücksmangel_years": 10, "notarization_required_for": ["real_estate", "gmbh_incorporation", "marriage_contract"], "electronic_signature_valid": "eIDAS_Regulation", "verzugszins_verbraucher": "basiszinssatz_plus_5", "verzugszins_unternehmer": "basiszinssatz_plus_9", "agb_kontrolle_§305_bgb": true}',
 'Regelverjährung (standard SOL) = 3 years. Default interest: +5 points above base rate (consumer), +9 points (commercial). §305 BGB: standard T&Cs must pass transparency/fairness test.',
 'https://www.gesetze-im-internet.de/bgb/__288.html',
 '2026-01-01'),

-- France
('France', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_avec_siret_et_tva", "considerants", "objet_du_contrat", "duree", "conditions_financieres_et_paiement", "obligations_des_parties", "garanties", "confidentialite", "propriete_intellectuelle", "rgpd_donnees_personnelles", "responsabilite", "force_majeure_article_1218_code_civil", "resiliation", "reglement_des_litiges", "loi_applicable_code_civil", "juridiction_competente", "clauses_attributives", "annexes"]}',
 'French contracts governed by Code Civil (reformed 2016). RGPD (GDPR) compliance mandatory. Force majeure defined in Art. 1218. SIRET and TVA number identification required.',
 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006070721/LEGISCTA000032040944/',
 '2026-01-01'),

('France', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"prescription_civile_years": 5, "prescription_commerciale_years": 5, "electronic_signature_valid": "eIDAS_and_article_1367_code_civil", "consumer_retraction_14_days": true, "penalites_retard_code_commerce_l441_10": "3_times_legal_interest_rate_or_contract_rate", "forfait_recouvrement_eur": 40, "notarization_required_for_real_estate": true}',
 'Commercial prescription 5 years (Art. 110-4 Code de commerce). Late-payment penalties under L441-10 Code Commerce: ≥ 3× legal rate or contractual rate + €40 fixed recovery fee.',
 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038410619',
 '2026-01-01'),

-- Netherlands
('Netherlands', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["partijen_met_kvk_en_btw", "considerans", "overeenkomst_voorwerp", "looptijd", "prijs_en_betaling", "verplichtingen_partijen", "garanties", "geheimhouding_vertrouwelijkheid", "intellectueel_eigendom", "avg_gdpr_privacy", "aansprakelijkheid", "overmacht", "ontbinding_en_opzegging", "geschillenbeslechting", "toepasselijk_recht_nederlands", "bevoegde_rechter", "slotbepalingen"]}',
 'Dutch contracts governed by Burgerlijk Wetboek. AVG (GDPR) compliance mandatory. KvK and BTW identification required.',
 'https://wetten.overheid.nl/BWBR0005289/',
 '2026-01-01'),

('Netherlands', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"verjaring_nakoming_years": 5, "verjaring_schadevergoeding_years": 5, "electronic_signature_valid": "eIDAS_Regulation_and_article_3_15a_bw", "wettelijke_handelsrente_percent": "ECB_refinancing_rate_plus_8", "incassokosten_wet_min_eur": 40, "consumer_14_day_retraction": true, "algemene_voorwaarden_zwarte_grijze_lijst_applies_to_consumers": true}',
 'General SOL 5 years (verjaring). Wettelijke handelsrente (statutory commercial interest) = ECB refinancing rate + 8% (revised semi-annually). Minimum collection costs €40.',
 'https://wetten.overheid.nl/BWBR0005290/2026-01-01#Boek6_Titel1_Afdeling11_Artikel120',
 '2026-01-01'),

-- Canada
('Canada', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_incorporation_jurisdiction", "recitals", "services_or_goods_description", "term", "compensation_payment_terms", "deliverables_and_acceptance", "representations_and_warranties", "confidentiality", "intellectual_property", "privacy_pipeda_or_provincial", "indemnification", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution", "governing_law_per_province", "jurisdiction_and_venue", "notices", "entire_agreement", "severability", "waiver", "counterparts_electronic_signature", "language_french_version_if_quebec_bill_96"]}',
 'Canadian contracts governed by provincial law (Civil Code in Quebec). PIPEDA privacy clause or provincial equivalent. Quebec Bill 96 requires French version for consumer-facing contracts (unless expressly waived).',
 'https://laws-lois.justice.gc.ca/eng/acts/p-8.6/',
 '2026-01-01'),

('Canada', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"limitation_act_years_by_province": "2_to_6", "electronic_signature_valid": "PIPEDA_Part_2_and_provincial_UECA", "statute_of_frauds_still_applies_most_provinces": true, "quebec_civil_code_30_year_prescription_for_real_rights": true, "late_payment_federal_pila_for_gov_contractors": true, "consumer_protection_act_per_province": true}',
 'Limitation periods vary by province (BC 2 yr, ON 2 yr, AB 2 yr, QC 3 yr basic). Electronic signatures valid under PIPEDA Part 2 + provincial UECA. Consumer protection acts per province.',
 'https://laws-lois.justice.gc.ca/eng/acts/p-8.6/page-4.html',
 '2026-01-01'),

-- Australia
('Australia', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_acn_or_abn", "recitals", "services_or_goods_description", "term", "fees_payment_and_gst", "deliverables_and_acceptance", "warranties", "confidentiality", "intellectual_property_and_moral_rights", "privacy_act_1988_compliance", "indemnity", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution", "governing_law_per_state", "jurisdiction", "notices", "entire_agreement", "severability", "counterparts_electronic_signature", "unfair_contract_terms_not_excluded_if_small_business"]}',
 'Australian contracts: include ACN/ABN. Privacy Act 1988 + Australian Privacy Principles apply. Unfair Contract Terms regime (strengthened 9 Nov 2023) prohibits one-sided clauses in small-business contracts ≤ AUD 5M.',
 'https://www.accc.gov.au/business/business-rights-and-protections/unfair-contract-terms',
 '2023-11-09'),

('Australia', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"limitation_period_years_per_state": "6_most_states_3_nt", "electronic_signature_valid": "Electronic_Transactions_Act_1999", "australian_consumer_law_cannot_be_contracted_out": true, "unfair_contract_terms_penalties_up_to_aud_50m_for_companies": true, "payment_times_reporting_scheme_250m_turnover": true}',
 'SOL 6 years (most states), 3 years (NT). Electronic Transactions Act 1999 makes e-signatures valid. ACL consumer guarantees cannot be contracted out. UCT penalties up to AUD $50M per breach for corporations.',
 'https://www.legislation.gov.au/Details/C2023C00223',
 '2026-01-01'),

-- Singapore
('Singapore', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_uen", "recitals", "services_goods_description", "term", "fees_payment_gst_9_percent", "deliverables", "warranties", "confidentiality", "intellectual_property", "pdpa_consent_and_data_protection", "indemnity", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution_siac_or_courts", "governing_law_singapore", "jurisdiction", "notices", "entire_agreement", "severability", "counterparts_electronic_signature_eta", "third_party_rights_contracts_rights_of_third_parties_act"]}',
 'Singapore contracts follow English common-law pattern. PDPA (Personal Data Protection Act 2012) compliance. SIAC arbitration is standard for international disputes. UEN mandatory.',
 'https://sso.agc.gov.sg/Act/PDPA2012',
 '2026-01-01'),

('Singapore', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"limitation_act_1959_simple_contract_years": 6, "limitation_act_1959_deed_years": 12, "electronic_signature_valid": "Electronic_Transactions_Act_2010", "unfair_contract_terms_act": "b2c_and_standard_form", "pdpa_fine_up_to_sgd_1m_or_10_percent_annual_turnover": true, "sale_of_goods_act_applies_to_goods": true}',
 'SOL: 6 years simple contract, 12 years deed. PDPA fines up to SGD $1M or 10% of annual turnover (whichever higher, from Oct 2022). ETA 2010 validates e-signatures.',
 'https://sso.agc.gov.sg/Act/ETA2010',
 '2026-01-01'),

-- UAE
('UAE', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_trn_and_trade_license", "recitals", "subject_matter_scope", "term_and_commencement", "consideration_payment_vat_inclusive", "deliverables", "warranties", "confidentiality", "intellectual_property", "data_protection_pdpl_federal_decree_law_45_2021", "indemnity", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution_onshore_or_difc_adgm", "governing_law_uae_federal_or_freezone", "jurisdiction", "notices", "entire_agreement", "severability", "language_arabic_required_if_requested"]}',
 'UAE contracts governed by Federal Civil Transactions Law (1985). PDPL (Federal Decree-Law 45/2021) data-protection clause required. TRN mandatory if VAT-registered. Arabic version required if any party requests or for government submissions.',
 'https://u.ae/en/information-and-services/justice-safety-and-the-law/civil-and-commercial-laws',
 '2026-01-01'),

('UAE', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"limitation_civil_years": 15, "limitation_commercial_years": 10, "electronic_signature_valid": "Federal_Decree_Law_46_2021", "notarization_required_for": ["power_of_attorney", "real_estate", "marriage"], "vat_late_payment_penalty_percent_daily": 1, "vat_late_payment_cap_percent": 300, "arabic_submission_penalty_aed": 5000, "e_invoicing_non_compliance_aed_monthly": 5000}',
 'Civil SOL 15 years, commercial 10 years. VAT late payment: 1%/day up to 300% cap. AED 5,000 penalty for failing to submit tax docs in Arabic (reduced from AED 20,000 in 2025 reform). E-invoicing non-compliance AED 5,000/month under Cabinet Decision 106 (July 2026).',
 'https://tallysolutions.com/mena/uae-vat/uae-e-invoicing-non-compliance-risks/',
 '2026-07-01'),

-- Philippines
('Philippines', 'contract', 'mandatory_fields', 'essential_clauses',
 '{"clauses": ["parties_with_tin_and_sec_or_dti", "whereas_clauses", "subject_matter", "term", "consideration_payment_vat_12", "obligations", "warranties_representations", "confidentiality", "intellectual_property", "data_privacy_act_ra_10173", "indemnification", "limitation_of_liability", "termination", "force_majeure", "dispute_resolution_adr_or_courts", "governing_law_philippines", "venue", "notices", "entire_agreement", "severability", "notarization_acknowledgment_clause", "counterparts_electronic_signature"]}',
 'Philippine contracts governed by Civil Code (RA 386). Data Privacy Act 2012 (RA 10173) compliance for personal data. Notarization through acknowledgment clause recommended for enforceability and conversion to public document.',
 'https://www.officialgazette.gov.ph/constitutions/the-new-civil-code-of-the-philippines/',
 '2026-01-01'),

('Philippines', 'contract', 'legal_requirements', 'enforceability_and_penalties',
 '{"prescription_written_contract_years": 10, "prescription_oral_contract_years": 6, "electronic_signature_valid": "E_Commerce_Act_RA_8792", "statute_of_frauds_article_1403_civil_code_applies": true, "notarization_not_required_for_validity_but_for_public_document_status": true, "legal_interest_per_BSP_circular_799": 6, "data_privacy_penalties_php_up_to_5m": true}',
 'SOL: 10 years (written), 6 years (oral). Statute of Frauds under Art. 1403 Civil Code requires writing for certain contracts. Legal interest 6% (BSP Circular 799, applicable since July 2013). Data Privacy Act penalties up to PHP 5M.',
 'https://www.bsp.gov.ph/Regulations/Issuances/2013/c799.pdf',
 '2026-01-01')

ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- =====================================================
-- INVOICE PENALTIES & RETENTION — per country
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date)
VALUES
('India', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"non_issuance_penalty_inr": 10000, "non_issuance_or_tax_evasion_penalty": "100_percent_of_tax_due_or_10000_whichever_higher", "retention_years": 6, "retention_source": "rule_56_cgst_rules", "late_gst_return_fee_per_day_inr": 50, "late_gst_return_max_per_return_inr": 5000, "interest_on_delayed_gst_annual_percent": 18}',
 'GST non-issuance penalty: higher of ₹10,000 or 100% of tax due. Records retention 6 years (Rule 56 CGST Rules). Late return fee ₹50/day capped at ₹5,000. Interest on delayed GST payment 18% p.a.',
 'https://www.gst.gov.in/',
 '2026-01-01'),

('USA', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"record_retention_years_federal": 3, "record_retention_years_recommended": 7, "late_payment_recovery_per_state": true, "federal_prompt_payment_act_for_gov_contractors_days": 30, "1099_filing_penalty_usd_2026": "60_to_660_per_form_based_on_lateness", "sales_tax_late_penalty_varies_by_state": "5_to_25_percent"}',
 'Federal IRS retention ≥ 3 years; CPAs recommend 7 years. 1099 filing penalties (tax year 2026): $60 (≤30 days late) to $660 (after Aug 1 or intentional disregard). Sales-tax late-filing penalties 5-25% per state.',
 'https://www.irs.gov/publications/p1099',
 '2026-01-01'),

('UK', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"vat_records_retention_years": 6, "mtd_records_retention_years": 6, "late_vat_points_system_2023": true, "vat_late_filing_penalty_gbp_per_point": 200, "late_payment_interest_hmrc_base_plus_2_5": true, "repayment_interest_hmrc_base_minus_1_minimum_0_5": true, "commercial_debt_interest_base_plus_8_percent": true}',
 'VAT records retention 6 years. Late-submission points system (Jan 2023): £200 penalty per point when threshold reached. HMRC late-payment interest = base rate + 2.5%. Commercial debt interest = base rate + 8%.',
 'https://www.gov.uk/guidance/vat-record-keeping',
 '2026-01-01'),

('Germany', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years": 10, "retention_years_e_invoice_original_format": 8, "late_filing_penalty_max_eur": 25000, "verspätungszuschlag_percent_of_tax": "up_to_10_percent_max_25000", "default_interest_per_month_percent": 0.5, "ust_late_payment_saumniszuschlag_percent_monthly": 1, "ordnungswidrigkeit_penalty_max_eur": 5000}',
 'Retention 10 years (GoBD). E-invoices: 8 years in original structured format. Verspätungszuschlag (late-filing): up to 10% of tax, max €25,000. Säumniszuschlag (late-payment surcharge): 1% per month.',
 'https://www.gesetze-im-internet.de/ao_1977/__147.html',
 '2026-01-01'),

('France', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years_tax": 6, "retention_years_commercial": 10, "late_issuance_penalty_eur_per_invoice": 15, "late_issuance_max_percent_of_tx": 25, "missing_mandatory_field_penalty_eur": 15, "tva_late_filing_penalty_percent": "5_to_80", "factur_x_mandatory_b2b_domestic_from": "2026-09-01", "e_reporting_b2c_cross_border_real_time": true}',
 'Retention: 6 years tax, 10 years commercial. Late-issuance or missing-field penalty: €15 per invoice, capped at 25% of transaction value. TVA late-filing penalty 5-80% depending on fault.',
 'https://www.impots.gouv.fr/professionnel/facturation-electronique',
 '2026-09-01'),

('Netherlands', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years": 7, "retention_years_real_estate": 10, "late_filing_verzuimboete_eur_first": 68, "late_filing_verzuimboete_eur_second": 136, "vat_default_interest_ecb_refi_rate_plus_4": true, "deliberate_non_compliance_vergrijpboete_percent_max": 100, "sequential_numbering_violation_investigation_trigger": true}',
 'Retention 7 years (10 for real estate). Late-filing verzuimboete €68 (first) / €136 (repeat). Deliberate non-compliance vergrijpboete up to 100% of tax. Sequential numbering gaps trigger audits.',
 'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/btw/administratie_bijhouden/',
 '2026-01-01'),

('Canada', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years_federal_gst_hst": 6, "retention_start": "after_last_year_records_relate_to", "failure_to_file_penalty_percent": 5, "failure_to_file_additional_per_month_percent": 1, "gst_hst_late_filing_max_months_or_years": 12, "interest_prescribed_rate_quarterly_adjusted": true, "quebec_qst_separate_retention": 6}',
 'CRA retention 6 years after last year records relate to. GST/HST late-filing penalty: 5% + 1%/month up to 12 months. Quebec QST separate retention 6 years.',
 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/keeping-records.html',
 '2026-01-01'),

('Australia', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years_federal": 5, "fbt_records_retention_years": 5, "failure_to_issue_tax_invoice_penalty_units": "up_to_20", "penalty_unit_aud_from_2024_07_01": 330, "gic_general_interest_charge_quarterly_adjusted": true, "false_misleading_gst_statement_penalty_percent": "25_to_75"}',
 'ATO retention 5 years. Failure to issue tax invoice: up to 20 penalty units (1 unit = AUD $330 from Jul 2024 = up to AUD $6,600). GIC (General Interest Charge) updated quarterly. False/misleading statement penalty 25-75% of tax shortfall.',
 'https://www.ato.gov.au/Business/Record-keeping-for-business/',
 '2024-07-01'),

('Singapore', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years": 5, "retention_start": "end_of_relevant_accounting_period", "gst_late_filing_penalty_sgd": 200, "gst_late_filing_additional_per_month_sgd": 200, "gst_late_filing_max_sgd": 10000, "gst_late_payment_penalty_percent": 5, "gst_late_payment_additional_monthly_percent": 2, "invoicenow_non_compliance_fatal_errors_from": "2026-05-01"}',
 'IRAS retention 5 years from end of accounting period. Late GST filing SGD $200 flat + $200/month, max $10,000. Late payment 5% + 2%/month. InvoiceNow fatal errors enforced from 1 May 2026.',
 'https://www.iras.gov.sg/taxes/goods-services-tax-(gst)/getting-it-right/record-keeping-requirements',
 '2026-05-01'),

('UAE', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years": 5, "retention_years_real_estate": 15, "non_issuance_penalty_aed_per_invoice": 2500, "non_compliance_format_penalty_aed_per_invoice": 2500, "asp_missing_penalty_aed_monthly": 5000, "arabic_submission_penalty_aed": 5000, "vat_late_payment_daily_percent": 1, "vat_late_payment_cap_percent": 300, "vat_registration_threshold_aed": 375000, "late_registration_penalty_aed": 10000}',
 'Retention 5 years (15 for real estate). AED 2,500 per non-compliant invoice. AED 5,000/month for missing ASP. VAT late payment 1%/day up to 300% cap. Late VAT registration (over 30 days from AED 375,000 threshold): AED 10,000.',
 'https://www.wafeq.com/en-ae/tax-and-reporting/vat-invoice-requirements-in-uae',
 '2026-01-01'),

('Philippines', 'invoice', 'legal_requirements', 'penalties_and_retention',
 '{"retention_years": 10, "retention_soft_copy_after_year_5": "allowed", "failure_to_issue_receipt_invoice_penalty_php": "1000_to_50000", "failure_to_issue_imprisonment": "2_to_4_years", "late_filing_surcharge_percent": 25, "interest_per_annum_percent": 12, "unauthorized_invoice_printing_penalty": "criminal"}',
 'BIR retention 10 years (soft copy allowed after year 5). Failure to issue receipt/invoice: PHP 1,000-50,000 + 2-4 years imprisonment per Sec 264 NIRC. Late-filing surcharge 25% + 12% interest p.a.',
 'https://www.bir.gov.ph/',
 '2026-01-01')

ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Summary counts
SELECT
    country,
    document_type,
    COUNT(*) as rule_count
FROM compliance_knowledge
GROUP BY country, document_type
ORDER BY country, document_type;

SELECT COUNT(DISTINCT country) AS countries_covered,
       COUNT(DISTINCT document_type) AS doc_types_covered,
       COUNT(*) AS total_rules
FROM compliance_knowledge;

COMMENT ON TABLE compliance_knowledge IS 'Compliance knowledge base — comprehensive global coverage across document types (invoice, contract, quotation, proposal). Includes penalties, retention periods, clause checklists. Last expansion: 2026-05-12.';
