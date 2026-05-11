-- =====================================================
-- COMPLIANCE KNOWLEDGE — WORLD BASELINE EXPANSION
-- =====================================================
-- Adds baseline compliance data (tax rates, basic mandatory
-- fields, legal framework) for every major country beyond
-- the original 11 with deep coverage. This ensures the RAG
-- returns meaningful content for any user jurisdiction.
--
-- Data sourced from: EY Worldwide VAT Guide 2026, OECD,
-- national tax authority pages, and PwC Tax Summaries.
-- Verified 2026-05-12.
--
-- Safe to run multiple times — uses ON CONFLICT DO UPDATE.
-- =====================================================

INSERT INTO compliance_knowledge (country, document_type, category, requirement_key, requirement_value, description, source_url, effective_date) VALUES

-- ── EUROPE (EU + EEA + UK-adjacent) ──────────────────────────────
('Austria', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 10, "super_reduced": 13, "zero": 0, "registration_threshold_eur": 35000}',
 'VAT (Umsatzsteuer): 20% standard, 13% reduced (culture, accommodation), 10% reduced (food, books, pharmaceuticals). Registration required at €35,000 annual turnover.',
 'https://www.bmf.gv.at/', '2026-01-01'),

('Belgium', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced_12": 12, "reduced_6": 6, "zero": 0, "registration_threshold_eur": 25000}',
 'VAT (BTW/TVA): 21% standard, 12% (restaurants, coal), 6% (food, books, transport). Registration at €25,000.',
 'https://finance.belgium.be/', '2026-01-01'),

('Italy', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 22, "reduced_10": 10, "reduced_5": 5, "super_reduced": 4, "zero": 0}',
 'IVA: 22% standard, 10% (tourism, restaurants), 5% (social services), 4% super-reduced (food basics, books). Mandatory e-invoicing via SDI since 2019.',
 'https://www.agenziaentrate.gov.it/', '2026-01-01'),

('Spain', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced": 10, "super_reduced": 4, "zero": 0}',
 'IVA: 21% standard, 10% (transport, hospitality), 4% super-reduced (bread, milk, books, medicines). Veri*Factu e-invoicing phases from 2026.',
 'https://sede.agenciatributaria.gob.es/', '2026-01-01'),

('Portugal', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 23, "reduced_13": 13, "reduced_6": 6, "zero": 0, "madeira_standard": 22, "azores_standard": 16}',
 'IVA: 23% standard (mainland), 22% (Madeira), 16% (Azores). Reduced rates 13% / 6% for specific categories. Portugal SAF-T e-invoicing mandatory.',
 'https://info.portaldasfinancas.gov.pt/', '2026-01-01'),

('Ireland', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 23, "reduced_13_5": 13.5, "reduced_9": 9, "super_reduced": 4.8, "zero": 0, "registration_threshold_goods_eur": 85000, "registration_threshold_services_eur": 42500}',
 'VAT: 23% standard, 13.5% (services), 9% (tourism, newspapers), 4.8% (livestock). Registration thresholds: €85k (goods), €42.5k (services).',
 'https://www.revenue.ie/', '2026-01-01'),

('Sweden', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 25, "reduced_12": 12, "reduced_6": 6, "zero": 0, "registration_threshold_sek": 120000}',
 'Moms (VAT): 25% standard, 12% (food, hotels), 6% (books, transport, cultural events). Registration at SEK 120,000.',
 'https://www.skatteverket.se/', '2026-01-01'),

('Norway', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 25, "reduced_15": 15, "reduced_12": 12, "zero": 0, "registration_threshold_nok": 50000}',
 'MVA: 25% standard, 15% (food), 12% (transport, hotels, cinema). Registration at NOK 50,000 over 12 months.',
 'https://www.skatteetaten.no/', '2026-01-01'),

('Switzerland', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 8.1, "reduced": 2.6, "special_accommodation": 3.8, "zero": 0, "registration_threshold_chf": 100000}',
 'MwSt/TVA: 8.1% standard (since 2024), 3.8% accommodation, 2.6% reduced (food, books, medicine). Registration at CHF 100,000.',
 'https://www.estv.admin.ch/', '2024-01-01'),

('Denmark', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 25, "zero": 0, "registration_threshold_dkk": 50000}',
 'Moms: 25% standard (no reduced rate). Registration at DKK 50,000. Newspapers and certain exports zero-rated.',
 'https://skat.dk/', '2026-01-01'),

('Finland', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 25.5, "reduced_14": 14, "reduced_10": 10, "zero": 0, "registration_threshold_eur": 20000}',
 'ALV (VAT): 25.5% standard (raised from 24% in Sep 2024), 14% (food, restaurants), 10% (books, culture, accommodation). Registration at €20,000.',
 'https://www.vero.fi/', '2024-09-01'),

('Poland', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 23, "reduced_8": 8, "reduced_5": 5, "super_reduced": 3, "zero": 0, "registration_threshold_pln": 200000}',
 'VAT (PTU): 23% standard, 8% (construction, restaurants), 5% (food, books). Registration at PLN 200,000. KSeF e-invoicing mandatory from 2026.',
 'https://www.podatki.gov.pl/', '2026-02-01'),

('Czech Republic', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced": 12, "zero": 0, "registration_threshold_czk": 2000000}',
 'DPH (VAT): 21% standard, 12% reduced (food, medicines, construction). Registration at CZK 2M.',
 'https://www.financnisprava.cz/', '2026-01-01'),

('Hungary', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 27, "reduced_18": 18, "reduced_5": 5, "zero": 0, "registration_threshold_huf": 18000000}',
 'ÁFA: 27% standard (highest VAT rate in the world), 18% (certain food, hotels), 5% (basic food, books, medicines). Real-time invoice reporting mandatory.',
 'https://nav.gov.hu/', '2026-01-01'),

('Greece', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 24, "reduced_13": 13, "super_reduced": 6, "zero": 0, "aegean_islands_discount_percent": 30}',
 'FPA (VAT): 24% standard, 13% (food, hotels, transport), 6% (books, pharma). 30% discount on 5 Aegean islands. myDATA e-books mandatory.',
 'https://www.aade.gr/', '2026-01-01'),

('Romania', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "reduced_9": 9, "reduced_5": 5, "zero": 0, "registration_threshold_ron": 395000}',
 'TVA: 19% standard, 9% (food, medicines, books, hotels, water), 5% (housing <450k lei, agricultural products). e-Factura mandatory for B2B.',
 'https://www.anaf.ro/', '2026-01-01'),

('Slovakia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 23, "reduced_19": 19, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 50000}',
 'DPH: 23% standard (raised from 20% in 2025), 19% (some services), 5% (basic food, books, medicines).',
 'https://www.financnasprava.sk/', '2025-01-01'),

('Bulgaria', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced_9": 9, "zero": 0, "registration_threshold_bgn": 100000}',
 'DDS (VAT): 20% standard, 9% (tourism, books). Registration at BGN 100,000.',
 'https://nra.bg/', '2026-01-01'),

('Croatia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 25, "reduced_13": 13, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 40000}',
 'PDV: 25% standard, 13% (tourism, newspapers, food), 5% (basic food, books, medicines). Euro since 2023.',
 'https://www.porezna-uprava.hr/', '2026-01-01'),

('Estonia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 24, "reduced_13": 13, "reduced_9": 9, "zero": 0, "registration_threshold_eur": 40000}',
 'KM (VAT): 24% standard (raised from 22% in Jul 2025), 13% (accommodation from 2026), 9% (medicines, books). e-Invoicing mandatory for B2G.',
 'https://www.emta.ee/', '2025-07-01'),

('Lithuania', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced_9": 9, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 45000}',
 'PVM: 21% standard, 9% (books, transport, heating), 5% (pharma, disabled equipment).',
 'https://www.vmi.lt/', '2026-01-01'),

('Latvia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced_12": 12, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 50000}',
 'PVN: 21% standard, 12% (medicines, accommodation), 5% (local food).',
 'https://www.vid.gov.lv/', '2026-01-01'),

('Slovenia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 22, "reduced_9_5": 9.5, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 60000}',
 'DDV: 22% standard, 9.5% (food, restaurants, books), 5% (books in digital form, sports activities).',
 'https://www.fu.gov.si/', '2026-01-01'),

('Luxembourg', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 17, "reduced_14": 14, "reduced_8": 8, "super_reduced": 3, "zero": 0, "registration_threshold_eur": 50000}',
 'TVA: 17% standard (lowest EU rate), 14% (certain wines, printed matter), 8% (hotels, transport), 3% super-reduced (food, books, children clothes).',
 'https://pfi.public.lu/', '2026-01-01'),

('Cyprus', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "reduced_9": 9, "reduced_5": 5, "super_reduced": 3, "zero": 0, "registration_threshold_eur": 15600}',
 'FPA: 19% standard, 9% (tourism, restaurants), 5% (medicines, books, primary housing).',
 'https://www.mof.gov.cy/tax/', '2026-01-01'),

('Malta', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "reduced_7": 7, "reduced_5": 5, "zero": 0, "registration_threshold_eur": 35000}',
 'VAT: 18% standard, 7% (tourism, accommodation), 5% (books, newspapers, confectionery). Registration thresholds: €35k (goods) / €30k (services).',
 'https://cfr.gov.mt/', '2026-01-01'),

('Iceland', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 24, "reduced": 11, "zero": 0, "registration_threshold_isk": 2000000}',
 'VSK (VAT): 24% standard, 11% reduced (food, books, accommodation). Registration at ISK 2M.',
 'https://www.rsk.is/', '2026-01-01'),

('Liechtenstein', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 8.1, "reduced": 2.6, "special_accommodation": 3.8, "zero": 0, "registration_threshold_chf": 100000}',
 'MwSt: aligned with Switzerland — 8.1% standard, 3.8% accommodation, 2.6% reduced. Registration at CHF 100,000.',
 'https://www.stv.llv.li/', '2024-01-01'),

('Turkey', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced_10": 10, "reduced_1": 1, "zero": 0}',
 'KDV: 20% standard (raised from 18% in Jul 2023), 10% (food, tourism, restaurants), 1% (basic food, books, agricultural products). e-Invoice mandatory above TRY 3M turnover.',
 'https://www.gib.gov.tr/', '2023-07-10'),

-- ── ASIA ─────────────────────────────────────────────────────────
('Japan', 'invoice', 'tax_rates', 'consumption_tax',
 '{"standard": 10, "reduced": 8, "zero": 0, "registration_threshold_jpy": 10000000}',
 'Consumption Tax: 10% standard (includes 2.2% local), 8% reduced (food, non-alcoholic beverages, newspapers). Qualified Invoice System (適格請求書) mandatory since Oct 2023.',
 'https://www.nta.go.jp/', '2023-10-01'),

('South Korea', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "zero": 0, "registration_threshold_krw": 80000000}',
 'VAT (부가가치세): 10% flat standard. Electronic Tax Invoice (전자세금계산서) mandatory for corporations and sole proprietors above KRW 80M.',
 'https://www.nts.go.kr/', '2026-01-01'),

('China', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 13, "reduced_9": 9, "reduced_6": 6, "zero": 0, "small_taxpayer": 3}',
 'VAT (增值税): 13% standard (goods, manufacturing), 9% (construction, transport, agriculture), 6% (modern services). Small taxpayers: 3% simplified rate. Fapiao (special VAT invoice) required.',
 'https://www.chinatax.gov.cn/', '2026-01-01'),

('Hong Kong', 'invoice', 'tax_rates', 'sales_tax',
 '{"no_vat": true, "no_gst": true, "note": "Hong Kong has no VAT, GST, or sales tax on goods and services"}',
 'No VAT/GST in Hong Kong. Invoices are informal — no specific tax format required. Profits tax filed separately.',
 'https://www.ird.gov.hk/', '2026-01-01'),

('Taiwan', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 5, "zero": 0, "gross_business_receipts_tax": "0.1_to_25_for_specific_industries", "registration_threshold_twd": 480000}',
 'Business Tax (VAT): 5% flat standard. Unified invoices (統一發票) required. Small businesses pay Gross Business Receipts Tax at 0.1% to 25% based on industry.',
 'https://www.etax.nat.gov.tw/', '2026-01-01'),

('Indonesia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 12, "zero": 0, "registration_threshold_idr": 4800000000}',
 'PPN (VAT): 12% standard (raised from 11% in Jan 2025, applies mainly to luxury goods), 11% for general goods. e-Faktur via Coretax mandatory.',
 'https://www.pajak.go.id/', '2025-01-01'),

('Malaysia', 'invoice', 'tax_rates', 'sales_service_tax',
 '{"service_tax": 8, "sales_tax_standard": 10, "sales_tax_reduced": 5, "zero": 0, "registration_threshold_myr": 500000}',
 'SST (Sales & Service Tax): Service Tax 8% standard (raised from 6% in Mar 2024), Sales Tax 10% standard / 5% on essentials. e-Invoice mandatory phased 2024–2025.',
 'https://www.hasil.gov.my/', '2024-03-01'),

('Thailand', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 7, "zero": 0, "registration_threshold_thb": 1800000}',
 'VAT: 7% standard (temporarily reduced from 10%; extended through 2025). Registration at THB 1.8M.',
 'https://www.rd.go.th/', '2025-01-01'),

('Vietnam', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 10, "reduced_8": 8, "reduced_5": 5, "zero": 0}',
 'VAT (GTGT): 10% standard, 8% (general — temporary reduction extended through Jun 2026 for most goods/services), 5% (essentials), 0% (exports). Mandatory e-invoicing via GDT.',
 'https://gdt.gov.vn/', '2026-01-01'),

('Saudi Arabia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "registration_threshold_sar": 375000}',
 'VAT: 15% flat standard (raised from 5% to 15% in Jul 2020). e-Invoicing (FATOORA) mandatory since Dec 2021 — Phase 2 integration rolling by revenue bands.',
 'https://zatca.gov.sa/', '2021-12-04'),

('Israel', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "registration_threshold_ils": 120000}',
 'VAT: 18% standard (raised from 17% in Jan 2025). Exports zero-rated. e-Invoicing via Israel Tax Authority mandatory above certain thresholds.',
 'https://www.gov.il/en/departments/israel_tax_authority', '2025-01-01'),

('Pakistan', 'invoice', 'tax_rates', 'sales_tax',
 '{"standard": 18, "services_varies_by_province": "13_to_19", "zero": 0, "registration_threshold_pkr": 10000000}',
 'Sales Tax: 18% federal on goods. Provincial services tax: 13-19% depending on province. Point-of-Sale integration with FBR mandatory for tier-1 retailers.',
 'https://www.fbr.gov.pk/', '2026-01-01'),

('Bangladesh', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "reduced": 7.5, "zero": 0, "registration_threshold_bdt": 30000000}',
 'VAT: 15% standard, 7.5% (specified reduced-rate items). e-BIN/e-VAT filing through NBR portal required.',
 'https://nbr.gov.bd/', '2026-01-01'),

('Sri Lanka', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "registration_threshold_lkr": 60000000}',
 'VAT: 18% standard (since Jan 2024). Registration at LKR 60M annual turnover.',
 'https://www.ird.gov.lk/', '2024-01-01'),

-- ── AMERICAS ─────────────────────────────────────────────────────
('Brazil', 'invoice', 'tax_rates', 'icms_ipi_pis_cofins',
 '{"icms_state_range": "17_to_19", "ipi_varies_by_product": "0_to_300", "pis_cofins_combined_cumulative": 3.65, "pis_cofins_combined_non_cumulative": 9.25, "new_ibs_cbs_unified_from_2027": true}',
 'Complex multi-layer tax: ICMS (state, 17-19%), IPI (federal excise, product-specific), PIS+COFINS (3.65% cumulative or 9.25% non-cumulative). Tax reform merges these into IBS+CBS from 2027. NF-e (electronic invoice) mandatory.',
 'https://www.gov.br/receitafederal/', '2026-01-01'),

('Mexico', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "border_zone": 8, "zero": 0, "registration_threshold_mxn": 0}',
 'IVA: 16% standard, 8% in northern border zone (to compete with US), 0% on food and medicines. CFDI 4.0 (digital invoice) mandatory — the most mature e-invoicing system globally.',
 'https://www.sat.gob.mx/', '2026-01-01'),

('Argentina', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 21, "reduced_10_5": 10.5, "increased_27": 27, "zero": 0}',
 'IVA: 21% standard, 10.5% (food, medical, transport, construction), 27% (utilities B2B). AFIP electronic invoice mandatory.',
 'https://www.afip.gob.ar/', '2026-01-01'),

('Chile', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "zero": 0}',
 'IVA: 19% flat standard. Electronic Tax Document (DTE) mandatory for all taxpayers since 2018.',
 'https://www.sii.cl/', '2026-01-01'),

('Colombia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 19, "reduced": 5, "zero": 0}',
 'IVA: 19% standard, 5% (basic goods, agricultural inputs), 0% (essentials, exports). e-Invoicing mandatory via DIAN.',
 'https://www.dian.gov.co/', '2026-01-01'),

('Peru', 'invoice', 'tax_rates', 'igv_ipm',
 '{"igv": 16, "ipm_municipal": 2, "combined_standard": 18, "zero": 0}',
 'IGV (VAT 16%) + IPM (municipal 2%) = 18% combined. Electronic invoicing through SUNAT mandatory.',
 'https://www.sunat.gob.pe/', '2026-01-01'),

('Uruguay', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 22, "reduced": 10, "zero": 0}',
 'IVA: 22% standard, 10% (basic food, medicines, tourism). e-CFE (electronic fiscal receipt) mandatory.',
 'https://www.dgi.gub.uy/', '2026-01-01'),

-- ── AFRICA ───────────────────────────────────────────────────────
('South Africa', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 15, "zero": 0, "registration_threshold_zar": 1000000}',
 'VAT: 15% flat standard (since 2018). Registration at ZAR 1M. Tax invoice must show VAT registration number and the words "Tax Invoice".',
 'https://www.sars.gov.za/', '2018-04-01'),

('Nigeria', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 7.5, "zero": 0, "registration_threshold_ngn": 25000000}',
 'VAT: 7.5% flat standard. FIRS e-invoicing platform mandatory for large taxpayers (>NGN 5B) from 2025.',
 'https://www.firs.gov.ng/', '2026-01-01'),

('Kenya', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 16, "reduced": 8, "zero": 0, "registration_threshold_kes": 5000000}',
 'VAT: 16% standard, 8% on petroleum products. eTIMS (electronic Tax Invoice Management System) mandatory for all VAT-registered businesses.',
 'https://www.kra.go.ke/', '2024-01-01'),

('Egypt', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 14, "reduced_5": 5, "zero": 0, "registration_threshold_egp": 500000}',
 'VAT: 14% standard, 5% (machinery, vocational training). Egyptian Tax Authority e-invoicing mandatory for B2B.',
 'https://www.eta.gov.eg/', '2026-01-01'),

('Morocco', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced_14": 14, "reduced_10": 10, "reduced_7": 7, "zero": 0, "registration_threshold_mad": 2000000}',
 'TVA: 20% standard, 14% (transport, electricity), 10% (restaurants, hotels, financial services), 7% (basic necessities, pharma).',
 'https://www.tax.gov.ma/', '2026-01-01'),

('Ghana', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard_vat": 15, "nhil": 2.5, "getfund": 2.5, "covid_levy": 1, "combined_standard": 21.9, "zero": 0}',
 'VAT 15% + NHIL 2.5% + GETFund 2.5% + COVID-19 Health Recovery Levy 1% = effective 21.9% combined rate on most goods/services. GRA e-invoicing mandatory.',
 'https://gra.gov.gh/', '2026-01-01'),

('Tanzania', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 18, "zero": 0, "zanzibar_standard": 15, "registration_threshold_tzs": 100000000}',
 'VAT: 18% mainland Tanzania, 15% Zanzibar. Registration at TZS 100M. Electronic Fiscal Devices (EFD) mandatory for invoicing.',
 'https://www.tra.go.tz/', '2026-01-01'),

-- ── OCEANIA ──────────────────────────────────────────────────────
('New Zealand', 'invoice', 'tax_rates', 'gst_rates',
 '{"standard": 15, "zero": 0, "registration_threshold_nzd": 60000}',
 'GST: 15% flat standard. Registration mandatory at NZD 60,000 turnover. Tax invoice required for supplies over NZD 50.',
 'https://www.ird.govt.nz/', '2026-01-01'),

-- ── CIS/OTHER ────────────────────────────────────────────────────
('Russia', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 10, "zero": 0, "small_business_simplified": "6_or_15_on_net"}',
 'VAT (НДС): 20% standard, 10% (food, medicines, children goods, books). Simplified taxation system for small businesses at 6% (revenue) or 15% (profit).',
 'https://www.nalog.gov.ru/', '2026-01-01'),

('Ukraine', 'invoice', 'tax_rates', 'vat_rates',
 '{"standard": 20, "reduced": 7, "zero": 0, "registration_threshold_uah": 1000000}',
 'VAT (ПДВ): 20% standard, 7% (pharmaceuticals, medical devices). Electronic Tax Invoice via STS mandatory.',
 'https://tax.gov.ua/', '2026-01-01')

ON CONFLICT (country, document_type, category, requirement_key) DO UPDATE
SET requirement_value = EXCLUDED.requirement_value,
    description = EXCLUDED.description,
    source_url = EXCLUDED.source_url,
    effective_date = EXCLUDED.effective_date,
    last_verified_date = CURRENT_DATE,
    updated_at = NOW();

-- Verification
SELECT COUNT(DISTINCT country) AS countries_covered, COUNT(*) AS total_rules
FROM compliance_knowledge;
