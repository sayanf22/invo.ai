# Tasks

## Task 1: Create SEO data layer and shared components

- [x] 1.1 Create `lib/seo-data.ts` with `SUPPORTED_COUNTRIES`, `DOCUMENT_TYPES` arrays, `ProgrammaticPageData` interface, and lookup functions (`getCountryBySlug`, `getDocumentTypeBySlug`, `getProgrammaticPageData`, `getAllProgrammaticPages`, `getRelatedProgrammaticPages`, `getRelatedBlogSlugs`)
- [x] 1.2 Create `components/seo/json-ld.tsx` — reusable server component that renders a `<script type="application/ld+json">` tag from a typed object
- [x] 1.3 Create `components/seo/breadcrumbs.tsx` — server component that renders breadcrumb navigation UI and BreadcrumbList JSON-LD, accepting `BreadcrumbItem[]` props
- [x] 1.4 Create `components/seo/related-links.tsx` — server component that renders a grid of internal links (related programmatic pages and blog posts)
- [x] 1.5 Enhance `lib/blog-data.ts` — add `hub` and `relatedToolPages` fields to `BlogPost` interface, add `getPostsByCategory`, `getPostsByHub`, `getAllCategories` helper functions, populate `relatedToolPages` on existing posts

## Task 2: Extract client components from existing pages

- [x] 2.1 Create `components/landing/animated-card.tsx` — client component wrapping Framer Motion `motion.div` with `whileInView` animation, accepting children and animation config props
- [x] 2.2 Create `components/landing/animated-hero.tsx` — client component wrapping Framer Motion entrance animation for hero sections
- [x] 2.3 Create `components/landing/feature-tab-nav.tsx` — client component with tab switching state (`useState`), receiving tab data and tab content data as props, rendering the interactive tab UI and content panels
- [x] 2.4 Create `components/landing/billing-toggle.tsx` — client component with billing cycle state, country detection (`useEffect`), Supabase auth check, and price display logic, receiving plan data as props
- [x] 2.5 Create `components/landing/faq-accordion.tsx` — client component with open/close state for FAQ items, receiving FAQ data as props

## Task 3: Refactor features page to server component

- [x] 3.1 Refactor `app/features/page.tsx` — remove `"use client"`, keep all data (tabs, tabContent, feature grid) as static data, use `FeatureTabNav` client component for interactive tabs, wrap animated sections with `AnimatedCard`, add `Breadcrumbs` component
- [x] 3.2 Enhance `app/features/layout.tsx` — add BreadcrumbList and WebPage JSON-LD structured data

## Task 4: Refactor pricing page to server component

- [x] 4.1 Refactor `app/pricing/page.tsx` — remove `"use client"`, render plan data, comparison section, and trust strip as static HTML, use `BillingToggle` for interactive pricing, use `FaqAccordion` for FAQ section, wrap animated sections with `AnimatedCard`, add `Breadcrumbs` component
- [x] 4.2 Enhance `app/pricing/layout.tsx` — add BreadcrumbList JSON-LD, ensure Product schema with Offer entries is complete

## Task 5: Refactor use-cases pages to server component

- [x] 5.1 Refactor `app/use-cases/[slug]/page.tsx` — remove `"use client"`, add `generateStaticParams()` for all 7 slugs, add `generateMetadata()` with per-slug title/description/OG/canonical, keep `USE_CASES` data as static, wrap animated sections with `AnimatedCard`/`AnimatedHero`, add `Breadcrumbs`, add internal links to relevant `/tools/*` pages
- [x] 5.2 Add WebPage and FAQPage JSON-LD structured data to use-case pages with audience-specific questions

## Task 6: Build programmatic SEO pages

- [x] 6.1 Create `app/tools/[documentType]/[country]/page.tsx` — server component with `generateStaticParams()` returning all 44 combinations, `generateMetadata()` with unique title/description/OG/canonical per page, page content rendering country-specific tax info, compliance details, features, FAQs, CTA, and internal links using `RelatedLinks` and `Breadcrumbs` components
- [x] 6.2 Add JSON-LD structured data to programmatic pages — SoftwareApplication with country-specific currency in offers, FAQPage with country-relevant Q&As, BreadcrumbList, and HowTo schema
- [x] 6.3 Set ISR revalidation (`export const revalidate = 86400`) on programmatic SEO pages

## Task 7: Dynamic OG image generation

- [x] 7.1 Create `app/tools/[documentType]/[country]/opengraph-image.tsx` — using Next.js `ImageResponse` API to render 1200×630 image with country flag, document type name, country name, and Clorefy branding
- [x] 7.2 Create `app/blog/[slug]/opengraph-image.tsx` — using `ImageResponse` to render 1200×630 image with blog post title and Clorefy branding
- [x] 7.3 Create `app/use-cases/[slug]/opengraph-image.tsx` — using `ImageResponse` to render 1200×630 image with use-case name and Clorefy branding

## Task 8: Enhance sitemap and footer navigation

- [x] 8.1 Update `app/sitemap.ts` — add all 44 programmatic SEO page URLs with priority 0.8 and monthly change frequency, sourced from `getAllProgrammaticPages()` in `lib/seo-data.ts`
- [x] 8.2 Update `components/landing/landing-footer.tsx` — add "Tools" section to footer links with links to top-level tool categories (e.g., `/tools/invoice-generator/india`, `/tools/contract-generator/usa`)

## Task 9: Blog enhancements

- [x] 9.1 Create `components/blog/category-filter.tsx` — client component for blog category filtering with URL-based state, rendering category pills
- [x] 9.2 Update `app/blog/page.tsx` — integrate `BlogCategoryFilter` component, support filtering posts by category via query params or client-side state
- [x] 9.3 Enhance `app/blog/[slug]/page.tsx` — add `Breadcrumbs` component, ensure related posts section prioritizes same-hub posts, add `relatedToolPages` links within the article body or CTA section

## Task 10: AI search engine visibility and entity SEO

- [x] 10.1 Update `app/layout.tsx` Organization JSON-LD — add `sameAs` array with social media profile URLs, ensure consistent entity description across all schemas
- [x] 10.2 Ensure all public pages use proper semantic HTML heading hierarchy — single h1 per page, logical h2-h6 nesting, FAQ sections use h3 for questions and p for answers

## Task 11: Core Web Vitals optimization

- [x] 11.1 Add `loading="lazy"` to below-fold images across all public pages, ensure above-fold images use `priority` prop in next/image
- [x] 11.2 Verify font preloading in `app/layout.tsx` — ensure `next/font/google` `preload` option is enabled for critical fonts (DM Sans, Playfair Display)
- [x] 11.3 Verify code-splitting — ensure refactored pages have interactive client components in separate chunks (this is automatic with the server/client component split from Tasks 2-5)

## Task 12: Property-based tests
- [x] 12.1 Install `fast-check` as a dev dependency
- [x] 12.2 Write property test for Property 1: Programmatic page data completeness — for any valid (country, docType) pair, `getProgrammaticPageData` returns complete data with tax, currency, compliance, FAQs, and hero heading
- [x] 12.3 Write property test for Property 2: Programmatic page content uniqueness — for any two distinct (country, docType) pairs, title, metaDescription, and heroHeading differ
- [x] 12.4 Write property test for Property 3: Breadcrumb generation — for any non-root page path, breadcrumbs have ≥2 items, first is Home with "/", last matches current page
- [x] 12.5 Write property test for Property 4: Structured data required fields — for any generated JSON-LD, all required fields for its @type are present
- [x] 12.6 Write property test for Property 5: Internal linking minimums — blog posts have ≥2 relatedSlugs + ≥1 relatedToolPages; programmatic pages have ≥2 related pages + ≥2 related blog slugs
- [x] 12.7 Write property test for Property 6: Metadata completeness — for any public page, metadata has unique title, description 120-160 chars, canonical URL, OG and Twitter tags
- [x] 12.8 Write property test for Property 7: Keyword presence — for any programmatic page, title contains country name and doc type name, description contains country name
- [x] 12.9 Write property test for Property 8: Sitemap completeness — for any known public page URL, sitemap contains a matching entry with valid lastModified
- [x] 12.10 Write property test for Property 9: Hub-based related posts — for any blog post with a hub, related posts include at least one post sharing the same hub
- [x] 12.11 Write property test for Property 10: Entity SEO consistency — for any page with Organization JSON-LD, name is "Clorefy", url is "https://clorefy.com", sameAs is present
