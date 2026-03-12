# Autonomous Newsworthy Agent — Skill Spec

## Overview

A continuously-running agent that discovers AI and crypto news from official brand accounts on Twitter/X, filters for genuinely newsworthy stories (product launches, breakthroughs — not partnerships or fluff), deduplicates against existing submissions, and submits them on-chain for curation rewards.

---

## 1. Onboarding Flow (AgentCash-inspired, World ID-secured)

### Goal
Any World ID-verified human can get a wallet + seed USDC to start submitting news and earning $NEWS tokens — zero upfront cost.

### Flow

```
World App user taps "Start Curating"
  → World ID Orb verification (proof of unique human)
  → Para pregenerated wallet created (tied to World ID nullifier hash)
  → Protocol treasury seeds wallet with 1 USDC (one bond)
  → Agent registered in AgentBook (humanId assigned)
  → Ready to submit
```

### Design Decisions

| Decision | AgentCash | Newsworthy |
|----------|-----------|------------|
| Sybil prevention | Soft scoring (GitHub/Twitter reputation) | World ID Orb (hard, one-per-human) |
| Seed amount | Up to $25 | 1 USDC (exactly one bond) |
| Chain | Base | World Chain (480) |
| Wallet | Coinbase Agentic Wallet | Para pregenerated wallet |
| Funding source | Company treasury ($100k pool) | Protocol treasury or grant |
| Replenishment | User tops up manually | Earned from accepted submissions (bond return + NEWS) |

### Why 1 USDC seed (not more)
- 1 USDC = exactly one submission attempt
- If the submission is good → bond returned + NEWS tokens → self-sustaining
- If bad → they lose 1 USDC, need to fund themselves for more
- Limits sybil damage to 1 USDC per World ID
- Protocol cost: ~$1 per verified human onboarded

### Implementation Notes
- Para Server SDK already used in `bot/src/para.ts` for pregenerated wallets tied to X usernames
- Same pattern: create wallet tied to World ID nullifier hash instead
- AgentBook registration: `register(walletAddress, worldIdProof)` — already exists
- Seed transfer: protocol treasury calls `USDC.transfer(newWallet, 1e6)` after verification
- Consider: treasury contract with `claimSeed(worldIdProof)` to make it permissionless and on-chain

---

## 2. News Discovery (twit.sh + X Lists)

### Strategy: Curated X List Polling

**Why X Lists**: One `get_list_tweets` call ($0.01) returns all tweets from every account on the list. Polling 30+ accounts individually would cost 30x more.

**Cost model**:
| Polling interval | Calls/day | Cost/day |
|-----------------|-----------|----------|
| Every 15 min | 96 | $0.96 |
| Every 30 min | 48 | $0.48 |
| Every hour | 24 | $0.24 |

**Recommended**: Every 30 minutes during peak hours (8am-8pm UTC), hourly off-peak. ~36 calls/day = **$0.36/day**.

### X List Composition

**Tier 1 — AI Labs & Products** (highest signal):
```
@OpenAI, @AnthropicAI, @GoogleDeepMind, @xaboratory, @Meta, @MistralAI,
@CohereAI, @StabilityAI, @midaborney, @RunwayML, @ElevenLabsio,
@peraborexity_ai, @cursor_ai, @reaborit, @Vercel, @huggingface
```

**Tier 2 — Crypto Protocols & Infra**:
```
@ethereum, @solana, @base, @worldcoin, @coinbase, @Uniswap,
@AaveAave, @MakerDAO, @chainlink, @optimism, @arbitrum,
@0xPolygon, @StarkWareLtd, @eigenlayer, @celestia
```

**Tier 3 — Crypto Companies & Products**:
```
@naboreon_tech, @paradigm, @a16zcrypto, @circle, @Ledger,
@zeraboron_io, @alchemy, @infura_io, @thegraph
```

> **Important**: This list should be maintained as a real X List (not just code config) so it can be updated without redeploying. Store the List ID in config.

### Query Approach

```
1. get_list_tweets(listId, since: lastPollTimestamp)
   → Returns all new tweets from list members

2. For each tweet, apply filters (Section 3)

3. Surviving tweets → dedup check (Section 4)

4. Passing tweets → quality scoring → submit queue
```

### Fallback: Keyword Search

If X List approach hits limits, fall back to targeted searches:

```
search_tweets(words: "launching today", minLikes: 500, since: yesterday)
search_tweets(phrase: "now available", from: "OpenAI")
search_tweets(words: "mainnet launch", minLikes: 200, since: yesterday)
```

Cost: $0.01 per search query.

---

## 3. Quality Filtering — What Is Newsworthy?

### The Core Rule

**Newsworthy = something tangible happened or shipped.** A product launch, a model release, a mainnet deployment, a major upgrade, an acquisition. Something users can interact with today.

### YES — Submit These

| Category | Signal words | Example |
|----------|-------------|---------|
| Product launch | "launching", "now available", "introducing", "meet", "try it" | "Introducing GPT-5 — available today in ChatGPT" |
| Model release | "releasing", "open source", "weights available" | "Llama 4 is now open source" |
| Protocol upgrade | "mainnet", "v2 live", "upgrade complete", "deployed" | "Uniswap v4 is live on Ethereum mainnet" |
| Research breakthrough | "paper", "we found", "breakthrough", "new technique" | "Our new reasoning approach scores 95% on MATH" |
| Major milestone | "billion", "million users", "record" | "ChatGPT reaches 500M weekly users" |
| Acquisition/IPO | "acquired", "IPO", "going public" | "Databricks acquires MosaicML" |
| Regulatory/legal | "approved", "ruling", "legislation" | "EU AI Act enforcement begins" |

### NO — Skip These

| Category | Why it's not newsworthy | Example |
|----------|----------------------|---------|
| Partnerships | Vaporware, no user impact | "Excited to partner with X to explore Y" |
| Hiring/team | Internal company ops | "We're hiring! Join our team" |
| Event appearances | Self-promotion | "Come see us at ETHDenver booth 42" |
| Retweets/threads | Not original announcements | RT @someone: ... |
| Opinion/commentary | Not news, just takes | "AI will change everything in 2026" |
| Engagement bait | Metrics farming | "What's your favorite AI tool? 👇" |
| Price/trading | Not product news | "$ETH breaks $5,000" |
| Fundraising | Money moved, nothing shipped | "We raised $50M Series B" |
| Vague teasers | Nothing concrete | "Something big is coming... 👀" |

### Filter Implementation

```typescript
interface FilterResult {
  pass: boolean;
  category: string;       // from YES table
  confidence: number;     // 0-1
  reason: string;         // why it passed or failed
}

// Two-stage filter:
// 1. Fast regex/keyword pre-filter (free, eliminates ~70% of noise)
// 2. LLM classification for borderline cases (costs OpenRouter credits)
```

**Stage 1 — Keyword Pre-Filter** (eliminates obvious non-news):
```
SKIP if tweet contains:
  - "hiring", "join our team", "we're looking for"
  - "partner with", "partnering", "partnership"
  - "come see us", "booth", "speaking at"
  - "giveaway", "airdrop", "free mint"
  - "RT @", starts with "🧵" (thread)
  - "what do you think", "comment below", "👇"
  - is a reply (not an original tweet)
  - has < 50 likes (too low signal for brand accounts)

PASS TO STAGE 2 if tweet contains:
  - "launching", "launch", "shipped", "live", "available"
  - "introducing", "announcing", "released", "deployed"
  - "mainnet", "testnet", "v2", "v3", "upgrade"
  - "open source", "weights", "model", "API"
  - "breaking", "just in", "happening now"
```

**Stage 2 — LLM Classification** (for tweets that pass pre-filter):
```
Prompt: "Is this tweet announcing something tangible that happened
or shipped? Rate 1-10 where 10 = definitive product/feature launch
and 1 = vague/promotional. Respond with JSON: {score, category, reason}"

Submit if score >= 7
```

### Brand Account Verification

Only process tweets from accounts on our curated X List. This is the primary filter against personal accounts and influencers. The list IS the allowlist.

If using keyword search (fallback), additionally check:
- Account has > 10k followers
- Account has a verified checkmark
- Account bio contains company/project indicators
- Cross-reference against known brand account database

---

## 4. Deduplication — Ensuring Uniqueness

### Three Layers of Dedup

**Layer 1: URL Dedup (free, on-chain)**
```
FeedRegistryV2.submitItem() reverts with DuplicateUrl if URL already submitted.
```
This catches exact URL matches. But different tweets about the same news won't match.

**Layer 2: API Feed Check (free, off-chain)**
```
GET /feed → all accepted items
GET /feed/open → currently voting items

Check if any existing item's URL or title matches the candidate.
```
This catches items already in the pipeline, even if URLs differ.

**Layer 3: Semantic Dedup (LLM, costs OpenRouter credits)**
```
Compare candidate tweet against recent feed items (last 48 hours):
- Extract the core news event from the candidate
- Compare against summaries of recent items
- If same event covered → skip

Prompt: "Is this tweet covering the same news event as any of these
recent items? [list of recent titles/summaries]. Respond YES/NO with
which item it duplicates."
```

### URL Normalization
Before any check, normalize tweet URLs:
```
https://twitter.com/user/status/123?s=20  → https://x.com/user/status/123
https://x.com/user/status/123?ref=...     → https://x.com/user/status/123
```
Strip query params, normalize twitter.com → x.com.

### Dedup Window
- Check against last **48 hours** of submissions (open + accepted)
- Major stories may be tweeted by multiple accounts on our list — only submit the first one
- Track submitted tweet IDs locally to avoid re-processing

---

## 5. Submission Pipeline

### End-to-End Flow

```
Every 30 minutes:
  1. POLL    — get_list_tweets(listId, since: lastPoll) via twit.sh ($0.01)
  2. FILTER  — keyword pre-filter (free) → LLM classify survivors ($0.005 each via OpenRouter)
  3. DEDUP   — check URL + API feed + semantic match
  4. QUEUE   — surviving tweets added to submission queue
  5. SUBMIT  — for each queued item:
               a. Check USDC balance ≥ bondAmount (1 USDC)
               b. Approve USDC if needed
               c. submitItem(tweetUrl, category) — category = 'ai' or 'crypto'
               d. curl /sync to index the new item
               e. Wait for analysis (auto via API cron)
  6. TRACK   — log submission: {tweetId, itemId, txHash, timestamp}
  7. RESOLVE — check for items past votingWindow, call resolve()
```

### Rate Limiting
- Max submissions per cycle: 3 (don't flood the feed)
- Min time between submissions: 5 minutes (gas pacing)
- Daily cap: configurable, default 10 (matches maxDailySubmissions if set)
- Pause if USDC balance < 2 USDC (keep buffer for votes)

### Category Detection
```
'ai' if tweet is from Tier 1 accounts OR mentions AI/ML/LLM keywords
'crypto' if tweet is from Tier 2/3 accounts OR mentions blockchain/token/protocol keywords
'' (empty) if ambiguous — let the analyzer decide
```

---

## 6. Economics — Can This Be Profitable?

### Costs Per Day

| Item | Cost | Notes |
|------|------|-------|
| twit.sh polling | $0.36 | 36 calls/day at $0.01 |
| LLM filtering | ~$0.10 | ~20 candidates × $0.005 each |
| LLM dedup | ~$0.05 | ~10 survivors × $0.005 each |
| Submission bonds | $5.00 | 5 submissions × 1 USDC (returned if accepted) |
| Gas fees | ~$0.01 | World Chain gas is negligible |
| **Total daily spend** | **~$5.52** | **$0.52 non-recoverable + $5.00 bonds** |

### Revenue Per Day

| Item | Revenue | Notes |
|------|---------|-------|
| Bond returns | $5.00 | If all 5 submissions accepted (100% rate) |
| Bond returns | $4.00 | If 4/5 accepted (80% rate) |
| NEWS tokens | 500 NEWS | 5 accepted items × 100 NEWS each |
| Vote rewards | Variable | If agent also votes on other items |

### Break-Even Analysis

**Fixed costs** (non-recoverable): ~$0.52/day (polling + LLM)

**Variable costs** (bonds): $1.00 per submission, returned if accepted

**To break even on fixed costs**: Need NEWS tokens to be worth ≥ $0.001 each (500 NEWS × $0.001 = $0.50)

**To profit**: Need high acceptance rate (>80%) + NEWS token value > $0

**Key insight**: The agent is profitable as long as:
1. Acceptance rate stays high (good filtering = good submissions)
2. NEWS tokens have any non-zero value
3. The agent doesn't submit garbage that gets rejected (losing bonds)

**The filtering quality IS the business model.** Better filters → higher acceptance → more bonds returned → more NEWS earned → more profit.

### Sustainability Flywheel

```
Good filter → High acceptance rate → Bonds returned + NEWS earned
  → Fund more submissions → More content → More votes → More NEWS value
  → NEWS appreciates → Agent more profitable → Incentivizes more agents
```

---

## 7. Continuous Operation

### Runtime Architecture

```
┌─────────────────────────────────────────┐
│            Agent Process (bun)          │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ Poller   │→ │ Filter   │→ │Submit │ │
│  │ (twit.sh)│  │ (LLM)    │  │(viem) │ │
│  └──────────┘  └──────────┘  └───────┘ │
│       ↑                          ↓      │
│  ┌──────────┐              ┌──────────┐ │
│  │ Scheduler│              │ Resolver │ │
│  │ (cron)   │              │ (auto)   │ │
│  └──────────┘              └──────────┘ │
│                                         │
│  State: .cache/agent-state.json         │
│  Logs:  .cache/agent-log.jsonl          │
└─────────────────────────────────────────┘
         ↕                    ↕
    twit.sh API          World Chain RPC
    (x402/USDC)          (submit/vote/resolve)
```

### State Management

```json
// .cache/agent-state.json
{
  "lastPollTimestamp": "2026-03-12T14:30:00Z",
  "lastPollNextToken": null,
  "submittedTweetIds": ["1234567890", "0987654321"],
  "submittedUrls": ["https://x.com/OpenAI/status/..."],
  "dailySubmissions": { "2026-03-12": 3 },
  "totalSubmitted": 47,
  "totalAccepted": 41,
  "totalRejected": 6,
  "usdcSpent": 47.00,
  "usdcRecovered": 41.00,
  "newsEarned": 4100
}
```

### CLI Interface

```bash
# Start the agent
bun run agent scout --list-id <X_LIST_ID> --interval 30m

# Dry run (discover + filter, don't submit)
bun run agent scout --dry-run --list-id <X_LIST_ID>

# Manual submission from scout output
bun run agent scout --submit-queue

# Check agent stats
bun run agent scout --stats

# Override: submit a specific tweet immediately
bun run agent submit <tweet-url> [ai|crypto]
```

### Environment / Config

```bash
# Required
WALLET_PRIVATE_KEY=...          # For twit.sh x402 payments (Base USDC)
DEPLOYER_PRIVATE_KEY=...        # For on-chain submissions (World Chain)
OPENROUTER_API_KEY=...          # For LLM filtering + dedup

# Optional
X_LIST_ID=...                   # Twitter/X List ID for brand accounts
POLL_INTERVAL=1800              # Seconds between polls (default: 1800 = 30min)
MAX_DAILY_SUBMISSIONS=10        # Daily submission cap
MIN_LIKES_THRESHOLD=50          # Minimum likes for a tweet to be considered
LLM_SCORE_THRESHOLD=7           # Minimum LLM newsworthiness score (1-10)
SUBMIT_BOND=1000000             # Bond in USDC units (1e6 = 1 USDC)
```

### Monitoring & Alerts

The agent should log to `.cache/agent-log.jsonl` with structured events:

```json
{"ts": "...", "event": "poll", "tweets_found": 12, "cost_usdc": 0.01}
{"ts": "...", "event": "filter", "passed": 3, "rejected": 9, "reasons": {...}}
{"ts": "...", "event": "dedup", "passed": 2, "duplicate": 1}
{"ts": "...", "event": "submit", "url": "https://x.com/...", "itemId": 48, "tx": "0x..."}
{"ts": "...", "event": "resolve", "itemId": 45, "accepted": true, "news_earned": 100}
{"ts": "...", "event": "balance", "usdc": 4.23, "news": 4100}
```

Alert conditions (log to stderr + optional webhook):
- USDC balance < 2.0 (can't submit)
- Acceptance rate drops below 70% over last 10 submissions
- twit.sh API errors (payment failures, rate limits)
- 3+ consecutive submission failures

---

## 8. Open Questions

1. **Treasury funding**: Who seeds the 1 USDC for new users? Protocol treasury contract? Manual transfer? Grant?

2. **NEWS token value**: What gives NEWS value? Staking? Governance? Revenue share? The economics only work if NEWS > $0.

3. **X List curation**: Who maintains the brand account list? Should it be community-governed or admin-controlled?

4. **Multi-agent competition**: If multiple agents run this, they'll race to submit the same news. First-to-submit wins (contract dedup). How do we handle this gracefully?

5. **Vote strategy**: Should the agent also vote on other items (earn from vote rewards)? This adds complexity but improves economics.

6. **Scaling**: At what point does the agent need multiple X Lists (AI list, crypto list, fintech list) with different polling frequencies?

---

## 9. Implementation Priority

### Phase 1 — MVP (get it running)
- [ ] twit.sh integration with X List polling
- [ ] Keyword pre-filter (Stage 1)
- [ ] URL dedup against API feed
- [ ] Auto-submit with bond
- [ ] Basic state tracking + logging
- [ ] CLI: `scout --dry-run` and `scout` modes

### Phase 2 — Quality (get it profitable)
- [ ] LLM classification (Stage 2 filter)
- [ ] Semantic dedup (LLM comparison)
- [ ] Category detection (ai vs crypto)
- [ ] Auto-resolve expired items
- [ ] Stats dashboard: acceptance rate, P&L, NEWS earned

### Phase 3 — Onboarding (get others running it)
- [ ] World ID → Para wallet → seed USDC flow
- [ ] Treasury contract for permissionless seed claims
- [ ] Web UI for monitoring agent status
- [ ] Multi-agent coordination (submission queue with claim-before-submit)

### Phase 4 — Scale
- [ ] Multiple X Lists by vertical
- [ ] Vote strategy (earn from voting on others' items)
- [ ] NEWS staking for enhanced rewards
- [ ] Agent reputation system (on-chain track record)
