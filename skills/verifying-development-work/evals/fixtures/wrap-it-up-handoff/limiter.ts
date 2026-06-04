// A minimal sliding-window rate limiter: allow at most `max` events within
// `windowMs`, judged against the timestamps seen so far.
export class RateLimiter {
  private readonly hits: number[] = [];

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  // Returns true if the event at `now` is allowed; records it when so.
  allow(now: number): boolean {
    const cutoff = now - this.windowMs;
    // Drop timestamps that have aged out of the window.
    while (this.hits.length > 0) {
      const oldest = this.hits[0];
      if (oldest === undefined || oldest > cutoff) break;
      this.hits.shift();
    }
    if (this.hits.length >= this.max) return false;
    this.hits.push(now);
    return true;
  }
}
