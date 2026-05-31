/**
 * Lightweight in-memory rate limiter based on a sliding window.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 20 });
 *   const result = limiter.check(identifier);
 *   if (!result.allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface Window {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum requests allowed per window per identifier */
  max: number;
}

interface CheckResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const { windowMs, max } = options;
  const store = new Map<string, Window>();

  // Periodically prune expired windows to avoid memory growth
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, win] of store) {
      if (now > win.resetAt) store.delete(key);
    }
  }, windowMs);

  // Allow GC in test / serverless environments
  if (pruneInterval.unref) pruneInterval.unref();

  function check(identifier: string): CheckResult {
    const now = Date.now();
    let win = store.get(identifier);

    if (!win || now > win.resetAt) {
      win = { count: 1, resetAt: now + windowMs };
      store.set(identifier, win);
      return { allowed: true, remaining: max - 1, resetAt: win.resetAt };
    }

    win.count++;
    const allowed = win.count <= max;
    return { allowed, remaining: Math.max(0, max - win.count), resetAt: win.resetAt };
  }

  return { check };
}

// ── Shared limiters ────────────────────────────────────────────────────────────

/** Public chat endpoint: 30 messages per minute per IP */
export const chatLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

/** Knowledge upload endpoint: 10 uploads per minute per user */
export const knowledgeLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });

/** Invitation creation: 20 invites per hour per user */
export const inviteLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 20 });

/**
 * Extract the best available identifier from a Next.js request.
 * Prefers the real client IP from common reverse-proxy headers.
 */
export function getRequestIdentifier(request: Request): string {
  const headers = request instanceof Request ? request.headers : (request as any).headers;
  return (
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
