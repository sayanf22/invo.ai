# SEO Blog Automation — Industry-Grade Content Engine

## Research Summary (2025 SaaS SEO Best Practices)

Based on analysis of HubSpot, Zapier, Notion, Stripe, and top SaaS content marketing strategies:

### What makes top blogs rank
1. **E-E-A-T signals** (Experience, Expertise, Authoritativeness, Trust) — Google's core quality rubric
2. **Long-form pillar pages** (2000-3000 words) for primary keywords
3. **Hub-and-spoke model** — pillar + supporting articles with internal linking
4. **Schema markup** — Article, FAQ, HowTo, BreadcrumbList on every post
5. **Publishing cadence** — 2-5 posts/week minimum for authority building
6. **Programmatic SEO** — Zapier ranks for 10K+ keywords via integration pages
7. **Freshness signals** — regular content updates (Google favors recent content)
8. **AI Overviews optimization** — structured, scannable content that AI can cite

### The pain points this project has
- 33 hardcoded blog posts in `lib/blog-data.ts` — can't scale beyond that
- No automation — every post requires manual coding
- No daily publishing — hurts SEO freshness signals
- No database backing — can't A/B test, can't track views
- No LLM generation — slow to create content

---

## Architecture

### Storage Split
- **Supabase** → post metadata (title, slug, keywords, status, dates, views)
- **Cloudflare R2** → actual content (HTML body)

**Why split?** Supabase free tier is 500MB. Storing full article HTML in Postgres burns it fast. R2 is 10GB free, ~$0.015/GB/month after. Content scales to 10,000+ posts for under $1/mo.

### AI Model
- **Amazon Nova Lite v1** on Bedrock — default for evergreen content
  - Pricing: $0.06/MTok input, $0.24/MTok output
  - Per blog post cost: ~$0.005 (half a cent for a 2000-word post)
- **Amazon Nova 2 Lite** — used only for `news` category (built-in web search)
  - Pricing: $0.17/MTok input, $0.68/MTok output
  - Per blog post cost: ~$0.015 (with citations from live web)
- 1 post/day, mostly evergreen: **~$2.20/year**
- See `.kiro/specs/seo-blog-automation/models-and-web-search.md` for details

### Flow

```
Topic Queue → Cron Job (daily) → Bedrock (Nova Lite)
                                       ↓
                                 Generate article
                                       ↓
                        Save HTML → R2 (.html file)
                                       ↓
                   Save metadata → Supabase (blog_posts table)
                                       ↓
                              Admin review (optional)
                                       ↓
                              Status → "published"
                                       ↓
                          Revalidate /blog pages
                                       ↓
                         Sitemap picks up new URL
```

---

## Implementation Phases

### Phase 1 — Database Schema (5 min)
Create `blog_posts` and `blog_topic_queue` tables in Supabase.

### Phase 2 — R2 Storage Helper (10 min)
Already have R2 credentials. Add `lib/r2-storage.ts` for put/get HTML files.

### Phase 3 — Bedrock Client (15 min)
Add `lib/bedrock.ts`. Decode existing base64 API key. Use Nova Lite via Converse API.

### Phase 4 — Content Generator (20 min)
`lib/blog-generator.ts` — takes topic + keyword, produces SEO-optimized article with:
- 2000-2500 words
- Proper H1/H2/H3 hierarchy
- Intro hook + body + FAQ + conclusion
- Internal links to `/pricing`, `/tools/*`, related posts
- Meta description + title
- Featured image alt text

### Phase 5 — Admin API (15 min)
- `POST /api/admin/blog/generate` — manually trigger generation for a topic
- `POST /api/admin/blog/publish` — move draft → published
- `GET /api/admin/blog/list` — list posts with status filter

### Phase 6 — Cron Job (10 min)
- `POST /api/cron/generate-blog` — runs daily via Cloudflare Cron Triggers
- Pulls next topic from queue, generates, saves as draft

### Phase 7 — Blog Reader Updates (15 min)
Update `lib/blog-data.ts` to merge hardcoded posts + DB posts.
Update `/blog/[slug]` to fetch content from R2 at request time (with ISR caching).

### Phase 8 — Topic Seed (5 min)
Seed 100 high-intent topics into `blog_topic_queue`:
- "How to create a GST invoice in India"
- "Free invoice templates for freelancers"
- "How to chase unpaid invoices legally"
- "FreshBooks vs Clorefy comparison"
- etc.

---

## SEO Quality Bar (Every Post Must Have)

| Element | Requirement |
|---------|-------------|
| Length | 1500-3000 words |
| H1 | Keyword in H1 |
| H2s | 5-8 section headers, keyword variations |
| Intro | First 100 words include primary keyword |
| FAQs | 4-6 questions at end, triggers FAQ rich snippet |
| Internal links | Minimum 3 links to product/pricing pages |
| External links | Minimum 2 to authoritative sources |
| CTAs | 2-3 conversion-focused CTAs |
| Schema | Article + FAQPage + BreadcrumbList |
| Meta desc | 150-160 chars, benefit-focused |
| Alt text | Descriptive, keyword-rich |
| Reading time | Auto-calculated from word count |

---

## Topic Categories (Prioritized)

### Tier 1 — High commercial intent (do first)
1. Comparison content: "Clorefy vs [Competitor]"
2. Country-specific: "How to create [document] in [country]"
3. Use case: "[Industry] [document] template"
4. Alternatives: "Best [competitor] alternatives"

### Tier 2 — Educational (trust building)
5. How-to guides: "How to [business task]"
6. Tax/compliance guides: "Understanding GST/VAT for SMBs"
7. Legal guides: "What should a contract include"

### Tier 3 — Long-tail (volume)
8. Templates: "[Document type] template for [industry]"
9. Tips/best practices: "10 ways to get paid faster"
10. Glossary/definitions: "What is an SOW"

---

## Expected Outcomes

| Metric | Month 1 | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Blog posts | 60 | 120 | 200+ |
| Indexed pages | 50 | 110 | 180+ |
| Organic traffic | 200-500 | 2K-5K | 10K-20K |
| Ranking keywords | 30-50 | 150-300 | 500-1000 |
| Cost per month | $0.10 | $0.10 | $0.15 |

---

## Safety & Quality Controls

1. **Draft-first** — AI posts saved as draft, admin reviews before publishing
2. **Dedup check** — before generating, check if topic already published
3. **Quality gate** — rejects posts under 1500 words or missing required elements
4. **Rate limiting** — max 2 posts/day via cron (Google penalizes content floods)
5. **Plagiarism-safe** — Nova Lite generates original content, not scraped
6. **Human editorial** — admin can edit any post via CMS before publishing
7. **Audit trail** — all AI generations logged with model version, prompt, cost
