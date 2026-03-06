import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem'
import { worldchain } from 'viem/chains'
import type { Env } from '../types'
import { parseUrl, summarizeWithAI } from '../parser/parse'

// FeedRegistry event signatures
const EVENTS = {
  ItemSubmitted: parseAbiItem(
    'event ItemSubmitted(uint256 indexed itemId, address indexed submitter, string url)'
  ),
  ItemChallenged: parseAbiItem(
    'event ItemChallenged(uint256 indexed itemId, address indexed challenger)'
  ),
  VoteCast: parseAbiItem(
    'event VoteCast(uint256 indexed itemId, address indexed voter, bool support)'
  ),
  ItemResolved: parseAbiItem(
    'event ItemResolved(uint256 indexed itemId, uint8 status)'
  ),
  ItemAccepted: parseAbiItem(
    'event ItemAccepted(uint256 indexed itemId)'
  ),
} as const

// Status mapping: matches the Solidity enum ItemStatus
const STATUS_MAP: Record<number, string> = {
  0: 'pending',
  1: 'challenged',
  2: 'accepted',
  3: 'rejected',
}

/**
 * Sync contract events from FeedRegistry into D1.
 *
 * Polls getLogs from `fromBlock` to latest. In production you'd persist
 * the last-synced block in KV to avoid re-processing.
 */
export async function syncEvents(
  db: D1Database,
  rpcUrl: string,
  registryAddress: string,
  fromBlock: bigint = 0n,
  ai?: Ai,
): Promise<{ syncedToBlock: bigint; eventsProcessed: number }> {
  const client = createPublicClient({
    chain: worldchain,
    transport: http(rpcUrl),
  }) as PublicClient

  const latestBlock = await client.getBlockNumber()
  if (fromBlock > latestBlock) {
    return { syncedToBlock: latestBlock, eventsProcessed: 0 }
  }

  const contractAddress = registryAddress as `0x${string}`
  let eventsProcessed = 0

  // ABI for reading item metadata (category)
  const itemsAbi = [{
    type: 'function' as const,
    name: 'items',
    inputs: [{ name: 'itemId', type: 'uint256' as const }],
    outputs: [
      { name: 'submitter', type: 'address' as const },
      { name: 'url', type: 'string' as const },
      { name: 'metadataHash', type: 'string' as const },
      { name: 'bond', type: 'uint256' as const },
      { name: 'submittedAt', type: 'uint256' as const },
      { name: 'status', type: 'uint8' as const },
    ],
    stateMutability: 'view' as const,
  }]

  // Fetch all event types in parallel
  const [submittedLogs, challengedLogs, voteLogs, resolvedLogs, acceptedLogs] = await Promise.all([
    client.getLogs({
      address: contractAddress,
      event: EVENTS.ItemSubmitted,
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      address: contractAddress,
      event: EVENTS.ItemChallenged,
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      address: contractAddress,
      event: EVENTS.VoteCast,
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      address: contractAddress,
      event: EVENTS.ItemResolved,
      fromBlock,
      toBlock: latestBlock,
    }),
    client.getLogs({
      address: contractAddress,
      event: EVENTS.ItemAccepted,
      fromBlock,
      toBlock: latestBlock,
    }),
  ])

  // Process ItemSubmitted — insert new articles + upsert agent scores
  for (const log of submittedLogs) {
    const { itemId, submitter, url } = log.args as {
      itemId: bigint
      submitter: string
      url: string
    }

    // Parse the URL for metadata
    let parsed = { title: null as string | null, description: null as string | null, image_url: null as string | null, content_summary: null as string | null }
    try {
      parsed = await parseUrl(url)
    } catch {
      // URL parsing is best-effort
    }

    // Summarize with AI if we have raw text
    if (ai && parsed.content_summary) {
      try {
        const aiSummary = await summarizeWithAI(ai, parsed.content_summary)
        if (aiSummary) parsed.content_summary = aiSummary
      } catch {
        // Fall back to raw oEmbed text
      }
    }

    // Read metadataHash from contract (used as category)
    let category = 'crypto' // default
    try {
      const itemData = await client.readContract({
        address: contractAddress,
        abi: itemsAbi,
        functionName: 'items',
        args: [itemId],
      }) as [string, string, string, bigint, bigint, number]
      const metadataHash = itemData[2]
      if (metadataHash === 'ai' || metadataHash === 'crypto') {
        category = metadataHash
      }
    } catch {
      // Fall back to default category
    }

    const now = Date.now()
    await db
      .prepare(
        `INSERT OR IGNORE INTO articles (id, url, title, description, image_url, content_summary, submitter, submitted_at, status, category, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
      )
      .bind(
        Number(itemId),
        url,
        parsed.title,
        parsed.description,
        parsed.image_url,
        parsed.content_summary,
        submitter.toLowerCase(),
        now,
        category,
        now
      )
      .run()

    // Upsert agent submission count
    await upsertAgentScore(db, submitter.toLowerCase(), { submissions: 1 })
    eventsProcessed++
  }

  // Process ItemChallenged — update article status + upsert agent scores
  for (const log of challengedLogs) {
    const { itemId, challenger } = log.args as {
      itemId: bigint
      challenger: string
    }

    await db
      .prepare(`UPDATE articles SET status = 'challenged' WHERE id = ?`)
      .bind(Number(itemId))
      .run()

    await upsertAgentScore(db, challenger.toLowerCase(), { challenges: 1 })
    eventsProcessed++
  }

  // Process VoteCast — update vote counts
  for (const log of voteLogs) {
    const { itemId, voter, support } = log.args as {
      itemId: bigint
      voter: string
      support: boolean
    }

    if (support) {
      await db
        .prepare(`UPDATE articles SET challenge_votes_for = challenge_votes_for + 1 WHERE id = ?`)
        .bind(Number(itemId))
        .run()
    } else {
      await db
        .prepare(`UPDATE articles SET challenge_votes_against = challenge_votes_against + 1 WHERE id = ?`)
        .bind(Number(itemId))
        .run()
    }

    await upsertAgentScore(db, voter.toLowerCase(), { votes: 1 })
    eventsProcessed++
  }

  // Process ItemResolved — update status + resolved_at, update agent scores
  for (const log of resolvedLogs) {
    const { itemId, status } = log.args as {
      itemId: bigint
      status: number
    }

    const statusStr = STATUS_MAP[status] ?? 'pending'
    const now = Date.now()

    await db
      .prepare(`UPDATE articles SET status = ?, resolved_at = ? WHERE id = ?`)
      .bind(statusStr, now, Number(itemId))
      .run()

    // Update reputation for submitter/challenger based on outcome
    const article = await db
      .prepare('SELECT submitter FROM articles WHERE id = ?')
      .bind(Number(itemId))
      .first<{ submitter: string }>()

    if (article) {
      if (statusStr === 'accepted') {
        await upsertAgentScore(db, article.submitter, { successful_submissions: 1 })
      } else if (statusStr === 'rejected') {
        // Submitter lost — no positive score update
        // Challenger won — would need to query challenge event to find challenger
      }
    }

    eventsProcessed++
  }

  // Process ItemAccepted — unchallenged items accepted after challenge period
  for (const log of acceptedLogs) {
    const { itemId } = log.args as { itemId: bigint }

    const now = Date.now()
    await db
      .prepare(`UPDATE articles SET status = 'accepted', resolved_at = ? WHERE id = ? AND status = 'pending'`)
      .bind(now, Number(itemId))
      .run()

    // Update submitter's successful_submissions
    const article = await db
      .prepare('SELECT submitter FROM articles WHERE id = ?')
      .bind(Number(itemId))
      .first<{ submitter: string }>()

    if (article) {
      await upsertAgentScore(db, article.submitter, { successful_submissions: 1 })
    }

    eventsProcessed++
  }

  // Recompute reputation scores for all agents
  await db
    .prepare(
      `UPDATE agent_scores SET reputation_score =
        (successful_submissions * 3) + (successful_challenges * 2) + votes
        - ((submissions - successful_submissions) * 2)
        - ((challenges - successful_challenges) * 2)`
    )
    .run()

  return { syncedToBlock: latestBlock, eventsProcessed }
}

/**
 * Upsert an agent's score counters. Creates the row if it doesn't exist,
 * otherwise increments the specified fields.
 */
async function upsertAgentScore(
  db: D1Database,
  address: string,
  increments: {
    submissions?: number
    successful_submissions?: number
    challenges?: number
    successful_challenges?: number
    votes?: number
  }
): Promise<void> {
  const s = increments.submissions ?? 0
  const ss = increments.successful_submissions ?? 0
  const ch = increments.challenges ?? 0
  const sc = increments.successful_challenges ?? 0
  const v = increments.votes ?? 0

  await db
    .prepare(
      `INSERT INTO agent_scores (address, submissions, successful_submissions, challenges, successful_challenges, votes, reputation_score)
       VALUES (?, ?, ?, ?, ?, ?, 0.0)
       ON CONFLICT (address) DO UPDATE SET
         submissions = submissions + ?,
         successful_submissions = successful_submissions + ?,
         challenges = challenges + ?,
         successful_challenges = successful_challenges + ?,
         votes = votes + ?`
    )
    .bind(address, s, ss, ch, sc, v, s, ss, ch, sc, v)
    .run()
}
