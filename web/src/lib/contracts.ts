import { createPublicClient, http, defineChain } from "viem";

// World Chain (not built into viem yet)
export const worldchain = defineChain({
  id: 480,
  name: "World Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://worldchain-mainnet.g.alchemy.com/v2/tRRCeUyvs7jVWGa5wX85x"],
    },
  },
  blockExplorers: {
    default: { name: "Worldscan", url: "https://worldscan.org" },
  },
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },
});

export const REGISTRY_ADDRESS = "0xb2d538D2BD69a657A5240c446F0565a7F5d52BBF" as const;
// MockAgentBook — matches what the V2 contract is currently pointing at.
// Switch to real AgentBook (0xd4c3680c8cd5Ef45F5AbA9402e32D0561A1401cc) when
// World Foundation ships official AgentBook on World Chain.
export const AGENTBOOK_ADDRESS = "0x1622a3c08bD330B5802B21013871Df17ddAD3b04" as const;
export const USDC_ADDRESS = "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" as const;

// Block when FeedRegistryV2 was deployed — avoids scanning from genesis
export const REGISTRY_DEPLOY_BLOCK = BigInt(27052617);

// 0.05 USDC (6 decimals) = 50000
export const VOTE_COST = BigInt(50000);

// Minimal ABI — only functions the app needs (V2)
export const registryAbi = [
  {
    type: "function",
    name: "items",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "submitter", type: "address" },
      { name: "submitterHumanId", type: "uint256" },
      { name: "url", type: "string" },
      { name: "metadataHash", type: "string" },
      { name: "bond", type: "uint256" },
      { name: "voteCostSnapshot", type: "uint256" },
      { name: "submittedAt", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getVoteSession",
    inputs: [{ name: "itemId", type: "uint256" }],
    outputs: [
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
      { name: "keepClaimPerVoter", type: "uint256" },
      { name: "removeClaimPerVoter", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextItemId",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "votingPeriod",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bondAmount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "voteCost",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pendingWithdrawals",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "VoteCast",
    inputs: [
      { name: "itemId", type: "uint256", indexed: true },
      { name: "humanId", type: "uint256", indexed: true },
      { name: "support", type: "bool", indexed: false },
    ],
  },
  {
    type: "function",
    name: "hasVotedByHuman",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "nullifierHash", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Separate non-const ABI for MiniKit (its types may conflict with viem's strict inference)
export const voteAbi = [
  {
    type: "function",
    name: "vote",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "support", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

// Standard ERC20 approve ABI for USDC approval before voting
export const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
];

// AgentBook: maps wallet address → World ID human identifier
export const agentBookAbi = [
  {
    type: "function",
    name: "lookupHuman",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

let _client: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_client) {
    _client = createPublicClient({
      chain: worldchain,
      transport: http(),
    });
  }
  return _client;
}
