/**
 * Submit real tweets to the v5 FeedRegistry on World Chain.
 * Uses the deployer key to submit items.
 *
 * Usage: bun run scripts/submit-tweets.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { worldchain } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'

// Load deployment config
const deployment = JSON.parse(
  fs.readFileSync('../../contracts/deployments/worldchain-test.json', 'utf8')
)

const FEED_REGISTRY = deployment.contracts.FeedRegistry.address as `0x${string}`
const USDC = deployment.contracts.FeedRegistry.bondToken as `0x${string}`
const RPC = deployment.rpc

// Deployer key
const key = fs.readFileSync('../../.secrets/deployer.key', 'utf8').trim()
const account = privateKeyToAccount(key as `0x${string}`)

const TWEETS = [
  'https://x.com/VitalikButerin/status/2006737662942871574',
  'https://x.com/VitalikButerin/status/2007559523528233041',
  'https://x.com/WuBlockchain/status/2027932920405758356',
  'https://x.com/LarkDavis/status/2026902829911113910',
  'https://x.com/matthew_sigel/status/2014048312886767913',
  'https://x.com/BullTheoryio/status/2028234448026968115',
  'https://x.com/CryptoTimes_io/status/2028361306986979636',
  'https://x.com/anndylian/status/2025822931021136297',
]

const erc20Abi = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])

const registryAbi = parseAbi([
  'function submitItem(string url, string metadataHash)',
  'function bondAmount() view returns (uint256)',
  'function maxDailySubmissions() view returns (uint256)',
  'function itemCount() view returns (uint256)',
])

async function main() {
  const transport = http(RPC)
  const publicClient = createPublicClient({ chain: worldchain, transport })
  const walletClient = createWalletClient({ account, chain: worldchain, transport })

  console.log('Submitter:', account.address)

  // Check USDC balance
  const balance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address]
  })
  console.log('USDC balance:', Number(balance) / 1e6)

  // Check bond amount
  const bondAmount = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'bondAmount'
  })
  console.log('Bond per item:', Number(bondAmount) / 1e6, 'USDC')

  const totalNeeded = bondAmount * BigInt(TWEETS.length)
  console.log('Total USDC needed:', Number(totalNeeded) / 1e6)

  if (balance < totalNeeded) {
    console.error(`Insufficient USDC. Have ${Number(balance) / 1e6}, need ${Number(totalNeeded) / 1e6}`)
    process.exit(1)
  }

  // Check/set USDC approval
  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, FEED_REGISTRY]
  })

  if (allowance < totalNeeded) {
    console.log('Approving USDC...')
    const approveTx = await walletClient.writeContract({
      address: USDC, abi: erc20Abi, functionName: 'approve',
      args: [FEED_REGISTRY, totalNeeded]
    })
    console.log('Approve tx:', approveTx)
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('Approved!')
  }

  // Check daily limit
  const maxDaily = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'maxDailySubmissions'
  })
  console.log('Max daily submissions:', Number(maxDaily))

  // Submit tweets (up to daily limit)
  const toSubmit = TWEETS.slice(0, Number(maxDaily))
  console.log(`\nSubmitting ${toSubmit.length} tweets (daily limit: ${maxDaily})...\n`)

  for (const url of toSubmit) {
    try {
      const tx = await walletClient.writeContract({
        address: FEED_REGISTRY, abi: registryAbi, functionName: 'submitItem',
        args: [url, '']
      })
      console.log(`✓ ${url}`)
      console.log(`  tx: ${tx}`)
      await publicClient.waitForTransactionReceipt({ hash: tx })
    } catch (err: any) {
      console.log(`✗ ${url}`)
      console.log(`  error: ${err.shortMessage || err.message}`)
    }
  }

  const itemCount = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'itemCount'
  })
  console.log(`\nTotal items in registry: ${itemCount}`)
}

main().catch(console.error)
