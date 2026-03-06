import type { SimConfig } from "../config.js";
import type { Clock } from "./clock.js";
import type { NewsStaking } from "./staking.js";

export type ItemStatus = "Pending" | "Challenged" | "Accepted" | "Rejected";

export interface FeedItem {
  id: number;
  submitter: string;
  quality: number;       // ground truth quality (1-10)
  bond: number;
  status: ItemStatus;
  submittedAt: number;   // tick
  challengeDeadline: number;
  // Challenge state
  challenger: string | null;
  challengerBond: number;
  challengedAt: number;
  voteDeadline: number;
  keepVoters: string[];
  removeVoters: string[];
}

export interface BondEvent {
  tick: number;
  agent: string;
  amount: number;  // positive = received, negative = paid
  reason: string;
}

export class FeedRegistry {
  items: FeedItem[] = [];
  bondEvents: BondEvent[] = [];
  private nextId = 0;
  private dailySubmissions = new Map<string, Map<number, number>>(); // agent -> day -> count

  constructor(
    private config: SimConfig,
    private clock: Clock,
    private balances: Map<string, { usdc: number; news: number }>,
  ) {}

  private getBalance(agent: string) {
    let b = this.balances.get(agent);
    if (!b) {
      b = { usdc: 0, news: 0 };
      this.balances.set(agent, b);
    }
    return b;
  }

  private getDailyCount(agent: string, day: number): number {
    const agentMap = this.dailySubmissions.get(agent);
    if (!agentMap) return 0;
    return agentMap.get(day) ?? 0;
  }

  private incDailyCount(agent: string, day: number): void {
    let agentMap = this.dailySubmissions.get(agent);
    if (!agentMap) {
      agentMap = new Map();
      this.dailySubmissions.set(agent, agentMap);
    }
    agentMap.set(day, (agentMap.get(day) ?? 0) + 1);
  }

  submitItem(agent: string, quality: number): FeedItem | null {
    const day = this.clock.day;
    if (this.getDailyCount(agent, day) >= this.config.maxDailySubmissions) {
      return null; // daily limit
    }

    const bal = this.getBalance(agent);
    if (bal.usdc < this.config.bondAmount) {
      return null; // can't afford bond
    }

    bal.usdc -= this.config.bondAmount;
    this.bondEvents.push({
      tick: this.clock.tick,
      agent,
      amount: -this.config.bondAmount,
      reason: "submit_bond",
    });

    this.incDailyCount(agent, day);

    const item: FeedItem = {
      id: this.nextId++,
      submitter: agent,
      quality,
      bond: this.config.bondAmount,
      status: "Pending",
      submittedAt: this.clock.tick,
      challengeDeadline: this.clock.tick + this.config.challengePeriod,
      challenger: null,
      challengerBond: 0,
      challengedAt: 0,
      voteDeadline: 0,
      keepVoters: [],
      removeVoters: [],
    };
    this.items.push(item);
    return item;
  }

  challengeItem(agent: string, itemId: number): boolean {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return false;
    if (item.status !== "Pending") return false;
    if (item.submitter === agent) return false; // can't self-challenge
    if (this.clock.tick > item.challengeDeadline) return false;

    const bal = this.getBalance(agent);
    if (bal.usdc < this.config.bondAmount) return false;

    bal.usdc -= this.config.bondAmount;
    this.bondEvents.push({
      tick: this.clock.tick,
      agent,
      amount: -this.config.bondAmount,
      reason: "challenge_bond",
    });

    item.status = "Challenged";
    item.challenger = agent;
    item.challengerBond = this.config.bondAmount;
    item.challengedAt = this.clock.tick;
    item.voteDeadline = this.clock.tick + this.config.votingPeriod;
    return true;
  }

  voteOnChallenge(agent: string, itemId: number, keepVote: boolean): boolean {
    const item = this.items.find((i) => i.id === itemId);
    if (!item) return false;
    if (item.status !== "Challenged") return false;
    if (this.clock.tick > item.voteDeadline) return false;
    // One vote per agent per item
    if (item.keepVoters.includes(agent) || item.removeVoters.includes(agent)) return false;
    // Submitter and challenger can't vote
    if (item.submitter === agent || item.challenger === agent) return false;

    if (keepVote) {
      item.keepVoters.push(agent);
    } else {
      item.removeVoters.push(agent);
    }
    return true;
  }

  // Called each tick to handle expirations
  processExpirations(): { accepted: FeedItem[]; resolved: FeedItem[] } {
    const accepted: FeedItem[] = [];
    const resolved: FeedItem[] = [];

    for (const item of this.items) {
      if (item.status === "Pending" && this.clock.tick > item.challengeDeadline) {
        // Auto-accept: unchallenged item past deadline
        this.acceptItem(item);
        accepted.push(item);
      } else if (item.status === "Challenged" && this.clock.tick > item.voteDeadline) {
        // Voting period expired — resolve
        const totalVotes = item.keepVoters.length + item.removeVoters.length;
        if (totalVotes >= this.config.minVotes) {
          this.resolveChallenge(item);
        } else {
          this.resolveNoQuorum(item);
        }
        resolved.push(item);
      }
    }
    return { accepted, resolved };
  }

  // Fix 2: Stake-weighted resolution — vote power = staked NEWS
  processExpirationsWeighted(
    staking: NewsStaking,
  ): { accepted: FeedItem[]; resolved: FeedItem[] } {
    const accepted: FeedItem[] = [];
    const resolved: FeedItem[] = [];

    for (const item of this.items) {
      if (item.status === "Pending" && this.clock.tick > item.challengeDeadline) {
        this.acceptItem(item);
        accepted.push(item);
      } else if (item.status === "Challenged" && this.clock.tick > item.voteDeadline) {
        const totalVoters = item.keepVoters.length + item.removeVoters.length;
        if (totalVoters >= this.config.minVotes) {
          // Weight votes by staked NEWS
          let keepWeight = 0;
          let removeWeight = 0;
          for (const v of item.keepVoters) {
            keepWeight += Math.max(1, staking.getStaked(v)); // min weight 1
          }
          for (const v of item.removeVoters) {
            removeWeight += Math.max(1, staking.getStaked(v));
          }
          this.resolveChallengeWeighted(item, keepWeight >= removeWeight);
        } else {
          this.resolveNoQuorum(item);
        }
        resolved.push(item);
      }
    }
    return { accepted, resolved };
  }

  private resolveChallengeWeighted(item: FeedItem, keepWins: boolean): void {
    const pool = item.bond + item.challengerBond;
    const voterShare = (pool * this.config.voterShareBps) / 10000;
    const winnerShare = pool - voterShare;

    if (keepWins) {
      item.status = "Accepted";
      const submitterBal = this.getBalance(item.submitter);
      submitterBal.usdc += winnerShare;
      this.bondEvents.push({
        tick: this.clock.tick, agent: item.submitter,
        amount: winnerShare, reason: "challenge_won_submitter",
      });
      if (item.keepVoters.length > 0) {
        const perVoter = voterShare / item.keepVoters.length;
        for (const voter of item.keepVoters) {
          const vBal = this.getBalance(voter);
          vBal.usdc += perVoter;
          this.bondEvents.push({
            tick: this.clock.tick, agent: voter,
            amount: perVoter, reason: "voter_reward_keep",
          });
        }
      } else {
        submitterBal.usdc += voterShare;
      }
    } else {
      item.status = "Rejected";
      const challengerBal = this.getBalance(item.challenger!);
      challengerBal.usdc += winnerShare;
      this.bondEvents.push({
        tick: this.clock.tick, agent: item.challenger!,
        amount: winnerShare, reason: "challenge_won_challenger",
      });
      if (item.removeVoters.length > 0) {
        const perVoter = voterShare / item.removeVoters.length;
        for (const voter of item.removeVoters) {
          const vBal = this.getBalance(voter);
          vBal.usdc += perVoter;
          this.bondEvents.push({
            tick: this.clock.tick, agent: voter,
            amount: perVoter, reason: "voter_reward_remove",
          });
        }
      } else {
        challengerBal.usdc += voterShare;
      }
    }
  }

  private acceptItem(item: FeedItem): void {
    item.status = "Accepted";
    // Return submitter's bond
    const bal = this.getBalance(item.submitter);
    bal.usdc += item.bond;
    this.bondEvents.push({
      tick: this.clock.tick,
      agent: item.submitter,
      amount: item.bond,
      reason: "bond_returned_accept",
    });
  }

  private resolveChallenge(item: FeedItem): void {
    const pool = item.bond + item.challengerBond;
    const voterShare = (pool * this.config.voterShareBps) / 10000;
    const winnerShare = pool - voterShare;

    const keepWins = item.keepVoters.length >= item.removeVoters.length;

    if (keepWins) {
      // Submitter wins — item accepted
      item.status = "Accepted";
      const submitterBal = this.getBalance(item.submitter);
      submitterBal.usdc += winnerShare;
      this.bondEvents.push({
        tick: this.clock.tick,
        agent: item.submitter,
        amount: winnerShare,
        reason: "challenge_won_submitter",
      });

      // Distribute voter share to keep voters
      if (item.keepVoters.length > 0) {
        const perVoter = voterShare / item.keepVoters.length;
        for (const voter of item.keepVoters) {
          const vBal = this.getBalance(voter);
          vBal.usdc += perVoter;
          this.bondEvents.push({
            tick: this.clock.tick,
            agent: voter,
            amount: perVoter,
            reason: "voter_reward_keep",
          });
        }
      } else {
        // No keep voters — winner gets full pool
        submitterBal.usdc += voterShare;
      }
    } else {
      // Challenger wins — item rejected
      item.status = "Rejected";
      const challengerBal = this.getBalance(item.challenger!);
      challengerBal.usdc += winnerShare;
      this.bondEvents.push({
        tick: this.clock.tick,
        agent: item.challenger!,
        amount: winnerShare,
        reason: "challenge_won_challenger",
      });

      // Distribute voter share to remove voters
      if (item.removeVoters.length > 0) {
        const perVoter = voterShare / item.removeVoters.length;
        for (const voter of item.removeVoters) {
          const vBal = this.getBalance(voter);
          vBal.usdc += perVoter;
          this.bondEvents.push({
            tick: this.clock.tick,
            agent: voter,
            amount: perVoter,
            reason: "voter_reward_remove",
          });
        }
      } else {
        challengerBal.usdc += voterShare;
      }
    }
  }

  private resolveNoQuorum(item: FeedItem): void {
    // Fix 5: No quorum can reject instead of accept
    item.status = this.config.noQuorumRejects ? "Rejected" : "Accepted";

    const submitterBal = this.getBalance(item.submitter);
    submitterBal.usdc += item.bond;
    this.bondEvents.push({
      tick: this.clock.tick,
      agent: item.submitter,
      amount: item.bond,
      reason: "bond_returned_no_quorum",
    });

    const challengerBal = this.getBalance(item.challenger!);
    challengerBal.usdc += item.challengerBond;
    this.bondEvents.push({
      tick: this.clock.tick,
      agent: item.challenger!,
      amount: item.challengerBond,
      reason: "bond_returned_no_quorum",
    });
  }

  // Helper: get items by status
  getItemsByStatus(status: ItemStatus): FeedItem[] {
    return this.items.filter((i) => i.status === status);
  }

  // Helper: get pending items within challenge window
  getChallengeable(): FeedItem[] {
    return this.items.filter(
      (i) => i.status === "Pending" && this.clock.tick <= i.challengeDeadline,
    );
  }

  // Helper: get items in voting
  getVotable(): FeedItem[] {
    return this.items.filter(
      (i) => i.status === "Challenged" && this.clock.tick <= i.voteDeadline,
    );
  }

  // Recent accepted items (within window ticks)
  getRecentAccepted(window: number): FeedItem[] {
    const cutoff = this.clock.tick - window;
    return this.items.filter(
      (i) => i.status === "Accepted" && i.submittedAt >= cutoff,
    );
  }
}
