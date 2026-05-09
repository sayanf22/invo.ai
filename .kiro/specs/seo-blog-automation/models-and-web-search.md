# Bedrock Model Selection & Web Search

## Does Bedrock have models with built-in web search?

**Yes — only Amazon Nova 2 models (launched December 2025).**

| Model | Web Search? | Input $/1M | Output $/1M | Notes |
|---|---|---|---|---|
| Nova Lite v1 | ❌ | $0.06 | $0.24 | Cheapest. Use for evergreen content |
| **Nova 2 Lite** | ✅ | $0.17 | $0.68 | 3x cost, built-in web grounding with citations |
| Nova Pro | ❌ | $0.80 | $3.20 | Larger model, no web search |
| Nova 2 Pro | ✅ | higher | higher | Flagship. Overkill for blog posts |
| Claude Haiku / Sonnet | ❌ (on Bedrock) | higher | higher | Web search only on Anthropic direct API |
| Llama / Mistral / DeepSeek | ❌ | varies | varies | No built-in search |

### Alternative web search options on AWS
1. **Bedrock AgentCore Browser Tool** — full browser automation, expensive (~$0.50/hour)
2. **Build your own** — Lambda + Brave/Serper/Tavily API ($0-50/mo depending on volume)
3. **Nova Multimodal Embeddings + your own index** — for RAG, not search

## Our model selection logic

Implemented in `lib/blog-generator.ts`:

```typescript
const useWebSearch = input.category === "news"
const modelId = useWebSearch ? NOVA_2_LITE_MODEL_ID : NOVA_LITE_MODEL_ID
```

**Why this split:**

| Category | Model | Why |
|---|---|---|
| `guides` | Nova Lite v1 | Evergreen, training data sufficient |
| `templates` | Nova Lite v1 | Static content, no recency needed |
| `country` | Nova Lite v1 | Tax rules rarely change; AI knows them |
| `tips` | Nova Lite v1 | Best practices are evergreen |
| `comparisons` | Nova Lite v1 | Competitor features change slowly |
| `news` | **Nova 2 Lite** | Needs current info with citations |

### Cost impact

At 1 post/day, 2000 words each:
- 100% Nova Lite v1: **$1.82/year**
- 100% Nova 2 Lite (all with web search): **~$5.50/year**
- Mix (10% news, 90% evergreen): **~$2.20/year**

Even at 3x cost for news posts, annual spend stays under $10. Negligible.

## Testing

`scripts/test-bedrock.mjs` validates the API key and prints a sample call:

```bash
node scripts/test-bedrock.mjs
```

Expected output on success:
- Response text from Nova
- Input/output token counts
- Cost per call
- Projected yearly cost

### Common errors

**401 Unauthorized**
→ API key is invalid. Regenerate in AWS Console → Bedrock → API keys.

**403 Forbidden**
→ Model access not enabled. Go to AWS Console → Bedrock → Model access → Request access to "Amazon Nova Lite" (and "Amazon Nova 2 Lite" if you want web search).

**429 Too many tokens per day**
→ You hit the daily quota (most likely on a free/new account). Either:
- Wait 24 hours
- Request a quota increase in AWS Service Quotas console
- Generate fewer posts per day temporarily
