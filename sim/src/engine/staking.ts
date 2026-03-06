// Faithful port of NewsStaking.sol — Synthetix accumulator pattern
// Uses JS floats (sufficient precision for simulation)

export class NewsStaking {
  totalStaked = 0;
  rewardPerTokenStored = 0;

  private staked = new Map<string, number>();
  private userRewardPerTokenPaid = new Map<string, number>();
  private rewards = new Map<string, number>();

  private balances: Map<string, { usdc: number; news: number }>;

  constructor(balances: Map<string, { usdc: number; news: number }>) {
    this.balances = balances;
  }

  private getBalance(agent: string) {
    let b = this.balances.get(agent);
    if (!b) {
      b = { usdc: 0, news: 0 };
      this.balances.set(agent, b);
    }
    return b;
  }

  private updateReward(agent: string): void {
    const stakedAmt = this.staked.get(agent) ?? 0;
    const paid = this.userRewardPerTokenPaid.get(agent) ?? 0;
    const pending = stakedAmt * (this.rewardPerTokenStored - paid);
    const existing = this.rewards.get(agent) ?? 0;
    this.rewards.set(agent, existing + pending);
    this.userRewardPerTokenPaid.set(agent, this.rewardPerTokenStored);
  }

  stake(agent: string, amount: number): boolean {
    if (amount <= 0) return false;
    const bal = this.getBalance(agent);
    if (bal.news < amount) return false;

    this.updateReward(agent);
    bal.news -= amount;
    this.staked.set(agent, (this.staked.get(agent) ?? 0) + amount);
    this.totalStaked += amount;
    return true;
  }

  unstake(agent: string, amount: number): boolean {
    if (amount <= 0) return false;
    const stakedAmt = this.staked.get(agent) ?? 0;
    if (stakedAmt < amount) return false;

    this.updateReward(agent);
    this.staked.set(agent, stakedAmt - amount);
    this.totalStaked -= amount;
    const bal = this.getBalance(agent);
    bal.news += amount;
    return true;
  }

  // Called by revenue module each tick — distributes USDC to all stakers
  depositRevenue(amount: number): void {
    if (amount <= 0 || this.totalStaked <= 0) return;
    this.rewardPerTokenStored += amount / this.totalStaked;
  }

  pendingRewards(agent: string): number {
    const stakedAmt = this.staked.get(agent) ?? 0;
    const paid = this.userRewardPerTokenPaid.get(agent) ?? 0;
    const pending = stakedAmt * (this.rewardPerTokenStored - paid);
    return (this.rewards.get(agent) ?? 0) + pending;
  }

  claimRewards(agent: string): number {
    this.updateReward(agent);
    const reward = this.rewards.get(agent) ?? 0;
    if (reward <= 0) return 0;

    this.rewards.set(agent, 0);
    const bal = this.getBalance(agent);
    bal.usdc += reward;
    return reward;
  }

  // Fix 3: Slash — burn staked NEWS (removed from circulation)
  slash(agent: string, amount: number): void {
    const stakedAmt = this.staked.get(agent) ?? 0;
    const actual = Math.min(amount, stakedAmt);
    if (actual <= 0) return;

    this.updateReward(agent);
    this.staked.set(agent, stakedAmt - actual);
    this.totalStaked -= actual;
    // Slashed NEWS is burned — not returned to agent, just removed from supply
  }

  getStaked(agent: string): number {
    return this.staked.get(agent) ?? 0;
  }

  getStakingAPY(newsPrice: number): number {
    if (this.totalStaked <= 0 || newsPrice <= 0) return 0;
    return 0;
  }
}
