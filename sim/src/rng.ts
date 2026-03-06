// Seeded xorshift128 PRNG — deterministic across runs
export class SeededRNG {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // Initialize state from seed using splitmix32
    let s = seed | 0;
    const sm = () => {
      s = (s + 0x9e3779b9) | 0;
      let t = s ^ (s >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      t = t ^ (t >>> 15);
      return t >>> 0;
    };
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
  }

  // Returns [0, 1)
  next(): number {
    const t = this.s0 ^ (this.s0 << 11);
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.s2 = this.s3;
    this.s3 = (this.s3 ^ (this.s3 >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return this.s3 / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Box-Muller transform
  nextGaussian(mean: number, stddev: number): number {
    const u1 = this.next() || 1e-10; // avoid log(0)
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  shuffle<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
