import { Agent, type AgentAction, type WorldView } from "./base.js";
import type { SeededRNG } from "../rng.js";

export class SpamBot extends Agent {
  readonly archetype = "spam_bot" as const;
  private submissionsToday = 0;
  private lastDay = -1;

  constructor(
    name: string,
    rng: SeededRNG,
    private maxDaily: number,
    private bondAmount: number,
  ) {
    super(name, rng);
  }

  decide(world: WorldView): AgentAction[] {
    const actions: AgentAction[] = [];

    // Reset daily counter
    if (world.day !== this.lastDay) {
      this.submissionsToday = 0;
      this.lastDay = world.day;
    }

    // Submit max daily low-quality items (1-3)
    while (
      this.submissionsToday < this.maxDaily &&
      world.myBalance.usdc >= this.bondAmount
    ) {
      const quality = this.rng.nextInt(1, 3);
      actions.push({ type: "submit", quality });
      this.submissionsToday++;
    }

    // Sell any NEWS immediately — no staking, just dump
    if (world.myBalance.news > 1) {
      actions.push({ type: "sell_news", amount: world.myBalance.news });
    }

    // Never challenge, never vote

    return actions;
  }
}
