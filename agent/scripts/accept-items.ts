/**
 * Accept all pending items whose challenge period has expired.
 * Anyone can call acceptItem() — it just checks the timer.
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
  'function acceptItem(uint256 itemId)',
  'function items(uint256 itemId) view returns (address submitter, string url, string metadataHash, uint256 bond, uint256 submittedAt, uint8 status)',
  'function challengePeriod() view returns (uint256)',
])

// Status enum: 0=Pending, 1=Challenged, 2=Accepted, 3=Rejected
const STATUS_NAMES = ['Pending', 'Challenged', 'Accepted', 'Rejected']

async function main() {
  const transport = http(RPC)
  const publicClient = createPublicClient({ chain: worldchain, transport })
  const walletClient = createWalletClient({ account, chain: worldchain, transport })

  const challengePeriod = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'challengePeriod'
  })
  console.log(`Challenge period: ${Number(challengePeriod)}s (${Number(challengePeriod) / 60}min)\n`)

  const now = BigInt(Math.floor(Date.now() / 1000))

  // Try items 0-20 (should cover all submitted items)
  const maxId = 20
  let accepted = 0
  let alreadyDone = 0

  for (let i = 0; i <= maxId; i++) {
    try {
      const item = await publicClient.readContract({
        address: FEED_REGISTRY, abi: registryAbi, functionName: 'items', args: [BigInt(i)]
      })

      const [submitter, url, metadataHash, bond, submittedAt, status] = item as [string, string, string, bigint, bigint, number]

      // Skip empty slots (no submitter)
      if (submitter === '0x0000000000000000000000000000000000000000') continue

      const statusName = STATUS_NAMES[status] || 'Unknown'
      const timeLeft = Number((submittedAt + challengePeriod) - now)

      if (status === 0) { // Pending
        if (timeLeft <= 0) {
          // Challenge period expired — accept it
          try {
            const tx = await walletClient.writeContract({
              address: FEED_REGISTRY, abi: registryAbi, functionName: 'acceptItem',
              args: [BigInt(i)]
            })
            await publicClient.waitForTransactionReceipt({ hash: tx })
            console.log(`✓ Accepted item ${i}: ${url} [${metadataHash || 'no category'}]`)
            accepted++
          } catch (err: any) {
            console.log(`✗ Failed to accept item ${i}: ${err.shortMessage || err.message}`)
          }
        } else {
          console.log(`⏳ Item ${i} pending — ${Math.ceil(timeLeft / 60)}min remaining`)
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

  console.log(`\nAccepted: ${accepted}, Already done: ${alreadyDone}`)
}

main().catch(console.error)
