export interface TickSnapshot {
  tick: number;
  feedQuality: number;
  spamRatio: number;
  queryVolume: number;
  revenue: number;
  newsPrice: number;
  totalStaked: number;
  itemsSubmitted: number;
  itemsAccepted: number;
  itemsRejected: number;
  itemsChallenged: number;
  agentSnapshots: Map<string, AgentSnapshot>;
}

export interface AgentSnapshot {
  usdc: number;
  news: number;
  staked: number;
  pendingRewards: number;
  // Total value = USDC + NEWS * price + staked * price + pendingRewards
  totalValue: number;
}

export class MetricsCollector {
  snapshots: TickSnapshot[] = [];

  record(snapshot: TickSnapshot): void {
    this.snapshots.push(snapshot);
  }

  // Agent P&L relative to starting capital
  agentPnL(agentName: string, startingValue: number): number {
    const last = this.snapshots[this.snapshots.length - 1];
    if (!last) return 0;
    const snap = last.agentSnapshots.get(agentName);
    if (!snap) return 0;
    return snap.totalValue - startingValue;
  }

  // Time series for a metric
  timeSeries(key: keyof Omit<TickSnapshot, "agentSnapshots" | "tick">): number[] {
    return this.snapshots.map((s) => s[key] as number);
  }

  // Average value over all ticks
  average(key: keyof Omit<TickSnapshot, "agentSnapshots" | "tick">): number {
    const series = this.timeSeries(key);
    if (series.length === 0) return 0;
    return series.reduce((a, b) => a + b, 0) / series.length;
  }
}
