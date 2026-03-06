/**
 * Submit tweets from the migrator wallet.
 * Usage: bun run scripts/submit-migrator.ts
 */

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { worldchain } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'

const deployment = JSON.parse(
  fs.readFileSync('../../contracts/deployments/worldchain-test.json', 'utf8')
)

const FEED_REGISTRY = deployment.contracts.FeedRegistry.address as `0x${string}`
const USDC = deployment.contracts.FeedRegistry.bondToken as `0x${string}`
const RPC = deployment.rpc

const key = fs.readFileSync('../../.secrets/migrator.key', 'utf8').trim()
const account = privateKeyToAccount(key as `0x${string}`)

const TWEETS = [
  'https://x.com/LarkDavis/status/2026902829911113910',
  'https://x.com/matthew_sigel/status/2014048312886767913',
  'https://x.com/BullTheoryio/status/2028234448026968115',
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
  const transport = http(RPC)
  const publicClient = createPublicClient({ chain: worldchain, transport })
  const walletClient = createWalletClient({ account, chain: worldchain, transport })

  console.log('Submitter:', account.address)

  const balance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address]
  })
  console.log('USDC balance:', Number(balance) / 1e6)

  const bondAmount = await publicClient.readContract({
    address: FEED_REGISTRY, abi: registryAbi, functionName: 'bondAmount'
  })
  const totalNeeded = bondAmount * BigInt(TWEETS.length)

  if (balance < totalNeeded) {
    console.error(`Insufficient USDC. Have ${Number(balance) / 1e6}, need ${Number(totalNeeded) / 1e6}`)
    process.exit(1)
  }

  const allowance = await publicClient.readContract({
    address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, FEED_REGISTRY]
  })

  if (allowance < totalNeeded) {
    console.log('Approving USDC...')
    const approveTx = await walletClient.writeContract({
      address: USDC, abi: erc20Abi, functionName: 'approve',
      args: [FEED_REGISTRY, totalNeeded]
    })
    await publicClient.waitForTransactionReceipt({ hash: approveTx })
    console.log('Approved!')
  }

  console.log(`\nSubmitting ${TWEETS.length} tweets...\n`)

  for (const url of TWEETS) {
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

  console.log('\nDone!')
}

main().catch(console.error)
