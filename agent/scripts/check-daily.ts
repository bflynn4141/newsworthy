import { createPublicClient, http, parseAbi } from 'viem'
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

const deployerKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/deployer.key'), 'utf8').trim()
const migratorKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/migrator.key'), 'utf8').trim()
const deployer = privateKeyToAccount(deployerKey as `0x${string}`)
const migrator = privateKeyToAccount(migratorKey as `0x${string}`)

const abi = parseAbi([
  'function dailySubmissionCount(address, uint256) view returns (uint256)',
  'function maxDailySubmissions() view returns (uint256)',
])

const client = createPublicClient({ chain: worldchain, transport: http(RPC) })

async function main() {
  const maxDaily = await client.readContract({ address: FEED_REGISTRY, abi, functionName: 'maxDailySubmissions' })
  const today = BigInt(Math.floor(Date.now() / 1000 / 86400))
  console.log(`Max daily: ${maxDaily}, Today (day ${today}):`)

  for (const [name, acct] of [['deployer', deployer], ['migrator', migrator]] as const) {
    const count = await client.readContract({
      address: FEED_REGISTRY, abi, functionName: 'dailySubmissionCount',
      args: [acct.address, today]
    })
    console.log(`  ${name}: ${count}/${maxDaily} submissions today`)
  }
}
main()
