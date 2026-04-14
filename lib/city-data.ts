/**
 * Static city data for programmatic SEO city landing pages.
 * 11 countries x 3-5 cities each = ~45 cities
 * 45 cities x 4 document types = ~180 city landing pages
 */

import { CountryData, DocumentTypeData, SUPPORTED_COUNTRIES, DOCUMENT_TYPES, getCountryBySlug, getDocumentTypeBySlug, getRelatedBlogSlugs } from "@/lib/seo-data"

// ── Interfaces ─────────────────────────────────────────────────────────

export interface CityData {
  slug: string
  name: string
  countrySlug: string
  population?: string
  businessContext: string
  industries: string[]
  taxNotes: string
}

export interface CityPageData {
  city: CityData
  country: CountryData
  documentType: DocumentTypeData
  title: string
  metaDescription: string
  heroHeading: string
  heroSubheading: string
  businessContextSection: string
  taxComplianceSection: string
  faqs: { question: string; answer: string }[]
  ctaMessage: string
  useCaseContent: string
  siblingCities: CityData[]
  parentCountryHref: string
  relatedBlogSlugs: string[]
}

// ── City Data per Country ──────────────────────────────────────────────

const CITIES_BY_COUNTRY: Record<string, CityData[]> = {
  india: [
    {
      slug: "mumbai",
      name: "Mumbai",
      countrySlug: "india",
      population: "20.7M",
      businessContext: "India's financial capital and largest commercial hub, home to the Bombay Stock Exchange, major banks, and headquarters of leading corporations across finance, entertainment, and manufacturing.",
      industries: ["Finance", "Entertainment", "Textiles", "IT Services", "Pharmaceuticals"],
      taxNotes: "Mumbai businesses must comply with Maharashtra GST rules. CGST + SGST applies for intra-state transactions; IGST for inter-state. E-invoicing mandatory for turnover above ₹5 crore.",
    },
    {
      slug: "delhi",
      name: "Delhi",
      countrySlug: "india",
      population: "32.9M",
      businessContext: "India's capital and second-largest commercial center, hosting government agencies, embassies, and a thriving startup ecosystem in Gurugram and Noida NCR.",
      industries: ["Government", "IT & Startups", "Retail", "Hospitality", "Education"],
      taxNotes: "Delhi NCR businesses follow central GST rules. Both Delhi and neighboring Haryana/UP have their own SGST rates. Cross-border NCR transactions require careful IGST treatment.",
    },
    {
      slug: "bangalore",
      name: "Bangalore",
      countrySlug: "india",
      population: "13.2M",
      businessContext: "India's Silicon Valley and tech startup capital, home to global IT giants, unicorn startups, and a thriving freelance developer and design community.",
      industries: ["IT & Software", "Startups", "Aerospace", "Biotechnology", "Manufacturing"],
      taxNotes: "Karnataka GST applies for Bangalore businesses. IT services exports may qualify for zero-rated GST. Software companies must maintain proper SAC code documentation.",
    },
    {
      slug: "chennai",
      name: "Chennai",
      countrySlug: "india",
      population: "11.5M",
      businessContext: "South India's industrial and automotive hub, known for manufacturing, IT services, and a strong export-oriented economy with major port infrastructure.",
      industries: ["Automotive", "IT Services", "Manufacturing", "Healthcare", "Logistics"],
      taxNotes: "Tamil Nadu GST applies. Automotive and manufacturing businesses must correctly classify HSN codes. Export-oriented units may claim GST refunds on inputs.",
    },
    {
      slug: "hyderabad",
      name: "Hyderabad",
      countrySlug: "india",
      population: "10.5M",
      businessContext: "A rapidly growing tech and pharma hub, home to HITEC City, major IT campuses, and one of India's fastest-growing startup ecosystems.",
      industries: ["IT & Software", "Pharmaceuticals", "Biotechnology", "Manufacturing", "Real Estate"],
      taxNotes: "Telangana GST applies. Pharma companies must use correct HSN codes for medicines. IT companies exporting services can claim LUT/bond for zero-rated exports.",
    },
  ],
  usa: [
    {
      slug: "new-york",
      name: "New York",
      countrySlug: "usa",
      population: "8.3M",
      businessContext: "The world's leading financial center, home to Wall Street, Fortune 500 headquarters, and a diverse economy spanning finance, media, fashion, and technology.",
      industries: ["Finance", "Media", "Fashion", "Technology", "Real Estate"],
      taxNotes: "New York State sales tax is 4%, with NYC adding 4.5% for a combined 8.875%. Professional services are generally exempt. Businesses must register for a Certificate of Authority.",
    },
    {
      slug: "los-angeles",
      name: "Los Angeles",
      countrySlug: "usa",
      population: "3.9M",
      businessContext: "The entertainment capital of the world and a major tech hub, with a diverse economy spanning film, music, aerospace, fashion, and a booming startup scene.",
      industries: ["Entertainment", "Technology", "Aerospace", "Fashion", "Healthcare"],
      taxNotes: "California sales tax base is 7.25%, with LA County adding 2.25% for a combined 9.5%. California has strict nexus rules and use tax requirements for remote sellers.",
    },
    {
      slug: "chicago",
      name: "Chicago",
      countrySlug: "usa",
      population: "2.7M",
      businessContext: "The Midwest's commercial capital, a major hub for finance, manufacturing, logistics, and professional services with a strong B2B economy.",
      industries: ["Finance", "Manufacturing", "Logistics", "Healthcare", "Professional Services"],
      taxNotes: "Illinois sales tax is 6.25% state rate, with Chicago adding local taxes for a combined rate up to 10.25%. Professional services are generally not subject to sales tax in Illinois.",
    },
    {
      slug: "houston",
      name: "Houston",
      countrySlug: "usa",
      population: "2.3M",
      businessContext: "The energy capital of the world, home to major oil and gas companies, a thriving medical center, and a growing tech and aerospace sector.",
      industries: ["Energy", "Healthcare", "Aerospace", "Manufacturing", "Technology"],
      taxNotes: "Texas has no state income tax. Sales tax is 6.25% state rate plus up to 2% local, totaling 8.25% in Houston. Texas has economic nexus rules for remote sellers over $500K.",
    },
    {
      slug: "san-francisco",
      name: "San Francisco",
      countrySlug: "usa",
      population: "874K",
      businessContext: "The global epicenter of technology and venture capital, home to Silicon Valley giants, unicorn startups, and a highly skilled workforce in software and AI.",
      industries: ["Technology", "Finance", "Biotechnology", "Tourism", "Professional Services"],
      taxNotes: "California sales tax applies at 8.625% in San Francisco. SF also has a Gross Receipts Tax on business revenue. Tech companies must carefully track nexus across states.",
    },
  ],
  uk: [
    {
      slug: "london",
      name: "London",
      countrySlug: "uk",
      population: "9.0M",
      businessContext: "Europe's leading financial center and a global hub for finance, technology, media, and professional services, with a highly international business community.",
      industries: ["Finance", "Technology", "Media", "Professional Services", "Tourism"],
      taxNotes: "Standard VAT rate of 20% applies. London businesses above £90,000 turnover must register for VAT. Making Tax Digital (MTD) requires digital VAT records and quarterly submissions.",
    },
    {
      slug: "manchester",
      name: "Manchester",
      countrySlug: "uk",
      population: "553K",
      businessContext: "The UK's second city for business, a major hub for digital, creative, and professional services with a thriving startup ecosystem and strong manufacturing heritage.",
      industries: ["Digital & Tech", "Creative Industries", "Manufacturing", "Healthcare", "Education"],
      taxNotes: "UK VAT at 20% applies. Manchester businesses benefit from Northern Powerhouse investment zones with potential tax reliefs. MTD for VAT is mandatory for all VAT-registered businesses.",
    },
    {
      slug: "birmingham",
      name: "Birmingham",
      countrySlug: "uk",
      population: "1.1M",
      businessContext: "The UK's second-largest city, a major manufacturing and professional services hub with a diverse economy and growing tech sector.",
      industries: ["Manufacturing", "Professional Services", "Retail", "Technology", "Healthcare"],
      taxNotes: "Standard UK VAT at 20% applies. Birmingham businesses in designated enterprise zones may qualify for enhanced capital allowances. MTD compliance is mandatory.",
    },
    {
      slug: "edinburgh",
      name: "Edinburgh",
      countrySlug: "uk",
      population: "524K",
      businessContext: "Scotland's capital and financial hub, home to major financial institutions, a thriving tech scene, and a world-class tourism and hospitality sector.",
      industries: ["Finance", "Technology", "Tourism", "Education", "Professional Services"],
      taxNotes: "UK VAT at 20% applies. Scottish businesses may be subject to Scottish Income Tax rates which differ from England. Land and Buildings Transaction Tax (LBTT) replaces Stamp Duty in Scotland.",
    },
    {
      slug: "leeds",
      name: "Leeds",
      countrySlug: "uk",
      population: "793K",
      businessContext: "A major financial and professional services center in Yorkshire, with a growing digital economy and strong retail, healthcare, and legal sectors.",
      industries: ["Finance", "Legal Services", "Digital & Tech", "Retail", "Healthcare"],
      taxNotes: "Standard UK VAT at 20% applies. Leeds businesses benefit from the West Yorkshire Investment Zone. MTD for VAT requires digital record-keeping and quarterly submissions.",
    },
  ],
  germany: [
    {
      slug: "berlin",
      name: "Berlin",
      countrySlug: "germany",
      population: "3.7M",
      businessContext: "Germany's capital and startup hub, home to a thriving tech ecosystem, creative industries, and a growing international business community.",
      industries: ["Technology", "Creative Industries", "Tourism", "Media", "Startups"],
      taxNotes: "German VAT (Umsatzsteuer) at 19% applies. Berlin businesses must include Steuernummer on invoices. Kleinunternehmerregelung exempts businesses under €22,000 annual revenue from VAT.",
    },
    {
      slug: "munich",
      name: "Munich",
      countrySlug: "germany",
      population: "1.5M",
      businessContext: "Bavaria's economic powerhouse and Germany's most prosperous city, home to BMW, Siemens, Allianz, and a thriving high-tech and financial services sector.",
      industries: ["Automotive", "Finance", "Technology", "Manufacturing", "Insurance"],
      taxNotes: "Bavarian tax office (Finanzamt) handles local tax matters. Standard VAT at 19% applies. Munich businesses must use sequential invoice numbers (Rechnungsnummer) and include USt-IdNr for EU transactions.",
    },
    {
      slug: "hamburg",
      name: "Hamburg",
      countrySlug: "germany",
      population: "1.9M",
      businessContext: "Germany's gateway to the world, Europe's second-largest port city, and a major hub for trade, logistics, media, and aerospace.",
      industries: ["Logistics", "Trade", "Media", "Aerospace", "Maritime"],
      taxNotes: "Hamburg Finanzamt handles local tax registration. VAT at 19% applies. Import/export businesses must comply with customs VAT rules. Media companies may qualify for reduced 7% VAT on certain publications.",
    },
    {
      slug: "frankfurt",
      name: "Frankfurt",
      countrySlug: "germany",
      population: "773K",
      businessContext: "Europe's financial capital, home to the European Central Bank, Deutsche Börse, and major international banks, with a highly international business environment.",
      industries: ["Finance", "Banking", "Insurance", "Logistics", "Technology"],
      taxNotes: "Frankfurt businesses in the financial sector must comply with BaFin regulations alongside standard VAT rules. Financial services are generally VAT-exempt. Standard 19% VAT applies to other services.",
    },
    {
      slug: "cologne",
      name: "Cologne",
      countrySlug: "germany",
      population: "1.1M",
      businessContext: "A major media, insurance, and trade fair city, home to RTL Group, major insurance companies, and the world-famous Cologne Trade Fair (Koelnmesse).",
      industries: ["Media", "Insurance", "Trade & Events", "Chemical", "Retail"],
      taxNotes: "North Rhine-Westphalia Finanzamt handles tax registration. Standard VAT at 19% applies. Media and broadcasting companies may have specific VAT treatment for digital content.",
    },
  ],
  canada: [
    {
      slug: "toronto",
      name: "Toronto",
      countrySlug: "canada",
      population: "2.9M",
      businessContext: "Canada's financial capital and largest city, home to the TSX, major banks, a thriving tech sector, and a highly diverse international business community.",
      industries: ["Finance", "Technology", "Real Estate", "Healthcare", "Professional Services"],
      taxNotes: "Ontario HST of 13% (5% GST + 8% PST) applies. Toronto businesses must register for HST if annual revenue exceeds $30,000. Business Number (BN) must appear on all invoices.",
    },
    {
      slug: "vancouver",
      name: "Vancouver",
      countrySlug: "canada",
      population: "675K",
      businessContext: "Canada's Pacific gateway, a major hub for technology, film production, natural resources, and international trade with Asia-Pacific markets.",
      industries: ["Technology", "Film & Media", "Natural Resources", "Tourism", "Real Estate"],
      taxNotes: "BC charges GST (5%) plus PST (7%) separately — not HST. Vancouver businesses must register for both GST/HST and BC PST if applicable. Digital services may have specific PST treatment.",
    },
    {
      slug: "montreal",
      name: "Montreal",
      countrySlug: "canada",
      population: "2.1M",
      businessContext: "Canada's second-largest city and cultural capital, a major hub for aerospace, AI research, gaming, and a thriving bilingual business environment.",
      industries: ["Aerospace", "AI & Technology", "Gaming", "Finance", "Creative Industries"],
      taxNotes: "Quebec charges GST (5%) plus QST (9.975%) separately. Montreal businesses must register for both federal GST and Quebec QST. Invoices must comply with both federal and Quebec requirements.",
    },
    {
      slug: "calgary",
      name: "Calgary",
      countrySlug: "canada",
      population: "1.3M",
      businessContext: "Canada's energy capital, home to major oil and gas companies, a growing tech sector, and a business-friendly environment with no provincial sales tax.",
      industries: ["Energy", "Technology", "Agriculture", "Finance", "Construction"],
      taxNotes: "Alberta has no provincial sales tax — only federal GST at 5% applies. This makes Calgary one of the most tax-efficient cities for business in Canada. BN required on invoices.",
    },
    {
      slug: "ottawa",
      name: "Ottawa",
      countrySlug: "canada",
      population: "1.0M",
      businessContext: "Canada's capital city, a major hub for government, technology, and professional services, with a stable economy driven by public sector contracts.",
      industries: ["Government", "Technology", "Professional Services", "Healthcare", "Education"],
      taxNotes: "Ontario HST of 13% applies. Ottawa businesses with significant government contracts must comply with federal procurement invoicing requirements. BN must appear on all invoices.",
    },
  ],
  australia: [
    {
      slug: "sydney",
      name: "Sydney",
      countrySlug: "australia",
      population: "5.3M",
      businessContext: "Australia's largest city and financial hub, home to the ASX, major banks, a thriving tech sector, and a highly international business community.",
      industries: ["Finance", "Technology", "Tourism", "Professional Services", "Real Estate"],
      taxNotes: "GST of 10% applies. Sydney businesses must display ABN on tax invoices. Tax invoices over $1,000 require the buyer's ABN. BAS reporting is quarterly or monthly via ATO.",
    },
    {
      slug: "melbourne",
      name: "Melbourne",
      countrySlug: "australia",
      population: "5.1M",
      businessContext: "Australia's cultural capital and a major hub for finance, education, healthcare, and a thriving startup ecosystem in the Docklands tech precinct.",
      industries: ["Finance", "Education", "Healthcare", "Technology", "Creative Industries"],
      taxNotes: "Standard 10% GST applies. Melbourne businesses must register for GST if annual turnover exceeds $75,000. ABN is required on all tax invoices. Quarterly BAS lodgment is standard.",
    },
    {
      slug: "brisbane",
      name: "Brisbane",
      countrySlug: "australia",
      population: "2.6M",
      businessContext: "Queensland's capital and a rapidly growing business hub, boosted by infrastructure investment ahead of the 2032 Olympics, with strengths in construction, tourism, and technology.",
      industries: ["Construction", "Tourism", "Technology", "Agriculture", "Healthcare"],
      taxNotes: "Queensland has no state payroll tax for businesses under $1.3M wages. Standard 10% GST applies nationally. Brisbane businesses must comply with ATO requirements for ABN and BAS.",
    },
    {
      slug: "perth",
      name: "Perth",
      countrySlug: "australia",
      population: "2.1M",
      businessContext: "Western Australia's capital and the gateway to Australia's mining and resources sector, with a strong economy driven by iron ore, gold, and LNG exports.",
      industries: ["Mining & Resources", "Energy", "Agriculture", "Construction", "Technology"],
      taxNotes: "WA has a payroll tax threshold of $1M. Standard 10% GST applies. Mining companies have specific GST treatment for exploration and extraction activities. ABN required on all invoices.",
    },
    {
      slug: "adelaide",
      name: "Adelaide",
      countrySlug: "australia",
      population: "1.4M",
      businessContext: "South Australia's capital, known for its defense industry, wine and food exports, and a growing technology and space sector.",
      industries: ["Defense", "Food & Wine", "Technology", "Healthcare", "Space"],
      taxNotes: "SA payroll tax threshold is $1.5M. Standard 10% GST applies. Defense contractors may have specific invoicing requirements for government contracts. ABN required on all tax invoices.",
    },
  ],
  singapore: [
    {
      slug: "central",
      name: "Central Singapore",
      countrySlug: "singapore",
      population: "1.1M",
      businessContext: "Singapore's CBD and Marina Bay financial district, home to global banks, MNCs, and the Singapore Exchange, making it one of Asia's premier financial centers.",
      industries: ["Finance", "Banking", "Professional Services", "Technology", "Trade"],
      taxNotes: "GST at 9% applies. Businesses with taxable turnover exceeding S$1 million must register for GST. Tax invoices must include GST registration number and be issued within 30 days of supply.",
    },
    {
      slug: "jurong-east",
      name: "Jurong East",
      countrySlug: "singapore",
      population: "350K",
      businessContext: "Singapore's second CBD and a major industrial and commercial hub in the west, home to manufacturing, logistics, and a growing tech and innovation cluster.",
      industries: ["Manufacturing", "Logistics", "Technology", "Retail", "Healthcare"],
      taxNotes: "Standard Singapore GST at 9% applies. Jurong businesses in industrial zones may qualify for specific MAS or EDB incentives. GST registration mandatory above S$1M turnover.",
    },
    {
      slug: "tampines",
      name: "Tampines",
      countrySlug: "singapore",
      population: "280K",
      businessContext: "A major regional center in eastern Singapore, with a strong retail, SME, and light industrial base, and growing as a business hub for eastern Singapore.",
      industries: ["Retail", "SME Services", "Light Manufacturing", "Healthcare", "Education"],
      taxNotes: "Standard Singapore GST at 9% applies. SMEs in Tampines may qualify for Enterprise Development Grant (EDG) support. GST-registered businesses must issue tax invoices within 30 days.",
    },
  ],
  uae: [
    {
      slug: "dubai",
      name: "Dubai",
      countrySlug: "uae",
      population: "3.6M",
      businessContext: "The UAE's commercial capital and a global hub for trade, tourism, real estate, and finance, with a highly international business environment and world-class infrastructure.",
      industries: ["Trade", "Tourism", "Real Estate", "Finance", "Technology"],
      taxNotes: "UAE VAT at 5% applies. Dubai businesses must register for VAT if taxable supplies exceed AED 375,000. Free zone businesses may have specific VAT treatment. TRN must appear on all tax invoices.",
    },
    {
      slug: "abu-dhabi",
      name: "Abu Dhabi",
      countrySlug: "uae",
      population: "1.5M",
      businessContext: "The UAE's capital and oil-rich emirate, home to sovereign wealth funds, major energy companies, and a growing diversification into finance, tourism, and technology.",
      industries: ["Energy", "Finance", "Government", "Tourism", "Technology"],
      taxNotes: "UAE VAT at 5% applies. Abu Dhabi businesses in ADGM (Abu Dhabi Global Market) free zone have specific regulatory requirements. Government contracts may have specific invoicing formats.",
    },
    {
      slug: "sharjah",
      name: "Sharjah",
      countrySlug: "uae",
      population: "1.4M",
      businessContext: "The UAE's third-largest emirate, known for manufacturing, education, and cultural industries, with a strong SME base and cost-effective business environment.",
      industries: ["Manufacturing", "Education", "Media", "Retail", "Logistics"],
      taxNotes: "UAE VAT at 5% applies across all emirates including Sharjah. Sharjah businesses in SAIF Zone free zone may have specific VAT treatment. TRN required on all invoices above AED 10,000.",
    },
  ],
  philippines: [
    {
      slug: "manila",
      name: "Manila",
      countrySlug: "philippines",
      population: "1.8M",
      businessContext: "The Philippines' capital and primary business hub, home to major corporations, BPO companies, and the Philippine Stock Exchange in the Makati CBD.",
      industries: ["BPO & Outsourcing", "Finance", "Retail", "Real Estate", "Government"],
      taxNotes: "VAT at 12% applies. Manila businesses must register with BIR and use BIR-registered invoices. TIN must appear on all invoices. Non-VAT businesses pay 3% percentage tax on gross receipts.",
    },
    {
      slug: "cebu",
      name: "Cebu",
      countrySlug: "philippines",
      population: "964K",
      businessContext: "The Philippines' second city and a major hub for tourism, IT-BPO, manufacturing, and trade, with a rapidly growing economy and strong export sector.",
      industries: ["Tourism", "IT-BPO", "Manufacturing", "Trade", "Real Estate"],
      taxNotes: "Standard 12% VAT applies. Cebu businesses in PEZA-registered zones may qualify for income tax holidays and VAT zero-rating on exports. BIR registration and TIN required.",
    },
    {
      slug: "davao",
      name: "Davao",
      countrySlug: "philippines",
      population: "1.8M",
      businessContext: "Mindanao's economic capital and a major hub for agriculture, food processing, and a growing IT-BPO sector, known for its business-friendly environment.",
      industries: ["Agriculture", "Food Processing", "IT-BPO", "Real Estate", "Retail"],
      taxNotes: "Standard 12% VAT applies. Davao businesses in agri-food sector may qualify for specific BIR exemptions. All businesses must register with BIR and use official receipts/invoices.",
    },
    {
      slug: "quezon-city",
      name: "Quezon City",
      countrySlug: "philippines",
      population: "2.9M",
      businessContext: "The Philippines' most populous city and a major center for media, healthcare, education, and government, with a thriving commercial and residential economy.",
      industries: ["Media", "Healthcare", "Education", "Retail", "Government"],
      taxNotes: "Standard 12% VAT applies. Quezon City has its own local business tax on top of national taxes. BIR registration and official receipts/invoices are mandatory for all businesses.",
    },
  ],
  france: [
    {
      slug: "paris",
      name: "Paris",
      countrySlug: "france",
      population: "2.1M",
      businessContext: "France's capital and Europe's third-largest economy, a global hub for luxury goods, fashion, finance, tourism, and a thriving startup ecosystem in Station F.",
      industries: ["Luxury & Fashion", "Finance", "Tourism", "Technology", "Media"],
      taxNotes: "French TVA at 20% applies. Paris businesses must include SIRET number on invoices. E-invoicing will be mandatory for B2B from 2026. Micro-entrepreneurs under €36,800 may use simplified invoicing.",
    },
    {
      slug: "lyon",
      name: "Lyon",
      countrySlug: "france",
      population: "522K",
      businessContext: "France's second business city, a major hub for pharmaceuticals, chemicals, digital technology, and a world-renowned gastronomy and tourism sector.",
      industries: ["Pharmaceuticals", "Chemicals", "Digital Technology", "Gastronomy", "Healthcare"],
      taxNotes: "Standard French TVA at 20% applies. Lyon businesses in the Auvergne-Rhône-Alpes region may qualify for specific regional business support. SIRET required on all invoices.",
    },
    {
      slug: "marseille",
      name: "Marseille",
      countrySlug: "france",
      population: "861K",
      businessContext: "France's second-largest city and major Mediterranean port, a hub for maritime trade, logistics, tourism, and a growing digital and creative economy.",
      industries: ["Maritime & Logistics", "Tourism", "Digital Economy", "Healthcare", "Trade"],
      taxNotes: "Standard French TVA at 20% applies. Marseille port businesses may have specific customs VAT treatment for imports. SIRET and TVA intracommunautaire number required on B2B invoices.",
    },
    {
      slug: "toulouse",
      name: "Toulouse",
      countrySlug: "france",
      population: "479K",
      businessContext: "Europe's aerospace capital, home to Airbus headquarters, a major space industry cluster, and a thriving university and research ecosystem.",
      industries: ["Aerospace", "Space", "Technology", "Research", "Healthcare"],
      taxNotes: "Standard French TVA at 20% applies. Aerospace and defense contractors may have specific invoicing requirements for government and EU contracts. SIRET required on all invoices.",
    },
    {
      slug: "nice",
      name: "Nice",
      countrySlug: "france",
      population: "342K",
      businessContext: "The French Riviera's capital, a major tourism, luxury, and technology hub with a growing startup ecosystem and strong international business community.",
      industries: ["Tourism", "Luxury", "Technology", "Healthcare", "Real Estate"],
      taxNotes: "Standard French TVA at 20% applies. Nice businesses in the Sophia Antipolis tech park may qualify for specific R&D tax credits (CIR). SIRET required on all invoices.",
    },
  ],
  netherlands: [
    {
      slug: "amsterdam",
      name: "Amsterdam",
      countrySlug: "netherlands",
      population: "921K",
      businessContext: "The Netherlands' capital and a major European hub for finance, technology, creative industries, and international trade, with a highly international workforce.",
      industries: ["Finance", "Technology", "Creative Industries", "Trade", "Tourism"],
      taxNotes: "Dutch BTW at 21% applies. Amsterdam businesses must include BTW-identificatienummer on invoices. KOR scheme exempts businesses under €20,000 revenue. Quarterly BTW returns are standard.",
    },
    {
      slug: "rotterdam",
      name: "Rotterdam",
      countrySlug: "netherlands",
      population: "651K",
      businessContext: "Europe's largest port and a global logistics hub, home to major shipping companies, energy firms, and a thriving industrial and technology sector.",
      industries: ["Logistics", "Shipping", "Energy", "Technology", "Manufacturing"],
      taxNotes: "Standard Dutch BTW at 21% applies. Rotterdam port businesses have specific customs VAT treatment for imports. BTW-identificatienummer required on all B2B invoices.",
    },
    {
      slug: "the-hague",
      name: "The Hague",
      countrySlug: "netherlands",
      population: "548K",
      businessContext: "The Netherlands' seat of government and international law capital, home to the International Court of Justice, embassies, and a major IT and security sector.",
      industries: ["Government", "International Law", "IT & Security", "Energy", "Professional Services"],
      taxNotes: "Standard Dutch BTW at 21% applies. Government contractors in The Hague may have specific invoicing requirements. International organizations may be VAT-exempt. BTW number required on invoices.",
    },
    {
      slug: "utrecht",
      name: "Utrecht",
      countrySlug: "netherlands",
      population: "357K",
      businessContext: "A major university city and growing business hub, with strengths in healthcare, IT, financial services, and a thriving startup and scale-up ecosystem.",
      industries: ["Healthcare", "IT", "Finance", "Education", "Startups"],
      taxNotes: "Standard Dutch BTW at 21% applies. Utrecht businesses in the Utrecht Science Park may qualify for innovation box tax benefits. KOR scheme available for small businesses under €20,000.",
    },
    {
      slug: "eindhoven",
      name: "Eindhoven",
      countrySlug: "netherlands",
      population: "234K",
      businessContext: "The Netherlands' technology and design capital, home to Philips, ASML, and a world-class design ecosystem at Dutch Design Week, with a strong high-tech manufacturing base.",
      industries: ["High-Tech Manufacturing", "Design", "Technology", "Semiconductors", "Healthcare"],
      taxNotes: "Standard Dutch BTW at 21% applies. Eindhoven's high-tech companies may qualify for WBSO R&D tax credits. Export-oriented manufacturers must comply with EU VAT rules for intra-community supplies.",
    },
  ],
}

// ── Lookup Functions ───────────────────────────────────────────────────

export function getCityBySlug(countrySlug: string, citySlug: string): CityData | undefined {
  const cities = CITIES_BY_COUNTRY[countrySlug]
  if (!cities) return undefined
  return cities.find((c) => c.slug === citySlug)
}

export function getCitiesForCountry(countrySlug: string): CityData[] {
  return CITIES_BY_COUNTRY[countrySlug] || []
}

export function getAllCityPages(): { documentType: string; country: string; city: string }[] {
  const pages: { documentType: string; country: string; city: string }[] = []
  for (const docType of DOCUMENT_TYPES) {
    for (const [countrySlug, cities] of Object.entries(CITIES_BY_COUNTRY)) {
      for (const city of cities) {
        pages.push({ documentType: docType.slug, country: countrySlug, city: city.slug })
      }
    }
  }
  return pages
}

// ── City FAQ Generator ─────────────────────────────────────────────────

function generateCityFaqs(
  city: CityData,
  country: CountryData,
  docType: DocumentTypeData
): { question: string; answer: string }[] {
  const faqs: Record<string, (ci: CityData, co: CountryData) => { question: string; answer: string }[]> = {
    "invoice-generator": (ci, co) => [
      {
        question: `What tax information is required on invoices for businesses in ${ci.name}?`,
        answer: `Businesses in ${ci.name} must comply with ${co.name}'s ${co.taxSystem} at ${co.taxRate}. ${ci.taxNotes} Clorefy automatically includes all required tax fields for ${ci.name}-based businesses.`,
      },
      {
        question: `Can I create ${co.currency}-denominated invoices for ${ci.name} clients?`,
        answer: `Yes, Clorefy fully supports ${co.currency} (${co.currencySymbol}) invoicing for ${ci.name}. All tax calculations and compliance rules for ${co.name} are applied automatically, so your invoices are always correct.`,
      },
      {
        question: `What industries in ${ci.name} use Clorefy for invoicing?`,
        answer: `${ci.name} businesses across ${ci.industries.slice(0, 3).join(", ")} and more use Clorefy to generate professional invoices. The AI understands local business context and generates invoices tailored to ${ci.name}'s business environment.`,
      },
      {
        question: `Is Clorefy's invoice generator suitable for freelancers in ${ci.name}?`,
        answer: `Absolutely. Freelancers and independent contractors in ${ci.name} use Clorefy to create professional invoices with correct ${co.taxSystem} calculations. The free tier lets you generate up to 3 invoices per month.`,
      },
    ],
    "contract-generator": (ci, co) => [
      {
        question: `What should contracts include for clients in ${ci.name}?`,
        answer: `Contracts for ${ci.name} clients should include scope of work, payment terms in ${co.currency} (${co.currencySymbol}), ${co.name} legal jurisdiction clauses, and dispute resolution terms. Clorefy generates contracts tailored to ${co.name}'s legal framework.`,
      },
      {
        question: `Are AI-generated contracts valid for ${ci.name} businesses?`,
        answer: `AI-generated contracts serve as professionally structured starting points for ${ci.name} businesses. Contracts are legally binding when both parties agree. For high-value agreements, we recommend review by a ${co.name}-qualified legal professional.`,
      },
      {
        question: `What types of contracts do ${ci.name} businesses need most?`,
        answer: `${ci.name} businesses in ${ci.industries.slice(0, 2).join(" and ")} commonly need service agreements, freelance contracts, and vendor agreements. Clorefy generates all these contract types with ${co.name}-specific legal clauses.`,
      },
      {
        question: `Can I add digital signatures to contracts for ${ci.name} clients?`,
        answer: `Yes, Clorefy supports digital signatures recognized in ${co.name}. You can send contracts to ${ci.name} clients for signing directly from the platform with a secure token-based signing flow.`,
      },
    ],
    "quotation-generator": (ci, co) => [
      {
        question: `Should quotations include ${co.taxSystem} for ${ci.name} clients?`,
        answer: `Yes, quotations for ${ci.name} clients should clearly show both the net amount and ${co.taxSystem} (${co.taxRate}). Clorefy automatically calculates and displays the correct tax breakdown for ${co.name}.`,
      },
      {
        question: `What is the standard quotation validity period for ${ci.name} businesses?`,
        answer: `Standard quotation validity in ${ci.name} is typically 30 days, though this varies by industry. ${ci.industries[0]} businesses in ${ci.name} often use 14-30 day validity periods. Clorefy lets you set custom validity periods.`,
      },
      {
        question: `How do I price quotations for the ${ci.name} market?`,
        answer: `When pricing for ${ci.name}, consider local market rates in ${co.currency} (${co.currencySymbol}), factor in ${co.taxSystem} at ${co.taxRate}, and benchmark against ${ci.name}'s ${ci.industries[0]} sector rates. Clorefy supports tiered pricing options.`,
      },
      {
        question: `Can I convert a quotation to an invoice for ${ci.name} clients?`,
        answer: `Yes, Clorefy allows one-click conversion from quotation to invoice. All line items, ${co.currency} pricing, and ${co.name}-specific tax calculations carry over automatically for your ${ci.name} clients.`,
      },
    ],
    "proposal-generator": (ci, co) => [
      {
        question: `What should a business proposal include for ${ci.name} clients?`,
        answer: `A strong proposal for ${ci.name} clients should include an executive summary, understanding of local business context, proposed solution, timeline, pricing in ${co.currency} (${co.currencySymbol}), and clear next steps tailored to ${ci.name}'s business culture.`,
      },
      {
        question: `How do I price proposals for the ${ci.name} market?`,
        answer: `When pricing for ${ci.name}, consider the local ${ci.industries[0]} market rates, present amounts in ${co.currency} (${co.currencySymbol}), and factor in ${co.taxSystem} at ${co.taxRate}. Clorefy supports tiered pricing to offer Basic, Standard, and Premium options.`,
      },
      {
        question: `What makes a winning proposal for ${ci.name} businesses?`,
        answer: `Winning proposals for ${ci.name} clients demonstrate understanding of local business challenges in ${ci.industries.slice(0, 2).join(" and ")}, show relevant experience, and present clear ROI in ${co.currency}. Clorefy's AI generates proposals with this local context built in.`,
      },
      {
        question: `Can I create proposals in ${ci.name} format with Clorefy?`,
        answer: `Yes, Clorefy generates proposals formatted for the ${co.name} market with ${co.currency} currency formatting, appropriate date formats, and professional styling suited to ${ci.name} business standards.`,
      },
    ],
  }

  const generator = faqs[docType.slug]
  return generator ? generator(city, country) : []
}

// ── City Use Case Content Generator ───────────────────────────────────

function generateUseCaseContent(
  city: CityData,
  country: CountryData,
  docType: DocumentTypeData
): string {
  const industryList = city.industries.slice(0, 3).join(", ")
  return `Businesses in ${city.name} across ${industryList} rely on Clorefy to generate professional ${docType.singularName.toLowerCase()}s quickly and accurately. Whether you're a freelancer in ${city.name}'s growing ${city.industries[0]} sector or a mid-sized company managing dozens of ${docType.singularName.toLowerCase()}s per month, Clorefy's AI understands ${city.name}'s business context and ${country.name}'s ${country.taxSystem} requirements. Generate your first ${docType.singularName.toLowerCase()} in under 60 seconds — no templates, no manual calculations, just describe your needs and let the AI do the rest.`
}

// ── Main getCityPageData Function ──────────────────────────────────────

export function getCityPageData(
  docTypeSlug: string,
  countrySlug: string,
  citySlug: string
): CityPageData | undefined {
  const city = getCityBySlug(countrySlug, citySlug)
  const country = getCountryBySlug(countrySlug)
  const documentType = getDocumentTypeBySlug(docTypeSlug)

  if (!city || !country || !documentType) return undefined

  // Build title within 60-char limit: "[DocType] for [City], [Country] | Clorefy"
  // Shorten if needed by abbreviating "Generator" to "Gen" or dropping country name
  let title = `${documentType.singularName} Generator for ${city.name}, ${country.name} | Clorefy`
  if (title.length > 60) {
    title = `${documentType.singularName} Generator for ${city.name} | Clorefy`
  }
  if (title.length > 60) {
    title = `${documentType.singularName} Gen for ${city.name} | Clorefy`
  }
  const metaDescription = `Create professional ${documentType.singularName.toLowerCase()}s for ${city.name}, ${country.name} with AI. ${country.taxSystem}-compliant, ${country.currency} formatting, and instant PDF export. Free to start.`

  const heroHeading = `${documentType.name} for ${city.name}, ${country.name}`
  const heroSubheading = `Generate professional, ${country.taxSystem}-compliant ${documentType.singularName.toLowerCase()}s for ${city.name} businesses in ${country.currency} (${country.currencySymbol}). Powered by AI — ready in seconds.`

  const businessContextSection = `${city.businessContext} Clorefy's AI understands the unique business environment of ${city.name} and generates ${documentType.singularName.toLowerCase()}s that reflect local industry standards and ${country.name}'s regulatory requirements.`

  const taxComplianceSection = `${city.taxNotes} Clorefy automatically applies the correct ${country.taxSystem} rate of ${country.taxRate} and includes all mandatory compliance fields required by ${country.name}'s tax authorities for businesses operating in ${city.name}.`

  const faqs = generateCityFaqs(city, country, documentType)

  const ctaMessage = `Join thousands of ${city.name} businesses using Clorefy to generate professional ${documentType.singularName.toLowerCase()}s. Start free today — no credit card required.`

  const useCaseContent = generateUseCaseContent(city, country, documentType)

  // Sibling cities: up to 2 other cities in the same country
  const allCitiesInCountry = getCitiesForCountry(countrySlug)
  const siblingCities = allCitiesInCountry.filter((c) => c.slug !== citySlug).slice(0, 2)

  const parentCountryHref = `/tools/${docTypeSlug}/${countrySlug}`

  const relatedBlogSlugs = getRelatedBlogSlugs(docTypeSlug, countrySlug)

  return {
    city,
    country,
    documentType,
    title,
    metaDescription,
    heroHeading,
    heroSubheading,
    businessContextSection,
    taxComplianceSection,
    faqs,
    ctaMessage,
    useCaseContent,
    siblingCities,
    parentCountryHref,
    relatedBlogSlugs,
  }
}
