import { SeededRNG } from "./rng.js";
import { DEFAULT_CONFIG, type SimConfig } from "./config.js";
import { World } from "./engine/world.js";
import { ContentGenerator } from "./content/generator.js";
import { type Agent } from "./agents/base.js";
import { HonestCurator } from "./agents/honest-curator.js";
import { ProfitMaximizer } from "./agents/profit-maximizer.js";
import { ColludingRingMember } from "./agents/colluding-ring.js";
import { SpamBot } from "./agents/spam-bot.js";
import { PassiveStaker } from "./agents/passive-staker.js";
import { printReport } from "./output/report.js";

function parseArgs(argv: string[]): {
  config: SimConfig;
  sweep?: { param: string; values: number[] };
  disabledAgents: Set<string>;
} {
  const config = { ...DEFAULT_CONFIG, agentCounts: { ...DEFAULT_CONFIG.agentCounts } };
  let sweep: { param: string; values: number[] } | undefined;
  const disabledAgents = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--seed":
        config.seed = parseInt(argv[++i], 10);
        break;
      case "--bond":
        config.bondAmount = parseFloat(argv[++i]);
        break;
      case "--ticks":
        config.totalTicks = parseInt(argv[++i], 10);
        break;
      case "--min-votes":
        config.minVotes = parseInt(argv[++i], 10);
        break;
      case "--challenge-period":
        config.challengePeriod = parseInt(argv[++i], 10);
        break;
      case "--voting-period":
        config.votingPeriod = parseInt(argv[++i], 10);
        break;
      case "--no-spam":
        disabledAgents.add("spam_bot");
        break;
      case "--no-collusion":
        disabledAgents.add("colluding_ring");
        break;
      case "--honest-only":
        disabledAgents.add("spam_bot");
        disabledAgents.add("colluding_ring");
        disabledAgents.add("profit_maximizer");
        disabledAgents.add("passive_staker");
        break;
      case "--agents": {
        // Format: --agents honest,profit,ring,spam,staker e.g. --agents 30,5,3,5,7
        const counts = argv[++i].split(",").map(Number);
        config.agentCounts.honestCurator = counts[0] ?? 4;
        config.agentCounts.profitMaximizer = counts[1] ?? 2;
        config.agentCounts.colludingRing = counts[2] ?? 3;
        config.agentCounts.spamBot = counts[3] ?? 2;
        config.agentCounts.passiveStaker = counts[4] ?? 2;
        break;
      }
      case "--sweep": {
        const param = argv[++i];
        const values = argv[++i].split(",").map(Number);
        sweep = { param, values };
        break;
      }
      // v2 mechanism flags
      case "--vesting":
        config.vestingPeriod = parseInt(argv[++i], 10);
        break;
      case "--stake-voting":
        config.stakeWeightedVoting = true;
        break;
      case "--slash":
        config.slashOnRejectPct = parseFloat(argv[++i]);
        break;
      case "--quality-bonus":
        config.qualityBonusEnabled = true;
        break;
      case "--no-quorum-rejects":
        config.noQuorumRejects = true;
        break;
      case "--v2":
        // Enable all v2 mechanisms with sensible defaults
        config.vestingPeriod = 24;        // 24 ticks (1 day) vesting
        config.stakeWeightedVoting = true;
        config.slashOnRejectPct = 0.1;    // 10% slash
        config.qualityBonusEnabled = true;
        config.noQuorumRejects = true;
        break;
    }
  }

  return { config, sweep, disabledAgents };
}

function createAgents(
  config: SimConfig,
  rng: SeededRNG,
  disabledAgents: Set<string>,
): Agent[] {
  const agents: Agent[] = [];
  const content = new ContentGenerator(config, rng);

  if (!disabledAgents.has("honest_curator")) {
    for (let i = 0; i < config.agentCounts.honestCurator; i++) {
      agents.push(
        new HonestCurator(`honest_${i + 1}`, new SeededRNG(rng.nextInt(0, 1e9)), content),
      );
    }
  }

  if (!disabledAgents.has("profit_maximizer")) {
    for (let i = 0; i < config.agentCounts.profitMaximizer; i++) {
      agents.push(
        new ProfitMaximizer(
          `profit_${i + 1}`,
          new SeededRNG(rng.nextInt(0, 1e9)),
          content,
          config.bondAmount,
        ),
      );
    }
  }

  if (!disabledAgents.has("colluding_ring")) {
    const ringNames = Array.from(
      { length: config.agentCounts.colludingRing },
      (_, i) => `ring_${i + 1}`,
    );
    for (let i = 0; i < config.agentCounts.colludingRing; i++) {
      agents.push(
        new ColludingRingMember(
          ringNames[i],
          new SeededRNG(rng.nextInt(0, 1e9)),
          content,
          ringNames,
          config.bondAmount,
        ),
      );
    }
  }

  if (!disabledAgents.has("spam_bot")) {
    for (let i = 0; i < config.agentCounts.spamBot; i++) {
      agents.push(
        new SpamBot(
          `spam_${i + 1}`,
          new SeededRNG(rng.nextInt(0, 1e9)),
          config.maxDailySubmissions,
          config.bondAmount,
        ),
      );
    }
  }

  if (!disabledAgents.has("passive_staker")) {
    for (let i = 0; i < config.agentCounts.passiveStaker; i++) {
      agents.push(
        new PassiveStaker(`staker_${i + 1}`, new SeededRNG(rng.nextInt(0, 1e9))),
      );
    }
  }

  return agents;
}

function runSimulation(config: SimConfig, disabledAgents: Set<string>): void {
  const rng = new SeededRNG(config.seed);
  const world = new World(config, rng);
  const agents = createAgents(config, rng, disabledAgents);

  for (const agent of agents) {
    world.initAgent(agent);
  }

  for (let t = 0; t < config.totalTicks; t++) {
    world.processTick(agents);
  }

  printReport(config, world.metrics, agents);
}

function runSweep(
  baseConfig: SimConfig,
  sweep: { param: string; values: number[] },
  disabledAgents: Set<string>,
): void {
  console.log("");
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`  PARAMETER SWEEP: ${sweep.param}`);
  console.log(`  Values: ${sweep.values.join(", ")}`);
  console.log(`═══════════════════════════════════════════════════════════════`);

  for (const value of sweep.values) {
    const config = { ...baseConfig, agentCounts: { ...baseConfig.agentCounts } };
    switch (sweep.param) {
      case "bond":
        config.bondAmount = value;
        break;
      case "minVotes":
        config.minVotes = value;
        break;
      case "challengePeriod":
        config.challengePeriod = value;
        break;
      case "votingPeriod":
        config.votingPeriod = value;
        break;
      case "newsPerItem":
        config.newsPerItem = value;
        break;
      default:
        console.error(`Unknown sweep parameter: ${sweep.param}`);
        process.exit(1);
    }

    console.log(`\n  ─── ${sweep.param} = ${value} ───`);
    runSimulation(config, disabledAgents);
  }
}

// Main
const args = process.argv.slice(2);
const { config, sweep, disabledAgents } = parseArgs(args);

if (sweep) {
  runSweep(config, sweep, disabledAgents);
} else {
  runSimulation(config, disabledAgents);
}
