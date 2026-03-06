import type { SimConfig } from "../config.js";
import type { SeededRNG } from "../rng.js";

// Generate article quality scores based on configured distribution
export class ContentGenerator {
  constructor(
    private config: SimConfig,
    private rng: SeededRNG,
  ) {}

  // Returns a quality score 1-10 following the configured distribution
  generate(): number {
    const roll = this.rng.next();
    if (roll < this.config.qualityLowPct) {
      // Low quality: 1-3
      return this.rng.nextInt(1, 3);
    } else if (roll < this.config.qualityLowPct + this.config.qualityMidPct) {
      // Mid quality: 4-6
      return this.rng.nextInt(4, 6);
    } else {
      // High quality: 7-10
      return this.rng.nextInt(7, 10);
    }
  }

  // Generate content at a specific quality tier
  generateAtQuality(minQuality: number, maxQuality: number): number {
    return this.rng.nextInt(
      Math.max(1, Math.min(10, minQuality)),
      Math.max(1, Math.min(10, maxQuality)),
    );
  }
}
