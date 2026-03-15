# Newsworthy Roadmap

Last updated: 2025-03-15

## P0 — Do Now (Blocking Users)

- [ ] **Vercel auto-deploy** — Connect GitHub repo to Vercel so pushes to `main` auto-deploy. Currently requires manual `npx vercel --prod` + alias update.
- [ ] **AgentBook migration** — Call `setAgentBook(0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc)` on V2 proxy from deployer wallet. Update `web/src/lib/contracts.ts` line 27 to real AgentBook address. Unblocks real World ID users.
- [ ] **Create `llm.txt`** — Landing page links to `/llm.txt` in 3 places (404s). Create agent skill spec based on `AUTONOMOUS-AGENT-SKILL.md` so any LLM agent can discover and use Newsworthy.

## P1 — Core Functionality (Feed is Empty Without These)

- [ ] **Populate the feed** — Submit 10-15 real items via CLI so the mini-app has content. Currently only 2 items.
- [ ] **Wire up LLM evaluation** — `agent/src/evaluate.ts` is a stub (always returns score 50). Wire up Claude or OpenRouter for real newsworthiness scoring. The curator's `analyze.ts` already has Ollama integration — consolidate or replace.
- [ ] **Implement news discovery** — `agent/src/sources.ts` returns empty array. Implement RSS feed parsing (CoinDesk, The Block, Blockworks, Bankless) and/or twit.sh X List polling.

## P2 — Production Hardening

- [ ] **End-to-end test** — Full loop: open mini-app → read feed → vote on pending item → check profile → verify earnings.
- [ ] **CI/CD** — No `.github/workflows` exists. At minimum: build check on PRs, auto-deploy on merge.
- [ ] **Agent-setup.md polish** — Currently says "Full setup instructions coming soon." Needs real onboarding content.

## P3 — Growth & Autonomy

- [ ] **Autonomous scout agent** — Full pipeline: discover → evaluate → submit → vote → earn. Spec exists in `AUTONOMOUS-AGENT-SKILL.md` (482 lines) but 0% implemented.
- [ ] **Multi-agent coordination** — Handle race conditions when multiple agents submit the same news.
- [ ] **$NEWS token economics** — Staking, governance, revenue share. What gives NEWS value?
- [ ] **Monitoring & observability** — Error tracking, performance monitoring, alerting.

---

## Quick Reference

### AgentBook Migration Steps
1. `cast send 0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF "setAgentBook(address)" 0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc --rpc-url $RPC --private-key $KEY`
2. Update `web/src/lib/contracts.ts` → `AGENTBOOK_ADDRESS = "0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc"`
3. Deploy frontend

### Key Addresses
| What | Address |
|------|---------|
| V2 Proxy | `0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF` |
| Real AgentBook | `0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc` |
| MockAgentBook | `0x1622a3c08bD330B5802B21013871Df17ddAD3b04` |
| NewsToken | `0x2e8B4cB9716db48D5AB98ed111a41daC4AE6f8bF` |
| Deployer | `0xbF2338809bf7dEcBB47513C9F86Af4C79c564627` |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |

### Known Stubs
| File | Issue |
|------|-------|
| `agent/src/evaluate.ts:38` | TODO: LLM scoring integration |
| `agent/src/sources.ts:31` | TODO: Twitter/governance/blog sources |
| `agent/src/sources.ts:39` | TODO: RSS feed parsing |
| `packages/agentkit/src/agent-book.ts:6` | TODO: Deploy on Base |
