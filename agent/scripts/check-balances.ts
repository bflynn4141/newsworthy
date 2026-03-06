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

const deployerKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/deployer.key'), 'utf8').trim()
const migratorKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/migrator.key'), 'utf8').trim()
const deployer = privateKeyToAccount(deployerKey as `0x${string}`)
const migrator = privateKeyToAccount(migratorKey as `0x${string}`)

const erc20Abi = parseAbi([
  'function balanceOf(address account) view returns (uint256)',
])

const registryAbi = parseAbi([
  'function pendingWithdrawals(address) view returns (uint256)',
  'function withdraw()',
])

const client = createPublicClient({ chain: worldchain, transport: http(RPC) })

async function main() {
  const action = process.argv[2] // 'withdraw' to claim bonds

  for (const [name, acct] of [['deployer', deployer], ['migrator', migrator]] as const) {
    const usdc = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [acct.address] })
    const pending = await client.readContract({ address: FEED_REGISTRY, abi: registryAbi, functionName: 'pendingWithdrawals', args: [acct.address] })
    console.log(`${name} (${acct.address}):`)
    console.log(`  USDC balance: ${Number(usdc) / 1e6}`)
    console.log(`  Claimable bonds: ${Number(pending) / 1e6}`)

    if (action === 'withdraw' && pending > 0n) {
      const walletClient = createWalletClient({ account: acct, chain: worldchain, transport: http(RPC) })
      const tx = await walletClient.writeContract({
        address: FEED_REGISTRY, abi: registryAbi, functionName: 'withdraw'
      })
      await client.waitForTransactionReceipt({ hash: tx })
      const newBalance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [acct.address] })
      console.log(`  ✓ Withdrawn! New balance: ${Number(newBalance) / 1e6}`)
    }
  }
}
main()
