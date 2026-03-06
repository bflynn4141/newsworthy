import type { SeededRNG } from "../rng.js";
import type { FeedItem } from "../engine/registry.js";

export type AgentActionType =
  | "submit"
  | "challenge"
  | "vote"
  | "buy_news"
  | "sell_news"
  | "stake"
  | "unstake"
  | "claim_rewards";

export interface AgentAction {
  type: AgentActionType;
  // Submit
  quality?: number;
  // Challenge / Vote
  itemId?: number;
  keepVote?: boolean;
  // AMM / Staking
  amount?: number;
}

export interface WorldView {
  tick: number;
  day: number;
  challengeable: FeedItem[];
  votable: FeedItem[];
  newsPrice: number;
  feedQuality: number;
  stakingAPY: number;
  myBalance: { usdc: number; news: number };
  myStaked: number;
  myPendingRewards: number;
  allAgentNames: string[];
}

export type AgentArchetype =
  | "honest_curator"
  | "profit_maximizer"
  | "colluding_ring"
  | "spam_bot"
  | "passive_staker";

export abstract class Agent {
  abstract readonly archetype: AgentArchetype;

  constructor(
    public readonly name: string,
    protected rng: SeededRNG,
  ) {}

  abstract decide(world: WorldView): AgentAction[];

  // Perceive quality with noise — simulates imperfect information
  perceiveQuality(item: FeedItem): number {
    const noisy = item.quality + this.rng.nextGaussian(0, 1.5);
    return Math.max(1, Math.min(10, noisy));
  }
}
