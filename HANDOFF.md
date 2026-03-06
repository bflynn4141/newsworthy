# Newsworthy — Session Handoff

> Last updated: 2026-03-06

## Current State

### Contracts (World Chain, chain ID 480)

| Contract | Address | Status |
|----------|---------|--------|
| MockAgentBook | `0x04436Df79E8A4604AF12abe21f275143e6bF47f2` | Live |
| FeedRegistry | `0x0156424Ae6112135c5371ddfba1668a706A6a57B` | Live, 8 items, all accepted |
| NewsToken | `0x11D1E765302a53e44b172931f963e64BDc6b301D` | Live, minter = FeedRegistry |
| NewsStaking | `0x42329d3BA44455D3087Da6C912da5123282E343b` | Live, no stakers yet |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | World Chain native USDC |

### x402 Paid API (Cloudflare Worker) — LIVE

**URL:** `https://newsworthy-api.bflynn4141.workers.dev`

| Endpoint | Status | Access |
|----------|--------|--------|
| `GET /health` | 200 | Public |
| `GET /stats` | 200 | Public — returns item counts, agent count |
| `GET /stats/agents` | 200 | Public — agent leaderboard by reputation |
| `GET /feed` | 402 | $0.01 USDC on Base mainnet via x402 |
| `GET /feed/:id` | 402 | $0.01 USDC — single article detail |
| `GET /pending` | 402 | $0.01 USDC — items in challenge period |
| `POST /sync` | 200 | Secret-gated (`x-sync-secret` header) |

**x402 config:**
- Facilitator: `https://facilitator.payai.network` (PayAI — supports Base mainnet)
- Network: `eip155:8453` (Base mainnet)
- Asset: USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Price: $0.01 per request
- PayTo: `0xA145882271662D59362924B3fD2Ed22Df5B9331c` (deployer)

**D1 Database:** `newsworthy-db` (ID: `d92c3799-7ec2-4712-b74d-3054760b2e4f`)
- Synced with 8 items from chain, all marked accepted
- Tables: articles, agent_scores, agentkit_usage, agentkit_nonces

**Known issue:** The event indexer (`/sync`) doesn't capture `ItemResolved` events — the event signature in the sync code doesn't match the actual contract events. Items 0-7 were manually updated to accepted status via D1.

### Agent CLI + TUI Dashboard

- Full $NEWS awareness (balance, newsPerItem, daily limits)
- USDC bonds (replaced ETH)
- Dashboard animations (number lerp, countdown urgency, status flash)
- **L hotkey** — toggles $NEWS leaderboard overlay (reads NewsRewarded events from chain)
- **Leaderboard CLI** — `bun run src/cli.ts --test leaderboard`
- Reputation starts at 3.0 (Bayesian blend, not flat 5.0)
- All tests passing (20 FeedRegistry + 14 NewsStaking)

### Wallets

- **Deployer**: `0xA145882271662D59362924B3fD2Ed22Df5B9331c` (humanId 1, keystore `~/.foundry/keystores/deployer`, pw `forge2026`)
- **Migrator**: `0x656aC590e02E7567C5bb58c0A30474Fdb8435f8C` (humanId 2, key `.secrets/migrator.key`)

### $NEWS Leaderboard

| Rank | Address | Earned | Items |
|------|---------|--------|-------|
| 1 | `0xa145...331c` (deployer) | 500 $NEWS | 5 |
| 2 | `0x656a...5f8c` (migrator) | 300 $NEWS | 3 |

---

## Production Plan

### Two-Tier Architecture

```
Agents (CLI/Claude Code)          Users (World App)
       |                                |
  x402 API (Base)               Direct on-chain (Base)
  AgentKit extension            MiniKit + World ID
  verified = free               register in AgentBook
  unverified = $0.01            submit / vote / challenge
       |                                |
       +------------ AgentBook ---------+
                 (World's, on Base)
           0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4
```

**Key insight:** Agents and users share the same AgentBook identity. Register once via World ID, interact everywhere.

### Phase 1: Gameplay Iteration (CURRENT)

Testing with MockAgentBook on World Chain. All game mechanics live here.

- FeedRegistry, NewsToken, NewsStaking on World Chain (480)
- MockAgentBook for instant test registration
- Iterate on bond amounts, challenge periods, voting mechanics
- Run edge case simulations (sybil, collusion, quorum)
- **Admin functions added** — owner can tune parameters without redeploying

### Phase 2: Frontends

Build both frontends while still on World Chain + MockAgentBook.

**Web App (public feed viewer)**
- React/Next.js, deployed to Vercel
- Free public endpoint for human visitors (add to API if needed)
- x402 gate stays for agent-to-agent queries
- Show: accepted items, leaderboard, registry stats

**World App (mini app for curation)**
- `@worldcoin/minikit-js` (v1.11.0) + `@worldcoin/minikit-react` (v1.9.14)
- Browse the feed + vote on submissions
- Mock World ID for testing (switch to real when migrating)
- Submit articles + challenge questionable items

### Phase 3: Base Migration (WHEN READY)

Trigger: game mechanics stable + frontends working + real humans ready to test.

1. Deploy NewsToken, NewsStaking, FeedRegistry on Base mainnet
2. FeedRegistry constructor: `agentBook = 0xE1D1D3526A6FAa37eb36bD10B933C1b77f4561a4` (World's AgentBook on Base)
3. `bondToken = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base)
4. Install `@worldcoin/agentkit` from `github:worldcoin/agentkit`
5. Wire `createAgentkitHooks()` into x402 middleware — verified agents = free, bots = $0.01
6. Update World App to use real World ID verification via MiniKit
7. Update API worker RPC + contract addresses
8. Update agent CLI config

**World's AgentKit repo:** `github.com/worldcoin/agentkit` (not on npm yet, install from GitHub)
**AgentKit package:** `@worldcoin/agentkit` (in `agentkit/` workspace of the repo)
**Dependencies:** `@x402/core`, `siwe`, `viem`, `zod`

### Phase 4: Growth

- Auto-accepter cron (Cloudflare scheduled trigger)
- Pimlico/ERC-4337 for gasless UX (users only need USDC)
- Revenue deposit cron → x402 income to $NEWS stakers
- Agent SDK: let Claude Code agents query + submit programmatically

---

## Remaining Work (Current Phase)

### P1 — Fix event indexer
The `/sync` endpoint doesn't capture `ItemResolved` events. Fix the event signature matching in `api/src/indexer/sync.ts`.

### P1 — Auto-accepter cron
Cloudflare scheduled trigger that calls `acceptItem()` on items past their challenge period. Currently done manually via CLI.

### P1 — Build web app
Public feed viewer. React/Next.js on Vercel.

### P1 — Build World App mini app
Curation UI with voting. MiniKit SDK.

### P2 — Pimlico gasless transactions
ERC-4337 so users don't need ETH for gas.

### P2 — Revenue deposit cron
Batch `depositRevenue()` calls to NewsStaking.

### P3 — Remaining tweet migration
4 tweets from v3 still not in v4.

---

## File Map

```
contracts/
  src/
    FeedRegistry.sol      -- Core registry (submit, challenge, vote, resolve, accept, withdraw)
    NewsToken.sol         -- ERC-20 reward token ($NEWS), minted on accepted items
    NewsStaking.sol       -- Stake $NEWS, earn USDC from x402 revenue
    interfaces/           -- IERC20, INewsToken
  test/                   -- 34 tests total
  deployments/
    worldchain-test.json  -- ACTIVE deployment (v4 with MockAgentBook, USDC bonds, $NEWS)
    worldchain-mainnet.json -- Production AgentBook deployment (real World ID)

agent/
  src/
    cli.ts                -- Terminal CLI (status, items, submit, accept, leaderboard, dashboard)
    curate.ts             -- ABI definitions (FeedRegistry, ERC20)
    curator.ts            -- Autonomous curation loop
    dashboard/
      App.tsx             -- Dashboard root (interactive + read-only modes)
      Header.tsx          -- Status bar (balances, daily limit, $NEWS)
      LeaderboardPanel.tsx -- $NEWS earnings leaderboard (L hotkey)
      ItemCard.tsx        -- Item display with animations
      DetailPanel.tsx     -- Expanded item view
      Footer.tsx          -- Hotkey legend
      useFeedData.ts      -- On-chain data fetching hook
      useNavigation.ts    -- Keyboard navigation + hotkeys (L, S, F, Q)
      useAnimatedValue.ts -- Smooth number transitions
      useStatusFlash.ts   -- Status change flash effect
      analyze.ts          -- LLM article analysis + reputation scoring
      sortItems.ts        -- Sort modes (newest, score, reputation)

api/
  src/
    index.ts              -- Hono router (health, stats, feed, pending, sync)
    types.ts              -- Env bindings type
    middleware/
      x402-agentkit.ts    -- x402 payment middleware (PayAI facilitator, Base mainnet)
    routes/
      feed.ts             -- Feed + article detail queries
      stats.ts            -- Registry overview + agent leaderboard
    indexer/
      sync.ts             -- Event sync from chain to D1
    parser/
      parse.ts            -- URL metadata extraction
  wrangler.toml           -- Worker config (D1, contract addresses, RPC)
  schema.sql              -- D1 table definitions

.secrets/
  deployer.key            -- Deployer private key (DO NOT COMMIT)
  migrator.key            -- Migrator private key
```

## Quick Start

```bash
# Run contract tests
cd contracts && forge test -vv

# Start TUI dashboard (interactive)
cd agent && bun run src/cli.ts --test dashboard

# CLI commands
bun run src/cli.ts --test status        # Registry overview
bun run src/cli.ts --test items         # List all items
bun run src/cli.ts --test leaderboard   # $NEWS earnings ranking
bun run src/cli.ts --test submit <url>  # Submit a tweet

# Deploy API changes
cd api && npx wrangler deploy

# Sync D1 from chain
curl -X POST "https://newsworthy-api.bflynn4141.workers.dev/sync?from=26707740" \
  -H "x-sync-secret: newsworthy-sync-2026"

# Test x402 gate
curl https://newsworthy-api.bflynn4141.workers.dev/feed  # Returns 402
curl https://newsworthy-api.bflynn4141.workers.dev/stats  # Returns JSON
```

## Key RPC

- **World Chain:** `https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x`
- Events start at block `26707740`
- **NOTE:** CLI uses `--test` flag because active contracts are in `worldchain-test.json` (the v4 deploy)
