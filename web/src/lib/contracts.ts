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

export const REGISTRY_ADDRESS = "0xF6bfE9084a8d615637A3Be609d737F94faC277ca" as const;
export const AGENTBOOK_ADDRESS = "0x04436Df79E8A4604AF12abe21f275143e6bF47f2" as const;

// Block when FeedRegistry was deployed — avoids scanning from genesis
export const REGISTRY_DEPLOY_BLOCK = BigInt(26707740);

// Minimal ABI — only functions the app needs
export const registryAbi = [
  {
    type: "function",
    name: "items",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "submitter", type: "address" },
      { name: "url", type: "string" },
      { name: "metadataHash", type: "bytes32" },
      { name: "bond", type: "uint256" },
      { name: "submittedAt", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "challenges",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "challenger", type: "address" },
      { name: "bond", type: "uint256" },
      { name: "challengedAt", type: "uint256" },
      { name: "votesFor", type: "uint256" },
      { name: "votesAgainst", type: "uint256" },
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
    name: "challengePeriod",
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
    name: "voteOnChallenge",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "keep", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

// Separate non-const ABI for MiniKit (its types may conflict with viem's strict inference)
export const voteAbi = [
  {
    type: "function",
    name: "voteOnChallenge",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "keep", type: "bool" },
    ],
    outputs: [],
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
