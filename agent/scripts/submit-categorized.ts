/**
 * Submit tweets with category (ai/crypto) as metadataHash.
 * Supports multiple wallet keys for daily limit workaround.
 *
 * Usage:
 *   bun run scripts/submit-categorized.ts deployer   # submit first 3
 *   bun run scripts/submit-categorized.ts migrator    # submit next 3
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
const USDC = deployment.contracts.FeedRegistry.bondToken as `0x${string}`
const RPC = deployment.rpc

// 9 tweets: 5 crypto, 4 AI
const TWEETS: { url: string; category: 'ai' | 'crypto' }[] = [
  // Crypto batch 1 (deployer)
  { url: 'https://x.com/IBIT_Global/status/2006660677688291479', category: 'crypto' },
  { url: 'https://x.com/uxuycom/status/2026870379659055331', category: 'crypto' },
  { url: 'https://x.com/cryptowalax/status/2022143722742272169', category: 'crypto' },

  // AI batch 2 (migrator)
  { url: 'https://x.com/PalantirOg/status/2024824231221953012', category: 'ai' },
  { url: 'https://x.com/FortuneMagazine/status/2024989968544788718', category: 'ai' },
  { url: 'https://x.com/WIONews/status/2024342693477031972', category: 'ai' },

  // Mixed batch 3 (tomorrow)
  { url: 'https://x.com/CryptoNewsHntrs/status/2003344832484507803', category: 'crypto' },
  { url: 'https://x.com/BCBC_stock/status/2029541906192175387', category: 'crypto' },
  { url: 'https://x.com/alliekmiller/status/1996289363316003243', category: 'ai' },
]

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])

const registryAbi = parseAbi([
  'function submitItem(string url, string metadataHash)',
  'function bondAmount() view returns (uint256)',
])

async function main() {
  const wallet = process.argv[2] || 'deployer'

  let keyFile: string
  let batchStart: number
  if (wallet === 'migrator') {
    keyFile = 'migrator.key'
    batchStart = 3
  } else if (wallet === 'tomorrow') {
    keyFile = 'deployer.key'
    batchStart = 6
  } else {
    keyFile = 'deployer.key'
    batchStart = 0
  }
  const keyPath = path.resolve(__dir, '../../.secrets', keyFile)

  const key = fs.readFileSync(keyPath, 'utf8').trim()
  const account = privateKeyToAccount(key as `0x${string}`)

  const batch = TWEETS.slice(batchStart, batchStart + 3)
  console.log(`Wallet: ${wallet} (${account.address})`)
  console.log(`Batch: items ${batchStart}-${batchStart + batch.length - 1}\n`)

  const transport = http(RPC)
  const publicClient = createPublicClient({ chain: worldchain, transport })
  const walletClient = createWalletClient({ account, chain: worldchain, transport })

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address]
  })
  const bondAmount = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'bondAmount'
  })
  const totalNeeded = bondAmount * BigInt(batch.length)

  console.log(`USDC balance: ${Number(balance) / 1e6}`)
  console.log(`Bond per item: ${Number(bondAmount) / 1e6} USDC`)
  console.log(`Total needed: ${Number(totalNeeded) / 1e6} USDC\n`)

  if (balance < totalNeeded) {
    console.error(`Insufficient USDC. Have ${Number(balance) / 1e6}, need ${Number(totalNeeded) / 1e6}`)
    process.exit(1)
  }

  // Approve if needed
  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, FEED_REGISTRY]
  })
  if (allowance < totalNeeded) {
    console.log('Approving USDC...')
    const approveTx = await walletClient.writeContract({
      address: USDC, abi: erc20Abi, functionName: 'approve',
      args: [FEED_REGISTRY, totalNeeded * 10n] // approve extra for future
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('Approved!\n')
  }

  // Submit each tweet with its category as metadataHash
  for (const { url, category } of batch) {
    try {
      const tx = await walletClient.writeContract({
        address: FEED_REGISTRY, abi: registryAbi, functionName: 'submitItem',
        args: [url, category]
      })
      console.log(`✓ [${category}] ${url}`)
      console.log(`  tx: ${tx}`)
      await publicClient.waitForTransactionReceipt({ hash: tx })
    } catch (err: any) {
      console.log(`✗ [${category}] ${url}`)
      console.log(`  error: ${err.shortMessage || err.message}`)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
