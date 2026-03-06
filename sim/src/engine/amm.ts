// Constant-product AMM (x * y = k) for NEWS/USDC
export class AMM {
  reserveUSDC: number;
  reserveNEWS: number;

  constructor(seedUSDC: number, seedNEWS: number) {
    this.reserveUSDC = seedUSDC;
    this.reserveNEWS = seedNEWS;
  }

  get price(): number {
    return this.reserveUSDC / this.reserveNEWS;
  }

  get k(): number {
    return this.reserveUSDC * this.reserveNEWS;
  }

  // Buy NEWS with USDC — returns NEWS received
  buyNEWS(usdcIn: number): number {
    if (usdcIn <= 0) return 0;
    const newReserveUSDC = this.reserveUSDC + usdcIn;
    const newReserveNEWS = this.k / newReserveUSDC;
    const newsOut = this.reserveNEWS - newReserveNEWS;
    this.reserveUSDC = newReserveUSDC;
    this.reserveNEWS = newReserveNEWS;
    return newsOut;
  }

  // Sell NEWS for USDC — returns USDC received
  sellNEWS(newsIn: number): number {
    if (newsIn <= 0) return 0;
    const newReserveNEWS = this.reserveNEWS + newsIn;
    const newReserveUSDC = this.k / newReserveNEWS;
    const usdcOut = this.reserveUSDC - newReserveUSDC;
    this.reserveUSDC = newReserveUSDC;
    this.reserveNEWS = newReserveNEWS;
    return usdcOut;
  }

  // Quote how much NEWS you'd get for usdcIn (no state change)
  quoteNEWSOut(usdcIn: number): number {
    if (usdcIn <= 0) return 0;
    const newReserveUSDC = this.reserveUSDC + usdcIn;
    return this.reserveNEWS - this.k / newReserveUSDC;
  }

  // Quote how much USDC you'd get for newsIn (no state change)
  quoteUSDCOut(newsIn: number): number {
    if (newsIn <= 0) return 0;
    const newReserveNEWS = this.reserveNEWS + newsIn;
    return this.reserveUSDC - this.k / newReserveNEWS;
  }
}
