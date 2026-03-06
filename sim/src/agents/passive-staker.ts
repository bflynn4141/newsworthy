import { Agent, type AgentAction, type WorldView } from "./base.js";
import type { SeededRNG } from "../rng.js";

export class PassiveStaker extends Agent {
  readonly archetype = "passive_staker" as const;

  constructor(name: string, rng: SeededRNG) {
    super(name, rng);
  }

  decide(world: WorldView): AgentAction[] {
    const actions: AgentAction[] = [];

    // Buy NEWS every tick with a small amount of USDC
    if (world.myBalance.usdc > 0.5) {
      actions.push({ type: "buy_news", amount: 0.1 });
    }

    // Stake all NEWS holdings
    if (world.myBalance.news > 1) {
      actions.push({ type: "stake", amount: world.myBalance.news });
    }

    // Claim rewards periodically
    if (world.tick % 12 === 0 && world.myPendingRewards > 0.001) {
      actions.push({ type: "claim_rewards" });
    }

    // Never submit, never challenge, never vote

    return actions;
  }
}
