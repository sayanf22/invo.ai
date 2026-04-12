# Requirements Document

## Introduction

Clorefy (clorefy.com) is an AI-powered document generation platform that creates invoices, contracts, quotations, and proposals for 11 countries. This spec covers a comprehensive SEO optimization initiative to achieve top search rankings for high-value keywords like "AI invoice generator", "AI contract generator", "free invoice generator", and related long-tail terms. The initiative addresses critical technical SEO gaps (client-rendered public pages), missing programmatic SEO pages, limited content strategy, and emerging AI visibility optimization.

## Glossary

- **Clorefy_Platform**: The Next.js 16 web application at clorefy.com serving both public marketing pages and the authenticated document generation dashboard
- **Public_Page**: Any route on clorefy.com intended for search engine indexing and organic traffic (landing page, pricing, features, use-cases, blog, programmatic SEO pages)
- **Server_Component**: A Next.js React Server Component that renders HTML on the server, making content immediately available to search engine crawlers without JavaScript execution
- **Client_Component**: A Next.js component marked with "use client" that renders via JavaScript in the browser — content may not be visible to search engine crawlers
- **Programmatic_SEO_Page**: A dynamically generated landing page targeting a specific long-tail keyword combination (e.g., country × document type), built from structured data and templates
- **Metadata_System**: The Next.js `generateMetadata()` function and `metadata` export used to set page titles, descriptions, Open Graph tags, and canonical URLs for each route
- **Structured_Data**: JSON-LD schema markup embedded in pages to help search engines and AI systems understand page content (e.g., SoftwareApplication, BreadcrumbList, FAQPage, HowTo)
- **Core_Web_Vitals**: Google's page experience metrics — Largest Contentful Paint (LCP), Cumulative Layout Shift (CLS), and Interaction to Next Paint (INP)
- **Sitemap**: The XML sitemap at clorefy.com/sitemap.xml that lists all indexable URLs for search engine crawlers
- **Internal_Link**: A hyperlink from one page on clorefy.com to another page on clorefy.com, used to distribute page authority and help crawlers discover content
- **AI_Search_Engine**: Search systems that use large language models to generate answers, including Google AI Overviews, Perplexity, ChatGPT search, and Bing Copilot
- **Entity_SEO**: The practice of consistently associating a brand (Clorefy) with specific concepts (AI invoice generator, AI contract generator) across structured data, content, and external references so that AI systems recognize the brand as an authority
- **ISR**: Incremental Static Regeneration — a Next.js feature that allows static pages to be regenerated at a specified interval without a full rebuild
- **Crawl_Budget**: The number of pages a search engine bot will crawl on a site within a given timeframe; efficient use ensures important pages are indexed
- **BreadcrumbList_Schema**: A JSON-LD structured data type that represents the page's position in the site hierarchy, enabling breadcrumb rich results in search
- **Country_Document_Matrix**: The set of all combinations of 11 supported countries × 4 document types, producing 44 unique programmatic SEO landing pages
- **Hub_And_Spoke_Model**: A content strategy where pillar pages (hubs) target high-volume keywords and supporting articles (spokes) target long-tail keywords, with internal links connecting them

## Requirements

### Requirement 1: Convert Client-Rendered Public Pages to Server Components

**User Story:** As a search engine crawler, I want all public marketing pages to render their content on the server, so that I can index the full page content without executing JavaScript.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL render the use-cases pages (`/use-cases/[slug]`) as Server_Components with all content available in the initial HTML response
2. THE Clorefy_Platform SHALL render the features page (`/features`) as a Server_Component with all content available in the initial HTML response
3. THE Clorefy_Platform SHALL render the pricing page (`/pricing`) as a Server_Component with all content available in the initial HTML response
4. WHEN a use-case page is requested, THE Clorefy_Platform SHALL export page-level metadata via `generateMetadata()` including title, description, Open Graph tags, and canonical URL specific to that use case
5. WHEN the features page is requested, THE Clorefy_Platform SHALL serve the full feature content as static HTML without requiring client-side JavaScript for initial render
6. WHEN the pricing page is requested, THE Clorefy_Platform SHALL serve plan names, descriptions, feature lists, and FAQ content as static HTML without requiring client-side JavaScript for initial render
7. IF a use-case slug does not match any defined use case, THEN THE Clorefy_Platform SHALL return a 404 status code
8. THE Clorefy_Platform SHALL extract interactive elements (billing toggle, FAQ accordion, tab navigation) into isolated Client_Components while keeping surrounding content as Server_Components

### Requirement 2: Programmatic SEO Landing Pages for Country × Document Type Matrix

**User Story:** As a user searching for "invoice generator India" or "contract generator USA", I want to find a dedicated Clorefy landing page targeting my specific need, so that I can see how Clorefy solves my exact use case.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL generate 44 unique Programmatic_SEO_Pages covering all combinations in the Country_Document_Matrix (11 countries × 4 document types)
2. WHEN a programmatic SEO page is requested (e.g., `/tools/invoice-generator/india`), THE Clorefy_Platform SHALL render it as a Server_Component with unique, country-specific and document-type-specific content
3. THE Metadata_System SHALL generate unique title tags, meta descriptions, and canonical URLs for each Programmatic_SEO_Page following the pattern "[Document Type] Generator for [Country] | Clorefy"
4. WHEN a programmatic SEO page is rendered, THE Clorefy_Platform SHALL include country-specific tax information, compliance requirements, and currency details relevant to that country and document type
5. WHEN a programmatic SEO page is rendered, THE Clorefy_Platform SHALL include a call-to-action linking to the signup page
6. THE Sitemap SHALL include all 44 Programmatic_SEO_Pages with appropriate priority and change frequency values
7. IF a country or document type slug does not match any supported combination, THEN THE Clorefy_Platform SHALL return a 404 status code
8. THE Clorefy_Platform SHALL use ISR with a revalidation period of no more than 86400 seconds (24 hours) for Programmatic_SEO_Pages

### Requirement 3: Enhanced Structured Data Per Page Type

**User Story:** As a search engine, I want rich structured data on every public page, so that I can display enhanced search results (breadcrumbs, FAQs, how-to steps, product info) for Clorefy.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL include BreadcrumbList_Schema JSON-LD on every Public_Page reflecting the page's position in the site hierarchy
2. WHEN a Programmatic_SEO_Page is rendered, THE Clorefy_Platform SHALL include SoftwareApplication schema with country-specific offer details and FAQPage schema with country-relevant questions
3. WHEN a blog post page is rendered, THE Clorefy_Platform SHALL include Article schema with headline, datePublished, dateModified, author, and publisher fields
4. WHEN the pricing page is rendered, THE Clorefy_Platform SHALL include Product schema with individual Offer entries for each pricing plan including price, currency, and description
5. WHEN a use-case page is rendered, THE Clorefy_Platform SHALL include WebPage schema with the specific audience type and FAQPage schema with audience-relevant questions
6. THE Clorefy_Platform SHALL validate all JSON-LD structured data against schema.org specifications, ensuring no required fields are missing

### Requirement 4: Internal Linking Strategy

**User Story:** As a site owner, I want a systematic internal linking structure connecting all public pages, so that search engines can discover all content and page authority flows to high-value pages.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL include contextual Internal_Links from each blog post to at least 2 related blog posts and at least 1 relevant Programmatic_SEO_Page
2. THE Clorefy_Platform SHALL include Internal_Links from each Programmatic_SEO_Page to at least 2 related blog posts and at least 2 other Programmatic_SEO_Pages (same country, different document type or same document type, different country)
3. THE Clorefy_Platform SHALL include a footer navigation section on all Public_Pages containing links to the top-level categories: pricing, features, use-cases, blog, and tools
4. WHEN a use-case page is rendered, THE Clorefy_Platform SHALL include Internal_Links to relevant Programmatic_SEO_Pages matching that audience's typical document needs
5. THE Clorefy_Platform SHALL include breadcrumb navigation on all Public_Pages below the top level, with each breadcrumb segment linking to its parent page

### Requirement 5: Page-Level Metadata for All Public Routes

**User Story:** As a search engine, I want every public page to have unique, descriptive metadata, so that I can display accurate titles and descriptions in search results.

#### Acceptance Criteria

1. THE Metadata_System SHALL generate a unique title tag for every Public_Page, with no two pages sharing the same title
2. THE Metadata_System SHALL generate a unique meta description for every Public_Page, between 120 and 160 characters in length
3. THE Metadata_System SHALL set a canonical URL for every Public_Page pointing to the preferred version of that URL
4. THE Metadata_System SHALL generate Open Graph tags (og:title, og:description, og:image, og:url) for every Public_Page
5. THE Metadata_System SHALL generate Twitter Card tags (twitter:card, twitter:title, twitter:description, twitter:image) for every Public_Page
6. WHEN a Programmatic_SEO_Page is rendered, THE Metadata_System SHALL include the target keyword in both the title tag and meta description
7. IF a Public_Page is a Client_Component, THEN THE Clorefy_Platform SHALL export metadata from a parent layout.tsx file as a Server_Component

### Requirement 6: Sitemap and Robots.txt Enhancement

**User Story:** As a search engine crawler, I want a complete and accurate sitemap and robots.txt, so that I can efficiently discover and index all important pages while avoiding private routes.

#### Acceptance Criteria

1. THE Sitemap SHALL include all Public_Pages including the 44 Programmatic_SEO_Pages, all blog posts, all use-case pages, and all marketing pages
2. THE Sitemap SHALL assign priority values reflecting page importance: homepage (1.0), programmatic SEO pages (0.8), blog posts (0.7), legal pages (0.4)
3. THE Sitemap SHALL set lastModified dates accurately based on content update timestamps
4. THE Clorefy_Platform SHALL serve the robots.txt file with rules allowing all Public_Pages and disallowing all private routes (API, auth callbacks, dashboard, settings, billing)
5. THE Clorefy_Platform SHALL reference the sitemap URL in the robots.txt file
6. WHEN a new Programmatic_SEO_Page is added, THE Sitemap SHALL automatically include the new page without manual configuration

### Requirement 7: Core Web Vitals Optimization

**User Story:** As a site owner, I want all public pages to meet Google's Core Web Vitals thresholds, so that page experience does not negatively impact search rankings.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL achieve a Largest Contentful Paint (LCP) of 2.5 seconds or less on all Public_Pages when measured on a simulated mobile connection
2. THE Clorefy_Platform SHALL achieve a Cumulative Layout Shift (CLS) score of 0.1 or less on all Public_Pages
3. THE Clorefy_Platform SHALL achieve an Interaction to Next Paint (INP) of 200 milliseconds or less on all Public_Pages
4. THE Clorefy_Platform SHALL lazy-load images and heavy components that appear below the initial viewport fold on all Public_Pages
5. THE Clorefy_Platform SHALL preload critical fonts used on Public_Pages to prevent layout shift from font loading
6. WHEN the landing page is loaded, THE Clorefy_Platform SHALL render the hero section content within the first 1.5 seconds on a 4G mobile connection
7. THE Clorefy_Platform SHALL minimize JavaScript bundle size for Public_Pages by code-splitting interactive components away from static content

### Requirement 8: Blog Content Expansion and Hub-and-Spoke Strategy

**User Story:** As a content marketer, I want a structured blog content plan targeting long-tail keywords with proper internal linking, so that Clorefy builds topical authority for AI document generation.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL support a blog content structure following the Hub_And_Spoke_Model with pillar posts targeting high-volume keywords and supporting posts targeting long-tail variations
2. WHEN a blog post is rendered, THE Clorefy_Platform SHALL display related posts from the same hub cluster with clickable Internal_Links
3. THE Clorefy_Platform SHALL include a blog category filtering system allowing users to browse posts by category (guides, templates, country guides, tips, comparisons)
4. WHEN a blog post is rendered, THE Clorefy_Platform SHALL include a call-to-action section linking to the Clorefy signup page
5. THE Clorefy_Platform SHALL support blog post content that includes inline Internal_Links to relevant Programmatic_SEO_Pages and other blog posts within the article body

### Requirement 9: AI Search Engine Visibility Optimization

**User Story:** As a user searching via AI-powered search engines (Google AI Overviews, Perplexity, ChatGPT), I want Clorefy to appear in AI-generated answers for document generation queries, so that I can discover Clorefy through modern search interfaces.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL include consistent Entity_SEO markup across all Public_Pages, associating the brand "Clorefy" with the concepts "AI invoice generator", "AI contract generator", "AI document generator", "AI proposal generator", and "AI quotation generator"
2. THE Clorefy_Platform SHALL structure FAQ content on Public_Pages using question-and-answer HTML patterns (heading as question, paragraph as answer) that AI_Search_Engines can parse
3. THE Clorefy_Platform SHALL include a "What is Clorefy?" section with a concise, factual description on the landing page and about page that AI_Search_Engines can extract as a knowledge panel source
4. WHEN Structured_Data is rendered on any Public_Page, THE Clorefy_Platform SHALL include sameAs links in the Organization schema pointing to official social media profiles and directory listings
5. THE Clorefy_Platform SHALL serve all Public_Pages with clean, semantic HTML using proper heading hierarchy (single h1, logical h2-h6 nesting) that AI_Search_Engines can parse for content structure

### Requirement 10: Open Graph Image Generation

**User Story:** As a user sharing a Clorefy page on social media, I want each page to display a visually distinct preview image, so that shared links look professional and attract clicks.

#### Acceptance Criteria

1. THE Clorefy_Platform SHALL generate unique Open Graph images for each page type: landing page, pricing, features, use-case pages, blog posts, and Programmatic_SEO_Pages
2. WHEN a blog post is shared on social media, THE Clorefy_Platform SHALL display an Open Graph image containing the blog post title and Clorefy branding
3. WHEN a Programmatic_SEO_Page is shared on social media, THE Clorefy_Platform SHALL display an Open Graph image containing the country name, document type, and Clorefy branding
4. THE Clorefy_Platform SHALL serve Open Graph images in the recommended dimensions of 1200×630 pixels
5. THE Clorefy_Platform SHALL cache generated Open Graph images to avoid regeneration on every request
