// Curator Agent — autonomous curation loop for FeedRegistry
//
// Watches the registry, analyzes new submissions, and takes action:
//   - Challenges low-quality items (bonds USDC)
//   - Votes on active challenges (keep/remove based on analysis)
//   - Accepts unchallenged items past their grace period
//   - Resolves finished challenges (quorum or no-quorum)
//
// Usage:
//   bun run agent/src/curator.ts [--test] [--dry-run] [--challenge-threshold 4.0]
//
// The agent needs:
//   - A funded wallet (.secrets/deployer.key)
//   - Registration in AgentBook (World ID or MockAgentBook)
//   - An LLM endpoint (Ollama, OpenRouter, etc.) for analysis

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  formatUnits,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { worldchain } from 'viem/chains'
import { FEED_REGISTRY_ABI, ERC20_ABI } from './curate.js'
import { AGENTBOOK_ABI } from './register.js'
import { analyzeItem, detectLlm, getLlmStatus, type ArticleAnalysis } from './dashboard/analyze.js'
import type { FeedItem } from './dashboard/useFeedData.js'

// ── Types ──────────────────────────────────────────────────────────────────

type Deployment = {
  rpc: string
  writeRpc?: string
  deployer: string
  contracts: {
    AgentBook: { address: string }
    FeedRegistry: { address: string }
  }
}

type RegistryConfig = {
  bondAmount: bigint
  challengePeriod: bigint
  votingPeriod: bigint
  minVotes: bigint
  bondToken: Address
  tokenSymbol: string
  tokenDecimals: number
  newsPerItem: bigint
  maxDailySubmissions: bigint
}

export type CuratorConfig = {
  challengeThreshold: number  // challenge items scoring below this (default: 4.0)
  voteThreshold: number       // vote REMOVE if below, KEEP if above (default: 5.0)
  autoAccept: boolean         // accept expired unchallenged items (default: true)
  autoResolve: boolean        // resolve expired challenges (default: true)
  dryRun: boolean             // log decisions without sending transactions
  pollIntervalMs: number      // how often to scan (default: 30000)
}

type ActionLog = {
  timestamp: number
  action: string
  itemId: number
  reason: string
  txHash?: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_PENDING = 0
const STATUS_CHALLENGED = 1
const STATUS_ACCEPTED = 2
const STATUS_REJECTED = 3

const BOLD = '\x1b[1m'
const DIM = '\x1b[90m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

// ── Helpers ────────────────────────────────────────────────────────────────

function log(prefix: string, msg: string) {
  const time = new Date().toLocaleTimeString('en-US', { hour12: false })
  console.log(`${DIM}${time}${RESET} ${prefix} ${msg}`)
}

function logAction(msg: string) { log(`${GREEN}ACT${RESET}`, msg) }
function logSkip(msg: string) { log(`${DIM}---${RESET}`, msg) }
function logInfo(msg: string) { log(`${CYAN}INF${RESET}`, msg) }
function logWarn(msg: string) { log(`${YELLOW}WRN${RESET}`, msg) }
function logError(msg: string) { log(`${RED}ERR${RESET}`, msg) }

async function loadDeployment(test: boolean): Promise<Deployment> {
  const filename = test ? 'worldchain-test.json' : 'worldchain-mainnet.json'
  const filePath = fileURLToPath(new URL(`../../contracts/deployments/${filename}`, import.meta.url))
  const text = await readFile(filePath, 'utf-8')
  return JSON.parse(text) as Deployment
}

async function loadPrivateKey(): Promise<`0x${string}`> {
  const filePath = fileURLToPath(new URL('../../.secrets/deployer.key', import.meta.url))
  const key = (await readFile(filePath, 'utf-8')).trim()
  if (!key.startsWith('0x')) return `0x${key}` as `0x${string}`
  return key as `0x${string}`
}

// ── Registry Reader ────────────────────────────────────────────────────────

async function fetchConfig(client: PublicClient, registry: Address): Promise<RegistryConfig> {
  const [bondAmount, challengePeriod, votingPeriod, minVotes, bondToken, newsPerItem, maxDailySubmissions] = await Promise.all([
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'bondAmount' }) as Promise<bigint>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'challengePeriod' }) as Promise<bigint>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'votingPeriod' }) as Promise<bigint>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'minVotes' }) as Promise<bigint>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'bondToken' }) as Promise<Address>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'newsPerItem' }) as Promise<bigint>,
    client.readContract({ address: registry, abi: FEED_REGISTRY_ABI, functionName: 'maxDailySubmissions' }) as Promise<bigint>,
  ])

  const [tokenSymbol, tokenDecimals] = await Promise.all([
    client.readContract({ address: bondToken, abi: ERC20_ABI, functionName: 'symbol' }) as Promise<string>,
    client.readContract({ address: bondToken, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
  ])

  return { bondAmount, challengePeriod, votingPeriod, minVotes, bondToken, tokenSymbol, tokenDecimals, newsPerItem, maxDailySubmissions }
}

async function fetchAllItems(
  client: PublicClient,
  registry: Address,
  config: RegistryConfig,
): Promise<FeedItem[]> {
  const nextId = await client.readContract({
    address: registry, abi: FEED_REGISTRY_ABI, functionName: 'nextItemId',
  }) as bigint

  const count = Number(nextId)
  const nowSec = BigInt(Math.floor(Date.now() / 1000))
  const items: FeedItem[] = []

  const promises = Array.from({ length: count }, async (_, i) => {
    const raw = await client.readContract({
      address: registry, abi: FEED_REGISTRY_ABI, functionName: 'items', args: [BigInt(i)],
    }) as [Address, string, string, bigint, bigint, number]

    const [submitter, url, metadataHash, bond, submittedAt, status] = raw

    let timeRemaining = -1
    if (status === STATUS_PENDING) {
      const end = submittedAt + config.challengePeriod
      timeRemaining = Math.max(0, Number(end - nowSec))
    }

    const item: FeedItem = { id: i, submitter, url, metadataHash, bond, submittedAt, status, timeRemaining }

    if (status === STATUS_CHALLENGED) {
      const cRaw = await client.readContract({
        address: registry, abi: FEED_REGISTRY_ABI, functionName: 'challenges', args: [BigInt(i)],
      }) as [Address, bigint, bigint, bigint, bigint]
      const [challenger, cBond, challengedAt, votesFor, votesAgainst] = cRaw
      item.challenge = {
        challenger, bond: cBond, challengedAt, votesFor, votesAgainst,
        timeRemaining: Math.max(0, Number(challengedAt + config.votingPeriod - nowSec)),
      }
    }

    return item
  })

  const results = await Promise.all(promises)
  return results.sort((a, b) => a.id - b.id)
}

// ── Curator Logic ──────────────────────────────────────────────────────────

export async function runCuratorLoop(
  curatorConfig: CuratorConfig,
  isTest: boolean,
): Promise<never> {
  // Setup
  const deployment = await loadDeployment(isTest)
  const readRpc = deployment.rpc
  const writeRpc = deployment.writeRpc ?? readRpc
  const registryAddr = deployment.contracts.FeedRegistry.address as Address
  const agentBookAddr = deployment.contracts.AgentBook.address as Address

  const client = createPublicClient({ chain: worldchain, transport: http(readRpc) })
  const key = await loadPrivateKey()
  const account = privateKeyToAccount(key)
  const walletClient = createWalletClient({ chain: worldchain, transport: http(writeRpc), account })
  const agentAddr = account.address

  // Preflight checks
  logInfo(`Agent address: ${agentAddr}`)
  logInfo(`Registry: ${registryAddr}`)
  logInfo(`Mode: ${curatorConfig.dryRun ? `${YELLOW}DRY RUN${RESET}` : `${GREEN}LIVE${RESET}`}`)
  logInfo(`Challenge threshold: ${curatorConfig.challengeThreshold}`)
  logInfo(`Vote threshold: ${curatorConfig.voteThreshold}`)
  logInfo(`Poll interval: ${curatorConfig.pollIntervalMs / 1000}s`)

  // Check registration
  const humanId = await client.readContract({
    address: agentBookAddr, abi: AGENTBOOK_ABI, functionName: 'lookupHuman',
    args: [agentAddr],
  }) as bigint

  if (humanId === 0n) {
    logError('Agent is NOT registered in AgentBook. Register first (World ID or MockAgentBook).')
    process.exit(1)
  }
  logInfo(`Registered as humanId: ${humanId}`)

  // Check LLM
  const hasLlm = await detectLlm()
  const llmStatus = getLlmStatus()
  if (!hasLlm) {
    logWarn('No LLM detected. Analysis will be limited to submitter reputation only.')
  } else {
    logInfo(`LLM: ${llmStatus.model}`)
  }

  // Fetch registry config (including bond token info)
  const registryConfig = await fetchConfig(client, registryAddr)
  const fmt = (amount: bigint) => formatUnits(amount, registryConfig.tokenDecimals)

  // Check balances
  const ethBalance = await client.getBalance({ address: agentAddr })
  const tokenBalance = await client.readContract({
    address: registryConfig.bondToken, abi: ERC20_ABI, functionName: 'balanceOf', args: [agentAddr],
  }) as bigint
  logInfo(`ETH balance: ${formatEther(ethBalance)} (for gas)`)
  logInfo(`${registryConfig.tokenSymbol} balance: ${fmt(tokenBalance)}`)
  logInfo(`Bond token: ${registryConfig.tokenSymbol} @ ${registryConfig.bondToken}`)
  logInfo(`Bond: ${fmt(registryConfig.bondAmount)} ${registryConfig.tokenSymbol} | Challenge: ${registryConfig.challengePeriod}s | Voting: ${registryConfig.votingPeriod}s | MinVotes: ${registryConfig.minVotes}`)

  // Ensure USDC approval for registry (approve max once)
  const allowance = await client.readContract({
    address: registryConfig.bondToken, abi: ERC20_ABI, functionName: 'allowance',
    args: [agentAddr, registryAddr],
  }) as bigint

  if (allowance < registryConfig.bondAmount * 100n) {
    logInfo(`Approving ${registryConfig.tokenSymbol} for registry...`)
    if (!curatorConfig.dryRun) {
      const approveHash = await walletClient.writeContract({
        address: registryConfig.bondToken, abi: ERC20_ABI, functionName: 'approve',
        args: [registryAddr, 2n ** 256n - 1n], // max approval
      })
      logInfo(`Approved: ${approveHash}`)
    } else {
      logInfo(`(dry run) Would approve max ${registryConfig.tokenSymbol}`)
    }
  } else {
    logInfo(`${registryConfig.tokenSymbol} already approved for registry`)
  }

  console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`)
  console.log(`${BOLD}  Curator agent started. Watching for items...${RESET}`)
  console.log(`${BOLD}${'='.repeat(60)}${RESET}\n`)

  // Track what we've already processed to avoid double-actions
  const processedItems = new Set<number>()
  const votedItems = new Set<number>()
  const acceptedItems = new Set<number>()
  const resolvedItems = new Set<number>()
  const actionLog: ActionLog[] = []

  function recordAction(action: string, itemId: number, reason: string, txHash?: string) {
    actionLog.push({ timestamp: Date.now(), action, itemId, reason, txHash })
  }

  // Main loop
  while (true) {
    try {
      const items = await fetchAllItems(client, registryAddr, registryConfig)
      const nowSec = Math.floor(Date.now() / 1000)

      for (const item of items) {
        // Skip terminal states
        if (item.status === STATUS_ACCEPTED || item.status === STATUS_REJECTED) continue

        // ── PENDING items ──────────────────────────────────────────
        if (item.status === STATUS_PENDING) {
          const challengeEnd = Number(item.submittedAt) + Number(registryConfig.challengePeriod)
          const expired = nowSec > challengeEnd

          // Accept expired items
          if (expired && curatorConfig.autoAccept && !acceptedItems.has(item.id)) {
            acceptedItems.add(item.id)
            logAction(`#${item.id} challenge period expired — accepting`)
            if (!curatorConfig.dryRun) {
              try {
                const hash = await walletClient.writeContract({
                  address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'acceptItem',
                  args: [BigInt(item.id)],
                })
                logAction(`#${item.id} accepted: ${hash}`)
                recordAction('accept', item.id, 'Challenge period expired', hash)
              } catch (err: any) {
                logError(`#${item.id} accept failed: ${err?.shortMessage ?? err?.message}`)
              }
            } else {
              recordAction('accept (dry)', item.id, 'Challenge period expired')
            }
            continue
          }

          // Analyze and maybe challenge (only while challenge period is active)
          if (!expired && !processedItems.has(item.id)) {
            processedItems.add(item.id)

            // Don't challenge our own submissions
            if (item.submitter.toLowerCase() === agentAddr.toLowerCase()) {
              logSkip(`#${item.id} own submission — skipping`)
              continue
            }

            logInfo(`#${item.id} analyzing ${item.url.slice(0, 60)}...`)
            const analysis = await analyzeItem(item, items)

            if (analysis.status === 'done' && analysis.score < curatorConfig.challengeThreshold) {
              logAction(`#${item.id} score ${analysis.score} < ${curatorConfig.challengeThreshold} — challenging`)
              logAction(`  Reason: ${analysis.flagReason ?? analysis.summary ?? 'Low quality'}`)

              if (!curatorConfig.dryRun) {
                try {
                  const hash = await walletClient.writeContract({
                    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challengeItem',
                    args: [BigInt(item.id)],
                  })
                  logAction(`#${item.id} challenged: ${hash}`)
                  recordAction('challenge', item.id, `Score ${analysis.score} < ${curatorConfig.challengeThreshold}`, hash)
                } catch (err: any) {
                  logError(`#${item.id} challenge failed: ${err?.shortMessage ?? err?.message}`)
                }
              } else {
                recordAction('challenge (dry)', item.id, `Score ${analysis.score} < ${curatorConfig.challengeThreshold}`)
              }
            } else if (analysis.status === 'done') {
              logSkip(`#${item.id} score ${analysis.score} — OK`)
            } else if (analysis.status === 'error') {
              logWarn(`#${item.id} analysis error: ${analysis.error}`)
              // If URL is unreachable, consider challenging
              if (analysis.flagged && analysis.flagReason === 'Unreachable URL') {
                logAction(`#${item.id} unreachable URL — challenging`)
                if (!curatorConfig.dryRun) {
                  try {
                    const hash = await walletClient.writeContract({
                      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challengeItem',
                      args: [BigInt(item.id)],
                    })
                    logAction(`#${item.id} challenged: ${hash}`)
                    recordAction('challenge', item.id, 'Unreachable URL', hash)
                  } catch (err: any) {
                    logError(`#${item.id} challenge failed: ${err?.shortMessage ?? err?.message}`)
                  }
                } else {
                  recordAction('challenge (dry)', item.id, 'Unreachable URL')
                }
              }
            }
          }
        }

        // ── CHALLENGED items ───────────────────────────────────────
        if (item.status === STATUS_CHALLENGED && item.challenge) {
          const votingEnd = Number(item.challenge.challengedAt) + Number(registryConfig.votingPeriod)
          const votingExpired = nowSec > votingEnd

          // Resolve expired challenges
          if (votingExpired && curatorConfig.autoResolve && !resolvedItems.has(item.id)) {
            resolvedItems.add(item.id)
            const totalVotes = item.challenge.votesFor + item.challenge.votesAgainst
            const quorumMet = totalVotes >= registryConfig.minVotes
            const fn = quorumMet ? 'resolveChallenge' : 'resolveNoQuorum'

            logAction(`#${item.id} voting expired (${totalVotes} votes, quorum ${quorumMet ? 'met' : 'not met'}) — resolving via ${fn}`)

            if (!curatorConfig.dryRun) {
              try {
                const hash = await walletClient.writeContract({
                  address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: fn,
                  args: [BigInt(item.id)],
                })
                logAction(`#${item.id} resolved: ${hash}`)
                recordAction('resolve', item.id, `${fn}, ${totalVotes} votes`, hash)
              } catch (err: any) {
                logError(`#${item.id} resolve failed: ${err?.shortMessage ?? err?.message}`)
              }
            } else {
              recordAction('resolve (dry)', item.id, `${fn}, ${totalVotes} votes`)
            }
            continue
          }

          // Vote on active challenges (only if we haven't voted and didn't challenge it ourselves)
          if (!votingExpired && !votedItems.has(item.id)) {
            // Check if we're the challenger — can't vote on own challenge
            if (item.challenge.challenger.toLowerCase() === agentAddr.toLowerCase()) {
              votedItems.add(item.id)
              logSkip(`#${item.id} we challenged this — can't vote`)
              continue
            }
            // Check if we're the submitter — skip voting on own submission
            if (item.submitter.toLowerCase() === agentAddr.toLowerCase()) {
              votedItems.add(item.id)
              logSkip(`#${item.id} our submission — skipping vote`)
              continue
            }

            votedItems.add(item.id)
            logInfo(`#${item.id} analyzing for vote...`)
            const analysis = await analyzeItem(item, items)

            if (analysis.status !== 'done' && !analysis.flagged) {
              logWarn(`#${item.id} analysis incomplete — abstaining`)
              continue
            }

            // Vote based on score vs threshold
            const keep = analysis.score >= curatorConfig.voteThreshold
            logAction(`#${item.id} score ${analysis.score} ${keep ? '>=' : '<'} ${curatorConfig.voteThreshold} — voting ${keep ? 'KEEP' : 'REMOVE'}`)

            if (!curatorConfig.dryRun) {
              try {
                const hash = await walletClient.writeContract({
                  address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'voteOnChallenge',
                  args: [BigInt(item.id), keep],
                })
                logAction(`#${item.id} voted ${keep ? 'KEEP' : 'REMOVE'}: ${hash}`)
                recordAction(keep ? 'vote-keep' : 'vote-remove', item.id, `Score ${analysis.score}`, hash)
              } catch (err: any) {
                // AlreadyVoted is expected if another agent voted from same humanId
                logError(`#${item.id} vote failed: ${err?.shortMessage ?? err?.message}`)
              }
            } else {
              recordAction(`vote-${keep ? 'keep' : 'remove'} (dry)`, item.id, `Score ${analysis.score}`)
            }
          }
        }
      }
    } catch (err: any) {
      logError(`Poll failed: ${err?.shortMessage ?? err?.message ?? err}`)
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, curatorConfig.pollIntervalMs))
  }
}

// ── CLI Entry Point ────────────────────────────────────────────────────────

async function main() {
  const argv = typeof globalThis.Bun !== 'undefined' ? (globalThis as any).Bun.argv.slice(2) : process.argv.slice(2)
  const { values } = parseArgs({
    args: argv,
    options: {
      test: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'challenge-threshold': { type: 'string', default: '4.0' },
      'vote-threshold': { type: 'string', default: '5.0' },
      'no-accept': { type: 'boolean', default: false },
      'no-resolve': { type: 'boolean', default: false },
      'poll-interval': { type: 'string', default: '30' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  })

  if (values.help) {
    console.log(`
${BOLD}Newsworthy Curator Agent${RESET} — autonomous curation for FeedRegistry

${BOLD}Usage:${RESET}
  bun run agent/src/curator.ts [options]

${BOLD}Options:${RESET}
  --test                  Use test deployment (MockAgentBook, short periods)
  --dry-run               Log decisions without sending transactions
  --challenge-threshold N Score below which items are challenged (default: 4.0)
                          ${DIM}Range 1-10. Higher = more aggressive.${RESET}
                          ${DIM}  1-3: Only challenges obvious spam${RESET}
                          ${DIM}  4-5: Challenges mediocre content${RESET}
                          ${DIM}  6-7: Challenges anything below "good"${RESET}
                          ${DIM}  8-10: Challenges almost everything${RESET}
                          ${DIM}Each challenge costs the bond amount in USDC.${RESET}
                          ${DIM}You earn 2x bond if the challenge succeeds,${RESET}
                          ${DIM}but lose your bond if the community votes to keep it.${RESET}
  --vote-threshold N      Score below which to vote REMOVE (default: 5.0)
                          ${DIM}Range 1-10. Items scoring above this get a KEEP vote.${RESET}
                          ${DIM}Voting is free (no bond required).${RESET}
  --no-accept             Don't auto-accept expired pending items
  --no-resolve            Don't auto-resolve expired challenges
  --poll-interval N       Seconds between scans (default: 30)
  -h, --help              Show this help

${BOLD}Examples:${RESET}
  ${DIM}# Conservative curator — only challenges spam${RESET}
  bun run agent/src/curator.ts --test --challenge-threshold 3.0

  ${DIM}# Aggressive curator — challenges anything below "good"${RESET}
  bun run agent/src/curator.ts --test --challenge-threshold 6.0

  ${DIM}# Dry run — see what the agent would do without spending USDC${RESET}
  bun run agent/src/curator.ts --test --dry-run

  ${DIM}# Vote-only (no challenges, no housekeeping)${RESET}
  bun run agent/src/curator.ts --test --challenge-threshold 0 --no-accept --no-resolve
`)
    return
  }

  const config: CuratorConfig = {
    challengeThreshold: parseFloat(values['challenge-threshold'] ?? '4.0'),
    voteThreshold: parseFloat(values['vote-threshold'] ?? '5.0'),
    autoAccept: !values['no-accept'],
    autoResolve: !values['no-resolve'],
    dryRun: values['dry-run'] ?? false,
    pollIntervalMs: parseInt(values['poll-interval'] ?? '30', 10) * 1000,
  }

  await runCuratorLoop(config, values.test ?? false)
}

main().catch(err => {
  console.error(`\x1b[31mFatal:\x1b[0m ${err?.message ?? err}`)
  process.exit(1)
})
