# Newsworthy Dashboard — Ink TUI Plan

## Context

The existing CLI (`agent/src/cli.ts`) works great for one-off commands, but when running agents you want a persistent monitoring view. The goal: a multi-column terminal dashboard showing all FeedRegistry items organized by status, auto-refreshing, that you can leave running in a second pane.

## Wireframes

### Main Dashboard View (~100 chars wide)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  NEWSWORTHY  ▸ test mode          Bond: 0.0001 ETH    Balance: 0.0098 ETH      │
│  Items: 7    Refresh: 5s          Periods: 1m / 1m    Withdrawable: 0.0003 ETH  │
├────────────────────┬────────────────────┬────────────────────┬──────────────────┤
│ ⏳ PENDING (2)      │ ⚔ CHALLENGED (1)   │ ✓ ACCEPTED (3)     │ ✗ REJECTED (1)  │
├────────────────────┼────────────────────┼────────────────────┼──────────────────┤
│                    │                    │                    │                  │
│ #8  example.com/n… │ #5  news.ycombina… │ #0  bbc.co.uk/n…   │ #3  spam.xyz/b…  │
│     43s remaining  │     Keep: 2  Rm: 1 │     by 0x8949…     │     by 0x5a12…   │
│                    │     12s remaining   │                    │                  │
│ #11 reuters.com/…  │                    │ #1  nytimes.com/…  │                  │
│     58s remaining  │                    │     by 0x8949…     │                  │
│                    │                    │                    │                  │
│                    │                    │ #6  wsj.com/mark…  │                  │
│                    │                    │     by 0x8949…     │                  │
│                    │                    │                    │                  │
├────────────────────┴────────────────────┴────────────────────┴──────────────────┤
│  Last refresh: 2s ago              Press Ctrl+C to exit                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Empty State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  NEWSWORTHY  ▸ test mode          Bond: 0.0001 ETH    Balance: 0.0098 ETH      │
│  Items: 0    Refresh: 5s          Periods: 1m / 1m    Withdrawable: 0 ETH       │
├────────────────────┬────────────────────┬────────────────────┬──────────────────┤
│ ⏳ PENDING (0)      │ ⚔ CHALLENGED (0)   │ ✓ ACCEPTED (0)     │ ✗ REJECTED (0)  │
├────────────────────┼────────────────────┼────────────────────┼──────────────────┤
│                    │                    │                    │                  │
│  No items yet.     │  No challenges.    │  No accepted       │  No rejected     │
│  Use 'submit' to   │                    │  items yet.        │  items.          │
│  add the first.    │                    │                    │                  │
│                    │                    │                    │                  │
├────────────────────┴────────────────────┴────────────────────┴──────────────────┤
│  Last refresh: 1s ago              Press Ctrl+C to exit                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Narrow Terminal Fallback (~60 chars — stacked columns)

```
═══ NEWSWORTHY ▸ test ═══
Bond: 0.0001 ETH  Balance: 0.0098 ETH
Items: 7  Periods: 1m/1m  Refresh: 5s

⏳ PENDING (2)
  #8   example.com/news-a…   43s
  #11  reuters.com/world…    58s

⚔ CHALLENGED (1)
  #5   news.ycombinator…     Keep:2 Rm:1  12s

✓ ACCEPTED (3)
  #0   bbc.co.uk/news/t…    0x8949…
  #1   nytimes.com/2026/…   0x8949…
  #6   wsj.com/markets/…    0x8949…

✗ REJECTED (1)
  #3   spam.xyz/buy-now…    0x5a12…

Last refresh: 2s ago
```

## Architecture

### Component Tree

```
<App>                          ← main entry, holds state + refresh loop
├── <Header />                 ← registry name, mode badge, bond, balance
├── <Columns>                  ← flex row (or stacked if narrow)
│   ├── <StatusColumn status="pending" />
│   ├── <StatusColumn status="challenged" />
│   ├── <StatusColumn status="accepted" />
│   └── <StatusColumn status="rejected" />
│       └── <ItemCard />       ← one per item: ID, URL, time/votes
└── <Footer />                 ← last refresh, ctrl+c hint
```

### Data Fetching Strategy

**On every refresh tick (default 5s):**

1. **Batch config read** (parallelize with `Promise.all`):
   - `bondAmount()`, `challengePeriod()`, `votingPeriod()`, `minVotes()` — 4 calls
   - `nextItemId()` — 1 call
   - `getBalance(deployer)` — 1 call
   - `pendingWithdrawals(deployer)` — 1 call
   - **Total: 7 calls** (cached after first load, only `nextItemId` + `balance` + `pendingWithdrawals` re-fetched)

2. **Fetch all items** (parallelize with `Promise.all`):
   - For each `i` in `0..nextItemId-1`: `items(i)` — N calls
   - For any item with status=1 (Challenged): also `challenges(i)` — M calls
   - **Total: N + M calls**

3. **Bucket items by status** in React state

**Optimization for scale:**
- Config params (bond, periods, minVotes) change extremely rarely → fetch once, re-fetch every 60s
- Items already in terminal state (Accepted/Rejected) → cache, skip re-fetching
- Only re-fetch Pending + Challenged items + any new items on each tick
- For < 50 items (testing phase), fetching all every 5s is fine (~50 RPC calls = <1s)

### Time Remaining — Client-Side Countdown

Countdowns tick visually every second without an RPC call:
- Fetch `submittedAt` and `challengePeriod` from chain once
- Compute `endTime = submittedAt + challengePeriod`
- Render `endTime - Date.now()/1000` in a 1-second `setInterval` (separate from the 5s data refresh)

## File Structure

```
agent/
├── src/
│   ├── cli.ts                    ← existing, add 'dashboard' command
│   ├── curate.ts                 ← existing ABI + helpers (reuse)
│   ├── register.ts               ← existing ABI (reuse)
│   └── dashboard/
│       ├── App.tsx               ← root component, state, refresh loop
│       ├── Header.tsx            ← registry stats bar
│       ├── StatusColumn.tsx      ← single column with item cards
│       ├── ItemCard.tsx          ← one item: ID, URL, timer/votes
│       ├── Footer.tsx            ← refresh indicator, exit hint
│       └── useFeedData.ts        ← custom hook: fetch + bucket items
```

## Dependencies

Add to `agent/package.json`:

```json
{
  "dependencies": {
    "viem": "^2.46.2",
    "ink": "^5.1.0",
    "react": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.0"
  }
}
```

Also need `"jsx": "react-jsx"` in `agent/tsconfig.json` for TSX support. **Already present.**

## Invocation

New `dashboard` command in the existing CLI:

```bash
# Test contracts, 5s refresh (default)
bun run agent/src/cli.ts --test dashboard

# Production, custom refresh
bun run agent/src/cli.ts dashboard --refresh 10

# Also via package.json script
cd agent && bun run cli -- --test dashboard
```

The `dashboard` case in the CLI's main switch imports and calls `ink`'s `render(<App />)` — this keeps the single entry point pattern. Ink takes over stdout and handles its own lifecycle until Ctrl+C.

## Bun Compatibility

**Known issue:** Bun has a bug (bun#6862) where keyboard input via `useInput` doesn't work. Since this dashboard is **read-only** (no keyboard interaction needed — just auto-refresh + Ctrl+C to exit), Bun works fine. Ctrl+C is handled by the OS signal layer, not Ink's input system.

If we add interactive features later (arrow-key selection, keyboard shortcuts), we'd need to test with `node --import tsx` as a fallback.

## Implementation Steps

### Step 1: Add dependencies + TSX config
- `cd agent && bun add ink react && bun add -d @types/react`
- tsconfig.json already has JSX support

### Step 2: Create `useFeedData.ts` hook
- Accepts: `publicClient`, `registryAddr`, `agentBookAddr`, `deployer`, `refreshInterval`
- Returns: `{ config, items, loading, lastRefresh, error }`
- Items bucketed as `{ pending: Item[], challenged: Item[], accepted: Item[], rejected: Item[] }`
- Challenge data merged into challenged items
- 1-second countdown timer for time-remaining fields

### Step 3: Build components bottom-up
- `ItemCard.tsx` — smallest unit, one item row
- `StatusColumn.tsx` — column header + list of ItemCards
- `Header.tsx` — stats bar
- `Footer.tsx` — refresh indicator
- `App.tsx` — compose everything, wire hook, handle terminal width

### Step 4: Wire into CLI
- Add `dashboard` case to `cli.ts` switch
- Dynamic import: `const { default: Dashboard } = await import('./dashboard/App.js')`
- Pass config (deployment, rpcUrl, deployer, refreshInterval) as props

### Step 5: Handle edge cases
- 0 items → empty state messages per column
- Terminal < 80 chars → stack columns vertically
- 20+ items per column → show most recent 10, with "(+N more)" footer
- RPC failure → show error in footer, keep stale data displayed

## Files Changed

| File | Action |
|------|--------|
| `agent/package.json` | Add ink, react, @types/react |
| `agent/src/cli.ts` | Add `dashboard` command in switch |
| `agent/src/dashboard/App.tsx` | **New** — root component |
| `agent/src/dashboard/Header.tsx` | **New** — stats bar |
| `agent/src/dashboard/StatusColumn.tsx` | **New** — column + items |
| `agent/src/dashboard/ItemCard.tsx` | **New** — single item card |
| `agent/src/dashboard/Footer.tsx` | **New** — refresh + hints |
| `agent/src/dashboard/useFeedData.ts` | **New** — data fetch hook |

## Verification

```bash
# 1. Install deps
cd agent && bun install

# 2. Launch dashboard against test contracts
bun run agent/src/cli.ts --test dashboard

# 3. In another terminal, submit items and watch them appear
bun run agent/src/cli.ts --test submit "https://example.com/live-test" "meta"

# 4. Verify:
#    - Item appears in Pending column within 5s
#    - Countdown ticks down every second
#    - After 60s, "Expired" shown
#    - After accepting in other terminal, item moves to Accepted column
#    - Narrow terminal → columns stack vertically
#    - Ctrl+C exits cleanly
```
