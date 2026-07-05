/**
 * In-memory sliding-window rate limiter. Each client keeps the timestamps of
 * its requests in the trailing window; a request is allowed while the count
 * is below the client's per-minute limit. Suitable for the single-container
 * deploy shape this service targets.
 */
export class SlidingWindowRateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private windowMs = 60_000) {}

  /** Returns true if the request is allowed (and records it). */
  allow(key: string, limitPerWindow: number, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= limitPerWindow) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  /** Drop clients with no recent activity (called periodically). */
  prune(now = Date.now()): void {
    const cutoff = now - this.windowMs;
    for (const [key, list] of this.hits) {
      const kept = list.filter((t) => t > cutoff);
      if (kept.length === 0) this.hits.delete(key);
      else this.hits.set(key, kept);
    }
  }
}
