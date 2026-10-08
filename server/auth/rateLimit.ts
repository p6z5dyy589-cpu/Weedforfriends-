/** Simple fixed-window limiter for PIN attempts, keyed per client+login name. */
export class AttemptLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max = 5,
    private readonly windowMs = 5 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  isBlocked(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.resetAt <= this.now()) {
      this.attempts.delete(key);
      return false;
    }
    return entry.count >= this.max;
  }

  recordFailure(key: string): void {
    const now = this.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.windowMs });
    } else {
      entry.count += 1;
    }
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
