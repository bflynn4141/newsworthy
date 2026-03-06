# Newsworthy TUI v2 — Interactive Dashboard

## Overview

Upgrade the read-only Ink dashboard to an interactive TUI with keyboard navigation, item detail panel, built-in article analysis via local LLM, and a generic agent hook for deeper investigation.

## Decisions

- **Runtime**: Node (via `tsx`) for dashboard only. Bun stays for all other CLI commands.
- **Detail view**: Bottom panel — columns stay visible on top, detail + agent below.
- **Agent hook**: Generic — spawns `$NEWSWORTHY_AGENT_CMD` (default: `claude`) with item context as JSON.
- **Article analysis**: Ollama (local) as default. Auto-detect, skip gracefully if unavailable. Analyze once on first fetch, cache results.
- **Analysis display**: Two-line summary in columns (score + one-sentence summary). Full reasoning in detail panel.

---

## Phase 1: Visual Polish — Column Borders

Add box-drawing characters between columns for readability.

### Changes
- Wrap each `StatusColumn` with vertical border separators (`|`)
- Add horizontal rule between header and columns
- Add horizontal rule between columns and footer
- Use Ink's `<Box borderStyle="single">` or manual `<Text>` borders
- Ensure borders degrade gracefully in narrow/stacked mode (no vertical borders when stacked)

### Files
- `StatusColumn.tsx` — add border props
- `App.tsx` — add separator elements between columns + horizontal rules

---

## Phase 2: Node Runtime for Dashboard

### Changes
- `bun add -d tsx` in agent/
- Add package.json script: `"dashboard": "node --import tsx src/cli.ts dashboard"`
- `cli.ts` dashboard case: detect runtime, warn if Bun + interactive features requested
- No changes to other CLI commands (stay on Bun)

### Verification
```bash
cd agent && bun run dashboard -- --test
# Should launch via Node with full keyboard support
```

---

## Phase 3: Keyboard Navigation

### Controls
| Key | Action |
|-----|--------|
| Tab / Arrow Right | Next column |
| Shift+Tab / Arrow Left | Previous column |
| Arrow Up/Down | Move between items within a column |
| Enter | Open selected item in bottom detail panel |
| Esc | Close detail panel, return to column view |
| A | Spawn agent with selected item context |
| Q / Ctrl+C | Quit |

### Changes
- Add `useInput` hook in `App.tsx` for global key handling
- Track `selectedColumn` and `selectedItem` state
- `StatusColumn` receives `isActive` + `selectedIndex` props
- `ItemCard` receives `isSelected` prop — renders with inverse colors or `>` marker
- Focus ring: highlighted item gets bold + color accent

### Files
- `App.tsx` — useInput, selection state, key dispatch
- `StatusColumn.tsx` — active/selected styling
- `ItemCard.tsx` — selected state styling

---

## Phase 4: Bottom Detail Panel

### Layout
```
+---------+---------+---------+---------+
| PENDING |CHALLNGD | ACCEPTED| REJECTED|  <- columns (compressed)
| > #8    |  #5     |  #0     |  #3     |
|   #11   |         |  #1     |         |
+---------+---------+---------+---------+
| Item #8 — example.com/news-article    |  <- detail panel
| Submitter: 0x8949...a3f2              |
| Bond: 0.0001 ETH  Status: Pending    |
| Submitted: 2026-03-05 14:32:01       |
| Time remaining: 43s                  |
|                                       |
| Analysis: 7.2 — Fed signals rate...  |
| [Full summary + reasoning here]      |
|                                       |
| Press A to ask agent | Esc to close  |
+---------------------------------------+
```

### Changes
- New `DetailPanel.tsx` component
- `App.tsx` manages `detailItem: FeedItem | null` state
- When detail is open, columns compress (fewer rows visible) to make room
- Detail panel shows all item fields + analysis data + challenge data if applicable
- Live countdown timer in the panel

### Files
- `dashboard/DetailPanel.tsx` — **new**
- `App.tsx` — detail state, layout split

---

## Phase 5: Agent Hook (Generic)

### How it works
1. User presses `A` on a selected item
2. TUI reads `NEWSWORTHY_AGENT_CMD` env var (default: `claude`)
3. TUI pauses Ink rendering (`app.unmount()` or `process.stdin.pause()`)
4. Spawns: `$NEWSWORTHY_AGENT_CMD` with item context
5. Context passed as: temp JSON file path in `--context` arg + `NEWSWORTHY_ITEM` env var
6. When agent process exits (Ctrl+C or natural), TUI resumes

### Context JSON shape
```json
{
  "id": 8,
  "url": "https://example.com/news-article",
  "submitter": "0x8949...a3f2",
  "bond": "0.0001",
  "status": "pending",
  "timeRemaining": 43,
  "submittedAt": "2026-03-05T14:32:01Z",
  "analysis": {
    "score": 7.2,
    "summary": "Fed signals rate pause amid mixed employment data",
    "category": "finance",
    "source_reliability": "high"
  },
  "challenge": null
}
```

### Files
- `dashboard/agentHook.ts` — **new** — spawn logic, context serialization
- `App.tsx` — key handler for 'A', pause/resume Ink

---

## Phase 6: Built-in Article Analysis (Ollama)

### Overview
Automatic article scoring and summarization using a local LLM. Runs once per item on first fetch, caches results. Gracefully degrades if Ollama is not running.

### Architecture
```
Item fetched (new) -> fetch URL content -> extract text -> LLM prompt -> cache result
                      |                                      |
                      | (timeout 5s)                         | (timeout 10s)
                      v                                      v
                   Skip if fail                          Skip if fail
```

### Scoring Model — Multi-Signal Composite

The score is a weighted blend of four signals:

```
Composite Score = (0.30 * article) + (0.25 * source) + (0.20 * submitter) + (0.25 * uniqueness)
```

| Signal | Weight | Source | How it works |
|--------|--------|--------|-------------|
| Article quality | 30% | LLM | Is it well-written, sourced, data-backed? Does it cover something newsworthy? |
| Source reputation | 25% | LLM + heuristics | Domain tier (reuters.com = high, unknown blog = low). LLM assesses based on known outlets. |
| Submitter record | 20% | On-chain | Accept/reject ratio from this submitter's history. `accepted / (accepted + rejected)` scaled 1-10. New submitters default to 5.0. |
| Uniqueness | 25% | LLM | Semantic similarity check against summaries of other recent items. High overlap = low score. |

#### Submitter reputation (on-chain)
```typescript
// Fetch all items, bucket by submitter address
const submitterItems = allItems.filter(i => i.submitter === item.submitter)
const accepted = submitterItems.filter(i => i.status === 2).length
const rejected = submitterItems.filter(i => i.status === 3).length
const total = accepted + rejected

// No history = neutral 5.0, otherwise ratio scaled to 1-10
const reputationScore = total === 0 ? 5.0 : 1 + (accepted / total) * 9
```

#### Uniqueness (LLM semantic similarity)
- After analyzing a new item, compare its summary to cached summaries of items from the last 24h
- Single LLM call: "Rate 1-10 how unique this article is compared to these recent items: [list]"
- If no recent items exist, uniqueness defaults to 8.0 (novel by default)

### Analysis output per item
```typescript
type ArticleAnalysis = {
  // Composite
  score: number            // 1-10 weighted composite score
  summary: string          // One sentence summary (max 80 chars)
  category: string         // politics | finance | tech | science | culture | sports | other
  // Sub-scores
  articleScore: number     // 1-10 content quality
  sourceScore: number      // 1-10 source/domain reputation
  submitterScore: number   // 1-10 on-chain accept/reject ratio
  uniquenessScore: number  // 1-10 novelty vs recent items
  // Detail
  reliability: string      // high | medium | low | unknown (source assessment)
  reasoning?: string       // Why this score (shown in detail panel only)
}
```

### Display in columns (two-line)
```
#8  example.com/break...
    43s remaining
    7.8 — Fed signals rate pause
    amid mixed employment data
```

### Display in detail panel (full)
```
Analysis (Ollama / llama3)
Score: 7.8 / 10  |  Category: finance  |  Source: high reliability

  Article quality:  8.0  (well-sourced, data-backed)
  Source reputation: 9.0  (reuters.com — tier 1)
  Submitter record:  6.5  (0x8949: 12 accepted, 3 rejected)
  Uniqueness:        7.5  (no similar items in last 24h)

Summary: The Federal Reserve signaled a potential pause in rate hikes
following mixed employment data, with job growth slowing but wages
remaining elevated.

Reasoning: Article from established financial news source, covers a
market-moving event with specific data points and multiple expert
quotes. Submitter has moderate track record (80% acceptance rate).
No duplicate coverage in recent feed items.
```

### LLM Integration
- **Detection**: On startup, `GET http://localhost:11434/api/tags` — if 200, Ollama is available
- **Model**: Use first available model, or respect `NEWSWORTHY_LLM_MODEL` env var (default: `llama3`)
- **Endpoint**: `NEWSWORTHY_LLM_URL` env var (default: `http://localhost:11434`)
- **Protocol**: Ollama API (`/api/generate`) — also compatible with any OpenAI-compatible endpoint via `/v1/chat/completions` if `NEWSWORTHY_LLM_URL` is set to a non-Ollama endpoint
- **Article fetching**: Simple `fetch(url)` + HTML text extraction (strip tags, take first 2000 chars)
- **Timeout**: 10s per analysis. Skip and show "No analysis" on timeout.
- **Cache**: In-memory `Map<itemId, ArticleAnalysis>`. Lost on restart (acceptable for now).

### LLM Calls (2 per new item)

**Call 1: Article analysis** (runs immediately)
```
You are a news quality analyst. Given this article, provide:
1. An article quality score from 1-10 (writing, sourcing, newsworthiness)
2. A source reputation score from 1-10 (is this domain a known, reliable outlet?)
3. A one-sentence summary (max 80 chars)
4. A category (one of: politics, finance, tech, science, culture, sports, other)
5. Source reliability assessment (high/medium/low/unknown)
6. Brief reasoning (2-3 sentences)

Respond in JSON: {"articleScore":N,"sourceScore":N,"summary":"...","category":"...","reliability":"...","reasoning":"..."}

Article URL: {url}
Article text:
{first 2000 chars of extracted text}
```

**Call 2: Uniqueness check** (runs after Call 1, compares against cached summaries)
```
Rate how unique this new article is compared to recently submitted items.
Score 1-10 where 10 = completely novel topic, 1 = exact duplicate.

New article: "{summary}"

Recent items (last 24h):
{list of cached summaries}

Respond in JSON: {"uniquenessScore":N}
```

**Submitter score** — no LLM call, computed from on-chain data (see scoring model above).

**Composite** — computed client-side from the three sources: `(0.30 * article) + (0.25 * source) + (0.20 * submitter) + (0.25 * uniqueness)`

### Graceful degradation
- Ollama not running -> show "No LLM" in header, skip all analysis, dashboard works fine
- URL fetch fails -> show "Fetch failed" instead of analysis
- LLM timeout -> show "Analysis timeout"
- Parse error -> show "Analysis error"

### Files
- `dashboard/analyze.ts` — **new** — LLM client, URL fetcher, text extraction, prompt, cache
- `useFeedData.ts` — trigger analysis for new items, store in state
- `ItemCard.tsx` — render two-line analysis summary
- `DetailPanel.tsx` — render full analysis with reasoning
- `Header.tsx` — show LLM status indicator ("Ollama: llama3" or "No LLM")

---

## Implementation Order

1. **Phase 1** (borders) — quick visual win, no new deps
2. **Phase 2** (Node runtime) — unblocks all interactive phases
3. **Phase 6** (analysis) — highest user value, works without keyboard input
4. **Phase 3** (keyboard nav) — builds on Node runtime
5. **Phase 4** (detail panel) — builds on navigation
6. **Phase 5** (agent hook) — builds on detail panel

Note: Phase 6 is moved up because it delivers value immediately in the read-only view. Users see article scores and summaries without needing to interact.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEWSWORTHY_AGENT_CMD` | `claude` | CLI to spawn when pressing A on an item |
| `NEWSWORTHY_LLM_URL` | `http://localhost:11434` | Ollama or OpenAI-compatible endpoint |
| `NEWSWORTHY_LLM_MODEL` | `llama3` | Model name to use for analysis |
