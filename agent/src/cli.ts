#!/usr/bin/env bun
// Newsworthy CLI — interact with FeedRegistry + AgentBook on World Chain
//
// Usage:
//   bun run agent/src/cli.ts [--test] <command> [args...]
//
// Commands (read):
//   status          Registry overview: bond, periods, deployer balance
//   items           List all items with ID, status, submitter, URL
//   item <id>       Detail view for a single item + challenge info
//   register        Check if deployer is registered in AgentBook
//
// Commands (write — costs gas):
//   submit <url> [meta]     Submit news item with bond
//   challenge <id>          Challenge a pending item
//   vote <id> <keep|remove> Vote on a challenged item
//   resolve <id>            Resolve a challenge (auto-detects quorum)
//   accept <id>             Accept an unchallenged item past grace period
//   withdraw                Claim pending ETH rewards
//
// Flags:
//   --test    Use test contracts (MockAgentBook, relaxed params)

import { parseArgs } from 'node:util'
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  type Address,
  type PublicClient,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { worldchain } from 'viem/chains'
import { FEED_REGISTRY_ABI } from './curate.js'
import { AGENTBOOK_ABI } from './register.js'

// ── Config ──────────────────────────────────────────────────────────────────

type Deployment = {
  chainId: number
  rpc: string
  deployer: string
  contracts: {
    AgentBook: { address: string }
    FeedRegistry: { address: string }
  }
}

const EXPLORER = 'https://worldchain-mainnet.explorer.alchemy.com'

const STATUS_NAMES: Record<number, string> = {
  0: 'Pending',
  1: 'Challenged',
  2: 'Accepted',
  3: 'Rejected',
}

const STATUS_COLORS: Record<number, string> = {
  0: '\x1b[33m',  // yellow
  1: '\x1b[31m',  // red
  2: '\x1b[32m',  // green
  3: '\x1b[90m',  // dim
}

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[90m'

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusLabel(status: number): string {
  const color = STATUS_COLORS[status] ?? ''
  const name = STATUS_NAMES[status] ?? `Unknown(${status})`
  return `${color}${name}${RESET}`
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return 'expired'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function timeRemaining(startTimestamp: bigint, periodSeconds: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const end = startTimestamp + periodSeconds
  if (now >= end) return '\x1b[32mExpired\x1b[0m'
  return formatDuration(Number(end - now)) + ' remaining'
}

function txLink(hash: string): string {
  return `${EXPLORER}/tx/${hash}`
}

function die(msg: string): never {
  console.error(`\x1b[31mError:\x1b[0m ${msg}`)
  process.exit(1)
}

// ── Load config ─────────────────────────────────────────────────────────────

async function loadDeployment(test: boolean): Promise<Deployment> {
  const filename = test ? 'worldchain-test.json' : 'worldchain-mainnet.json'
  const path = new URL(`../../contracts/deployments/${filename}`, import.meta.url)
  try {
    const file = Bun.file(path)
    return await file.json() as Deployment
  } catch {
    die(`Deployment file not found: contracts/deployments/${filename}`)
  }
}

async function loadPrivateKey(): Promise<`0x${string}`> {
  const path = new URL('../../.secrets/deployer.key', import.meta.url)
  try {
    const file = Bun.file(path)
    const key = (await file.text()).trim()
    if (!key.startsWith('0x')) return `0x${key}` as `0x${string}`
    return key as `0x${string}`
  } catch {
    die('Private key not found at .secrets/deployer.key')
  }
}

async function getWalletClient(rpcUrl: string) {
  const key = await loadPrivateKey()
  const account = privateKeyToAccount(key)
  return createWalletClient({ chain: worldchain, transport: http(rpcUrl), account })
}

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdStatus(
  deployment: Deployment,
  client: PublicClient,
  registryAddr: Address,
  agentBookAddr: Address,
) {
  const [bond, challengePeriod, votingPeriod, minVotes, nextId, balance] = await Promise.all([
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'bondAmount' }),
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challengePeriod' }),
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'votingPeriod' }),
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'minVotes' }),
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'nextItemId' }),
    client.getBalance({ address: deployment.deployer as Address }),
  ])

  const humanId = await client.readContract({
    address: agentBookAddr, abi: AGENTBOOK_ABI, functionName: 'lookupHuman',
    args: [deployment.deployer as Address],
  })

  console.log(`\n${BOLD}═══ Newsworthy Registry Status ═══${RESET}\n`)
  console.log(`  Registry:         ${DIM}${registryAddr}${RESET}`)
  console.log(`  AgentBook:        ${DIM}${agentBookAddr}${RESET}`)
  console.log(`  Bond:             ${formatEther(bond as bigint)} ETH`)
  console.log(`  Challenge period: ${formatDuration(Number(challengePeriod as bigint))}`)
  console.log(`  Voting period:    ${formatDuration(Number(votingPeriod as bigint))}`)
  console.log(`  Min votes:        ${(minVotes as bigint).toString()}`)
  console.log(`  Total items:      ${(nextId as bigint).toString()}`)
  console.log(`  Deployer:         ${DIM}${deployment.deployer}${RESET}`)
  console.log(`  Deployer balance: ${formatEther(balance)} ETH`)
  console.log(`  Registered:       ${humanId !== 0n ? `\x1b[32mYes\x1b[0m (humanId: ${humanId})` : '\x1b[31mNo\x1b[0m'}`)
  console.log()
}

async function cmdItems(client: PublicClient, registryAddr: Address) {
  const nextId = await client.readContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'nextItemId',
  }) as bigint

  if (nextId === 0n) {
    console.log('\nNo items submitted yet.\n')
    return
  }

  console.log(`\n${BOLD}═══ Items (${nextId} total) ═══${RESET}\n`)

  for (let i = 0n; i < nextId; i++) {
    const item = await client.readContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'items', args: [i],
    }) as [Address, string, string, bigint, bigint, number]

    const [submitter, url, , bond, , status] = item
    console.log(`  ${BOLD}#${i}${RESET}  ${statusLabel(status)}  ${formatEther(bond)} ETH  ${DIM}${submitter.slice(0, 10)}…${RESET}`)
    console.log(`      ${url}`)
  }
  console.log()
}

async function cmdItem(client: PublicClient, registryAddr: Address, itemId: bigint) {
  const item = await client.readContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'items', args: [itemId],
  }) as [Address, string, string, bigint, bigint, number]

  const [submitter, url, metadataHash, bond, submittedAt, status] = item

  const [challengePeriod, votingPeriod] = await Promise.all([
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challengePeriod' }) as Promise<bigint>,
    client.readContract({ address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'votingPeriod' }) as Promise<bigint>,
  ])

  console.log(`\n${BOLD}═══ Item #${itemId} ═══${RESET}\n`)
  console.log(`  Status:       ${statusLabel(status)}`)
  console.log(`  URL:          ${url}`)
  console.log(`  Metadata:     ${metadataHash || DIM + '(none)' + RESET}`)
  console.log(`  Submitter:    ${DIM}${submitter}${RESET}`)
  console.log(`  Bond:         ${formatEther(bond)} ETH`)
  console.log(`  Submitted at: ${new Date(Number(submittedAt) * 1000).toISOString()}`)

  if (status === 0) {
    console.log(`  Challenge:    ${timeRemaining(submittedAt, challengePeriod)}`)
  }

  if (status === 1) {
    const challenge = await client.readContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challenges', args: [itemId],
    }) as [Address, bigint, bigint, bigint, bigint]

    const [challenger, cBond, challengedAt, votesFor, votesAgainst] = challenge

    console.log(`\n  ${BOLD}── Challenge ──${RESET}`)
    console.log(`  Challenger:   ${DIM}${challenger}${RESET}`)
    console.log(`  Bond:         ${formatEther(cBond)} ETH`)
    console.log(`  Votes keep:   ${votesFor.toString()}`)
    console.log(`  Votes remove: ${votesAgainst.toString()}`)
    console.log(`  Voting:       ${timeRemaining(challengedAt, votingPeriod)}`)
  }
  console.log()
}

async function cmdRegister(client: PublicClient, agentBookAddr: Address, deployer: Address) {
  const humanId = await client.readContract({
    address: agentBookAddr, abi: AGENTBOOK_ABI, functionName: 'lookupHuman',
    args: [deployer],
  }) as bigint

  if (humanId !== 0n) {
    console.log(`\n\x1b[32m✓\x1b[0m Registered as humanId: ${humanId}\n`)
  } else {
    console.log(`\n\x1b[31m✗\x1b[0m Not registered in AgentBook.\n`)
    console.log(`  Production: Scan World ID QR code to register.`)
    console.log(`  Test (--test): MockAgentBook auto-registers deployer.\n`)
  }
}

async function cmdSubmit(
  client: PublicClient, rpcUrl: string, registryAddr: Address,
  url: string, metadataHash: string,
) {
  const walletClient = await getWalletClient(rpcUrl)

  const bond = await client.readContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'bondAmount',
  }) as bigint

  console.log(`\nSubmitting: ${url}`)
  console.log(`Bond: ${formatEther(bond)} ETH`)

  const hash = await walletClient.writeContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'submitItem',
    args: [url, metadataHash], value: bond,
  })

  console.log(`\x1b[32m✓\x1b[0m Submitted: ${txLink(hash)}\n`)
}

async function cmdChallenge(
  client: PublicClient, rpcUrl: string, registryAddr: Address, itemId: bigint,
) {
  const walletClient = await getWalletClient(rpcUrl)

  const item = await client.readContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'items', args: [itemId],
  }) as [Address, string, string, bigint, bigint, number]

  const bond = item[3]

  console.log(`\nChallenging item #${itemId}`)
  console.log(`Bond: ${formatEther(bond)} ETH`)

  const hash = await walletClient.writeContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challengeItem',
    args: [itemId], value: bond,
  })

  console.log(`\x1b[32m✓\x1b[0m Challenged: ${txLink(hash)}\n`)
}

async function cmdVote(
  client: PublicClient, rpcUrl: string, registryAddr: Address,
  itemId: bigint, support: boolean,
) {
  const walletClient = await getWalletClient(rpcUrl)

  console.log(`\nVoting ${support ? '\x1b[32mKEEP\x1b[0m' : '\x1b[31mREMOVE\x1b[0m'} on item #${itemId}`)

  const hash = await walletClient.writeContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'voteOnChallenge',
    args: [itemId, support],
  })

  console.log(`\x1b[32m✓\x1b[0m Vote cast: ${txLink(hash)}\n`)
}

async function cmdResolve(
  client: PublicClient, rpcUrl: string, registryAddr: Address, itemId: bigint,
) {
  const walletClient = await getWalletClient(rpcUrl)

  const [challenge, minVotes] = await Promise.all([
    client.readContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'challenges', args: [itemId],
    }) as Promise<[Address, bigint, bigint, bigint, bigint]>,
    client.readContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'minVotes',
    }) as Promise<bigint>,
  ])

  const [, , , votesFor, votesAgainst] = challenge
  const totalVotes = votesFor + votesAgainst
  const quorumMet = totalVotes >= minVotes

  console.log(`\nResolving item #${itemId}`)
  console.log(`Votes: ${votesFor} keep / ${votesAgainst} remove (${totalVotes} total, need ${minVotes})`)

  let hash: `0x${string}`
  if (quorumMet) {
    console.log(`Quorum met — calling resolveChallenge`)
    hash = await walletClient.writeContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'resolveChallenge',
      args: [itemId],
    })
  } else {
    console.log(`No quorum — calling resolveNoQuorum (bonds returned)`)
    hash = await walletClient.writeContract({
      address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'resolveNoQuorum',
      args: [itemId],
    })
  }

  console.log(`\x1b[32m✓\x1b[0m Resolved: ${txLink(hash)}\n`)
}

async function cmdAccept(
  client: PublicClient, rpcUrl: string, registryAddr: Address, itemId: bigint,
) {
  const walletClient = await getWalletClient(rpcUrl)

  console.log(`\nAccepting item #${itemId}`)

  const hash = await walletClient.writeContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'acceptItem',
    args: [itemId],
  })

  console.log(`\x1b[32m✓\x1b[0m Accepted: ${txLink(hash)}\n`)
}

async function cmdWithdraw(
  client: PublicClient, rpcUrl: string, registryAddr: Address, deployer: Address,
) {
  const walletClient = await getWalletClient(rpcUrl)

  const pending = await client.readContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'pendingWithdrawals',
    args: [deployer],
  }) as bigint

  if (pending === 0n) {
    console.log('\nNo pending withdrawals.\n')
    return
  }

  console.log(`\nWithdrawing ${formatEther(pending)} ETH`)

  const hash = await walletClient.writeContract({
    address: registryAddr, abi: FEED_REGISTRY_ABI, functionName: 'withdraw',
    args: [],
  })

  console.log(`\x1b[32m✓\x1b[0m Withdrawn: ${txLink(hash)}\n`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      test: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: true,
  })

  if (values.help || positionals.length === 0) {
    console.log(`
${BOLD}Newsworthy CLI${RESET} — FeedRegistry on World Chain

${BOLD}Usage:${RESET} bun run agent/src/cli.ts [--test] <command> [args...]

${BOLD}Read commands:${RESET}
  status              Registry overview
  items               List all items
  item <id>           Detail view for one item
  register            Check AgentBook registration

${BOLD}Write commands:${RESET} (costs gas)
  submit <url> [meta] Submit item with bond
  challenge <id>      Challenge a pending item
  vote <id> <keep|remove>  Vote on challenged item
  resolve <id>        Resolve a challenge
  accept <id>         Accept unchallenged item
  withdraw            Claim pending ETH

${BOLD}Flags:${RESET}
  --test              Use test contracts (MockAgentBook, 60s periods)
`)
    return
  }

  const isTest = values.test ?? false
  const deployment = await loadDeployment(isTest)
  const rpcUrl = deployment.rpc

  const client = createPublicClient({
    chain: worldchain,
    transport: http(rpcUrl),
  })

  const registryAddr = deployment.contracts.FeedRegistry.address as Address
  const agentBookAddr = deployment.contracts.AgentBook.address as Address
  const deployer = deployment.deployer as Address

  const command = positionals[0]

  try {
    switch (command) {
      case 'status':
        await cmdStatus(deployment, client, registryAddr, agentBookAddr)
        break

      case 'items':
        await cmdItems(client, registryAddr)
        break

      case 'item': {
        const id = positionals[1]
        if (id === undefined) die('Usage: item <id>')
        await cmdItem(client, registryAddr, BigInt(id))
        break
      }

      case 'register':
        await cmdRegister(client, agentBookAddr, deployer)
        break

      case 'submit': {
        const url = positionals[1]
        if (!url) die('Usage: submit <url> [metadataHash]')
        const meta = positionals[2] ?? ''
        await cmdSubmit(client, rpcUrl, registryAddr, url, meta)
        break
      }

      case 'challenge': {
        const id = positionals[1]
        if (id === undefined) die('Usage: challenge <id>')
        await cmdChallenge(client, rpcUrl, registryAddr, BigInt(id))
        break
      }

      case 'vote': {
        const id = positionals[1]
        const direction = positionals[2]
        if (id === undefined || !direction) die('Usage: vote <id> <keep|remove>')
        if (direction !== 'keep' && direction !== 'remove') die('Vote must be "keep" or "remove"')
        await cmdVote(client, rpcUrl, registryAddr, BigInt(id), direction === 'keep')
        break
      }

      case 'resolve': {
        const id = positionals[1]
        if (id === undefined) die('Usage: resolve <id>')
        await cmdResolve(client, rpcUrl, registryAddr, BigInt(id))
        break
      }

      case 'accept': {
        const id = positionals[1]
        if (id === undefined) die('Usage: accept <id>')
        await cmdAccept(client, rpcUrl, registryAddr, BigInt(id))
        break
      }

      case 'withdraw':
        await cmdWithdraw(client, rpcUrl, registryAddr, deployer)
        break

      default:
        die(`Unknown command: ${command}. Run with --help to see available commands.`)
    }
  } catch (err: any) {
    // Viem nests custom error info in err.cause for ContractFunctionRevertedError
    const errorName = err?.cause?.data?.errorName
    if (errorName) {
      die(`Contract reverted: ${errorName}`)
    }
    const reason = err?.shortMessage ?? err?.message ?? String(err)
    die(reason)
  }
}

main()
