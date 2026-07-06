import { describe, expect, it } from "vitest";
import {
  backoffMinutes,
  DEFAULT_RETRY_POLICY,
  policyFromConfig,
  readRetryState,
  recordFailure,
  recordSuccess,
  requeue,
  skippedKeys,
} from "../src/files/retry.js";

const now = new Date("2026-07-05T12:00:00Z");

describe("backoff", () => {
  it("doubles per attempt and caps at the max", () => {
    expect(backoffMinutes(1, DEFAULT_RETRY_POLICY)).toBe(15);
    expect(backoffMinutes(2, DEFAULT_RETRY_POLICY)).toBe(30);
    expect(backoffMinutes(3, DEFAULT_RETRY_POLICY)).toBe(60);
    expect(backoffMinutes(10, DEFAULT_RETRY_POLICY)).toBe(24 * 60);
  });
});

describe("policyFromConfig", () => {
  it("reads overrides from config.retry and falls back to defaults", () => {
    expect(policyFromConfig({ retry: { max_retries: 3, base_backoff_minutes: 5 } })).toEqual({
      maxRetries: 3,
      baseBackoffMinutes: 5,
      maxBackoffMinutes: 24 * 60,
    });
    expect(policyFromConfig({})).toEqual(DEFAULT_RETRY_POLICY);
  });
});

describe("retry lifecycle", () => {
  it("schedules retries with backoff, then dead-letters after max attempts", () => {
    const state = readRetryState({});
    const policy = { maxRetries: 3, baseBackoffMinutes: 15, maxBackoffMinutes: 1440 };

    expect(recordFailure(state, "bad.csv", "boom", policy, now)).toBe("retry");
    expect(state.retry_state["bad.csv"]).toMatchObject({ attempts: 1, last_error: "boom" });
    expect(new Date(state.retry_state["bad.csv"]!.next_at as string).getTime()).toBe(
      now.getTime() + 15 * 60_000,
    );

    expect(recordFailure(state, "bad.csv", "boom again", policy, now)).toBe("retry");
    expect(state.retry_state["bad.csv"]!.attempts).toBe(2);

    expect(recordFailure(state, "bad.csv", "boom 3", policy, now)).toBe("dead_letter");
    expect(state.retry_state["bad.csv"]).toBeUndefined();
    expect(state.dead_letter).toEqual(["bad.csv"]);
  });

  it("skips backing-off and dead-lettered keys, retries due ones", () => {
    const state = readRetryState({
      retry_state: {
        "due.csv": { attempts: 1, next_at: "2026-07-05T11:00:00Z", last_error: "x" },
        "waiting.csv": { attempts: 1, next_at: "2026-07-05T13:00:00Z", last_error: "x" },
      },
      dead_letter: ["dead.csv"],
    });
    const skip = skippedKeys(state, now);
    expect(skip.has("waiting.csv")).toBe(true);
    expect(skip.has("dead.csv")).toBe(true);
    expect(skip.has("due.csv")).toBe(false);
  });

  it("success and requeue clear failure state", () => {
    const state = readRetryState({
      retry_state: { "a.csv": { attempts: 2, next_at: "2026-07-05T13:00:00Z", last_error: "x" } },
      dead_letter: ["b.csv"],
    });
    recordSuccess(state, "a.csv");
    expect(state.retry_state).toEqual({});
    expect(requeue(state, "b.csv")).toBe(true);
    expect(state.dead_letter).toEqual([]);
    expect(requeue(state, "never-seen.csv")).toBe(false);
  });
});
