# Newsworthy

A token-curated registry for crypto news. Humans submit tweets, stake bonds to back their quality, and earn $NEWS tokens when content is accepted. Agents pay to query the curated feed via x402.

## How It Works

**Submit.** A registered human posts a tweet URL (x.com or twitter.com) and locks a 0.1 USDC bond. The contract validates the URL format on-chain — only tweet URLs are accepted.

**Challenge.** Any other registered human can challenge the submission within 30 minutes by posting a matching 0.1 USDC bond. This moves the item into a voting phase. You cannot challenge your own submissions (enforced by World ID — even across multiple wallets).

**Vote.** Registered humans vote to keep or remove the item during a 30-minute voting window. Voting is free — no bond required. Each human gets one vote per item, regardless of how many wallets they control.

**Resolve.** Once the voting period ends and at least 3 votes have been cast (quorum), anyone can trigger resolution:
- **Keep wins** (votes for >= votes against): Submitter gets 70% of both bonds. Voters who voted keep split 30%.
- **Remove wins**: Challenger gets 70% of both bonds. Voters who voted remove split 30%.
- **No quorum** (fewer than 3 votes): Both bonds returned, item accepted. Neither side is penalized for low participation.

**Accept.** Items that go unchallenged for the full 30-minute window are automatically accepted. Any address can call `acceptItem()` to finalize — it's a public good action.

**Reward.** Every accepted item (whether unchallenged, survived a challenge, or accepted via no-quorum) mints 100 $NEWS to the submitter.

**Withdraw.** Bond refunds and voter rewards accumulate in the contract. Users call `withdraw()` to claim their USDC at any time.

## Identity and Sybil Resistance

Newsworthy uses World ID via AgentBook to tie every wallet to a verified human. This is the backbone of the system's fairness guarantees:

- **One human, one vote.** If you control 10 wallets, you still get one vote per challenged item. The contract checks your World ID human identifier, not your wallet address.
- **No self-challenges.** You cannot challenge your own submission, even from a different wallet. The contract compares human IDs, not addresses.
- **Rate limiting per human.** Each human can submit a maximum of 3 items per day (UTC). This prevents spam farming where someone submits low-effort content at scale to farm $NEWS. The limit resets at midnight UTC.
- **Registration required for everything.** Submitting, challenging, and voting all require AgentBook registration. Unregistered addresses are rejected on-chain.

AgentBook is the identity layer — in production it verifies World ID proofs on-chain. For testing, MockAgentBook lets us assign human IDs manually without World App.

## The Three-Sided Marketplace

**Submitters** earn $NEWS for curating quality content. They risk their USDC bond but get it back (plus the challenger's bond) if their content survives challenges.

**Humans** read the curated feed for free. World ID verification prevents sybil attacks — one human, one identity, regardless of how many wallets they use.

**Agents** pay USDC via x402 to query the feed programmatically. This revenue flows to $NEWS stakers pro-rata.

## Game Theory

The incentive structure pushes participants toward honest behavior:

- **Submitting garbage is expensive.** You lose your 0.1 USDC bond if challenged and the community votes against you. With 3 submissions/day, a bad actor can lose at most 0.3 USDC/day — not profitable when $NEWS earned from spam gets diluted.
- **Frivolous challenges are expensive.** Challenging good content means losing your bond when voters keep it. Challengers need conviction that the content is actually bad.
- **Voting is free and profitable.** Voters on the winning side earn a share of the loser's bond (30% split evenly). This incentivizes participation and honest assessment with zero downside risk.
- **$NEWS aligns long-term incentives.** Submitters earn tokens that appreciate as agent query revenue grows. Quality feed attracts more agents, which means more revenue, which means $NEWS is worth more. Dumping $NEWS to farm short-term means missing future staking rewards.

## Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Bond amount | 0.1 USDC | Skin in the game for submitters and challengers |
| Challenge period | 30 minutes | Window to dispute a submission |
| Voting period | 30 minutes | Window for community to vote on challenged items |
| Minimum votes (quorum) | 3 | Prevents resolution with too few participants |
| $NEWS per accepted item | 100 $NEWS | Fixed emission to reward curators |
| Daily submission limit | 3 per human | Anti-spam, enforced via World ID |
| Voter reward share | 30% of total bond pool | Split among winning-side voters |
| Winner share | 70% of total bond pool | Goes to submitter (keep wins) or challenger (remove wins) |

## Contract Architecture

| Contract | Address (World Chain) | Role |
|----------|----------------------|------|
| FeedRegistry | `0x0156424A...a57B` | Core registry — submit, challenge, vote, resolve, withdraw |
| NewsToken | `0x11D1E765...301D` | ERC-20 reward token, minted by FeedRegistry on acceptance |
| NewsStaking | `0x42329d3B...343b` | Stake $NEWS, earn pro-rata USDC from x402 query revenue |
| AgentBook | `0x04436Df7...47f2` | Identity gate — World ID verification (MockAgentBook for testing) |

All contracts are deployed on World Chain (chain ID 480). Bonds are in USDC. No ETH needed for end users (gas sponsorship via Pimlico planned).

## Revenue Loop

```
Submitters curate tweets
    → Accepted items mint $NEWS
        → $NEWS holders stake
            → Agents pay USDC to query the feed
                → USDC flows to stakers
                    → $NEWS becomes valuable
                        → More submitters curate
```
