import type { SimConfig } from "../config.js";
import type { SeededRNG } from "../rng.js";
import { Clock } from "./clock.js";
import { FeedRegistry } from "./registry.js";
import { NewsStaking } from "./staking.js";
import { AMM } from "./amm.js";
import { RevenueModel } from "./revenue.js";
import { type Agent, type WorldView, type AgentAction } from "../agents/base.js";
import {
  MetricsCollector,
  type TickSnapshot,
  type AgentSnapshot,
} from "../metrics/collector.js";

export class World {
  readonly clock: Clock;
  readonly registry: FeedRegistry;
  readonly staking: NewsStaking;
  readonly amm: AMM;
  readonly revenue: RevenueModel;
  readonly metrics: MetricsCollector;
  readonly balances: Map<string, { usdc: number; news: number }>;

  // Fix 1: Vesting ledger — agent → [{amount, unlocksAt}]
  private vestingLedger = new Map<string, { amount: number; unlocksAt: number }[]>();

  // Per-tick counters
  private tickSubmitted = 0;
  private tickAccepted = 0;
  private tickRejected = 0;
  private tickChallenged = 0;

  constructor(
    private config: SimConfig,
    private rng: SeededRNG,
  ) {
    this.clock = new Clock(config.ticksPerDay);
    this.balances = new Map();
    this.registry = new FeedRegistry(config, this.clock, this.balances);
    this.staking = new NewsStaking(this.balances);
    this.amm = new AMM(config.ammSeedUSDC, config.ammSeedNEWS);
    this.revenue = new RevenueModel(config);
    this.metrics = new MetricsCollector();
  }

  initAgent(agent: Agent): void {
    this.balances.set(agent.name, {
      usdc: this.config.startingUSDC,
      news: this.config.startingNEWS,
    });
  }

  private getWorldView(agent: Agent): WorldView {
    const bal = this.balances.get(agent.name) ?? { usdc: 0, news: 0 };
    return {
      tick: this.clock.tick,
      day: this.clock.day,
      challengeable: this.registry.getChallengeable(),
      votable: this.registry.getVotable(),
      newsPrice: this.amm.price,
      feedQuality: this.revenue.feedQuality(
        this.registry.getRecentAccepted(this.config.ticksPerDay),
      ),
      stakingAPY: this.staking.getStakingAPY(this.amm.price),
      myBalance: { ...bal },
      myStaked: this.staking.getStaked(agent.name),
      myPendingRewards: this.staking.pendingRewards(agent.name),
      allAgentNames: [...this.balances.keys()],
    };
  }

  processTick(agents: Agent[]): void {
    this.tickSubmitted = 0;
    this.tickAccepted = 0;
    this.tickRejected = 0;
    this.tickChallenged = 0;

    // 0. Unlock vested NEWS
    this.processVesting();

    // 1. Collect all agent decisions
    const allActions: { agent: Agent; actions: AgentAction[] }[] = [];
    for (const agent of agents) {
      const view = this.getWorldView(agent);
      const actions = agent.decide(view);
      allActions.push({ agent, actions });
    }

    // 2. Shuffle action order for fairness
    const shuffled = this.rng.shuffle(allActions);

    // 3. Execute submits first
    for (const { agent, actions } of shuffled) {
      for (const action of actions) {
        if (action.type === "submit" && action.quality !== undefined) {
          const item = this.registry.submitItem(agent.name, action.quality);
          if (item) this.tickSubmitted++;
        }
      }
    }

    // 4. Execute challenges
    for (const { agent, actions } of shuffled) {
      for (const action of actions) {
        if (action.type === "challenge" && action.itemId !== undefined) {
          if (this.registry.challengeItem(agent.name, action.itemId)) {
            this.tickChallenged++;
          }
        }
      }
    }

    // 5. Execute votes (with optional stake-weighting)
    if (this.config.stakeWeightedVoting) {
      this.executeStakeWeightedVotes(shuffled);
    } else {
      for (const { agent, actions } of shuffled) {
        for (const action of actions) {
          if (action.type === "vote" && action.itemId !== undefined) {
            this.registry.voteOnChallenge(
              agent.name,
              action.itemId,
              action.keepVote ?? true,
            );
          }
        }
      }
    }

    // 6. Process expirations (auto-accept, resolve challenges)
    const { accepted, resolved } = this.config.stakeWeightedVoting
      ? this.registry.processExpirationsWeighted(this.staking)
      : this.registry.processExpirations();
    this.tickAccepted += accepted.length;
    const rejectedItems: typeof resolved = [];
    for (const item of resolved) {
      if (item.status === "Accepted") this.tickAccepted++;
      if (item.status === "Rejected") {
        this.tickRejected++;
        rejectedItems.push(item);
      }
    }

    // 7. Mint NEWS for newly accepted items (with optional vesting)
    const newlyAccepted = [...accepted, ...resolved.filter((r) => r.status === "Accepted")];
    for (const item of newlyAccepted) {
      this.mintNews(item.submitter, this.config.newsPerItem);
    }

    // Fix 3: Slash staked NEWS on rejection
    if (this.config.slashOnRejectPct > 0) {
      for (const item of rejectedItems) {
        const stakedAmt = this.staking.getStaked(item.submitter);
        if (stakedAmt > 0) {
          const slashAmount = stakedAmt * this.config.slashOnRejectPct;
          this.staking.slash(item.submitter, slashAmount);
        }
      }
    }

    // 8. Calculate feed quality + revenue
    const recentAccepted = this.registry.getRecentAccepted(this.config.ticksPerDay);
    const rev = this.revenue.compute(recentAccepted);

    // 9. Deposit revenue into staking (with optional quality bonus carve-out)
    let stakingRevenue = rev.revenue;
    if (this.config.qualityBonusEnabled && newlyAccepted.length > 0) {
      const bonusPool = rev.revenue * this.config.qualityBonusPct;
      stakingRevenue = rev.revenue - bonusPool;
      this.distributeQualityBonus(bonusPool, newlyAccepted);
    }
    this.staking.depositRevenue(stakingRevenue);

    // 10. Execute staking and AMM actions
    for (const { agent, actions } of shuffled) {
      for (const action of actions) {
        this.executeEconomicAction(agent.name, action);
      }
    }

    // 11. Record metrics
    this.recordSnapshot(rev.feedQuality, rev.spamRatio, rev.queryVolume, rev.revenue);

    // 12. Advance clock
    this.clock.advance();
  }

  // Fix 1: Vest NEWS instead of immediately granting
  private mintNews(agent: string, amount: number): void {
    if (this.config.vestingPeriod <= 0) {
      // No vesting — immediate grant (original behavior)
      const bal = this.balances.get(agent);
      if (bal) bal.news += amount;
    } else {
      // Add to vesting ledger
      let entries = this.vestingLedger.get(agent);
      if (!entries) {
        entries = [];
        this.vestingLedger.set(agent, entries);
      }
      entries.push({ amount, unlocksAt: this.clock.tick + this.config.vestingPeriod });
    }
  }

  private processVesting(): void {
    if (this.config.vestingPeriod <= 0) return;
    for (const [agent, entries] of this.vestingLedger) {
      const bal = this.balances.get(agent);
      if (!bal) continue;
      let i = 0;
      while (i < entries.length) {
        if (this.clock.tick >= entries[i].unlocksAt) {
          bal.news += entries[i].amount;
          entries.splice(i, 1);
        } else {
          i++;
        }
      }
    }
  }

  // Fix 2: Stake-weighted voting — record votes but resolve using staked weight
  private executeStakeWeightedVotes(
    shuffled: { agent: Agent; actions: AgentAction[] }[],
  ): void {
    // Still register votes in registry (for tracking), but resolution uses weights
    for (const { agent, actions } of shuffled) {
      for (const action of actions) {
        if (action.type === "vote" && action.itemId !== undefined) {
          this.registry.voteOnChallenge(
            agent.name,
            action.itemId,
            action.keepVote ?? true,
          );
        }
      }
    }
  }

  // Fix 4: Quality bonus — distribute bonus pool proportional to item quality
  private distributeQualityBonus(
    bonusPool: number,
    acceptedItems: { submitter: string; quality: number }[],
  ): void {
    const totalQuality = acceptedItems.reduce((s, i) => s + i.quality, 0);
    if (totalQuality <= 0) return;
    for (const item of acceptedItems) {
      const share = (item.quality / totalQuality) * bonusPool;
      const bal = this.balances.get(item.submitter);
      if (bal) bal.usdc += share;
    }
  }

  private executeEconomicAction(agentName: string, action: AgentAction): void {
    const bal = this.balances.get(agentName);
    if (!bal) return;

    switch (action.type) {
      case "buy_news": {
        const usdcIn = Math.min(action.amount ?? 0, bal.usdc);
        if (usdcIn > 0) {
          bal.usdc -= usdcIn;
          const newsOut = this.amm.buyNEWS(usdcIn);
          bal.news += newsOut;
        }
        break;
      }
      case "sell_news": {
        const newsIn = Math.min(action.amount ?? 0, bal.news);
        if (newsIn > 0) {
          bal.news -= newsIn;
          const usdcOut = this.amm.sellNEWS(newsIn);
          bal.usdc += usdcOut;
        }
        break;
      }
      case "stake": {
        const amount = Math.min(action.amount ?? 0, bal.news);
        if (amount > 0) {
          this.staking.stake(agentName, amount);
        }
        break;
      }
      case "unstake": {
        const amount = action.amount ?? 0;
        if (amount > 0) {
          this.staking.unstake(agentName, amount);
        }
        break;
      }
      case "claim_rewards": {
        this.staking.claimRewards(agentName);
        break;
      }
    }
  }

  private recordSnapshot(
    feedQuality: number,
    spamRatio: number,
    queryVolume: number,
    revenue: number,
  ): void {
    const agentSnapshots = new Map<string, AgentSnapshot>();
    for (const [name, bal] of this.balances) {
      const staked = this.staking.getStaked(name);
      const pending = this.staking.pendingRewards(name);
      // Include locked vesting NEWS in total value
      const vestingEntries = this.vestingLedger.get(name) ?? [];
      const vestingNews = vestingEntries.reduce((s, e) => s + e.amount, 0);
      const newsValue = (bal.news + staked + vestingNews) * this.amm.price;
      agentSnapshots.set(name, {
        usdc: bal.usdc,
        news: bal.news,
        staked,
        pendingRewards: pending,
        totalValue: bal.usdc + newsValue + pending,
      });
    }

    const snapshot: TickSnapshot = {
      tick: this.clock.tick,
      feedQuality,
      spamRatio,
      queryVolume,
      revenue,
      newsPrice: this.amm.price,
      totalStaked: this.staking.totalStaked,
      itemsSubmitted: this.tickSubmitted,
      itemsAccepted: this.tickAccepted,
      itemsRejected: this.tickRejected,
      itemsChallenged: this.tickChallenged,
      agentSnapshots,
    };
    this.metrics.record(snapshot);
  }
}
