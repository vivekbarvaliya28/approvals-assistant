/** The limit: how many requests are allowed in one time window. */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/** The answer: allowed or not, and how long to wait if not. */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Request count for one user in the current time window.
interface Window {
  count: number;
  resetAt: number;
}

// Stored globally so the counts are not lost when Next.js reloads in dev mode.
const globalStore = globalThis as typeof globalThis & { __rateLimitWindows?: Map<string, Window> };
const windows = (globalStore.__rateLimitWindows ??= new Map<string, Window>());

/**
 * Counts requests per key in a fixed time window (kept in memory).
 * Fine for one server. Many servers would need a shared store like Redis.
 */
export function checkRateLimit(
  key: string,
  { maxRequests, windowMs }: RateLimitConfig,
  now: number = Date.now(),
): RateLimitResult {
  pruneExpired(now);

  const current = windows.get(key);
  // First request, or the old window ended: start a new window.
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Too many requests: tell the caller how long to wait.
  if (current.count >= maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Clears all counters. Used in tests. */
export function resetRateLimits(): void {
  windows.clear();
}

// Removes windows that have already ended, to save memory.
function pruneExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}
