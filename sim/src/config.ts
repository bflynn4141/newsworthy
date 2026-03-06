export interface SimConfig {
  // Registry parameters (from FeedRegistry.sol)
  bondAmount: number;         // USDC per submission/challenge
  challengePeriod: number;    // ticks before auto-accept
  votingPeriod: number;       // ticks for voting after challenge
  minVotes: number;           // quorum threshold
  newsPerItem: number;        // NEWS minted per accepted item
  maxDailySubmissions: number;
  voterShareBps: number;      // 3000 = 30%

  // Revenue model
  baseQueriesPerTick: number; // baseline x402 queries per tick
  revenuePerQuery: number;    // USDC per query

  // AMM seed
  ammSeedUSDC: number;
  ammSeedNEWS: number;

  // Simulation
  totalTicks: number;         // 168 = 1 week at 1 tick/hour
  seed: number;
  ticksPerDay: number;

  // Content quality distribution
  qualityLowPct: number;     // 30%
  qualityMidPct: number;     // 40%
  qualityHighPct: number;    // 30%

  // Agent population
  agentCounts: {
    honestCurator: number;
    profitMaximizer: number;
    colludingRing: number;
    spamBot: number;
    passiveStaker: number;
  };

  // Starting balances
  startingUSDC: number;
  startingNEWS: number;

  // === Mechanism fixes (v2) ===

  // Fix 1: NEWS vesting — minted NEWS locked for N ticks before liquid
  vestingPeriod: number;      // 0 = disabled (current behavior)

  // Fix 2: Stake-weighted voting — votes weighted by staked NEWS
  stakeWeightedVoting: boolean;

  // Fix 3: Slash on rejection — submitter loses % of staked NEWS when item rejected
  slashOnRejectPct: number;   // 0 = disabled, 0.1 = 10% slash

  // Fix 4: Quality revenue bonus — submitters of high-rated items get extra revenue share
  qualityBonusEnabled: boolean;
  qualityBonusPct: number;    // fraction of tick revenue reserved for quality bonus pool

  // Fix 5: No quorum = reject (not accept) — challenged items must earn legitimacy
  noQuorumRejects: boolean;
}

export const DEFAULT_CONFIG: SimConfig = {
  bondAmount: 1.0,
  challengePeriod: 1,
  votingPeriod: 1,
  minVotes: 1,
  newsPerItem: 100,
  maxDailySubmissions: 3,
  voterShareBps: 3000,

  baseQueriesPerTick: 100,
  revenuePerQuery: 0.01,

  ammSeedUSDC: 1000,
  ammSeedNEWS: 100_000,

  totalTicks: 168,
  seed: 42,
  ticksPerDay: 24,

  qualityLowPct: 0.30,
  qualityMidPct: 0.40,
  qualityHighPct: 0.30,

  agentCounts: {
    honestCurator: 4,
    profitMaximizer: 2,
    colludingRing: 3,
    spamBot: 2,
    passiveStaker: 2,
  },

  startingUSDC: 10,
  startingNEWS: 0,

  // v2 mechanisms — all disabled by default (baseline)
  vestingPeriod: 0,
  stakeWeightedVoting: false,
  slashOnRejectPct: 0,
  qualityBonusEnabled: false,
  qualityBonusPct: 0.2,
  noQuorumRejects: false,
};
