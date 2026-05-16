-- =====================================================
-- COMPLIANCE KNOWLEDGE — GLOBAL EXPANSION
-- =====================================================
-- Adds compliance data for ALL remaining countries not
-- covered in the world baseline migration. Covers Europe,
-- Middle East, Asia, Africa, Americas, Oceania, and
-- Caribbean/Small States.
--
-- Data sourced from: EY Worldwide VAT Guide 2026, OECD,
-- national tax authority pages, PwC Tax Summaries, and
-- IBFD Country Tax Guides.
-- Verified 2026-06-01.
--
-- Safe to run multiple times — uses ON CONFLICT DO UPDATE.
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date) VALUES

-- ══════════════════════════════════════════════════════
-- EUROPE (Remaining)
-- ══════════════════════════════════════════════════════

('Albania', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 6, "zero": 0, "registration_threshold_all": 10000000}',
 'VAT (TVSH): 20% standard, 6% reduced (accommodation, agritourism). Registration threshold ALL 10,000,000 (approx €85,000). E-invoicing mandatory since 2021 via national fiscal platform.',
 'https://www.tatime.gov.al/', '2026-01-01'),

('Andorra', 'invoice', 'tax_rates', 'igi_rates',
 '{"standard": 4.5, "reduced": 1, "zero": 0, "superreduced": 0, "registration_threshold_eur": 40000}',
 'IGI (Impost General Indirecte): 4.5% standard, 1% reduced (food, books). Registration threshold €40,000. No EU membership; separate tax system.',
 'https://www.govern.ad/finances/', '2026-01-01'),

('Belarus', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 10, "zero": 0, "registration_threshold_byn": 500000}',
 'VAT (НДС): 20% standard, 10% reduced (food, children goods). E-invoicing mandatory via national system. Registration threshold BYN 500,000 annual revenue.',
 'https://www.nalog.gov.by/', '2026-01-01'),

('Bosnia and Herzegovina', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 17, "zero": 0, "registration_threshold_bam": 50000}',
 'VAT (PDV): Single rate 17%. No reduced rates. Registration threshold BAM 50,000 annual turnover. Invoices must include VAT ID number.',
 'https://www.uino.gov.ba/', '2026-01-01'),

('Kosovo', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 8, "zero": 0, "registration_threshold_eur": 30000}',
 'VAT (TVSH): 18% standard, 8% reduced (electricity, water, food, IT equipment). Registration threshold €30,000. Fiscal electronic devices mandatory for invoicing.',
 'https://www.atk-ks.org/', '2026-01-01'),

('Moldova', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 8, "zero": 0, "registration_threshold_mdl": 1200000}',
 'VAT (TVA): 20% standard, 8% reduced (food, pharmaceuticals, natural gas). Registration threshold MDL 1,200,000. E-invoicing via e-Factura system.',
 'https://www.sfs.md/', '2026-01-01'),

('Monaco', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced_10": 10, "reduced_5_5": 5.5, "reduced_2_1": 2.1, "zero": 0}',
 'TVA (aligned with France): 20% standard, 10% reduced (restaurants, transport), 5.5% (food, books), 2.1% (press, medicines). Monaco follows French VAT system. No registration threshold — all businesses must register.',
 'https://en.gouv.mc/', '2026-01-01'),

('Montenegro', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced": 7, "zero": 0, "registration_threshold_eur": 30000}',
 'VAT (PDV): 21% standard, 7% reduced (food, medicines, books, accommodation). Registration threshold €30,000. Fiscal invoices required with fiscal identification number.',
 'https://www.tax.gov.me/', '2026-01-01'),

('North Macedonia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 5, "zero": 0, "registration_threshold_mkd": 2000000}',
 'VAT (DDV): 18% standard, 5% reduced (food, medicines, books, public transport). Registration threshold MKD 2,000,000 (approx €32,000). E-invoicing via e-Faktura system mandatory for B2G.',
 'https://www.ujp.gov.mk/', '2026-01-01'),

('San Marino', 'invoice', 'tax_rates', 'import_duty',
 '{"no_vat": true, "import_duty_standard": 17, "monofase_tax": 3, "registration_required": true}',
 'San Marino has no VAT system. Applies a single-phase import duty (monofase) of 17% on imports and a 3% general services tax. Businesses must register with the tax office. Special customs agreement with Italy/EU.',
 'https://www.gov.sm/', '2026-01-01'),

('Serbia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 10, "zero": 0, "registration_threshold_rsd": 8000000}',
 'VAT (PDV): 20% standard, 10% reduced (food, medicines, newspapers, accommodation). Registration threshold RSD 8,000,000 (approx €68,000). E-invoicing (SEF system) mandatory for B2G and B2B since 2023.',
 'https://www.purs.gov.rs/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- MIDDLE EAST
-- ══════════════════════════════════════════════════════

('Bahrain', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_bhd": 37500}',
 'VAT: 10% standard (increased from 5% in 2022). Zero-rated: exports, international transport, new buildings. Exempt: financial services, bare land. Registration threshold BHD 37,500. National Bureau for Revenue administers.',
 'https://www.nbr.gov.bh/', '2026-01-01'),

('Iraq', 'invoice', 'tax_rates', 'sales_tax',
 '{"no_vat": true, "sales_tax_goods": 15, "sales_tax_services": 0, "corporate_tax": 15, "withholding_tax": 3.3}',
 'Iraq has no VAT system. Sales tax of 15% applies to certain goods at import/manufacturing stage. Services generally not taxed. Corporate income tax 15%. Withholding tax 3.3% on government contracts.',
 'https://tax.mof.gov.iq/', '2026-01-01'),

('Iran', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 9, "zero": 0, "exempt": true, "registration_threshold_irr": 0}',
 'VAT (مالیات بر ارزش افزوده): 9% standard (includes 6% VAT + 3% municipal tax). Exempt: basic food, health, education. All businesses must register regardless of turnover. Electronic tax invoicing mandatory.',
 'https://www.tax.gov.ir/', '2026-01-01'),

('Jordan', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 16, "reduced": 4, "zero": 0, "exempt": true, "registration_threshold_jod": 75000}',
 'GST (ضريبة المبيعات العامة): 16% standard, 4% reduced (certain services). Zero-rated: exports. Exempt: basic food, health, education. Registration threshold JOD 75,000. E-invoicing (JOFOTARA) mandatory since 2024.',
 'https://www.istd.gov.jo/', '2026-01-01'),

('Kuwait', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "corporate_tax_foreign": 15, "customs_duty": 5, "social_security": 11.5}',
 'Kuwait has no VAT or income tax on individuals. Foreign companies pay 15% corporate tax. Standard customs duty 5% (GCC Common External Tariff). Social security contributions 11.5% employer. VAT implementation postponed indefinitely.',
 'https://www.tax.gov.kw/', '2026-01-01'),

('Lebanon', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 11, "zero": 0, "exempt": true, "registration_threshold_lbp": 100000000}',
 'VAT (TVA): 11% standard rate. Zero-rated: exports. Exempt: financial services, education, health. Registration threshold LBP 100,000,000. Invoices must be in Arabic or bilingual.',
 'https://www.finance.gov.lb/', '2026-01-01'),

('Oman', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 5, "zero": 0, "exempt": true, "registration_threshold_omr": 38500}',
 'VAT: 5% standard (implemented April 2021). Zero-rated: exports, international transport, precious metals. Exempt: financial services, healthcare, education. Registration threshold OMR 38,500.',
 'https://tms.taxoman.gov.om/', '2026-01-01'),

('Qatar', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "corporate_tax": 10, "customs_duty": 5, "excise_tax": true}',
 'Qatar has no VAT system. Corporate tax 10% on foreign companies. No personal income tax. Customs duty 5% (GCC CET). Excise tax on tobacco (100%), energy drinks (100%), carbonated drinks (50%). VAT implementation postponed.',
 'https://www.gta.gov.qa/', '2026-01-01'),

('Syria', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "turnover_tax": 1.5, "consumption_tax_range": "5-30", "corporate_tax": 28}',
 'Syria has no formal VAT system. Turnover tax 1.5% on gross revenue. Consumption tax 5-30% on luxury goods. Corporate tax 28%. Due to ongoing conflict, tax administration is limited in some regions.',
 'https://www.syriantax.gov.sy/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- ASIA (Remaining)
-- ══════════════════════════════════════════════════════

('Afghanistan', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "business_receipts_tax": 4, "fixed_tax_small": 2, "corporate_tax": 20}',
 'Afghanistan has no formal VAT. Business Receipts Tax (BRT) of 4% on gross revenue for services, 2% fixed tax for small businesses. Corporate tax 20%. Tax administration under Afghanistan Revenue Department.',
 'https://ard.gov.af/', '2026-01-01'),

('Armenia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "zero": 0, "exempt": true, "registration_threshold_amd": 115000000}',
 'VAT (ԱԱՀ): 20% standard. Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold AMD 115,000,000 (approx €250,000). E-invoicing via electronic system mandatory.',
 'https://www.petekamutner.am/', '2026-01-01'),

('Azerbaijan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_azn": 200000}',
 'VAT (ƏDV): 18% standard. Zero-rated: exports, international transport. Exempt: financial services, insurance, education. Registration threshold AZN 200,000. Electronic tax invoices mandatory via tax authority portal.',
 'https://www.taxes.gov.az/', '2026-01-01'),

('Bhutan', 'invoice', 'tax_rates', 'sales_tax',
 '{"no_vat": true, "sales_tax_range": "5-50", "sales_tax_standard": 20, "customs_duty_range": "0-100"}',
 'Bhutan has no VAT. Sales tax ranges from 5% to 50% depending on goods category (standard consumer goods 20%). Customs duty 0-100%. No personal income tax for most citizens. Business Income Tax 30% for companies.',
 'https://www.mof.gov.bt/', '2026-01-01'),

('Brunei', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "no_gst": true, "corporate_tax": 18.5, "customs_duty_range": "0-30", "no_personal_income_tax": true}',
 'Brunei has no VAT or GST. No personal income tax. Corporate tax 18.5%. Revenue from oil and gas. Customs duty 0-30%. Businesses must issue invoices but no indirect tax collection required.',
 'https://www.mofe.gov.bn/', '2026-01-01'),

('Cambodia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_khr": 250000000}',
 'VAT: 10% standard. Zero-rated: exports. Exempt: public postal services, medical, public transport. Registration threshold KHR 250,000,000 quarterly (approx $62,500). Monthly VAT returns required.',
 'https://www.tax.gov.kh/', '2026-01-01'),

('Georgia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_gel": 100000}',
 'VAT (დღგ): 18% standard. Zero-rated: exports, international transport. Exempt: financial services, education, medical. Registration threshold GEL 100,000 in any consecutive 12 months. E-invoicing via RS.ge portal.',
 'https://www.rs.ge/', '2026-01-01'),

('Kazakhstan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "zero": 0, "exempt": true, "registration_threshold_kzt": 20000}',
 'VAT (ҚҚС): 16% standard (increased from 12% in 2024). Zero-rated: exports, international transport. Exempt: financial services, medical. Registration threshold 20,000 MCI (Monthly Calculation Index). E-invoicing mandatory via IS ESF system.',
 'https://www.kgd.gov.kz/', '2024-01-01'),

('Kyrgyzstan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12, "zero": 0, "exempt": true, "registration_threshold_kgs": 8000000}',
 'VAT (КНС): 12% standard. Zero-rated: exports. Exempt: financial services, education, medical services. Registration threshold KGS 8,000,000 annual turnover. Electronic invoicing via tax authority system.',
 'https://www.sti.gov.kg/', '2026-01-01'),

('Laos', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_lak": 400000000}',
 'VAT: 10% standard (increased from 7% in 2022). Zero-rated: exports. Exempt: agricultural products, education, health. Registration threshold LAK 400,000,000 annual. Tax invoices must be issued in Lao language.',
 'https://www.tax.gov.la/', '2026-01-01'),

('Maldives', 'invoice', 'tax_rates', 'gst_rates',
 '{"tourism_gst": 16, "general_gst": 8, "zero": 0, "registration_threshold_mvr": 1000000}',
 'GST: 16% on tourism sector, 8% general goods and services (increased from 6% in 2023). Zero-rated: exports. Registration threshold MVR 1,000,000 annual. MIRA administers tax collection.',
 'https://www.mira.gov.mv/', '2026-01-01'),

('Mongolia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_mnt": 50000000}',
 'VAT (НӨАТ): 10% standard. Zero-rated: exports. Exempt: financial services, education, health. Registration threshold MNT 50,000,000 annual turnover. E-invoicing mandatory via eBarimt system since 2016.',
 'https://www.mta.mn/', '2026-01-01'),

('Myanmar', 'invoice', 'tax_rates', 'commercial_tax',
 '{"standard": 5, "special_goods_range": "8-80", "zero": 0, "registration_threshold_mmk": 50000000}',
 'Commercial Tax: 5% standard on goods and services. Special rates 8-80% on luxury goods, alcohol, tobacco. Zero-rated: exports. Registration threshold MMK 50,000,000. No formal VAT system.',
 'https://www.ird.gov.mm/', '2026-01-01'),

('Nepal', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 13, "zero": 0, "exempt": true, "registration_threshold_npr": 5000000}',
 'VAT: 13% standard. Zero-rated: exports. Exempt: basic food, agricultural inputs, education, health. Registration threshold NPR 5,000,000 for goods, NPR 2,000,000 for services. Fiscal year Shrawan-Ashad.',
 'https://www.ird.gov.np/', '2026-01-01'),

('North Korea', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "transaction_tax": 15, "no_data_available": true, "state_controlled_economy": true}',
 'North Korea (DPRK) has no conventional VAT system. State-controlled economy with transaction taxes on foreign enterprises (approx 15%). Limited reliable data available. International sanctions restrict most business activity.',
 'https://www.korea-dpr.com/', '2026-01-01'),

('Tajikistan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_tjs": 1000000}',
 'VAT (АИА): 15% standard (reduced from 18% in 2022). Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold TJS 1,000,000 annual. Electronic invoicing being phased in.',
 'https://www.andoz.tj/', '2026-01-01'),

('Turkmenistan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_tmt": 0}',
 'VAT (GBS): 15% standard. Zero-rated: exports. Exempt: financial services, education. All businesses must register regardless of turnover. State-controlled economy with limited private sector.',
 'https://www.minfin.gov.tm/', '2026-01-01'),

('Uzbekistan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12, "zero": 0, "exempt": true, "registration_threshold_uzs": 1000000000}',
 'VAT (QQS): 12% standard. Zero-rated: exports, international transport. Exempt: financial services, education, medical. Registration threshold UZS 1,000,000,000. E-invoicing mandatory via factura.uz system.',
 'https://www.soliq.uz/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- AFRICA (Remaining)
-- ══════════════════════════════════════════════════════

('Algeria', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "reduced": 9, "zero": 0, "registration_threshold_dzd": 0}',
 'TVA: 19% standard, 9% reduced (basic food, tourism, cultural activities). All commercial entities must register. Invoices must be in Arabic. E-invoicing system (Jibaya''tic) being implemented.',
 'https://www.mfdgi.gov.dz/', '2026-01-01'),

('Angola', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 14, "reduced": 7, "zero": 0, "exempt": true, "registration_threshold_aoa": 350000000}',
 'IVA (Imposto sobre o Valor Acrescentado): 14% standard (increased from 5% in 2024), 7% reduced (basic food basket). Registration threshold AOA 350,000,000. E-invoicing (AGT e-Factura) mandatory.',
 'https://www.agt.minfin.gov.ao/', '2026-01-01'),

('Benin', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard (WAEMU harmonized rate). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. Member of WAEMU fiscal union.',
 'https://www.impots.bj/', '2026-01-01'),

('Botswana', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 14, "zero": 0, "exempt": true, "registration_threshold_bwp": 1000000}',
 'VAT: 14% standard (reduced from 15% in 2024). Zero-rated: exports, basic food. Exempt: financial services, residential rent, education. Registration threshold BWP 1,000,000 annual turnover.',
 'https://www.burs.org.bw/', '2026-01-01'),

('Burkina Faso', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard (WAEMU harmonized). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member state.',
 'https://www.impots.gov.bf/', '2026-01-01'),

('Burundi', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_bif": 100000000}',
 'TVA: 18% standard. Zero-rated: exports. Exempt: basic food, health, education. Registration threshold BIF 100,000,000 annual turnover. EAC member state.',
 'https://www.obr.bi/', '2026-01-01'),

('Cameroon', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19.25, "reduced": 0, "zero": 0, "exempt": true, "registration_threshold_xaf": 50000000}',
 'TVA: 19.25% (17.5% + 1.75% additional communal tax). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XAF 50,000,000. CEMAC member state.',
 'https://www.impots.cm/', '2026-01-01'),

('Cape Verde', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_cve": 5000000}',
 'IVA (Imposto sobre o Valor Acrescentado): 15% standard, 10% reduced (accommodation, restaurants). Zero-rated: exports. Registration threshold CVE 5,000,000.',
 'https://www.dnre.gov.cv/', '2026-01-01'),

('Central African Republic', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "zero": 0, "exempt": true, "registration_threshold_xaf": 30000000}',
 'TVA: 19% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XAF 30,000,000. CEMAC member state with harmonized tax rules.',
 'https://www.impots-cf.org/', '2026-01-01'),

('Chad', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_xaf": 50000000}',
 'TVA: 18% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XAF 50,000,000. CEMAC member state.',
 'https://www.finances.gouv.td/', '2026-01-01'),

('Comoros', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_kmf": 50000000}',
 'TVA: 10% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold KMF 50,000,000. Relatively low rate compared to regional peers.',
 'https://www.finances.gouv.km/', '2026-01-01'),

('Congo', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18.9, "reduced": 5, "zero": 0, "exempt": true, "registration_threshold_xaf": 30000000}',
 'TVA: 18.9% standard (18% + 0.9% additional tax), 5% reduced (basic necessities). Zero-rated: exports. Registration threshold XAF 30,000,000. CEMAC member state (Republic of Congo/Congo-Brazzaville).',
 'https://www.impots.gouv.cg/', '2026-01-01'),

('Democratic Republic of the Congo', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "zero": 0, "exempt": true, "registration_threshold_cdf": 80000000}',
 'TVA: 16% standard. Zero-rated: exports. Exempt: basic food, medical, education, agricultural inputs. Registration threshold CDF 80,000,000. DGI administers tax collection.',
 'https://www.dfrdc.gouv.cd/', '2026-01-01'),

('Cote d''Ivoire', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 9, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard, 9% reduced (milk, solar equipment, pasta). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member. E-invoicing mandatory since 2024.',
 'https://www.dgi.gouv.ci/', '2026-01-01'),

('Djibouti', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_djf": 30000000}',
 'TVA: 10% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold DJF 30,000,000. Strategic trade hub with relatively low VAT rate.',
 'https://www.finances.gouv.dj/', '2026-01-01'),

('Equatorial Guinea', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_xaf": 30000000}',
 'IVA (Impuesto sobre el Valor Añadido): 15% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XAF 30,000,000. CEMAC member state. Spanish-speaking.',
 'https://www.minhacienda.gob.gq/', '2026-01-01'),

('Eritrea', 'invoice', 'tax_rates', 'sales_tax',
 '{"no_vat": true, "sales_tax": 4, "service_tax": 5, "customs_duty_range": "0-200", "turnover_tax": 2}',
 'Eritrea has no VAT. Sales tax 4% on goods, 5% on services. Turnover tax 2% for small businesses. Customs duty 0-200%. Limited formal tax infrastructure. Invoices must be issued for all commercial transactions.',
 'https://www.eritrea.gov.er/', '2026-01-01'),

('Ethiopia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_etb": 1000000}',
 'VAT: 15% standard. Zero-rated: exports. Exempt: basic food, medical, education, financial services. Registration threshold ETB 1,000,000 annual turnover. Turnover tax 2% for businesses below threshold.',
 'https://www.mor.gov.et/', '2026-01-01'),

('Gabon', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xaf": 60000000}',
 'TVA: 18% standard, 10% reduced (tourism, cement). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XAF 60,000,000. CEMAC member state.',
 'https://www.dgi.gouv.ga/', '2026-01-01'),

('Gambia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_gmd": 1000000}',
 'VAT: 15% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold GMD 1,000,000 annual turnover. GRA administers tax collection.',
 'https://www.gra.gm/', '2026-01-01'),

('Guinea', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_gnf": 500000000}',
 'TVA: 18% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold GNF 500,000,000. National tax directorate administers.',
 'https://www.dni.gov.gn/', '2026-01-01'),

('Guinea-Bissau', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'IGV (Imposto Geral sobre Vendas): 15% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member state. Portuguese-speaking.',
 'https://www.dgci.gov.gw/', '2026-01-01'),

('Lesotho', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_lsl": 850000}',
 'VAT: 15% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold LSL 850,000 annual turnover. SACU member state.',
 'https://www.lra.org.ls/', '2026-01-01'),

('Liberia', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 12, "zero": 0, "exempt": true, "registration_threshold_lrd": 5000000}',
 'GST (Goods and Services Tax): 12% standard (per PwC 2026 review). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold LRD 5,000,000. Liberia Revenue Authority administers.',
 'https://www.lra.gov.lr/', '2026-01-01'),

('Libya', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "stamp_duty": 2, "customs_duty_range": "0-40", "corporate_tax": 20, "jihad_tax": 4}',
 'Libya has no VAT system. Stamp duty 2% on transactions. Customs duty 0-40%. Corporate tax 20%. Jihad tax 4% surcharge on corporate profits. Limited formal tax infrastructure due to political instability.',
 'https://www.tax.gov.ly/', '2026-01-01'),

('Madagascar', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "zero": 0, "exempt": true, "registration_threshold_mga": 400000000}',
 'TVA: 20% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold MGA 400,000,000 annual turnover. Invoices must include NIF (tax identification number).',
 'https://www.impots.mg/', '2026-01-01'),

('Malawi', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16.5, "zero": 0, "exempt": true, "registration_threshold_mwk": 25000000}',
 'VAT: 16.5% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold MWK 25,000,000 annual turnover. MRA administers.',
 'https://www.mra.mw/', '2026-01-01'),

('Mali', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard (WAEMU harmonized). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member state.',
 'https://www.dgi.gouv.ml/', '2026-01-01'),

('Mauritania', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "reduced": 0, "zero": 0, "exempt": true, "registration_threshold_mru": 30000000}',
 'TVA: 16% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold MRU 30,000,000. Arabic and French used for official documents.',
 'https://www.impots.gov.mr/', '2026-01-01'),

('Mauritius', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_mur": 6000000}',
 'VAT: 15% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical, residential rent. Registration threshold MUR 6,000,000 annual turnover. MRA administers. E-filing mandatory.',
 'https://www.mra.mu/', '2026-01-01'),

('Mozambique', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "zero": 0, "exempt": true, "registration_threshold_mzn": 2500000}',
 'IVA (Imposto sobre o Valor Acrescentado): 16% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold MZN 2,500,000 annual. Portuguese-speaking. E-invoicing being implemented.',
 'https://www.at.gov.mz/', '2026-01-01'),

('Namibia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_nad": 500000}',
 'VAT: 15% standard. Zero-rated: exports, basic food, fuel. Exempt: financial services, education, medical, residential rent. Registration threshold NAD 500,000 annual turnover. SACU member.',
 'https://www.nra.org.na/', '2026-01-01'),

('Niger', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 19% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member state with harmonized fiscal rules.',
 'https://www.impots.ne/', '2026-01-01'),

('Rwanda', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_rwf": 20000000}',
 'VAT: 18% standard. Zero-rated: exports, international transport. Exempt: financial services, education, medical. Registration threshold RWF 20,000,000 annual. E-invoicing (EBM) mandatory for all VAT-registered businesses.',
 'https://www.rra.gov.rw/', '2026-01-01'),

('Sao Tome and Principe', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 5, "zero": 0, "exempt": true, "registration_threshold_std": 0}',
 'IVA: 15% standard, 5% reduced (basic food, tourism). Zero-rated: exports. All commercial entities must register. Portuguese-speaking island nation.',
 'https://www.financas.gov.st/', '2026-01-01'),

('Senegal', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard, 10% reduced (tourism, hospitality). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member. E-invoicing being rolled out.',
 'https://www.impotsetdomaines.gouv.sn/', '2026-01-01'),

('Seychelles', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_scr": 5000000}',
 'VAT: 15% standard. Zero-rated: exports. Exempt: financial services, education, medical, residential rent. Registration threshold SCR 5,000,000 annual turnover. SRC administers.',
 'https://www.src.gov.sc/', '2026-01-01'),

('Sierra Leone', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_sle": 350000000}',
 'GST (Goods and Services Tax): 15% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold SLE 350,000,000. NRA administers tax collection.',
 'https://www.nra.gov.sl/', '2026-01-01'),

('Somalia', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "sales_tax": 5, "customs_duty_range": "0-50", "corporate_tax": 0}',
 'Somalia has no formal VAT system. Sales tax approximately 5% in areas with functioning government. Customs duty 0-50%. No corporate income tax currently enforced. Tax administration limited due to ongoing instability.',
 'https://www.mof.gov.so/', '2026-01-01'),

('South Sudan', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "sales_tax": 18, "customs_duty_range": "0-40", "corporate_tax": 25}',
 'South Sudan has no formal VAT. Sales tax 18% on goods and services. Customs duty 0-40%. Corporate tax 25%. Tax administration still developing since independence in 2011. NRA established 2020.',
 'https://www.nra.gov.ss/', '2026-01-01'),

('Sudan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 17, "zero": 0, "exempt": true, "registration_threshold_sdg": 0}',
 'VAT: 17% standard. Zero-rated: exports. Exempt: basic food, medical, education. All businesses must register. Arabic is official language for invoices. Tax administration affected by ongoing conflict.',
 'https://www.customs.gov.sd/', '2026-01-01'),

('Eswatini', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_szl": 500000}',
 'VAT: 15% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical, residential rent. Registration threshold SZL 500,000 annual turnover. SACU member. Formerly Swaziland.',
 'https://www.sra.org.sz/', '2026-01-01'),

('Togo', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_xof": 50000000}',
 'TVA: 18% standard (WAEMU harmonized). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XOF 50,000,000. WAEMU member state.',
 'https://www.otr.tg/', '2026-01-01'),

('Tunisia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "reduced_13": 13, "reduced_7": 7, "zero": 0, "registration_threshold_tnd": 100000}',
 'TVA: 19% standard, 13% reduced (hospitality, transport), 7% reduced (food, pharmaceuticals). Zero-rated: exports. Registration threshold TND 100,000. E-invoicing being phased in. Arabic/French bilingual invoices.',
 'https://www.finances.gov.tn/', '2026-01-01'),

('Uganda', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "exempt": true, "registration_threshold_ugx": 150000000}',
 'VAT: 18% standard. Zero-rated: exports, unprocessed food. Exempt: financial services, education, medical, insurance. Registration threshold UGX 150,000,000 annual. URA administers. E-invoicing (EFRIS) mandatory.',
 'https://www.ura.go.ug/', '2026-01-01'),

('Zambia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "zero": 0, "exempt": true, "registration_threshold_zmw": 800000}',
 'VAT: 16% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold ZMW 800,000 annual turnover. ZRA administers. Smart invoicing system being implemented.',
 'https://www.zra.org.zm/', '2026-01-01'),

('Zimbabwe', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_usd": 40000}',
 'VAT: 15% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold USD 40,000 annual. ZIMRA administers. Fiscalised electronic devices mandatory.',
 'https://www.zimra.co.zw/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- AMERICAS (Remaining)
-- ══════════════════════════════════════════════════════

('Bahamas', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_bsd": 100000}',
 'VAT: 10% standard (increased from 7.5% in 2022). Zero-rated: exports. Exempt: financial services, medical, education. Registration threshold BSD 100,000 annual. No income tax. VAT is primary revenue source.',
 'https://www.bahamasbudget.gov.bs/', '2026-01-01'),

('Barbados', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 17.5, "reduced": 7.5, "zero": 0, "exempt": true, "registration_threshold_bbd": 200000}',
 'VAT: 17.5% standard, 7.5% reduced (accommodation, tour operators). Zero-rated: exports, basic food. Exempt: financial services, medical, education. Registration threshold BBD 200,000 annual.',
 'https://www.bra.gov.bb/', '2026-01-01'),

('Belize', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 12.5, "zero": 0, "exempt": true, "registration_threshold_bzd": 75000}',
 'GST (General Sales Tax): 12.5% standard. Zero-rated: exports, basic food. Exempt: financial services, medical, education. Registration threshold BZD 75,000 annual turnover.',
 'https://www.bts.gov.bz/', '2026-01-01'),

('Bolivia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 13, "zero": 0, "exempt": true, "registration_threshold_bob": 0}',
 'IVA (Impuesto al Valor Agregado): 13% standard (effective rate, embedded in price). Zero-rated: exports. All businesses must register. Invoices must be authorized by SIN (Servicio de Impuestos Nacionales). Dosificación system for invoice numbering.',
 'https://www.impuestos.gob.bo/', '2026-01-01'),

('Costa Rica', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 13, "reduced_4": 4, "reduced_2": 2, "reduced_1": 1, "zero": 0, "registration_threshold_crc": 0}',
 'IVA: 13% standard, 4% (health services, insurance), 2% (pharmaceuticals, education supplies), 1% (basic food basket). All businesses must register. E-invoicing mandatory via Hacienda system since 2018.',
 'https://www.hacienda.go.cr/', '2026-01-01'),

('Cuba', 'invoice', 'tax_rates', 'tax_regime',
 '{"no_vat": true, "sales_tax": 10, "services_tax": 5, "corporate_tax": 35, "state_controlled": true}',
 'Cuba has no VAT. Sales tax 10% on retail goods, 5% on services. Corporate tax 35%. State-controlled economy with limited private sector. Self-employed (cuentapropistas) pay progressive income tax.',
 'https://www.onat.gob.cu/', '2026-01-01'),

('Dominican Republic', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced": 16, "zero": 0, "exempt": true, "registration_threshold_dop": 0}',
 'ITBIS (Impuesto a la Transferencia de Bienes Industrializados y Servicios): 18% standard, 16% reduced (certain food products). Zero-rated: exports. All businesses must register. E-invoicing (e-CF) mandatory since 2023.',
 'https://www.dgii.gov.do/', '2026-01-01'),

('Ecuador', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_usd": 0}',
 'IVA: 15% standard (increased from 12% in 2024). Zero-rated: basic food, health, education. All businesses must register. E-invoicing mandatory via SRI system. USD is official currency.',
 'https://www.sri.gob.ec/', '2026-01-01'),

('El Salvador', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 13, "zero": 0, "exempt": true, "registration_threshold_usd": 0}',
 'IVA: 13% standard. Zero-rated: exports. Exempt: health, education, basic food. All businesses must register. E-invoicing (DTE) mandatory since 2024. USD is official currency alongside Bitcoin.',
 'https://www.mh.gob.sv/', '2026-01-01'),

('Guatemala', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12, "zero": 0, "exempt": true, "registration_threshold_gtq": 0}',
 'IVA: 12% standard. Zero-rated: exports. Exempt: financial services, education, medical. All businesses must register. FEL (Factura Electrónica en Línea) e-invoicing mandatory for all taxpayers.',
 'https://portal.sat.gob.gt/', '2026-01-01'),

('Guyana', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 14, "zero": 0, "exempt": true, "registration_threshold_gyd": 15000000}',
 'VAT: 14% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold GYD 15,000,000 annual turnover. GRA administers.',
 'https://www.gra.gov.gy/', '2026-01-01'),

('Haiti', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_htg": 5000000}',
 'TCA (Taxe sur le Chiffre d''Affaires): 10% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold HTG 5,000,000. French/Creole bilingual invoices.',
 'https://www.dgi.gouv.ht/', '2026-01-01'),

('Honduras', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 18, "zero": 0, "exempt": true, "registration_threshold_hnl": 0}',
 'ISV (Impuesto Sobre Ventas): 15% standard, 18% on alcohol, tobacco, and luxury goods. Zero-rated: exports. Exempt: basic food, medical, education. All businesses must register. E-invoicing being implemented.',
 'https://www.sar.gob.hn/', '2026-01-01'),

('Jamaica', 'invoice', 'tax_rates', 'gct_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_jmd": 10000000}',
 'GCT (General Consumption Tax): 15% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold JMD 10,000,000 annual. TAJ administers. E-invoicing being phased in.',
 'https://www.jamaicatax.gov.jm/', '2026-01-01'),

('Nicaragua', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 7, "zero": 0, "exempt": true, "registration_threshold_nio": 0}',
 'IVA: 15% standard, 7% reduced (basic food basket). Zero-rated: exports. Exempt: health, education. All businesses must register. DGI administers. Invoices must be pre-authorized.',
 'https://www.dgi.gob.ni/', '2026-01-01'),

('Panama', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 7, "reduced": 10, "reduced_15": 15, "zero": 0, "exempt": true, "registration_threshold_pab": 36000}',
 'ITBMS (Impuesto de Transferencia de Bienes Muebles y Servicios): 7% standard, 10% (alcohol, accommodation), 15% (tobacco). Zero-rated: exports. Registration threshold PAB 36,000 annual. E-invoicing mandatory since 2022.',
 'https://www.dgi.mef.gob.pa/', '2026-01-01'),

('Paraguay', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "reduced": 5, "zero": 0, "exempt": true, "registration_threshold_pyg": 0}',
 'IVA: 10% standard, 5% reduced (basic food, pharmaceuticals, interest). Zero-rated: exports. All businesses must register. E-invoicing (SIFEN) mandatory since 2024. SET administers.',
 'https://www.set.gov.py/', '2026-01-01'),

('Suriname', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_srd": 500000}',
 'BTW (Belasting over de Toegevoegde Waarde): 10% standard. Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold SRD 500,000 annual. Dutch-speaking. Implemented 2023.',
 'https://www.belastingdienst.sr/', '2026-01-01'),

('Trinidad and Tobago', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12.5, "zero": 0, "exempt": true, "registration_threshold_ttd": 500000}',
 'VAT: 12.5% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold TTD 500,000 annual turnover. BIR administers.',
 'https://www.ird.gov.tt/', '2026-01-01'),

('Venezuela', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "reduced": 8, "additional_luxury": 15, "zero": 0, "exempt": true, "registration_threshold_ves": 0}',
 'IVA: 16% standard, 8% reduced (certain food), additional 15% luxury tax. Zero-rated: exports. All businesses must register. SENIAT administers. Invoices must comply with fiscal machine requirements.',
 'https://www.seniat.gob.ve/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- OCEANIA (Remaining)
-- ══════════════════════════════════════════════════════

('Fiji', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_fjd": 100000}',
 'VAT: 15% standard. Zero-rated: exports, basic food. Exempt: financial services, education, medical. Registration threshold FJD 100,000 annual turnover. FRCS administers.',
 'https://www.frcs.org.fj/', '2026-01-01'),

('Papua New Guinea', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_pgk": 250000}',
 'GST: 10% standard. Zero-rated: exports, medical supplies. Exempt: financial services, education, medical. Registration threshold PGK 250,000 annual turnover. IRC administers.',
 'https://www.irc.gov.pg/', '2026-01-01'),

('Samoa', 'invoice', 'tax_rates', 'vagst_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_wst": 130000}',
 'VAGST (Value Added Goods and Services Tax): 15% standard. Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold WST 130,000 annual. MfR administers.',
 'https://www.revenue.gov.ws/', '2026-01-01'),

('Solomon Islands', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 10, "zero": 0, "exempt": true, "registration_threshold_sbd": 300000}',
 'GST (Goods and Services Tax): 10% standard. Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold SBD 300,000 annual turnover. Implemented 2024.',
 'https://www.ird.gov.sb/', '2026-01-01'),

('Tonga', 'invoice', 'tax_rates', 'consumption_tax',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_top": 100000}',
 'CT (Consumption Tax): 15% standard. Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold TOP 100,000 annual turnover. Ministry of Revenue and Customs administers.',
 'https://www.revenue.gov.to/', '2026-01-01'),

('Vanuatu', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "exempt": true, "registration_threshold_vuv": 4000000}',
 'VAT: 15% standard. Zero-rated: exports. Exempt: financial services, education, medical. Registration threshold VUV 4,000,000 quarterly turnover. No income tax — VAT is primary revenue source.',
 'https://www.customsinlandrevenue.gov.vu/', '2026-01-01'),

-- ══════════════════════════════════════════════════════
-- CARIBBEAN / SMALL STATES
-- ══════════════════════════════════════════════════════

('Antigua and Barbuda', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 14, "zero": 0, "exempt": true, "registration_threshold_xcd": 300000}',
 'ABST (Antigua and Barbuda Sales Tax): 15% standard, 14% reduced (accommodation). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XCD 300,000 annual.',
 'https://www.ird.gov.ag/', '2026-01-01'),

('Dominica', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xcd": 250000}',
 'VAT: 15% standard, 10% reduced (accommodation, tour operators). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XCD 250,000 annual turnover.',
 'https://www.ird.gov.dm/', '2026-01-01'),

('Grenada', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xcd": 120000}',
 'VAT: 15% standard, 10% reduced (accommodation, diving). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XCD 120,000 annual. IRD administers.',
 'https://www.ird.gov.gd/', '2026-01-01'),

('Saint Kitts and Nevis', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 17, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xcd": 150000}',
 'VAT: 17% standard, 10% reduced (accommodation, restaurants). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XCD 150,000 annual. IRD administers.',
 'https://www.ird.kn/', '2026-01-01'),

('Saint Lucia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12.5, "reduced": 10, "zero": 0, "exempt": true, "registration_threshold_xcd": 400000}',
 'VAT: 12.5% standard, 10% reduced (accommodation). Zero-rated: exports, basic food. Exempt: financial services, medical, education. Registration threshold XCD 400,000 annual. IRD administers.',
 'https://www.ird.gov.lc/', '2026-01-01'),

('Saint Vincent and the Grenadines', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "reduced": 11, "zero": 0, "exempt": true, "registration_threshold_xcd": 300000}',
 'VAT: 16% standard, 11% reduced (accommodation). Zero-rated: exports. Exempt: basic food, medical, education. Registration threshold XCD 300,000 annual. IRD administers.',
 'https://www.ird.gov.vc/', '2026-01-01')

-- ══════════════════════════════════════════════════════
-- ON CONFLICT — Safe re-run (upsert)
-- ══════════════════════════════════════════════════════

ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();


-- ══════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ══════════════════════════════════════════════════════

-- Count total countries in compliance_knowledge
SELECT 'Total countries in compliance_knowledge' AS metric,
       COUNT(DISTINCT country) AS value
FROM compliance_knowledge
WHERE document_type = 'invoice'
  AND category = 'tax_rates';

-- Count countries added by this migration (global expansion set)
SELECT 'Countries added by global expansion migration' AS metric,
       COUNT(DISTINCT country) AS value
FROM compliance_knowledge
WHERE document_type = 'invoice'
  AND category = 'tax_rates'
  AND country IN (
    'Albania', 'Andorra', 'Belarus', 'Bosnia and Herzegovina', 'Kosovo',
    'Moldova', 'Monaco', 'Montenegro', 'North Macedonia', 'San Marino', 'Serbia',
    'Bahrain', 'Iraq', 'Iran', 'Jordan', 'Kuwait', 'Lebanon', 'Oman', 'Qatar', 'Syria',
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bhutan', 'Brunei', 'Cambodia', 'Georgia',
    'Kazakhstan', 'Kyrgyzstan', 'Laos', 'Maldives', 'Mongolia', 'Myanmar', 'Nepal',
    'North Korea', 'Tajikistan', 'Turkmenistan', 'Uzbekistan',
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon',
    'Cape Verde', 'Central African Republic', 'Chad', 'Comoros', 'Congo',
    'Democratic Republic of the Congo', 'Cote d''Ivoire', 'Djibouti',
    'Equatorial Guinea', 'Eritrea', 'Ethiopia', 'Gabon', 'Gambia', 'Guinea',
    'Guinea-Bissau', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali',
    'Mauritania', 'Mauritius', 'Mozambique', 'Namibia', 'Niger', 'Rwanda',
    'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
    'South Sudan', 'Sudan', 'Eswatini', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
    'Bahamas', 'Barbados', 'Belize', 'Bolivia', 'Costa Rica', 'Cuba',
    'Dominican Republic', 'Ecuador', 'El Salvador', 'Guatemala', 'Guyana', 'Haiti',
    'Honduras', 'Jamaica', 'Nicaragua', 'Panama', 'Paraguay', 'Suriname',
    'Trinidad and Tobago', 'Venezuela',
    'Fiji', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tonga', 'Vanuatu',
    'Antigua and Barbuda', 'Dominica', 'Grenada', 'Saint Kitts and Nevis',
    'Saint Lucia', 'Saint Vincent and the Grenadines'
  );

-- Show sample of newly added countries with their rates
SELECT country, requirement_key,
       requirement_value::jsonb->>'standard' AS standard_rate,
       LEFT(description, 80) AS description_preview
FROM compliance_knowledge
WHERE document_type = 'invoice'
  AND category = 'tax_rates'
  AND country IN ('Albania', 'Bahrain', 'Cambodia', 'Ethiopia', 'Costa Rica', 'Fiji', 'Grenada')
ORDER BY country;
