import { Agent, type AgentAction, type WorldView } from "./base.js";
import type { SeededRNG } from "../rng.js";
import type { ContentGenerator } from "../content/generator.js";

// Three attack patterns:
// 1. Mutual approval: never challenge ring members
// 2. Vote manipulation: all ring members vote same way
// 3. Economic griefing: challenge honest submitters to burn their bonds

export class ColludingRingMember extends Agent {
  readonly archetype = "colluding_ring" as const;

  constructor(
    name: string,
    rng: SeededRNG,
    private content: ContentGenerator,
    private ringMembers: string[], // names of all ring members
    private bondAmount: number,
  ) {
    super(name, rng);
  }

  private isRingMember(agent: string): boolean {
    return this.ringMembers.includes(agent);
  }

  decide(world: WorldView): AgentAction[] {
    const actions: AgentAction[] = [];

    // Submit borderline content (3-5) — low effort, might slip through
    if (world.myBalance.usdc >= this.bondAmount * 1.2) {
      const quality = this.content.generateAtQuality(3, 5);
      actions.push({ type: "submit", quality });
    }

    // Attack pattern 3: grief honest submitters
    // Challenge good-looking content from non-ring members to burn their bonds
    for (const item of world.challengeable) {
      if (this.isRingMember(item.submitter)) continue; // never challenge ring
      if (item.submitter === this.name) continue;

      // Grief strategy: challenge even decent content, hoping ring votes REMOVE
      if (world.myBalance.usdc >= this.bondAmount * 1.5) {
        actions.push({ type: "challenge", itemId: item.id });
        break; // One challenge per tick
      }
    }

    // Vote manipulation: always support ring, always oppose outsiders
    for (const item of world.votable) {
      if (item.submitter === this.name || item.challenger === this.name) continue;

      if (this.isRingMember(item.submitter)) {
        // Always vote KEEP for ring members
        actions.push({ type: "vote", itemId: item.id, keepVote: true });
      } else if (this.isRingMember(item.challenger!)) {
        // Always vote REMOVE to support ring challenger
        actions.push({ type: "vote", itemId: item.id, keepVote: false });
      } else {
        // Outsider vs outsider — vote REMOVE to lower feed quality
        actions.push({ type: "vote", itemId: item.id, keepVote: false });
      }
    }

    // Stake NEWS (ring wants token value... or dumps it)
    if (world.myBalance.news > 10) {
      // Stake some, keep some liquid for coordinated sell
      actions.push({ type: "stake", amount: world.myBalance.news * 0.4 });
    }

    // Claim rewards
    if (world.myPendingRewards > 0.01) {
      actions.push({ type: "claim_rewards" });
    }

    // Coordinated sell at high price — all ring members sell when price > 2x initial
    if (world.newsPrice > 0.02 && world.myBalance.news > 20) {
      actions.push({ type: "sell_news", amount: world.myBalance.news * 0.5 });
    }

    return actions;
  }
}
