// Main curation pipeline
//
// Lifecycle of a news item:
//   1. Agent discovers URLs          (sources.ts)
//   2. Agent evaluates each URL      (evaluate.ts)
//   3. Worthy items → submitItem()   (this file)
//   4. Other agents can challenge    → challengeItem()
//   5. Registered agents vote        → voteOnChallenge()
//   6. After voting period           → resolveChallenge() or resolveNoQuorum()
//   7. Unchallenged items auto-pass  → acceptItem()
//   8. Winners withdraw rewards      → withdraw()
//
// All functions require the caller to be registered in AgentBook (enforced on-chain).

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type Account,
} from 'viem'
import { worldchain } from 'viem/chains'

// ── FeedRegistry ABI ─────────────────────────────────────────────────────────
// Matches the spec in task #1 — submitItem, challengeItem, voteOnChallenge,
// resolveChallenge, resolveNoQuorum, acceptItem, withdraw, plus events.

export const FEED_REGISTRY_ABI = [
  // ── Errors ───────────────────────────────────────────────────────────────
  { type: 'error', name: 'NotRegistered', inputs: [] },
  { type: 'error', name: 'DuplicateUrl', inputs: [] },
  { type: 'error', name: 'InvalidItemStatus', inputs: [] },
  { type: 'error', name: 'InsufficientBond', inputs: [] },
  { type: 'error', name: 'SelfChallenge', inputs: [] },
  { type: 'error', name: 'AlreadyVoted', inputs: [] },
  { type: 'error', name: 'ChallengePeriodActive', inputs: [] },
  { type: 'error', name: 'ChallengePeriodExpired', inputs: [] },
  { type: 'error', name: 'VotingPeriodActive', inputs: [] },
  { type: 'error', name: 'VotingPeriodExpired', inputs: [] },
  { type: 'error', name: 'QuorumNotMet', inputs: [] },
  { type: 'error', name: 'QuorumMet', inputs: [] },
  { type: 'error', name: 'NothingToWithdraw', inputs: [] },

  // ── Write functions ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'submitItem',
    inputs: [
      { name: 'url', type: 'string' },
      { name: 'metadataHash', type: 'string' },
    ],
    outputs: [{ name: 'itemId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'challengeItem',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'voteOnChallenge',
    inputs: [
      { name: 'itemId', type: 'uint256' },
      { name: 'support', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveChallenge',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'resolveNoQuorum',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'acceptItem',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // ── Read functions ─────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'bondAmount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'items',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [
      { name: 'submitter', type: 'address' },
      { name: 'url', type: 'string' },
      { name: 'metadataHash', type: 'string' },
      { name: 'bond', type: 'uint256' },
      { name: 'submittedAt', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nextItemId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pendingWithdrawals',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'challengePeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'votingPeriod',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'minVotes',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'challenges',
    inputs: [{ name: 'itemId', type: 'uint256' }],
    outputs: [
      { name: 'challenger', type: 'address' },
      { name: 'bond', type: 'uint256' },
      { name: 'challengedAt', type: 'uint256' },
      { name: 'votesFor', type: 'uint256' },
      { name: 'votesAgainst', type: 'uint256' },
    ],
    stateMutability: 'view',
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'ItemSubmitted',
    inputs: [
      { name: 'itemId', type: 'uint256', indexed: true },
      { name: 'submitter', type: 'address', indexed: true },
      { name: 'url', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ItemChallenged',
    inputs: [
      { name: 'itemId', type: 'uint256', indexed: true },
      { name: 'challenger', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'itemId', type: 'uint256', indexed: true },
      { name: 'humanId', type: 'uint256', indexed: true },
      { name: 'support', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ItemResolved',
    inputs: [
      { name: 'itemId', type: 'uint256', indexed: true },
      { name: 'status', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ItemAccepted',
    inputs: [
      { name: 'itemId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawal',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// ── Clients ──────────────────────────────────────────────────────────────────

const publicClient = createPublicClient({
  chain: worldchain,
  transport: http(),
})

// ── Submit ───────────────────────────────────────────────────────────────────

export async function submitItem(
  registryAddress: Address,
  url: string,
  metadataHash: string,
  bondAmount: bigint,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'submitItem',
    args: [url, metadataHash],
    value: bondAmount,
  })
}

// ── Challenge ────────────────────────────────────────────────────────────────

export async function challengeItem(
  registryAddress: Address,
  itemId: bigint,
  bondAmount: bigint,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'challengeItem',
    args: [itemId],
    value: bondAmount,
  })
}

// ── Vote ─────────────────────────────────────────────────────────────────────

export async function voteOnChallenge(
  registryAddress: Address,
  itemId: bigint,
  support: boolean,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'voteOnChallenge',
    args: [itemId, support],
  })
}

// ── Resolve ──────────────────────────────────────────────────────────────────

export async function resolveChallenge(
  registryAddress: Address,
  itemId: bigint,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'resolveChallenge',
    args: [itemId],
  })
}

export async function resolveNoQuorum(
  registryAddress: Address,
  itemId: bigint,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'resolveNoQuorum',
    args: [itemId],
  })
}

export async function acceptItem(
  registryAddress: Address,
  itemId: bigint,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'acceptItem',
    args: [itemId],
  })
}

// ── Withdraw ─────────────────────────────────────────────────────────────────

export async function claimRewards(
  registryAddress: Address,
  account: Account,
): Promise<Hash> {
  const walletClient = createWalletClient({
    chain: worldchain,
    transport: http(),
    account,
  })

  return walletClient.writeContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'withdraw',
    args: [],
  })
}

// ── Read helpers ─────────────────────────────────────────────────────────────

export async function getBondAmount(registryAddress: Address): Promise<bigint> {
  return publicClient.readContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'bondAmount',
  })
}

export async function getPendingWithdrawals(
  registryAddress: Address,
  account: Address,
): Promise<bigint> {
  return publicClient.readContract({
    address: registryAddress,
    abi: FEED_REGISTRY_ABI,
    functionName: 'pendingWithdrawals',
    args: [account],
  })
}
