# Requirements Document

## Introduction

Clorefy (clorefy.com) is an AI-powered document generation platform deployed on Cloudflare Workers via Next.js 16. Google Search Console currently reports indexing issues including "Alternate page with proper canonical tag", "Page with redirect", and "Redirect error" statuses. This spec addresses those technical SEO errors and expands Clorefy's organic reach by adding location-specific city/region landing pages across all 11 supported countries, misspelling/alternate-spelling redirect handling, proper hreflang tags for international SEO, enhanced structured data (JSON-LD with FAQ schema) on all pages, and comprehensive canonical URL management. The goal is to rank in India, USA, UK, Germany, Canada, Australia, Singapore, UAE, Philippines, France, and Netherlands for document-generation queries at both country and city level.

## Glossary

- **Clorefy_Platform**: The Next.js 16 web application at clorefy.com deployed on Cloudflare Workers, serving public marketing pages and the authenticated document generation dashboard
- **GSC**: Google Search Console — the tool reporting indexing status, crawl errors, and search performance for clorefy.com
- **Canonical_URL**: The `<link rel="canonical">` tag specifying the preferred URL for a page, used to resolve duplicate content issues
- **Hreflang_Tag**: An HTML `<link rel="alternate" hreflang="x">` tag that tells search engines which language/region version of a page to show to users in a specific locale
- **City_Landing_Page**: A location-specific landing page targeting a major city or region within a supported country (e.g., `/tools/invoice-generator/india/mumbai`)
- **Misspelling_Redirect**: A server-side 301 redirect from a common misspelling or alternate spelling of "Clorefy" (e.g., "clorify", "cloriphy", "clorephy") to the correct clorefy.com URL
- **Structured_Data**: JSON-LD schema markup embedded in pages to help search engines understand page content
- **FAQ_Schema**: JSON-LD markup of type FAQPage containing Question and Answer entities for rich snippet eligibility
- **Sitemap**: The XML sitemap at clorefy.com/sitemap.xml listing all indexable URLs
- **301_Redirect**: A permanent HTTP redirect indicating the resource has moved permanently, passing link equity to the destination URL
- **Redirect_Chain**: Multiple sequential redirects (A → B → C) that waste crawl budget and dilute link equity
- **Orphan_Page**: A page with no internal links pointing to it, making it difficult for crawlers to discover
- **Country_Landing_Page**: An existing programmatic SEO page at `/tools/[documentType]/[country]` targeting a country-level keyword
- **Rich_Snippet**: Enhanced search result display (stars, FAQs, breadcrumbs) enabled by structured data
- **Crawl_Budget**: The number of pages a search engine bot will crawl on a site within a given timeframe
- **ISR**: Incremental Static Regeneration — Next.js feature for regenerating static pages at intervals without full rebuilds
- **BreadcrumbList_Schema**: JSON-LD structured data representing page hierarchy, enabling breadcrumb rich results

## Requirements

### Requirement 1: Fix Google Search Console Indexing Errors

**User Story:** As a site owner, I want all GSC indexing errors resolved, so that Google properly indexes every public page without "Alternate page with proper canonical tag", "Page with redirect", or "Redirect error" statuses.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL set a self-referencing Canonical_URL on every public page using the exact URL path that the page is served from, without trailing slashes, query parameters, or fragment identifiers
2. WHEN a page is accessible at multiple URL variants (with/without trailing slash, with/without www), THE Clorefy_Platform SHALL serve a 301_Redirect from all non-canonical variants to the single canonical version
3. THE Clorefy_Platform SHALL eliminate all Redirect_Chains by ensuring every redirect resolves in a single hop (source → final destination)
4. IF a public page sets a canonical URL pointing to a different page, THEN THE Clorefy_Platform SHALL either remove the cross-canonical or serve a 301_Redirect from the source page to the canonical target
5. THE Clorefy_Platform SHALL configure the middleware to enforce consistent URL formatting: lowercase paths, no trailing slashes (except root "/"), and no duplicate slashes
6. WHEN the Clorefy_Platform returns a redirect response, THE Clorefy_Platform SHALL use HTTP status 301 for permanent redirects and HTTP status 308 for permanent redirects that must preserve the HTTP method
7. THE Clorefy_Platform SHALL ensure that no page listed in the Sitemap returns a 3xx, 4xx, or 5xx HTTP status code
8. IF a previously indexed URL has been removed or moved, THEN THE Clorefy_Platform SHALL serve a 301_Redirect to the most relevant replacement page rather than returning a 404

### Requirement 2: Location-Specific City Landing Pages

**User Story:** As a user searching for "invoice generator Mumbai" or "contract generator Berlin", I want to find a dedicated Clorefy landing page for my city, so that I see locally relevant content and trust that Clorefy serves my area.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL generate City_Landing_Pages for the top 3–5 major cities or regions in each of the 11 supported countries, served at the URL pattern `/tools/[documentType]/[country]/[city]`
2. WHEN a City_Landing_Page is requested, THE Clorefy_Platform SHALL render unique content including the city name, country-specific tax information, local business context, and a call-to-action linking to the signup page
3. THE Clorefy_Platform SHALL generate unique title tags for each City_Landing_Page following the pattern "[Document Type] for [City], [Country] | Clorefy"
4. THE Clorefy_Platform SHALL generate unique meta descriptions for each City_Landing_Page between 120 and 160 characters, mentioning the city name and document type
5. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL include BreadcrumbList_Schema JSON-LD reflecting the hierarchy: Home → Tools → [Document Type] → [Country] → [City]
6. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL include FAQ_Schema JSON-LD with at least 3 city-specific questions and answers
7. THE Clorefy_Platform SHALL include internal links from each City_Landing_Page to the parent Country_Landing_Page and to at least 2 other City_Landing_Pages in the same country
8. THE Clorefy_Platform SHALL include internal links from each Country_Landing_Page to all its child City_Landing_Pages
9. IF a city slug does not match any defined city for the given country and document type, THEN THE Clorefy_Platform SHALL return a 404 status code
10. THE Clorefy_Platform SHALL use ISR with a revalidation period of no more than 86400 seconds (24 hours) for City_Landing_Pages

### Requirement 3: Misspelling and Alternate Spelling Handling

**User Story:** As a user who searches for "clorify invoice generator" or "cloriphy contract maker", I want to still reach clorefy.com, so that typos and alternate spellings do not prevent me from finding the platform.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL maintain a list of known misspellings and alternate spellings of "Clorefy" including at minimum: "clorify", "cloriphy", "clorephy", "clorafy", "clorefi", "clorfy", "clorifly"
2. WHEN a request URL path contains a misspelling pattern that matches a known alternate spelling, THE Clorefy_Platform SHALL serve a 301_Redirect to the equivalent correct URL
3. THE Clorefy_Platform SHALL include a dedicated landing page at `/clorefy-alternative-spellings` (or equivalent) that contains text mentioning common misspellings, so that search engines associate these terms with clorefy.com
4. THE Clorefy_Platform SHALL include misspelling variants in the meta keywords and page content of the landing page to capture long-tail misspelling traffic
5. WHEN the misspelling landing page is rendered, THE Clorefy_Platform SHALL include Structured_Data with the correct brand name "Clorefy" and sameAs references
6. THE Sitemap SHALL include the misspelling landing page

### Requirement 4: Hreflang Tags for International SEO

**User Story:** As a search engine serving results in multiple countries, I want hreflang tags on Clorefy pages, so that I can show the correct country-specific page to users in each supported locale.

#### Acceptance Criteria

1. WHEN a Country_Landing_Page is rendered, THE Clorefy_Platform SHALL include Hreflang_Tags for all 11 country variants of that document type, plus an `x-default` tag pointing to the USA variant
2. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL include a Hreflang_Tag for the locale of the country that city belongs to
3. THE Clorefy_Platform SHALL use the correct ISO 639-1 language code and ISO 3166-1 Alpha-2 country code in all Hreflang_Tags (e.g., "en-IN" for India, "de-DE" for Germany, "fr-FR" for France, "nl-NL" for Netherlands)
4. THE Clorefy_Platform SHALL ensure that every page referenced in a Hreflang_Tag reciprocally references the source page in its own Hreflang_Tags
5. THE Clorefy_Platform SHALL include Hreflang_Tags on the landing page pointing to country-specific variants or using `x-default` for the default English version

### Requirement 5: Enhanced Structured Data on All Pages

**User Story:** As a search engine, I want comprehensive structured data on every public page, so that I can display rich snippets including FAQs, breadcrumbs, product info, and how-to steps for Clorefy results.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL include BreadcrumbList_Schema JSON-LD on every public page below the root level, reflecting the page's position in the site hierarchy
2. WHEN a Country_Landing_Page is rendered, THE Clorefy_Platform SHALL include FAQ_Schema JSON-LD with at least 3 country-specific and document-type-specific questions and answers
3. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL include FAQ_Schema JSON-LD with at least 3 city-specific questions and answers that differ from the parent country page FAQs
4. WHEN the pricing page is rendered, THE Clorefy_Platform SHALL include Product schema with individual Offer entries for each pricing plan including price, currency, and plan description
5. WHEN a blog post page is rendered, THE Clorefy_Platform SHALL include Article schema with headline, datePublished, dateModified, author, and publisher fields
6. THE Clorefy_Platform SHALL include LocalBusiness or SoftwareApplication schema on City_Landing_Pages with the areaServed property set to the specific city
7. THE Clorefy_Platform SHALL validate that all JSON-LD structured data contains no empty required fields and follows schema.org specifications

### Requirement 6: Comprehensive Sitemap Optimization

**User Story:** As a search engine crawler, I want a complete sitemap covering all new city pages, misspelling pages, and existing pages, so that I can discover and index every public URL efficiently.

#### Acceptance Criteria

1. THE Sitemap SHALL include all City_Landing_Pages with a priority of 0.7 and a change frequency of "monthly"
2. THE Sitemap SHALL include the misspelling landing page with a priority of 0.5 and a change frequency of "monthly"
3. THE Sitemap SHALL include all existing Country_Landing_Pages, blog posts, use-case pages, marketing pages, and legal pages with their current priority values
4. THE Sitemap SHALL set lastModified dates based on actual content update timestamps, not the current date for static content
5. THE Clorefy_Platform SHALL ensure that every URL in the Sitemap returns a 200 HTTP status code when crawled
6. WHEN a new City_Landing_Page is added to the city data, THE Sitemap SHALL automatically include the new page without manual configuration

### Requirement 7: Canonical URL Management

**User Story:** As a site owner, I want every public page to have a correct, self-referencing canonical URL, so that Google does not flag pages as duplicates or report "Alternate page with proper canonical tag" errors.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL set a self-referencing canonical URL on every public page using the `alternates.canonical` metadata field in Next.js
2. THE Clorefy_Platform SHALL use absolute URLs (starting with "https://clorefy.com") for all canonical tags
3. THE Clorefy_Platform SHALL ensure that no two distinct pages share the same canonical URL
4. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL set its canonical URL to the exact city page URL (e.g., "https://clorefy.com/tools/invoice-generator/india/mumbai"), not the parent country page
5. THE Clorefy_Platform SHALL ensure that the canonical URL matches the URL in the Sitemap for every page
6. IF a page has been consolidated into another page, THEN THE Clorefy_Platform SHALL serve a 301_Redirect rather than setting a cross-page canonical

### Requirement 8: Rich Content for Location Pages

**User Story:** As a user landing on a city-specific page, I want to see rich, unique content relevant to my city and document needs, so that the page feels tailored to my local context rather than generic.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL generate unique hero headings and subheadings for each City_Landing_Page that include the city name and document type
2. THE Clorefy_Platform SHALL include a section on each City_Landing_Page describing local business context relevant to that city (e.g., industry focus, business hub status, local tax considerations)
3. THE Clorefy_Platform SHALL include a section on each City_Landing_Page listing the specific tax compliance requirements for the parent country, contextualized for businesses operating in that city
4. THE Clorefy_Platform SHALL include at least 3 unique FAQ items per City_Landing_Page that reference the city name and are distinct from the parent Country_Landing_Page FAQs
5. THE Clorefy_Platform SHALL include a call-to-action section on each City_Landing_Page with a signup link and a message referencing the city name
6. THE Clorefy_Platform SHALL include testimonial-style or use-case content on City_Landing_Pages describing how businesses in that city use Clorefy for the specific document type

### Requirement 9: Meta Title and Description Optimization

**User Story:** As a search engine, I want every public page to have a unique, keyword-rich title and description, so that I can display accurate and compelling search results for Clorefy.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL generate unique title tags for every public page, with no two pages sharing the same title
2. THE Clorefy_Platform SHALL generate meta descriptions between 120 and 160 characters for every public page
3. WHEN a City_Landing_Page is rendered, THE Clorefy_Platform SHALL include the city name, country name, and document type in both the title tag and meta description
4. WHEN a Country_Landing_Page is rendered, THE Clorefy_Platform SHALL include the country name and document type in both the title tag and meta description
5. THE Clorefy_Platform SHALL generate Open Graph tags (og:title, og:description, og:image, og:url) for every public page including all new City_Landing_Pages
6. THE Clorefy_Platform SHALL generate Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image) for every public page including all new City_Landing_Pages
7. THE Clorefy_Platform SHALL ensure that title tags do not exceed 60 characters and meta descriptions do not exceed 160 characters to avoid truncation in search results

### Requirement 10: Internal Linking for New Pages

**User Story:** As a site owner, I want all new city pages and the misspelling page properly linked from existing pages, so that search engines can discover them and page authority flows throughout the site.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL include internal links from each Country_Landing_Page to all its child City_Landing_Pages in a dedicated "Available Cities" or equivalent section
2. THE Clorefy_Platform SHALL include internal links from each City_Landing_Page to the parent Country_Landing_Page and to at least 2 sibling City_Landing_Pages
3. THE Clorefy_Platform SHALL include internal links from each City_Landing_Page to at least 1 related blog post
4. THE Clorefy_Platform SHALL include links to city pages in the footer or a dedicated "Locations" section on marketing pages
5. THE Clorefy_Platform SHALL ensure that no City_Landing_Page is an Orphan_Page (every city page must have at least 2 internal links pointing to it from other pages)
6. THE Clorefy_Platform SHALL include the misspelling landing page in the footer navigation or a relevant section of the about page
