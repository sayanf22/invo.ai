# Bugfix Requirements Document

## Introduction

Searching "clorefy" on Google does not surface any organic listing for clorefy.com anywhere in the results, even though Google's own AI Overview already describes "Clorefy" correctly as a B2B invoicing/document-generation platform — meaning Google has *some* knowledge of the brand from a source other than clorefy.com's own indexed pages. This has persisted for roughly 3 months, despite two prior specs (`seo-optimization`, `seo-comprehensive-optimization`) being fully implemented: programmatic tool pages, city pages, JSON-LD structured data, sitemap, hreflang, misspelling redirects, OG images, and canonical tags all exist in the codebase and pass their property-based tests.

Investigation during requirements gathering surfaced two concrete, reproducible data points:

- A `site:clorefy.com` search shows only the homepage (`https://clorefy.com/`) in Google's index. None of the ~50+ other URLs listed in `sitemap.xml` (blog posts, `/pricing`, `/features`, `/tools/*` programmatic pages, `/use-cases/*`, etc.) appear indexed.
- A plain search for "clorefy.com" returns results dominated by **Corefy** (`corefy.com`), an established, unrelated payment-orchestration company with a highly similar name. This is a plausible contributor to Google either suppressing clorefy.com in favor of the more established domain, or having difficulty disambiguating the two entities.

A code-level review of the technical SEO surface (`app/sitemap.ts`, `public/robots.txt`, deployed `robots.txt`/`sitemap.xml` assets, `middleware.ts`, canonical tags on programmatic/city pages, JSON-LD in `app/layout.tsx`) did not turn up an obvious technical blocker (no stray `noindex`, no robots disallow on public routes, no canonical cross-pointing, no redirect loop) purely from static inspection. This means the root cause is most likely one or more of: actual GSC indexing status/errors that require live verification, domain trust/authority factors (3-month-old domain, thin backlink profile), the Corefy name collision diluting entity recognition, or a runtime/deployment discrepancy that isn't visible from source code alone (e.g., something Cloudflare/OpenNext serves differently than the source implies). The design phase will verify GSC data directly and investigate these hypotheses further; this document captures the observable defect and the desired end state.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user searches "clorefy" on Google THEN the system (Google's organic search results) displays no clorefy.com organic listing, sitelink, or knowledge panel on any results page, even though Google's AI Overview independently and correctly describes the "Clorefy" brand as a B2B document/invoicing platform
1.2 WHEN a user searches "clorefy.com" on Google THEN the results are dominated by or conflated with the unrelated company Corefy (corefy.com)
1.3 WHEN the Google `site:clorefy.com` search operator is used THEN only the homepage (`https://clorefy.com/`) is returned, despite `sitemap.xml` listing 50+ additional indexable URLs
1.4 WHEN Google Search Console's indexing coverage is reviewed THEN the count of indexed pages is far below the count of pages submitted via sitemap, indicating most pages are excluded from the index for reasons not yet confirmed (to be diagnosed with live GSC data in the design phase)
1.5 WHEN searching for document-generation/invoicing niche competitive terms (e.g. "AI invoice generator", "contract generator") for any of the 9 supported document types THEN clorefy.com does not rank on the visible results pages, despite programmatic SEO pages targeting these terms having been implemented

### Expected Behavior (Correct)

2.1 WHEN a user searches "clorefy" on Google THEN clorefy.com's homepage SHALL appear as the top organic result, reflecting standard brand-name search behavior for the domain's own registered owner
2.2 WHEN a user searches "clorefy.com" on Google THEN the results SHALL be dominated by clorefy.com pages and SHALL be clearly disambiguated from corefy.com
2.3 WHEN the Google `site:clorefy.com` search operator is used THEN a majority of the indexable pages listed in `sitemap.xml` SHALL appear in Google's index within a reasonable crawl/index timeframe following the fix
2.4 WHEN Google Search Console's indexing coverage is reviewed THEN the count of indexed pages SHALL closely track the count of pages submitted via sitemap, with any exclusions limited to intentionally non-indexable routes (auth, dashboard, API, admin)
2.5 WHEN Google Search Console's Security & Manual Actions report is reviewed THEN it SHALL show zero manual actions and zero security issues
2.6 WHEN Google Search Console's Core Web Vitals, Mobile Usability, and structured data validity reports are reviewed THEN they SHALL show zero errors
2.7 WHEN a user searches for document-generation/invoicing niche competitive terms for any of the 9 supported document types (invoice, contract, quote/quotation, proposal, SOW, change order, NDA, client onboarding form, payment follow-up) THEN clorefy.com's relevant programmatic SEO page SHALL be crawlable, indexed, and eligible to rank (ranking position itself depends on factors like backlinks and domain age that are outside the scope of a single fix, but indexation and technical eligibility SHALL be verified as correct)
2.8 WHEN Google or another search engine crawls any page targeting one of the 150+ supported countries THEN that page SHALL be technically eligible for indexing (correct status code, no unintended noindex/canonical/robots block) regardless of whether it is one of the 11 "well-tested" countries with dedicated city pages

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the existing sitemap generation (`app/sitemap.ts`), robots.txt rules, JSON-LD structured data (Organization, SoftwareApplication, WebSite, FAQPage schemas), canonical tag logic, and hreflang tag logic are exercised THEN they SHALL CONTINUE TO produce the same technically-correct output they currently produce, unless a specific defect is identified in them during design
3.2 WHEN the misspelling redirect system (`lib/misspelling-data.ts`, `middleware.ts`) handles a known misspelling path THEN it SHALL CONTINUE TO 301-redirect to the corrected URL
3.3 WHEN an authenticated/private route (e.g. `/billing`, `/settings`, `/documents`, `/api/*`) is requested by a crawler THEN it SHALL CONTINUE TO be excluded from indexing per `robots.txt` and SHALL CONTINUE TO redirect unauthenticated crawlers away from protected content per `middleware.ts`
3.4 WHEN the programmatic tool pages (`/tools/[documentType]/[country]`) and city pages (`/tools/[documentType]/[country]/[city]`) are requested THEN they SHALL CONTINUE TO render with unique content, correct metadata, and ISR revalidation as currently implemented
3.5 WHEN a user is logged in and navigates the authenticated dashboard THEN authentication, routing, and rate-limiting behavior in `middleware.ts` SHALL CONTINUE TO function exactly as before — no change to auth logic is in scope for this fix
3.6 WHEN the homepage is crawled and indexed THEN it SHALL CONTINUE TO be indexed and SHALL NOT regress as a side effect of fixing the rest of the site's indexation

## Bug Condition (Derived)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type SearchOrIndexingEvent
         // X covers: a Google search query, a site: operator check,
         // a GSC coverage report entry, or a crawl of a specific URL
  OUTPUT: boolean

  RETURN (
    (X.queryType = "brand" AND X.query CONTAINS "clorefy" AND NOT X.results CONTAINS "clorefy.com" AS top result)
    OR (X.queryType = "brand" AND X.query = "clorefy.com" AND X.results CONFLATED_WITH "corefy.com")
    OR (X.queryType = "site_operator" AND X.domain = "clorefy.com" AND X.indexedCount < X.sitemapCount)
    OR (X.queryType = "gsc_coverage" AND X.indexedPages << X.submittedPages)
    OR (X.queryType = "niche_competitive" AND X.targetsSupportedDocumentType AND NOT X.pageIsIndexed)
  )
END FUNCTION
```

```pascal
// Property: Fix Checking — Brand Search Visibility
FOR ALL X WHERE isBugCondition(X) DO
  result ← F'(X)
  ASSERT (
    (X.queryType = "brand" AND X.query = "clorefy" IMPLIES result.topOrganicResult = "clorefy.com")
    AND (X.queryType = "site_operator" IMPLIES result.indexedCount >= 0.8 * result.eligibleSitemapCount)
    AND (X.queryType = "gsc_coverage" IMPLIES result.manualActions = 0 AND result.securityIssues = 0)
    AND (X.queryType = "niche_competitive" IMPLIES result.pageIsIndexed = true)
  )
END FOR
```

```pascal
// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // e.g. homepage indexing, auth-page exclusion, misspelling redirects,
  // and already-correct structured data continue to behave identically
END FOR
```

**Key Definitions:**
- **F**: The current production state of clorefy.com (technical SEO implementation + GSC/domain state as of this bug report)
- **F'**: The state after root-cause fixes are applied (design phase will determine exact fixes — could span GSC configuration, DNS, sitemap submission, robots/canonical corrections, entity disambiguation content, or domain authority-building measures)
- **Counterexample (observed)**: `site:clorefy.com` → only `https://clorefy.com/` returned, despite 50+ sitemap URLs; search for `clorefy.com` → results dominated by `corefy.com`
