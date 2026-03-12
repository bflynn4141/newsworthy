# Deploy FeedRegistryV2 — Handoff

**Status**: Tests pass (51/51). Deployer needs funding. Everything else is ready.

---

## Why V2 — Context

### What V1 did (FeedRegistry.sol — now deleted)
V1 had a two-phase flow: **submit → challenge → resolve**. A submitter posted a news item with a 1 USDC bond. Anyone could challenge it (also 1 USDC). If challenged, it went to a vote. If unchallenged for 3 hours, it auto-accepted. The winner got the loser's bond.

### What was wrong with V1
- **Challenge step was dead weight** — in practice, nobody challenged. Items just waited 3 hours and auto-accepted. The challenge mechanic added complexity without adding curation quality.
- **No token incentive** — there was no $NEWS token, so voters/curators had no stake or reward beyond the bond.
- **Not upgradeable** — any parameter change (bond amount, timing) required a full redeploy and address swap.
- **Minter lock** — the V1 NewsToken's minter was permanently set to the V1 registry address, so we can't reuse it.

### What V2 changes (FeedRegistryV2.sol — 403 lines, UUPS proxy)
V2 eliminates the challenge step entirely. The flow is now: **submit → vote → resolve**.

Key differences:
1. **Direct voting** — every item goes straight to a voting window (12h default). No challenge gate.
2. **Vote cost** — voters pay 0.05 USDC per vote (configurable). This prevents spam voting and funds the rake.
3. **Quorum + majority** — items need ≥3 votes (configurable) and simple majority to accept. No quorum = bond refund, no penalty.
4. **$NEWS token rewards** — accepted items mint 100 $NEWS to the submitter. Creates a tangible incentive for quality submissions.
5. **Rake** — 10% of losing bonds go to the contract owner (protocol revenue).
6. **Daily submission limit** — configurable cap per human per day (currently unlimited, can be tightened).
7. **UUPS upgradeability** — all 7 parameters (bond, vote cost, voting window, quorum, NEWS per item, daily limit, rake) are admin-configurable via `onlyOwner` setters. Future logic changes can be done via `upgradeToAndCall()` without redeploying.
8. **Fresh NewsToken** — new token contract deployed alongside, with minter set to the V2 proxy.

### What stays the same
- **AgentBook integration** — still uses World ID proof-of-humanness. Submitters and voters must be registered humans.
- **USDC bonds** — same 1 USDC bond per submission.
- **Event-driven indexer** — the API syncs on-chain events. The indexer (`api/src/indexer/sync.ts`) already uses V2 event signatures (`ItemSubmitted`, `VoteCast`, `ItemResolved`).
- **Self-vote prevention** — submitters can't vote on their own items (enforced by humanId check).

### Why a fresh deploy (not upgrading V1)
V1 wasn't a proxy — it was a plain contract with no upgrade path. There's no way to upgrade it in place. V1's 29 items stay at the old address (`0xF6bfE9084a8d615637A3Be609d737F94faC277ca`); V2 starts fresh with itemId 0.

### Files changed in the V2 cleanup (already done, committed)
- **Deleted**: `FeedRegistry.sol`, `evaluate.ts`, `sources.ts`, old deploy scripts, old tests
- **Added**: `FeedRegistryV2.sol`, `NewsToken.sol`, `NewsStaking.sol`, V2 deploy script, V2 tests (51 total)
- **Updated**: Agent CLI, curator, dashboard, API indexer, web contracts — all point to V2 ABI/events already
- **Not yet updated**: Registry address constants (that's what this deploy does)

---

## Step 0: Fund Deployer

Deployer `0xA145882271662D59362924B3fD2Ed22Df5B9331c` has ~0.000482 ETH on World Chain. Needs ~0.005 ETH.

Send from any wallet with World Chain ETH, then verify:

```bash
cast balance 0xA145882271662D59362924B3fD2Ed22Df5B9331c --rpc-url https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x
```

Should show ≥ 5000000000000000 (0.005 ETH in wei).

---

## Step 1: Deploy Contracts

```bash
cd contracts
forge script script/DeployFeedRegistryV2.s.sol:DeployFeedRegistryV2 \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x \
  --private-key $(cat ../.secrets/deployer.key) \
  --broadcast \
  --verify
```

**Record the 3 addresses from output:**
- `NewsToken: 0x...`
- `Implementation: 0x...`
- `Proxy (use this): 0x...`

The proxy address is the one used everywhere. The script also calls `news.setMinter(proxy)`.

---

## Step 2: Update Deployment Record

Edit `contracts/deployments/worldchain-mainnet.json`:

```json
{
  "chain": "World Chain",
  "chainId": 480,
  "rpc": "https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x",
  "deployer": "0xA145882271662D59362924B3fD2Ed22Df5B9331c",
  "deployedAt": "2026-03-07",
  "contracts": {
    "AgentBook": {
      "address": "0x04436Df79E8A4604AF12abe21f275143e6bF47f2",
      "worldIdRouter": "0x17B354dD2595411ff79041f930e491A4Df39A278",
      "groupId": 1,
      "appId": "app_1325590145579e6d6df0809d48040738",
      "action": "newsworthy-register"
    },
    "FeedRegistryV1 (deprecated)": {
      "address": "0xF6bfE9084a8d615637A3Be609d737F94faC277ca",
      "note": "29 items, no longer indexed"
    },
    "FeedRegistryV2": {
      "proxy": "<PROXY_ADDRESS>",
      "implementation": "<IMPL_ADDRESS>",
      "newsToken": "<NEWS_TOKEN_ADDRESS>",
      "bondAmount": "1 USDC",
      "voteCost": "0.05 USDC",
      "votingWindow": "12 hours",
      "minQuorum": 3,
      "newsPerItem": "100 NEWS",
      "maxDailySubmissions": "unlimited",
      "rakeBps": 1000
    }
  }
}
```

---

## Step 3: Swap Address in Config

**`api/wrangler.toml` line 11** — replace old registry address:
```
FEED_REGISTRY_ADDRESS = "<PROXY_ADDRESS>"
```

**`web/src/lib/contracts.ts` line 24** — replace old registry address:
```ts
export const REGISTRY_ADDRESS = "<PROXY_ADDRESS>" as const;
```

Also update `REGISTRY_DEPLOY_BLOCK` on line 28 to the block the proxy was deployed at. You can find it from the forge broadcast output or worldscan.

---

## Step 4: Redeploy API + Web

```bash
# API (picks up new FEED_REGISTRY_ADDRESS from wrangler.toml)
cd api && npx wrangler deploy

# Web
cd web && npx vercel --prod
# Then alias:
npx vercel alias <DEPLOYMENT_URL> newsworthy-app.vercel.app
```

---

## Step 5: Smoke Test

```bash
PROXY=<PROXY_ADDRESS>

# Contract responds correctly
cast call $PROXY "bondAmount()(uint256)" --rpc-url https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x
# → 1000000

cast call $PROXY "votingWindow()(uint256)" --rpc-url https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x
# → 43200

# Proxy has implementation set (non-zero = good)
cast storage $PROXY 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x

# API syncs from new contract
curl https://newsworthy-api.bflynn4141.workers.dev/sync

# Health check
curl https://newsworthy-api.bflynn4141.workers.dev/health

# Load web app
open https://newsworthy-app.vercel.app
```

---

## What NOT to change

- No contract code changes needed
- No indexer code changes — already uses V2 event signatures
- No ABI changes — agent/curator/dashboard already use V2 ABI
- No V1 data migration — V1's 29 items stay at old address, V2 starts fresh

---

## If Something Goes Wrong

- **Deploy fails**: Check deployer balance, ensure RPC is reachable
- **Verify fails**: Can verify manually later with `forge verify-contract`
- **API sync returns errors**: Check that `FEED_REGISTRY_ADDRESS` in wrangler.toml matches the proxy (not implementation)
- **Web deploy fails**: Make sure you're in the `web/` directory and using team `brians-projects-b0f2b96c`
- **UUPS proxy issue**: The implementation slot at `0x360894...` should contain the implementation address. If it's zero, the proxy wasn't initialized correctly.
