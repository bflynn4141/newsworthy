# Newsworthy CLI — Testing Guide

## Prerequisites

- **Bun** installed (`curl -fsSL https://bun.sh/install | bash`)
- **Forge** installed ([Foundry](https://getfoundry.sh))
- Deployer private key at `.secrets/deployer.key`
- Dependencies: `cd agent && bun install`

## Test Contracts (already deployed)

Test contracts use MockAgentBook (no World ID) with relaxed parameters for single-developer testing.

| Contract | Address | Notes |
|----------|---------|-------|
| MockAgentBook | `0x561DB06A58d793c86BC9b5CfecA9aBb1b42eE3F6` | No World ID, public `setHumanId()` |
| FeedRegistry (test) | `0xb7fD8e36f47bA7965338c1D4a51233a6d9bd406E` | 0.0001 ETH bond, 60s periods, 1 min vote |

Config: `contracts/deployments/worldchain-test.json`

### Re-deploying (if needed)

```bash
cd contracts && forge script script/DeployTestFeedRegistry.s.sol \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/public \
  --broadcast --private-key $(cat ../.secrets/deployer.key)
```

Then update `contracts/deployments/worldchain-test.json` with the new addresses.

## Production Contracts

| Contract | Address | Notes |
|----------|---------|-------|
| AgentBook | `0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc` | Requires World ID proof |
| FeedRegistry | `0xA727Cb7128DfcEf3bB0A79FAC6883D3c65cbeC2A` | 0.001 ETH bond, 1h periods, 3 min votes |

Config: `contracts/deployments/worldchain-mainnet.json`

---

## Story 1: Smoke Test (read-only, no gas)

Verifies config loading, RPC connection, and MockAgentBook registration.

```bash
bun run agent/src/cli.ts --test status
# Expected: Bond 0.0001 ETH, 1m periods, humanId 1

bun run agent/src/cli.ts --test items
# Expected: list of items (or "No items submitted yet")

bun run agent/src/cli.ts --test register
# Expected: "Registered as humanId: 1"
```

## Story 2: Happy Path — Submit + Accept (~70 seconds)

Tests the unchallenged item lifecycle: submit with bond, wait for grace period, accept, withdraw.

```bash
# 1. Submit an item
bun run agent/src/cli.ts --test submit "https://example.com/test-$(date +%s)" "metadata"

# 2. Verify it appeared
bun run agent/src/cli.ts --test items
bun run agent/src/cli.ts --test item <ID>
# Note the challenge countdown timer

# 3. Wait 60 seconds for challenge period to expire
sleep 65

# 4. Verify expiry, then accept
bun run agent/src/cli.ts --test item <ID>
# Should show "Expired"

bun run agent/src/cli.ts --test accept <ID>
bun run agent/src/cli.ts --test withdraw
```

## Story 3: Challenge + Vote + Resolve (~2 minutes)

Tests the full adversarial flow. **Requires two wallets** — the contract prevents self-challenges (same humanId can't submit and challenge the same item).

### Step 1: Generate a challenger key

```bash
# Generate a random private key
openssl rand -hex 32 > .secrets/challenger.key

# Derive the address (using cast from foundry)
CHALLENGER=$(cast wallet address --private-key $(cat .secrets/challenger.key))
echo "Challenger address: $CHALLENGER"
```

### Step 2: Fund the challenger

The challenger needs ETH for the bond (0.0001) + gas. Send ~0.0005 ETH from deployer.

```bash
cast send $CHALLENGER \
  --value 0.0005ether \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/public \
  --private-key $(cat .secrets/deployer.key)
```

### Step 3: Register challenger in MockAgentBook

MockAgentBook has a public `setHumanId(address, uint256)` — register as humanId 2.

```bash
cast send 0x561DB06A58d793c86BC9b5CfecA9aBb1b42eE3F6 \
  "setHumanId(address,uint256)" $CHALLENGER 2 \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/public \
  --private-key $(cat .secrets/deployer.key)
```

Verify:

```bash
cast call 0x561DB06A58d793c86BC9b5CfecA9aBb1b42eE3F6 \
  "lookupHuman(address)(uint256)" $CHALLENGER \
  --rpc-url https://worldchain-mainnet.g.alchemy.com/public
# Expected: 2
```

### Step 4: Run the challenge flow

Currently the CLI loads the key from `.secrets/deployer.key`. To use the challenger key, temporarily swap it:

```bash
# Back up deployer key
cp .secrets/deployer.key .secrets/deployer.key.bak

# --- AS DEPLOYER: Submit an item ---
bun run agent/src/cli.ts --test submit "https://example.com/challenge-test-$(date +%s)" "test"
# Note the item ID

# --- SWAP TO CHALLENGER ---
cp .secrets/challenger.key .secrets/deployer.key

# Challenge the item
bun run agent/src/cli.ts --test challenge <ID>

# --- SWAP BACK TO DEPLOYER (to vote) ---
cp .secrets/deployer.key.bak .secrets/deployer.key

# Vote to keep
bun run agent/src/cli.ts --test vote <ID> keep

# Wait for voting period
sleep 65

# Resolve (auto-detects quorum)
bun run agent/src/cli.ts --test resolve <ID>

# Withdraw rewards
bun run agent/src/cli.ts --test withdraw
```

### Future improvement

Add `--key <path>` flag to the CLI so you don't need to swap key files:

```bash
# Would allow:
bun run agent/src/cli.ts --test --key .secrets/challenger.key challenge <ID>
```

## Story 4: Edge Cases

All should produce clean error messages (not raw hex selectors).

```bash
# Duplicate URL → "Contract reverted: DuplicateUrl"
bun run agent/src/cli.ts --test submit "https://example.com/test-SAME-URL" "a"
bun run agent/src/cli.ts --test submit "https://example.com/test-SAME-URL" "b"

# Self-challenge → "Contract reverted: SelfChallenge"
bun run agent/src/cli.ts --test submit "https://example.com/self-challenge-test" ""
bun run agent/src/cli.ts --test challenge <ID>

# Accept too early → "Contract reverted: ChallengePeriodActive"
bun run agent/src/cli.ts --test submit "https://example.com/too-early" ""
bun run agent/src/cli.ts --test accept <ID>  # immediately

# Withdraw with nothing → "No pending withdrawals" (graceful, not a revert)
bun run agent/src/cli.ts --test withdraw
```

## Error Reference

| Error | Meaning |
|-------|---------|
| `NotRegistered` | Wallet not registered in AgentBook |
| `DuplicateUrl` | URL already submitted |
| `InvalidItemStatus` | Item is not in the expected state for this operation |
| `InsufficientBond` | Sent less ETH than required bond |
| `SelfChallenge` | Challenger and submitter are the same human |
| `AlreadyVoted` | This humanId already voted on this challenge |
| `ChallengePeriodActive` | Cannot accept yet — challenge window still open |
| `ChallengePeriodExpired` | Cannot challenge — grace period has passed |
| `VotingPeriodActive` | Cannot resolve yet — voting still open |
| `VotingPeriodExpired` | Cannot vote — voting window closed |
| `QuorumNotMet` | Cannot call `resolveChallenge` — not enough votes (use `resolve` command, it auto-detects) |
| `QuorumMet` | Cannot call `resolveNoQuorum` — quorum was reached (use `resolve` command, it auto-detects) |
| `NothingToWithdraw` | No pending ETH to claim |

## CLI Quick Reference

```bash
# All commands — add --test for test contracts, omit for production
bun run agent/src/cli.ts [--test] <command> [args...]

# Read (free)
status              # Registry overview
items               # List all items
item <id>           # Detail view
register            # Check AgentBook registration

# Write (costs gas)
submit <url> [meta] # Submit with bond
challenge <id>      # Challenge pending item
vote <id> keep      # Vote to keep
vote <id> remove    # Vote to remove
resolve <id>        # Auto-resolve (picks correct function)
accept <id>         # Accept unchallenged item
withdraw            # Claim pending ETH
```
