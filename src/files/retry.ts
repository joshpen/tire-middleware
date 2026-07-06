/**
 * Bounded retry with exponential backoff and a dead-letter list for file
 * ingestion. State is persisted in the endpoint's config jsonb (the gateway
 * owns no schema):
 *
 *   config.retry_state = { [fileKey]: { attempts, next_at, last_error } }
 *   config.dead_letter = [fileKey, ...]
 *
 * A file that fails is retried on subsequent polls with growing delays;
 * after max_retries it moves to dead_letter and is skipped until an operator
 * requeues it (POST /admin/requeue/:endpointId).
 */

export interface RetryEntry {
  attempts: number;
  /** ISO time before which the file is not retried. */
  next_at: string;
  last_error: string;
  /** Keeps the shape assignable to the Json config column type. */
  [key: string]: string | number;
}

export interface RetryPolicy {
  maxRetries: number;
  baseBackoffMinutes: number;
  maxBackoffMinutes: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 5,
  baseBackoffMinutes: 15,
  maxBackoffMinutes: 24 * 60,
};

export function policyFromConfig(config: Record<string, unknown>): RetryPolicy {
  const retry = (config.retry ?? {}) as Record<string, unknown>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  return {
    maxRetries: num(retry.max_retries, DEFAULT_RETRY_POLICY.maxRetries),
    baseBackoffMinutes: num(retry.base_backoff_minutes, DEFAULT_RETRY_POLICY.baseBackoffMinutes),
    maxBackoffMinutes: num(retry.max_backoff_minutes, DEFAULT_RETRY_POLICY.maxBackoffMinutes),
  };
}

export function backoffMinutes(attempts: number, policy: RetryPolicy): number {
  return Math.min(policy.baseBackoffMinutes * 2 ** Math.max(attempts - 1, 0), policy.maxBackoffMinutes);
}

export interface RetryState {
  retry_state: Record<string, RetryEntry>;
  dead_letter: string[];
}

export function readRetryState(config: Record<string, unknown>): RetryState {
  const rs = config.retry_state;
  const dl = config.dead_letter;
  return {
    retry_state:
      rs && typeof rs === "object" && !Array.isArray(rs) ? { ...(rs as Record<string, RetryEntry>) } : {},
    dead_letter: Array.isArray(dl) ? [...(dl as string[])] : [],
  };
}

/** Keys the poller must skip this cycle: dead-lettered or backing off. */
export function skippedKeys(state: RetryState, now = new Date()): Set<string> {
  const skip = new Set<string>(state.dead_letter);
  for (const [key, entry] of Object.entries(state.retry_state)) {
    if (new Date(entry.next_at) > now) skip.add(key);
  }
  return skip;
}

/**
 * Records a failure. Returns "retry" (scheduled again) or "dead_letter"
 * (attempts exhausted). Mutates the passed state.
 */
export function recordFailure(
  state: RetryState,
  key: string,
  error: string,
  policy: RetryPolicy,
  now = new Date(),
): "retry" | "dead_letter" {
  const attempts = (state.retry_state[key]?.attempts ?? 0) + 1;
  if (attempts >= policy.maxRetries) {
    delete state.retry_state[key];
    if (!state.dead_letter.includes(key)) state.dead_letter.push(key);
    return "dead_letter";
  }
  const nextAt = new Date(now.getTime() + backoffMinutes(attempts, policy) * 60_000);
  state.retry_state[key] = { attempts, next_at: nextAt.toISOString(), last_error: error.slice(0, 500) };
  return "retry";
}

/** Clears retry state after a successful ingest. Mutates the passed state. */
export function recordSuccess(state: RetryState, key: string): void {
  delete state.retry_state[key];
  state.dead_letter = state.dead_letter.filter((k) => k !== key);
}

/** Operator requeue: forget all failure state for a key. */
export function requeue(state: RetryState, key: string): boolean {
  const had = key in state.retry_state || state.dead_letter.includes(key);
  recordSuccess(state, key);
  return had;
}
