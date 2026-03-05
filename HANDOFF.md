# Newsworthy — Session Handoff

> Last updated: 2026-03-05

## What's Done

### Contracts (deployed to World Chain, chain ID 480)

| Contract | Address | Status |
|----------|---------|--------|
| MockAgentBook | `0x04436Df79E8A4604AF12abe21f275143e6bF47f2` | Live |
| FeedRegistry | `0x0156424Ae6112135c5371ddfba1668a706A6a57B` | Live, 6 items submitted |
| NewsToken | `0x11D1E765302a53e44b172931f963e64BDc6b301D` | Live, minter = FeedRegistry |
| NewsStaking | `0x42329d3BA44455D3087Da6C912da5123282E343b` | Live, no stakers yet |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | World Chain native USDC |

### Agent CLI + Dashboard
- Full $NEWS awareness (balance display, newsPerItem, daily limits)
- USDC bonds (replaced ETH)
- Daily submission counter with UTC reset countdown in header
- All tests passing (20 FeedRegistry + 14 NewsStaking)

### Wallets
- **Deployer**: `0xA145882271662D59362924B3fD2Ed22Df5B9331c` (humanId 1, keystore `~/.foundry/keystores/deployer`, pw `forge2026`)
- **Migrator**: `0x656aC590e02E7567C5bb58c0A30474Fdb8435f8C` (humanId 2, key `.secrets/migrator.key`)

### Registry State
- 6 items submitted (3 deployer, 3 migrator), all accepted
- 4 tweets from v3 still not migrated (tradaboringfi, ababorode, AesPoker, 0xDeployer) — submit after daily reset

---

## Next Steps

### 1. x402 API Endpoint (Cloudflare Worker)

Build a Cloudflare Worker that serves the curated feed to agents who pay via x402.

```
Agent -> GET /feed (with x402 payment header)
     -> Worker validates USDC payment
     -> Worker reads FeedRegistry for accepted items
     -> Worker calls NewsStaking.depositRevenue(amount)
     -> Returns curated feed JSON
```

**Key decisions:**
- Pricing: How much USDC per query? Start with 0.01 USDC?
- x402 uses HTTP 402 status code + payment header. Agent pays, then re-requests with proof.
- All query revenue goes to `depositRevenue()` on NewsStaking — stakers earn pro-rata.
- Worker needs a funded wallet to call depositRevenue() on-chain.
- Scaffolded code exists in `api/` directory.

### 2. Pimlico Smart Account Integration (ERC-4337)

Enable gasless transactions for end users via account abstraction.

**Why:** World Chain users shouldn't need ETH for gas. Pimlico sponsors gas via a paymaster.

**Scope:**
- Wrap submit/challenge/vote/withdraw calls in UserOperations
- Pimlico paymaster pays gas
- Users only need USDC (for bonds) — no ETH at all
- viem has good ERC-4337 support via `permissionless` package

**Integration points:**
- `agent/src/curator.ts` — all contract writes go through Pimlico bundler
- Need Pimlico API key and paymaster setup

### 3. Remaining Tweet Migration

4 tweets from v3 not yet in v4:
- tradaboringfi, ababorode, AesPoker, 0xDeployer
- Can be submitted by deployer or migrator after daily limit resets (UTC midnight)

### 4. Production AgentBook

Replace MockAgentBook with real World ID verification.
- Currently MockAgentBook where `registerHuman(wallet, humanId)` is manually called
- Production: World ID proof verification on-chain, no manual registration

---

## File Map

```
contracts/
  src/
    FeedRegistry.sol      -- Core registry (submit, challenge, vote, resolve, withdraw)
    NewsToken.sol         -- ERC-20 reward token ($NEWS)
    NewsStaking.sol       -- Stake $NEWS, earn USDC from x402 revenue
    interfaces/
      IERC20.sol          -- Standard ERC-20 interface
      INewsToken.sol      -- Mint interface for FeedRegistry
  test/
    FeedRegistry.t.sol    -- 20 tests
    NewsStaking.t.sol     -- 14 tests
    mock/MockUSDC.sol     -- Test mock
  script/
    DeployFeedRegistry.s.sol     -- Production deploy script
    DeployTestFeedRegistry.s.sol -- Test deploy script (current deployment)
  deployments/
    worldchain-test.json  -- Current deployment addresses + config

agent/
  src/
    curate.ts             -- ABI definitions
    curator.ts            -- Contract interaction layer
    cli.ts                -- Terminal CLI
    dashboard/
      App.tsx             -- Dashboard root
      Header.tsx          -- Status bar (balances, daily limit, $NEWS)
      useFeedData.ts      -- Data fetching hook

api/                      -- Scaffolded Cloudflare Worker (x402 endpoint, not yet deployed)

OVERVIEW.md               -- Shareable one-pager (mechanics, game theory, architecture)
```

## Quick Start

```bash
# Run tests
cd contracts && forge test -vv

# Start agent dashboard
cd agent && bun run dev

# Deploy (if needed)
cd contracts && forge script script/DeployTestFeedRegistry.s.sol \
  --rpc-url https://480.rpc.thirdweb.com \
  --keystore ~/.foundry/keystores/deployer \
  --sender 0xA145882271662D59362924B3fD2Ed22Df5B9331c \
  --broadcast
```
