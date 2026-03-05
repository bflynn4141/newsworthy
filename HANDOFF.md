# Newsworthy — Handoff Document

> Agent-curated crypto intelligence feed on World Chain.
> Last updated: 2026-03-05

## Quick Start

```bash
# Clone and install
git clone https://github.com/bflynn4141/newsworthy.git
cd newsworthy
bun install

# Run CLI against test contracts
bun run agent/src/cli.ts --test status
bun run agent/src/cli.ts --test items

# Submit a test item
bun run agent/src/cli.ts --test submit "https://example.com/news" "metadata-hash"
```

**Requires:** `.secrets/deployer.key` with a private key (hex, with or without `0x` prefix). This key must be funded on World Chain.

---

## Project Overview

Newsworthy is a **token-curated registry (TCR)** for crypto news. AI agents stake ETH to submit URLs, challenge bad submissions, and vote on quality. Humans pay $0.25 via x402 micropayment to read the feed.

**Key differentiator:** Only ERC-8004 registered agents (verified via World ID) can participate, creating Sybil-resistant curation with economic incentives.

See `SCOPE.md` for the full narrative and `ARCHITECTURE.md` for the 5-layer system design.

---

## Repository Structure

```
newsworthy/
├── SCOPE.md                   # Project narrative and build order
├── ARCHITECTURE.md            # 5-layer system design (contract → frontend)
├── PLAN-INK-DASHBOARD.md      # Next feature: Ink TUI dashboard (approved, not started)
├── HANDOFF.md                 # This file
│
├── contracts/                 # Layer 1: Foundry (Solidity)
│   ├── src/
│   │   ├── FeedRegistry.sol          # Core TCR: submit, challenge, vote, resolve
│   │   ├── AgentBook.sol             # ERC-8004 agent registry (World ID gate)
│   │   └── interfaces/               # IAgentBook, etc.
│   ├── test/
│   │   ├── FeedRegistry.t.sol        # Full test suite
│   │   └── mock/                     # MockAgentBook for testing
│   ├── script/
│   │   ├── DeployAgentBook.s.sol
│   │   ├── DeployFeedRegistry.s.sol
│   │   └── DeployTestFeedRegistry.s.sol  # Test deployment (relaxed params)
│   └── deployments/
│       ├── worldchain-mainnet.json   # Production addresses + RPC
│       └── worldchain-test.json      # Test addresses (MockAgentBook, 60s periods)
│
├── agent/                     # Layer 4: Agent CLI + curation logic
│   ├── src/
│   │   ├── cli.ts                    # Main CLI entry point (10 commands)
│   │   ├── curate.ts                 # FeedRegistry ABI + write/read helpers
│   │   ├── register.ts              # AgentBook ABI + registration helpers
│   │   ├── evaluate.ts              # Newsworthiness scoring (stub, needs LLM)
│   │   └── sources.ts               # URL discovery (RSS feeds, stub)
│   ├── tsconfig.json                 # JSX: react-jsx already configured
│   └── package.json                  # Dependencies: viem
│
├── api/                       # Layer 2+3: Cloudflare Worker (x402-gated API)
│   ├── src/
│   │   ├── index.ts                  # Worker entry point
│   │   ├── types.ts                  # Shared types
│   │   ├── routes/
│   │   │   ├── feed.ts               # GET /feed, GET /feed/:id
│   │   │   └── stats.ts             # GET /stats (public)
│   │   ├── indexer/
│   │   │   └── sync.ts              # Contract event indexer
│   │   ├── parser/
│   │   │   └── parse.ts             # URL content extraction
│   │   ├── middleware/
│   │   │   └── x402-agentkit.ts     # x402 payment gate middleware
│   │   └── storage/
│   │       └── d1-agentkit.ts       # D1 database adapter
│   ├── schema.sql                    # D1 schema (articles, agent_scores)
│   ├── wrangler.toml                # Cloudflare Worker config
│   └── package.json
│
├── packages/                  # Shared packages (currently empty workspace)
├── package.json               # Root workspace config (bun workspaces)
└── .secrets/                  # Git-ignored: deployer.key, deployer.env
```

---

## What's Built

### Contracts (DEPLOYED)
- **FeedRegistry.sol** — Full TCR mechanics: submit, challenge, vote, resolve, accept, withdraw
- **AgentBook.sol** — ERC-8004 agent registry with World ID verification
- **Test deployment** on World Chain with MockAgentBook (no World ID needed) and relaxed 60-second periods
- **Mainnet deployment** with real AgentBook
- Addresses in `contracts/deployments/*.json`

### Agent CLI (WORKING)
- 10 commands: `status`, `items`, `item`, `register`, `submit`, `challenge`, `vote`, `resolve`, `accept`, `withdraw`
- `--test` flag switches between test/mainnet deployments
- Full viem integration (public + wallet clients)
- Reads private key from `.secrets/deployer.key`

### API Worker (SCAFFOLDED)
- Cloudflare Worker structure exists
- Routes, indexer, parser, x402 middleware scaffolded but not complete
- D1 schema defined in `schema.sql`
- **Not deployed yet**

### Evaluation & Sources (STUBS)
- `evaluate.ts` — Scoring rubric defined (5 criteria, 0-100 scale), but returns placeholder scores. Needs LLM integration.
- `sources.ts` — RSS feed list defined, but `fetchRssFeeds()` returns empty array. Needs XML parser.

---

## What's Next: Ink TUI Dashboard

**Full plan in `PLAN-INK-DASHBOARD.md`** — approved, ready to implement.

A persistent terminal dashboard (built with React Ink) showing all FeedRegistry items organized by status in a 4-column layout. Auto-refreshes every 5s with client-side countdown timers.

### Implementation order:
1. `bun add ink react && bun add -d @types/react` in `agent/`
2. Create `agent/src/dashboard/useFeedData.ts` — data fetching hook
3. Create components: `ItemCard.tsx`, `StatusColumn.tsx`, `Header.tsx`, `Footer.tsx`, `App.tsx`
4. Wire `dashboard` command into `cli.ts` switch statement
5. Handle edge cases: empty state, narrow terminals, overflow, RPC errors

### Key design decisions already made:
- Read-only dashboard (no keyboard interaction beyond Ctrl+C) — avoids Bun input bug
- Client-side countdown timers (1s tick) separate from data refresh (5s tick)
- Terminal width detection: < 80 chars → stacked vertical layout
- Config params (bond, periods) cached, only re-fetched every 60s
- Terminal state items (Accepted/Rejected) cached, never re-fetched

---

## After the Dashboard

These are rough priorities, not a committed roadmap:

1. **LLM evaluation** — Wire `evaluate.ts` to Claude API for real newsworthiness scoring
2. **RSS source fetching** — Implement `sources.ts` with XML parser
3. **API Worker completion** — Deploy to Cloudflare with D1, implement event indexer
4. **x402 payment gate** — Wire up x402 middleware on read endpoints
5. **Frontend** — Simple newspaper-style page (stretch goal)

---

## Chain & Contract Details

| Item | Value |
|------|-------|
| **Chain** | World Chain (chainId: 480) |
| **Explorer** | https://worldchain-mainnet.explorer.alchemy.com |
| **RPC** | In deployment JSON files |
| **Bond (test)** | 0.0001 ETH |
| **Periods (test)** | 60s challenge, 60s voting |
| **Min votes (test)** | 1 |

Test deployment uses `MockAgentBook` which auto-registers any address, so you don't need a World ID to test.

---

## Local Development

```bash
# Prerequisites
bun --version    # needs bun
forge --version  # needs foundry (for contracts only)

# Install all workspaces
bun install

# Run contract tests
cd contracts && forge test

# CLI commands
bun run agent/src/cli.ts --test status
bun run agent/src/cli.ts --test items
bun run agent/src/cli.ts --test submit "https://example.com" "meta"
bun run agent/src/cli.ts --test item 0

# You need .secrets/deployer.key with a funded World Chain private key
```

---

## Key Technical Notes

- **Bun-first**: CLI uses `Bun.file()`, `Bun.argv`, etc. Not Node-compatible without changes.
- **viem for everything**: All contract interaction uses viem (publicClient for reads, walletClient for writes).
- **ABI as const**: Both `FEED_REGISTRY_ABI` and `AGENTBOOK_ABI` are typed `as const` for full viem type inference.
- **Workspaces**: Root `package.json` defines bun workspaces for `packages/*`, `api`, `agent`.
- **tsconfig.json**: Already has `"jsx": "react-jsx"` — ready for Ink/React TSX.
- **No CI/CD**: No GitHub Actions or deployment automation yet.
