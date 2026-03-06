import type { SimConfig } from "../config.js";
import type { FeedItem } from "./registry.js";

// Quality → query volume → USDC revenue
// Core thesis: curated, high-quality feeds generate more x402 revenue

export class RevenueModel {
  constructor(private config: SimConfig) {}

  // Compute feed quality as exponentially-weighted avg of accepted item scores
  feedQuality(recentAccepted: FeedItem[]): number {
    if (recentAccepted.length === 0) return 0;
    // More recent items weighted higher (exponential decay)
    let weightSum = 0;
    let qualitySum = 0;
    for (let i = 0; i < recentAccepted.length; i++) {
      const weight = Math.pow(0.95, recentAccepted.length - 1 - i);
      qualitySum += recentAccepted[i].quality * weight;
      weightSum += weight;
    }
    return qualitySum / weightSum;
  }

  // Spam ratio: fraction of low-quality items in recent accepted
  spamRatio(recentAccepted: FeedItem[]): number {
    if (recentAccepted.length === 0) return 0;
    const lowQuality = recentAccepted.filter((i) => i.quality <= 3).length;
    return lowQuality / recentAccepted.length;
  }

  // Revenue for this tick
  compute(recentAccepted: FeedItem[]): {
    feedQuality: number;
    spamRatio: number;
    qualityMultiplier: number;
    spamPenalty: number;
    queryVolume: number;
    revenue: number;
  } {
    const fq = this.feedQuality(recentAccepted);
    const sr = this.spamRatio(recentAccepted);

    // Quality multiplier: linear 0.1 → 2.0 as quality goes 0 → 10
    const qualityMultiplier = 0.1 + (fq / 10) * 1.9;

    // Spam penalty: sqrt(spamRatio) — even small spam hurts disproportionately
    const spamPenalty = Math.sqrt(sr);

    const queryVolume =
      this.config.baseQueriesPerTick * qualityMultiplier * (1 - spamPenalty);
    const revenue = queryVolume * this.config.revenuePerQuery;

    return {
      feedQuality: fq,
      spamRatio: sr,
      qualityMultiplier,
      spamPenalty,
      queryVolume,
      revenue,
    };
  }
}
