export class Clock {
  tick = 0;
  readonly ticksPerDay: number;

  constructor(ticksPerDay: number) {
    this.ticksPerDay = ticksPerDay;
  }

  advance(): void {
    this.tick++;
  }

  get day(): number {
    return Math.floor(this.tick / this.ticksPerDay);
  }

  get hour(): number {
    return this.tick % this.ticksPerDay;
  }
}
