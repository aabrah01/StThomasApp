/**
 * Simple in-memory rate limiter.
 * NOTE: This works for a single-instance deployment (local, single Vercel region).
 * For multi-region production, replace with a Redis-backed solution.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key per client+action (e.g. IP + endpoint)
 * @param max      Max requests allowed in the window
 * @param windowMs Window size in milliseconds (default: 1 minute)
 */
export function checkRateLimit(key: string, max = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}

/** Extract a best-effort client IP from a Next.js request. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}
