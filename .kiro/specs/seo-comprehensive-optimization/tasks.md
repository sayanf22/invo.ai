# Tasks

- [x] 1 Create city data module and misspelling data module
  - [x] 1.1 Create `lib/city-data.ts` with CityData interface, city lists for all 11 countries (3-5 cities each), and lookup functions (getCityBySlug, getCitiesForCountry, getAllCityPages)
  - [x] 1.2 Create city content generation functions in `lib/city-data.ts`: getCityPageData returning CityPageData with hero heading, business context, tax compliance, FAQs, CTA, use-case content, sibling cities, and related blog slugs
  - [x] 1.3 Create `lib/misspelling-data.ts` with MISSPELLING_VARIANTS array and isMisspellingPath function that detects misspelling patterns in URL paths and returns corrected paths
  - [x] 1.4 Create `lib/hreflang.ts` with getCountryHreflangTags (returns 12 entries: 11 locales + x-default), getCityHreflangTag, and getLocaleForCountry functions
  - [x] 1.5 Create `lib/structured-data.ts` with helper functions: generateFAQSchema, generateProductSchema, generateArticleSchema, generateSoftwareAppSchema, generateOrganizationSchema

- [x] 2 Add URL normalization and misspelling redirects to middleware
  - [x] 2.1 Add URL normalization logic to `middleware.ts` that runs before auth checks: lowercase paths, remove trailing slashes (except root), remove duplicate slashes, and return 301 redirects for non-canonical URLs
  - [x] 2.2 Add misspelling redirect logic to `middleware.ts` using isMisspellingPath from misspelling-data module, returning 301 redirects to corrected URLs
  - [x] 2.3 Add `/tools` and `/clorefy-alternative-spellings` to the PUBLIC_PATHS array in middleware.ts so city pages and misspelling page are publicly accessible

- [x] 3 Create city landing pages
  - [x] 3.1 Create `app/tools/[documentType]/[country]/[city]/page.tsx` with generateStaticParams (from getAllCityPages), generateMetadata (unique title, description, canonical, OG, Twitter, hreflang), and ISR revalidate of 86400
  - [x] 3.2 Implement city page component rendering: breadcrumbs (Home → Tools → DocType → Country → City), hero section, business context section, tax compliance section, FAQ section, CTA with signup link, use-case content, and internal links (parent country + 2 sibling cities + blog posts)
  - [x] 3.3 Add BreadcrumbList JSON-LD, FAQ JSON-LD, and SoftwareApplication JSON-LD (with areaServed) to city page

- [x] 4 Update country landing pages with hreflang and city links
  - [x] 4.1 Update `app/tools/[documentType]/[country]/page.tsx` generateMetadata to include hreflang tags for all 11 country variants plus x-default using getCountryHreflangTags
  - [x] 4.2 Add "Available Cities" section to country page component that renders internal links to all child city pages using getCitiesForCountry

- [x] 5 Create misspelling landing page
  - [x] 5.1 Create `app/clorefy-alternative-spellings/page.tsx` with content mentioning all misspelling variants, Organization schema with sameAs references, self-referencing canonical URL, OG tags, Twitter Card tags, and breadcrumbs

- [x] 6 Add structured data to pricing and blog pages
  - [x] 6.1 Update `app/pricing/page.tsx` to include Product schema with individual Offer entries for each pricing plan (price, currency, description)
  - [x] 6.2 Update `app/blog/[slug]/page.tsx` to include Article schema with headline, datePublished, dateModified, author, and publisher fields

- [x] 7 Update sitemap and internal linking
  - [x] 7.1 Update `app/sitemap.ts` to include all city landing pages (priority 0.7, changeFrequency "monthly") using getAllCityPages from city-data module
  - [x] 7.2 Update `app/sitemap.ts` to include misspelling landing page (priority 0.5, changeFrequency "monthly")
  - [x] 7.3 Update `app/sitemap.ts` to use actual content timestamps for lastModified instead of current date for static pages
  - [x] 7.4 Add city page links to footer component or a dedicated "Locations" section on marketing pages, and add misspelling page link to footer navigation

- [x] 8 Write property-based tests
  - [x] 8.1 [PBT] Property 2: URL normalization produces canonical form — test that normalizeURL is idempotent, produces lowercase paths, removes trailing slashes and duplicate slashes
  - [x] 8.2 [PBT] Property 3: Misspelling detection and correction — test that isMisspellingPath returns corrected path for known variants and null for non-misspellings
  - [x] 8.3 [PBT] Property 4+5: City page data completeness and metadata constraints — test getCityPageData returns complete data with correct title pattern, description length 120-160 chars, and content containing city name
  - [x] 8.4 [PBT] Property 6: City page FAQ uniqueness — test that city FAQs have 3+ entries containing city name and are distinct from parent country FAQs
  - [x] 8.5 [PBT] Property 7+8: Internal linking — test city pages link to parent country + 2 sibling cities + 1 blog post, and country pages link to all child cities
  - [x] 8.6 [PBT] Property 9+10+11: Hreflang correctness — test getCountryHreflangTags returns 12 entries, locales match ISO pattern, and hreflang references are reciprocal
  - [x] 8.7 [PBT] Property 14: JSON-LD structural validity — test all generated JSON-LD objects have non-empty required fields and correct @type
  - [x] 8.8 [PBT] Property 15+17: Sitemap coverage and canonical consistency — test all city pages appear in sitemap with correct priority, and canonical URLs match sitemap URLs
