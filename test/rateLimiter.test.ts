import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "../src/auth/rateLimiter.js";

describe("SlidingWindowRateLimiter", () => {
  it("allows up to the limit within the window, then denies", () => {
    const limiter = new SlidingWindowRateLimiter(60_000);
    const t0 = 1_000_000;
    expect(limiter.allow("c1", 3, t0)).toBe(true);
    expect(limiter.allow("c1", 3, t0 + 1)).toBe(true);
    expect(limiter.allow("c1", 3, t0 + 2)).toBe(true);
    expect(limiter.allow("c1", 3, t0 + 3)).toBe(false);
  });

  it("slides: old hits fall out of the window", () => {
    const limiter = new SlidingWindowRateLimiter(60_000);
    const t0 = 1_000_000;
    limiter.allow("c1", 2, t0);
    limiter.allow("c1", 2, t0 + 30_000);
    expect(limiter.allow("c1", 2, t0 + 45_000)).toBe(false);
    // t0 hit expires at t0 + 60s.
    expect(limiter.allow("c1", 2, t0 + 60_001)).toBe(true);
  });

  it("tracks clients independently", () => {
    const limiter = new SlidingWindowRateLimiter(60_000);
    expect(limiter.allow("a", 1, 0)).toBe(true);
    expect(limiter.allow("a", 1, 1)).toBe(false);
    expect(limiter.allow("b", 1, 1)).toBe(true);
  });
});
