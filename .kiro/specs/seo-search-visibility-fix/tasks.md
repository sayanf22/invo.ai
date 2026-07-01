# Implementation Plan

## Overview

This plan fixes the SEO search-visibility defect using the exploratory bugfix workflow
(explore → preserve → implement → validate). It covers ONLY the deterministically testable
code/content surface: sitemap hygiene, programmatic content uniqueness, canonical/structured-data
validity, and preservation of existing correct behavior.

Ranking position, knowledge-panel appearance, and brand-entity dominance depend on external,
non-deterministic Google behavior and domain authority. They are tracked in the design's
"Manual / Operational Actions" section and verified via Google Search Console over time — they
are intentionally NOT modeled as code tasks here.

## Tasks

- [x] 1. Write bug condition exploration test (sitemap hygiene + content uniqueness + schema validity)
  - **Property 1: Bug Condition** - Sitemap Hygiene, Content Uniqueness & Structured-Data Validity
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface concrete counterexamples that demonstrate each code/content defect on the current build
  - **Scoped PBT Approach**: For the deterministic sitemap defects, scope the property to the concrete failing URLs surfaced by the audit (the ~9x404, ~9xredirect, 1xsoft-404, 1xnoindex, and the `/auth/login` + `/auth/signup` entries); for uniqueness, scope to the 44 `/tools/[documentType]/[country]` sibling pairs
  - Implement a sitemap audit (e.g. `scripts/audit-sitemap.mjs`) that fetches the deployed `sitemap.xml`, requests every URL, and flags any that are non-`200`, 3xx-redirected, or carry `noindex` (meta or `X-Robots-Tag`) — from Bug Condition branch (d) `X.type = "sitemap_url"` in design
  - Assert every sitemap URL resolves to a final non-redirecting `200` with no `noindex` (Property 1 in design)
  - Assert `/auth/login` and `/auth/signup` are absent from the sitemap
  - Compute pairwise body similarity across the templated `/tools/*` pages (e.g. `/tools/invoice-generator/germany` vs `/tools/invoice-generator/france`) and assert similarity < threshold — from Bug Condition branch (b) `X.type = "gsc_index_entry" ... MATCHES "/tools/*"` and Property 2 in design
  - Assert each sampled programmatic page emits exactly one self-referential canonical and structurally valid JSON-LD with absolute `sameAs` URLs — from Property 3 in design
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the sitemap-hygiene and content-duplication bugs exist)
  - Document counterexamples found: the concrete list of redirecting/404/soft-404/noindex sitemap URLs and the high pairwise similarity scores across `/tools/*` siblings
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 1.4, 1.5, 2.3, 2.4, 2.6, 2.7, 2.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Buggy URLs & Signals Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for inputs where `isBugCondition(X)` is false, and record the actual outputs:
    - Observe: known-misspelling paths (from `lib/misspelling-data.ts`) 301-redirect to their corrected URL
    - Observe: `www`→non-`www` and brand-normalization redirects in `next.config.mjs` / `normalizePathname` behave as-is
    - Observe: auth/private routes (`/billing`, `/settings`, `/documents`, `/api/*`) remain non-indexable and redirect unauthenticated access per `middleware.ts`
    - Observe: the homepage `/` resolves to a clean indexable `200`
    - Observe: existing valid JSON-LD (WebSite, Organization, SoftwareApplication, FAQPage) serializes identically for unchanged pages
  - Write property-based tests capturing these observed patterns from the Preservation Requirements in design (generate random misspelling variants, random private-route paths, and random doc-type/country/city combinations)
  - Property-based testing generates many test cases for stronger regression guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms the baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for SEO search visibility (sitemap hygiene, programmatic content uniqueness, canonical/schema, brand-entity code signals, internal linking)

  - [x] 3.1 Sitemap hygiene automation and cleanup
    - Wire the audit script from task 1 into CI / a pre-deploy check so a redirecting/404/`noindex` URL can never re-enter the sitemap (regression guard for Property 1)
    - Edit `app/sitemap.ts` to drop `/auth/login` and `/auth/signup` (thin, low-value — belong to the noindex/exclude set)
    - Filter the dynamic `getAllCombinedSlugs()` blog list so only slugs resolving to a real published post are emitted
    - Use the audit output to resolve the concrete 9x404 / 9xredirect / 1xsoft-404 / 1xnoindex URLs (fix, 301, or intentionally `noindex`-and-exclude per URL)
    - _Bug_Condition: isBugCondition(X) where X.type = "sitemap_url" AND (finalStatus != 200 OR wasRedirected OR hasNoindex) from design_
    - _Expected_Behavior: every sitemap URL resolves to a final non-redirecting 200 with no noindex (Property 1 / expectedBehavior from design)_
    - _Preservation: Preservation Requirements from design — homepage, auth exclusion, misspelling/normalization 301s unchanged_
    - _Requirements: 2.3, 2.4, 2.8_

  - [x] 3.2 Programmatic content uniqueness
    - Replace fully-templated output of `generateTaxSection` / `generateComplianceSection` / `generateFaqs` in `lib/seo-data.ts` with materially distinct per-country content (real rate tables, thresholds, filing cadences, local examples; varied structure; expanded FAQs)
    - Lean into the existing unique `businessContext` / `industries` / `taxNotes` fields in `lib/city-data.ts` so per-city tax/compliance copy is genuinely city/country-specific, not a shared sentence with a swapped noun
    - Keep pairwise `/tools/*` page similarity below the threshold defined in task 1
    - _Bug_Condition: isBugCondition(X) where X.type = "gsc_index_entry" AND status = "Crawled - currently not indexed" AND url MATCHES "/tools/*" from design_
    - _Expected_Behavior: each page carries materially unique, intent-matched content (Property 2 / expectedBehavior from design)_
    - _Preservation: programmatic pages continue to render with correct metadata and ISR revalidation (Req 3.4)_
    - _Requirements: 2.7, 2.8_

  - [x] 3.3 Canonical and structured-data audit
    - Confirm each `/tools/*` page emits a single self-referential canonical via `alternates.canonical`, and that city pages do not accidentally canonicalize to the country page or homepage (audits the 68 "Alternative page with proper canonical tag" bucket for wrong canonicalization)
    - Validate all JSON-LD in `lib/structured-data.ts` serializes with required `@context`/`@type` present, no empty required fields, and absolute `sameAs` URLs
    - _Bug_Condition: isBugCondition(X) — programmatic/brand page emitting malformed or cross-pointing canonical/schema from design_
    - _Expected_Behavior: exactly one self-referential canonical + valid JSON-LD per page (Property 3 from design)_
    - _Preservation: already-valid canonical/hreflang/JSON-LD output unchanged (Req 3.1)_
    - _Requirements: 2.6, 2.7_

  - [x] 3.4 Brand-entity reinforcement (code portions only) and internal linking
    - Tighten the Organization/WebSite/SoftwareApplication/FAQ JSON-LD in `app/layout.tsx` / `lib/structured-data.ts`; ensure every `sameAs` URL points to a profile that will actually be created (operational task — a `sameAs` to a non-existent profile is a dead signal)
    - Reinforce title/meta brand framing (consistent "Clorefy" + descriptor) and the Clorefy≠Corefy / Clorefy≠Glorify disambiguation already present in `public/llms.txt` and the brand FAQ schema
    - Strengthen internal links from high-authority pages (homepage, top blog posts, footer) into the `/tools/*` cluster and between sibling pages so link equity flows to the thin pages (primary code lever against the ranking/authority problem)
    - _Bug_Condition: isBugCondition(X) where X.type = "brand_query" AND query CONTAINS "clorefy" AND (NOT clorefyDominatesResults OR conflatedWith = "corefy.com") from design_
    - _Expected_Behavior: internally consistent, verifiable brand/entity signals (design Lane A A4/A5)_
    - _Preservation: existing valid structured data and redirects unchanged (Req 3.1, 3.2)_
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 3.5 Rendering/runtime verification (OpenNext/Cloudflare)
    - Verify programmatic pages serve fully server-rendered HTML (not JS-only) to crawlers, and that KV-cached renders are not serving stale/empty HTML that reads as a soft-404
    - Confirm the Node.js runtime (not Edge) is used for these routes per OpenNext guidance
    - _Bug_Condition: isBugCondition(X) where a crawled page returns stale/empty HTML reading as soft-404 from design_
    - _Expected_Behavior: full content + JSON-LD present in the initial server HTML response_
    - _Preservation: ISR revalidation (86400 on programmatic pages, 3600 on sitemap) continues to function (Req 3.4)_
    - _Requirements: 2.6, 2.8_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Sitemap Hygiene, Content Uniqueness & Structured-Data Validity
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms every sitemap URL is a clean `200`, `/tools/*` siblings fall below the similarity threshold, and every sampled page has a valid self-referential canonical + JSON-LD
    - Run the bug condition exploration test from task 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms the bug is fixed)
    - _Requirements: 2.3, 2.4, 2.6, 2.7, 2.8_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Buggy URLs & Signals Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run the preservation property tests from task 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions to homepage indexing, auth-route exclusion, misspelling/normalization 301s, or existing valid canonical/hreflang/JSON-LD)
    - Confirm all tests still pass after the fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run the full test suite (exploration test from task 1, preservation tests from task 2, unit/property/integration tests) and the sitemap audit against a fresh build
  - Confirm the bug condition test passes, all preservation tests pass, and the CI sitemap-hygiene guard is active
  - Ensure all tests pass; ask the user if questions arise
  - **Reminder**: After deploy, the design's Manual / Operational Actions (GSC "Validate Fix" + re-indexing, real `sameAs` profile creation, Google Business Profile, backlink outreach) must be performed by the user and monitored in GSC over weeks — these are out of code scope and not part of this checkpoint
  - _Requirements: 2.3, 2.4, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

## Task Dependency Graph

```
Task 1 (Bug Condition exploration test — MUST FAIL on unfixed code)
   │
   ▼
Task 2 (Preservation tests — MUST PASS on unfixed code)
   │
   ▼
Task 3 (Fix)
   ├─ 3.1 Sitemap hygiene automation + cleanup
   ├─ 3.2 Programmatic content uniqueness
   ├─ 3.3 Canonical / structured-data audit
   ├─ 3.4 Brand-entity reinforcement + internal linking
   ├─ 3.5 Rendering/runtime verification (OpenNext/Cloudflare)
   ├─ 3.6 Verify Task 1 test now PASSES        (depends on 3.1–3.5)
   └─ 3.7 Verify Task 2 tests still PASS         (depends on 3.1–3.5)
   │
   ▼
Task 4 (Checkpoint — all tests pass)             (depends on 3.6, 3.7)
```

- Task 1 must be written and run first; it must FAIL on the unfixed code to confirm the bug.
- Task 2 must be written and run before the fix; it must PASS on the unfixed code to establish the baseline.
- Tasks 3.1–3.5 implement the fix and can proceed in parallel where files do not overlap.
- Tasks 3.6 and 3.7 re-run the SAME tests from Tasks 1 and 2 (no new tests) after the fix.
- Task 4 is the final gate once 3.6 and 3.7 pass.

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1"],
      "description": "Write and run the bug condition exploration test; it must FAIL on unfixed code."
    },
    {
      "wave": 2,
      "tasks": ["2"],
      "description": "Write and run preservation property tests; they must PASS on unfixed code."
    },
    {
      "wave": 3,
      "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5"],
      "description": "Implement the fix across sitemap, content, canonical/schema, brand-entity, and runtime (parallel where files do not overlap)."
    },
    {
      "wave": 4,
      "tasks": ["3.6", "3.7"],
      "description": "Re-run the SAME tests from Tasks 1 and 2 after the fix; both must PASS."
    },
    {
      "wave": 5,
      "tasks": ["4"],
      "description": "Final checkpoint — full suite and sitemap audit pass."
    }
  ]
}
```

## Notes

- **Test-first, no-fix-on-red for Task 1**: Task 1 is expected to fail on unfixed code. Do NOT patch code or the test when it fails — the failure is the confirmation that the sitemap-hygiene and content-duplication bugs exist. It flips to green only after the fix (Task 3.6).
- **Observation-first for Task 2**: Capture the actual current behavior of misspelling redirects, auth-route exclusion, and existing JSON-LD before writing assertions, so preservation tests encode real (not assumed) behavior.
- **Property format**: Property 1 encodes the Bug Condition (and its Expected Behavior after the fix); Property 2 encodes Preservation. These use the `**Property N:**` format so hover status works.
- **Out of scope (operational, verified via GSC over weeks, NOT code tasks)**: ranking-position improvement, knowledge-panel appearance, brand-entity dominance, creating real `sameAs` social profiles, claiming a Google Business Profile, and backlink outreach. See the design's "Manual / Operational Actions" section.
- **Runtime watch-item**: On the OpenNext/Cloudflare runtime, KV-cached rendered HTML does not expire on its own; confirm crawlers receive fully server-rendered HTML (not JS-only) and no stale/empty renders read as soft-404 (Task 3.5).
