import { Agent, type AgentAction, type WorldView } from "./base.js";
import type { SeededRNG } from "../rng.js";
import type { ContentGenerator } from "../content/generator.js";

export class ProfitMaximizer extends Agent {
  readonly archetype = "profit_maximizer" as const;
  private apyThreshold = 0.1; // 10% — sell NEWS if staking APY drops below

  constructor(
    name: string,
    rng: SeededRNG,
    private content: ContentGenerator,
    private bondAmount: number,
  ) {
    super(name, rng);
  }

  decide(world: WorldView): AgentAction[] {
    const actions: AgentAction[] = [];

    // Submit anything > 3 (might pass through unchallenged)
    if (world.myBalance.usdc >= this.bondAmount * 1.5) {
      const quality = this.content.generate();
      if (quality > 3) {
        actions.push({ type: "submit", quality });
      }
    }

    // Challenge only if EV+: perceived low quality AND likely to win vote
    for (const item of world.challengeable) {
      if (item.submitter === this.name) continue;
      const perceived = this.perceiveQuality(item);
      // Only challenge obvious garbage where vote outcome is predictable
      if (perceived < 3 && world.myBalance.usdc >= this.bondAmount * 2) {
        const pool = this.bondAmount * 2;
        const winnerShare = pool * 0.7;
        const ev = winnerShare - this.bondAmount; // net gain if we win
        if (ev > 0) {
          actions.push({ type: "challenge", itemId: item.id });
          break;
        }
      }
    }

    // Bandwagon voting — join the majority side for voter rewards
    for (const item of world.votable) {
      if (item.submitter === this.name || item.challenger === this.name) continue;
      // Vote with whichever side has more votes (or keep if tied, safer bet)
      const keepVote = item.keepVoters.length >= item.removeVoters.length;
      actions.push({ type: "vote", itemId: item.id, keepVote });
    }

    // Claim rewards regularly
    if (world.myPendingRewards > 0.01) {
      actions.push({ type: "claim_rewards" });
    }

    // Stake NEWS when APY is decent
    if (world.myBalance.news > 10) {
      if (world.stakingAPY >= this.apyThreshold || world.tick < 24) {
        // Early on, stake speculatively
        actions.push({ type: "stake", amount: world.myBalance.news * 0.5 });
      }
    }

    // Sell NEWS if price is high relative to initial ($0.01)
    if (world.newsPrice > 0.015 && world.myBalance.news > 50) {
      actions.push({ type: "sell_news", amount: world.myBalance.news * 0.3 });
    }

    return actions;
  }
}
