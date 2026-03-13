/**
 * Resolve all voting items whose voting period has expired.
 * Anyone can call resolve() — it just checks the timer.
 *
 * Usage: bun run scripts/accept-items.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { worldchain } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'
import * as path from 'path'

const __dir = path.dirname(new URL(import.meta.url).pathname)
const deployment = JSON.parse(
  fs.readFileSync(path.resolve(__dir, '../../contracts/deployments/worldchain-test.json'), 'utf8')
)

const FEED_REGISTRY = deployment.contracts.FeedRegistry.address as `0x${string}`
const RPC = deployment.rpc

const key = fs.readFileSync(path.resolve(__dir, '../../.secrets/deployer.key'), 'utf8').trim()
const account = privateKeyToAccount(key as `0x${string}`)

const registryAbi = parseAbi([
  'function resolve(uint256 itemId)',
  'function items(uint256 itemId) view returns (address submitter, uint256 submitterHumanId, string url, string metadataHash, uint256 bond, uint256 voteCostSnapshot, uint256 submittedAt, uint8 status)',
  'function votingPeriod() view returns (uint256)',
])

// Status enum: 0=Voting, 1=Accepted, 2=Rejected
const STATUS_NAMES = ['Voting', 'Accepted', 'Rejected']

async function main() {
  const transport = http(RPC)
  const publicClient = createPublicClient({ chain: worldchain, transport })
  const walletClient = createWalletClient({ account, chain: worldchain, transport })

  const votingPeriod = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'votingPeriod'
  })
  console.log(`Voting period: ${Number(votingPeriod)}s (${Number(votingPeriod) / 60}min)\n`)

  const now = BigInt(Math.floor(Date.now() / 1000))

  // Try items 0-20 (should cover all submitted items)
  const maxId = 20
  let resolved = 0
  let alreadyDone = 0

  for (let i = 0; i <= maxId; i++) {
    try {
      const item = await publicClient.readContract({
        address: FEED_REGISTRY, abi: registryAbi, functionName: 'items', args: [BigInt(i)]
      })

      const [submitter, , url, metadataHash, , , submittedAt, status] = item as [string, bigint, string, string, bigint, bigint, bigint, number]

      // Skip empty slots (no submitter)
      if (submitter === '0x0000000000000000000000000000000000000000') continue

      const statusName = STATUS_NAMES[status] || 'Unknown'
      const timeLeft = Number((submittedAt + votingPeriod) - now)

      if (status === 0) { // Voting
        if (timeLeft <= 0) {
          // Voting period expired — resolve it
          try {
            const tx = await walletClient.writeContract({
              address: FEED_REGISTRY, abi: registryAbi, functionName: 'resolve',
              args: [BigInt(i)]
            })
            await publicClient.waitForTransactionReceipt({ hash: tx })
            console.log(`✓ Resolved item ${i}: ${url} [${metadataHash || 'no category'}]`)
            resolved++
          } catch (err: any) {
            console.log(`✗ Failed to resolve item ${i}: ${err.shortMessage || err.message}`)
          }
        } else {
          console.log(`⏳ Item ${i} voting — ${Math.ceil(timeLeft / 60)}min remaining`)
        }
      } else {
        console.log(`- Item ${i}: ${statusName}`)
        alreadyDone++
      }
    } catch {
      // Item doesn't exist, stop scanning
      break
    }
  }

  console.log(`\nResolved: ${resolved}, Already done: ${alreadyDone}`)
}

main().catch(console.error)
