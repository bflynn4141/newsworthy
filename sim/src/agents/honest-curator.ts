import { Agent, type AgentAction, type WorldView } from "./base.js";
import type { SeededRNG } from "../rng.js";
import type { ContentGenerator } from "../content/generator.js";

export class HonestCurator extends Agent {
  readonly archetype = "honest_curator" as const;
  private hasStakedInitial = false;

  constructor(
    name: string,
    rng: SeededRNG,
    private content: ContentGenerator,
  ) {
    super(name, rng);
  }

  decide(world: WorldView): AgentAction[] {
    const actions: AgentAction[] = [];

    // Stake 80% of NEWS holdings on first opportunity
    if (!this.hasStakedInitial && world.myBalance.news > 0) {
      const toStake = world.myBalance.news * 0.8;
      if (toStake > 0) {
        actions.push({ type: "stake", amount: toStake });
        this.hasStakedInitial = true;
      }
    }

    // Periodically stake new NEWS earnings (every 12 ticks)
    if (world.tick % 12 === 0 && world.myBalance.news > 10) {
      actions.push({ type: "stake", amount: world.myBalance.news * 0.8 });
    }

    // Claim staking rewards periodically
    if (world.tick % 24 === 0 && world.myPendingRewards > 0.01) {
      actions.push({ type: "claim_rewards" });
    }

    // Submit only quality content (>= 6)
    if (world.myBalance.usdc >= 0.2) {
      // Generate content and only submit if quality
      const quality = this.content.generate();
      if (quality >= 6) {
        actions.push({ type: "submit", quality });
      }
    }

    // Challenge all items perceived as low quality (AI agents are fast)
    for (const item of world.challengeable) {
      if (item.submitter === this.name) continue;
      const perceived = this.perceiveQuality(item);
      if (perceived < 4 && world.myBalance.usdc >= 0.2) {
        actions.push({ type: "challenge", itemId: item.id });
      }
    }

    // Vote truthfully on challenged items
    for (const item of world.votable) {
      if (item.submitter === this.name || item.challenger === this.name) continue;
      const perceived = this.perceiveQuality(item);
      actions.push({
        type: "vote",
        itemId: item.id,
        keepVote: perceived >= 5,
      });
    }

    return actions;
  }
}
