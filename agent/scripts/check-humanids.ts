import { createPublicClient, http, parseAbi } from 'viem'
import { worldchain } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import * as fs from 'fs'
import * as path from 'path'

const __dir = path.dirname(new URL(import.meta.url).pathname)
const deployment = JSON.parse(
  fs.readFileSync(path.resolve(__dir, '../../contracts/deployments/worldchain-test.json'), 'utf8')
)
const AGENT_BOOK = deployment.contracts.AgentBook.address as `0x${string}`
const FEED_REGISTRY = deployment.contracts.FeedRegistry.address as `0x${string}`
const RPC = deployment.rpc

const deployerKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/deployer.key'), 'utf8').trim()
const migratorKey = fs.readFileSync(path.resolve(__dir, '../../.secrets/migrator.key'), 'utf8').trim()
const deployer = privateKeyToAccount(deployerKey as `0x${string}`)
const migrator = privateKeyToAccount(migratorKey as `0x${string}`)

const bookAbi = parseAbi([
  'function humanIds(address) view returns (uint256)',
  'function lookupHuman(address) view returns (uint256)',
])

const registryAbi = parseAbi([
  'function dailySubmissions(uint256 humanId, uint256 day) view returns (uint256)',
  'function maxDailySubmissions() view returns (uint256)',
])

const client = createPublicClient({ chain: worldchain, transport: http(RPC) })

async function main() {
  const maxDaily = await client.readContract({ address: FEED_REGISTRY, abi: registryAbi, functionName: 'maxDailySubmissions' })
  const today = BigInt(Math.floor(Date.now() / 1000 / 86400))

  for (const [name, acct] of [['deployer', deployer], ['migrator', migrator]] as const) {
    const humanId = await client.readContract({ address: AGENT_BOOK, abi: bookAbi, functionName: 'humanIds', args: [acct.address] })
    const dailyCount = await client.readContract({ address: FEED_REGISTRY, abi: registryAbi, functionName: 'dailySubmissions', args: [humanId, today] })
    console.log(`${name} (${acct.address}): humanId=${humanId}, daily=${dailyCount}/${maxDaily}`)
  }
}
main()
