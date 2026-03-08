# Mini App — Build Handoff

> Skeleton committed, visual refinements needed. This doc has everything you need.

## What Exists

The Mini App lives at `/mini/` inside the existing Next.js web app (`web/`). Three routes:

| Route | File | Component | Status |
|-------|------|-----------|--------|
| `/mini` | `app/mini/page.tsx` | `FeedView` | Working — pulls real data from API |
| `/mini/curate` | `app/mini/curate/page.tsx` | `CurateView` | Skeleton — mock data, no on-chain voting |
| `/mini/profile` | `app/mini/profile/page.tsx` | `ProfileView` | Skeleton — zeroed out, no on-chain reads |

**Shared components** in `components/mini/`:
- `minikit-provider.tsx` — Wraps app with `MiniKit.install(APP_ID)`
- `bottom-nav.tsx` — 3-tab nav with filled/outline active states + badge count
- `feed-view.tsx` — Accepted items list with category avatars
- `curate-view.tsx` — Card queue with swipe + progress + empty state
- `swipe-card.tsx` — Touch gesture handler with rotation + KEEP/REMOVE stamps
- `profile-view.tsx` — Earnings hero, stats row, vote history list

**Dependencies added:**
- `@worldcoin/minikit-react@1.9.14` (added to `web/package.json`)
- `@worldcoin/minikit-js@1.11.0` (already existed)

---

## Paper Design Screens (11 total)

All designs are in the Paper file "Scratchpad" → Page 1. Reference these by artboard ID.

### Feed Tab
| Artboard | Name | Description |
|----------|------|-------------|
| `DZQ-1` | Mini App — Feed | Accepted items with avatars, descriptions, timestamps, category tabs |

### Curate Tab
| Artboard | Name | Description |
|----------|------|-------------|
| `DZR-1` | Mini App — Curate | Card with CHALLENGED badge, 3-segment progress, BONDED/VOTES/EARN row |
| `EDF-1` | Mini App — Curate Large Queue | 14 items, continuous progress bar, `@VitalikButerin` card |
| `E4N-1` | Mini App — Swipe Keep | Card tilted 8°, green KEEP stamp at top-left |
| `E4O-1` | Mini App — Swipe Remove | Card tilted -8°, red REMOVE stamp at top-right, pink background |
| `EGM-1` | Mini App — New Arrivals Toast | Dark toast "2 new challenges just arrived · View", URGENT card |
| `EGL-1` | Mini App — Empty State | "All caught up" with star icon, 7-day streak, notify button |
| `ENX-1` | Mini App — Empty No Votes Today | "7 day streak at risk", notify button |
| `ENY-1` | Mini App — Empty New User | "No challenges yet" + How it works explainer (3 steps) |

### Profile Tab
| Artboard | Name | Description |
|----------|------|-------------|
| `EAU-1` | Mini App — Profile | $4.20 earnings, 78% accuracy, vote history with Won/Lost/Pending |
| `FB4-1` | Mini App — Profile (Empty) | $0.00, all zeros, "No votes yet" + Start curating CTA |

### Architecture Diagrams (for context)
| Artboard | Name | Description |
|----------|------|-------------|
| `FEH-1` | System Architecture | 3-column: Client (MiniKit SDK) → API (Next.js routes) → Chain (contracts) |
| `FIO-1` | Vote Flow | 4-step: Swipe → Build tx → World App confirms → Update UI |
| `FKJ-1` | Component Tree | Full React component hierarchy mapped to screens |

---

## Visual Refinements Needed

### Priority 1: Curate Card Layout

The card is the core interaction. Current code vs Paper design:

**Header section** — Add:
- `CHALLENGED` badge (orange dot + green uppercase text)
- Timer: `47m left` / `12m left` / `3m left` — color changes:
  - Gray: >15 minutes remaining
  - Amber: 5-15 minutes remaining
  - Red + "URGENT": <5 minutes remaining
- Submitter avatar + `@handle · Xh ago` row (below CHALLENGED badge)

**Content section** — Already close, just needs:
- Slightly larger/bolder headline text
- Description text in lighter color

**Bottom row** — Replace single "Earn for voting correctly" with 3-column layout:
```
BONDED          VOTES          EARN UP TO
2 USDC          6 votes        ~$0.20
```
- Labels: `text-[10px]`, uppercase, `color: #A8A29E`
- Values: `text-[15px]`, `font-weight: 700`, `color: #1A1A1A`
- EARN UP TO value: `color: #10B981` (green)
- Earnings formula: `~$${(0.6 / Math.max(1, Math.ceil(totalVotes / 2))).toFixed(2)}`

### Priority 2: Curate Header

**Current:** "Curate" + "3 remaining"
**Paper:** "Curate" + "X items need your vote" (subtitle) + "1 of 3" (counter pill)

**Progress bar:**
- ≤7 items: Segmented blocks (one per item, filled = voted, current = blue, upcoming = gray)
- 8+ items: Continuous progress bar (percentage-based)
- See artboards `DZR-1` (segmented) vs `EDF-1` (continuous)

### Priority 3: Feed Tab

**Current:** "CR" colored circles as avatars, no descriptions
**Paper:** Real avatars via `unavatar.io/x/{handle}`, 2-3 line descriptions, proper time formatting

Feed items should show:
- Avatar image (fallback to colored initials if no image)
- **Bold name** + `@handle` · time
- 2-3 line description (if available from API)
- Source link with external icon

### Priority 4: Vote Buttons

**Current:** Just icons (X and checkmark)
**Paper:** Icons + "Remove" / "Keep" labels underneath
```
  (X)            (✓)
Remove           Keep
```
- Remove: pink background circle, red border
- Keep: green background circle, teal border
- Labels: `text-[12px]`, matching colors

### Priority 5: Empty States (3 variants)

**1. All Caught Up** (artboard `EGL-1`):
- Star icon in yellow circle
- Large streak number (e.g., "7")
- "day voting streak"
- "Nice work! You voted 3 times today."
- Dark button: "Notify me when challenges arrive"

**2. Streak At Risk** (artboard `ENX-1`):
- Star outline icon (not filled)
- "7 day streak at risk"
- "You haven't voted today yet."
- Same notify button

**3. New User** (artboard `ENY-1`):
- Grid icon in circle
- "No challenges yet"
- "When someone challenges a submission, it'll appear here."
- "How it works" card with 3 numbered steps:
  1. Someone submits a tweet and bonds 1 USDC
  2. Another curator challenges it, matching the bond
  3. You vote Keep or Remove — free, and earn a share of the bond pool
- Same notify button

### Priority 6: Profile Tab

**Verified badge:** Green dot + "Verified Human" text, right-aligned in header

**Earnings hero:**
- "TOTAL EARNINGS" label (caps, small, `#A8A29E`)
- Large dollar amount
- "from N votes" subtitle

**Stats row** — 3 bordered cards (not gray background):
- Each card: large value + small label underneath
- Accuracy: colored green if >50%
- Cards have `border: 1px solid #F0EDE8`, `border-radius: 12px`

**Vote history items:**
- Green checkmark circle + title + "+$0.30" green + "Won"
- Red X circle + title + "$0.00" gray + "Lost"
- Yellow clock circle + title + "~$0.15" green + "Pending"

---

## Animations & Interactions

### Swipe Gesture (already implemented, needs polish)

```
Touch/drag → card follows finger with rotation
  rotation = offsetX * 0.08 degrees
  KEEP stamp fades in at offsetX > 20px (right)
  REMOVE stamp fades in at offsetX < -20px (left)

Release:
  if |offsetX| > 80px → card exits screen (400px translate + 15° rotation)
  else → spring back to center

On exit:
  400ms ease-out animation
  Then advance to next card (setCurrentIndex + 1)
```

### Swipe Background Tint

From the Paper designs (not yet implemented):
- Swiping right: background tints **green** (subtle, opacity tied to drag distance)
- Swiping left: background tints **pink/red** (see artboard `E4O-1`)
- The entire screen behind the card should tint, not just the card

### Card Stack Effect

Not yet implemented. The Paper designs show a subtle "stack" behind the current card:
- Next card visible at ~95% scale, slightly behind
- Creates depth effect suggesting more cards below
- On swipe, next card scales up to 100%

### Progress Bar Animation

Segmented progress should animate:
- Current segment fills with blue as you swipe
- Completed segments stay blue
- Use `transition: width 300ms ease-out`

### New Arrivals Toast (artboard `EGM-1`)

When polling detects new challenged items:
- Dark toast slides down from top: "2 new challenges just arrived · View"
- Tapping "View" scrolls/inserts new cards at front of queue
- Auto-dismiss after 5 seconds

---

## Wiring Up Real Data

### 1. New API Endpoint: `/api/challenges`

The Curate tab needs pending/challenged items. Currently the x402 API's `/pending` endpoint is paywalled. Create a free Next.js API route:

```typescript
// web/src/app/api/challenges/route.ts
// Read challenged items from FeedRegistry contract (view call, no tx)
// Return: { items: ChallengedItem[], total: number }
// Each item: { id, url, title, description, submitter, totalVotes,
//              challengedAt, votingPeriodEnd, category }
```

This requires reading from the FeedRegistry contract on World Chain. Use `viem` with the World Chain RPC.

**Contract:** `0xF6bfE9084a8d615637A3Be609d737F94faC277ca` (World Chain testnet)
**RPC:** `https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x`

Key functions to call:
- `itemCount()` → total items
- `items(id)` → returns `(url, metadataHash, submitter, submittedAt, status, bond)`
- `challenges(id)` → returns `(challenger, bond, challengedAt, votesFor, votesAgainst)`

Filter for items where `status == 2` (Challenged).

### 2. MiniKit Vote Transaction

Replace the TODO in `curate-view.tsx` with actual MiniKit transaction:

```typescript
import { MiniKit } from "@worldcoin/minikit-js";
import { parseAbi } from "viem";

const REGISTRY = "0xF6bfE9084a8d615637A3Be609d737F94faC277ca";
const registryAbi = parseAbi([
  "function voteOnChallenge(uint256 itemId, bool support) external",
]);

async function vote(itemId: number, keep: boolean) {
  const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
    transaction: [{
      address: REGISTRY,
      abi: registryAbi,
      functionName: "voteOnChallenge",
      args: [itemId, keep],
    }],
  });

  if (finalPayload.status === "error") {
    // Re-insert card at top of stack, show error toast
    console.error("Vote failed:", finalPayload.error_code);
    return false;
  }

  // Transaction submitted — World App pays gas
  console.log("Vote tx:", finalPayload.transaction_id);
  return true;
}
```

**Key behavior from Vote Flow diagram (artboard `FIO-1`):**
1. User swipes → card animates off immediately (optimistic UI)
2. `sendTransaction` fires → World App shows native confirmation sheet
3. User taps "Confirm" → tx submitted to chain (gas-free)
4. If tx fails/reverts → show error toast, re-insert card at top of stack

### 3. Profile Data: `/api/profile/:nullifier`

Create an API route that aggregates user stats from on-chain events:

```typescript
// web/src/app/api/profile/[nullifier]/route.ts
// Read VoteCast events for this user's humanId
// Calculate: earnings, accuracy, streak, vote history
// Return: { earnings, accuracy, totalVotes, streak, history: VoteHistory[] }
```

The user's nullifier comes from the session cookie set during World ID verification.

### 4. Polling for New Challenges

The Curate tab should poll for new items every 30 seconds:

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch("/api/challenges");
    const data = await res.json();
    if (data.total > items.length) {
      // Show toast: "X new challenges just arrived"
    }
  }, 30000);
  return () => clearInterval(interval);
}, [items.length]);
```

---

## Chain & Contract Context

**All contracts on World Chain** (chain ID 480). Decision made 2026-03-07.

| Contract | Testnet Address | Purpose |
|----------|----------------|---------|
| FeedRegistry | `0xF6bfE9084a8d615637A3Be609d737F94faC277ca` | Submit, challenge, vote, resolve |
| MockAgentBook | `0x04436Df79E8A4604AF12abe21f275143e6bF47f2` | World ID verification (test) |
| NewsToken | `0x0b22640664c27434E9D4B7F31E02889fEeAF822C` | $NEWS reward token |
| NewsStaking | `0x2d4c0d0a76bA7Ab61b9bed5A6950E216D539CA74` | Stake NEWS, earn USDC |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | Bond currency |

**Why World Chain:** MiniKit.sendTransaction() ONLY works on World Chain. World App sponsors gas ONLY on World Chain. All 4 contracts call each other and can't be split across chains.

**Voting is free** for humans — no bond needed. Only submitters (1 USDC) and challengers (1 USDC) put up bonds. World App pays gas.

**One-human-one-vote:** AgentBook maps wallet → World ID nullifier. `hasVotedByHuman[itemId][humanId]` prevents double-voting even across wallets.

---

## Dev Setup

```bash
cd ~/newsworthy/web
bun install
bun run dev

# Open in browser at mobile size (375x812):
# http://localhost:3000/mini          — Feed
# http://localhost:3000/mini/curate   — Curate
# http://localhost:3000/mini/profile  — Profile
```

**Note:** MiniKit features (verify, sendTransaction) only work inside World App. In browser, `MiniKit.isInstalled()` returns false. Build the UI with mock data first, then test in World App via ngrok tunnel.

**Env vars needed** (already in `.env.local`):
- `NEXT_PUBLIC_WORLD_APP_ID` — World Developer Portal app ID
- `NEXT_PUBLIC_RP_ID` — Relying party ID
- `RP_SIGNING_KEY` — For signing MiniKit transaction requests
- `SESSION_SECRET` — HMAC key for session cookies

---

## Recommended Build Order

1. **Visual refinements** — Match Paper designs (this doc's "Visual Refinements" section)
2. **`/api/challenges` endpoint** — Free endpoint returning challenged items from chain
3. **Wire CurateView to real data** — Replace mock items with API fetch
4. **MiniKit sendTransaction** — Wire vote buttons to on-chain `voteOnChallenge()`
5. **`/api/profile` endpoint** — User stats from on-chain events
6. **Wire ProfileView to real data** — Replace zeros with actual earnings
7. **Polish** — Toast notifications, card stack effect, background tint on swipe
8. **Test in World App** — ngrok tunnel + World Developer Portal setup
