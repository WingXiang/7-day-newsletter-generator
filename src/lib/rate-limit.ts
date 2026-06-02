import { Redis } from "@upstash/redis";

export const DAILY_LIMIT = 10;
const TIMEZONE = "Asia/Taipei";

let cachedRedis: Redis | null | undefined = undefined;

/**
 * Lazy-init Redis client. Returns null if env vars are missing
 * (e.g. in local dev), so we fail-open without breaking the app.
 */
function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.warn("[rate-limit] Upstash env vars not set — rate limiting disabled");
    cachedRedis = null;
    return null;
  }

  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

/**
 * Get today's date string in Taipei timezone (YYYY-MM-DD format).
 */
function getTaipeiDateKey(now: Date = new Date()): string {
  // en-CA format gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Compute seconds until next midnight in Taipei time.
 * Used as Redis key TTL so the counter auto-resets at 00:00 Taipei.
 */
function secondsUntilTaipeiMidnight(now: Date = new Date()): number {
  // Get current time components in Taipei
  const taipeiNow = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);

  const h = parseInt(taipeiNow.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(taipeiNow.find((p) => p.type === "minute")?.value ?? "0", 10);
  const s = parseInt(taipeiNow.find((p) => p.type === "second")?.value ?? "0", 10);

  const elapsedSeconds = h * 3600 + m * 60 + s;
  const remaining = 24 * 3600 - elapsedSeconds;
  // At least 60s to avoid TTL=0 edge cases
  return Math.max(remaining, 60);
}

export interface RateLimitStatus {
  /** How many generations have been used today */
  used: number;
  /** Daily limit (10) */
  limit: number;
  /** How many remaining today */
  remaining: number;
  /** ISO string of next Taipei midnight */
  resetsAt: string;
  /** Whether rate limiting is active. False if Redis isn't configured */
  enabled: boolean;
}

function buildResetsAt(now: Date = new Date()): string {
  const seconds = secondsUntilTaipeiMidnight(now);
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

/**
 * Check current usage WITHOUT incrementing. Used by status endpoint.
 */
export async function getStatus(ip: string): Promise<RateLimitStatus> {
  const now = new Date();
  const resetsAt = buildResetsAt(now);

  const redis = getRedis();
  if (!redis) {
    return { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT, resetsAt, enabled: false };
  }

  const key = `rl:${getTaipeiDateKey(now)}:${ip}`;
  try {
    const used = ((await redis.get<number>(key)) ?? 0) | 0;
    return {
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetsAt,
      enabled: true,
    };
  } catch (err) {
    console.error("[rate-limit] Redis get failed, fail-open:", err);
    return { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT, resetsAt, enabled: false };
  }
}

/**
 * Check limit and increment counter atomically.
 * Returns { allowed: true, ...status } if under limit (counter is incremented).
 * Returns { allowed: false, ...status } if over limit (counter NOT incremented further).
 */
export async function checkAndIncrement(
  ip: string,
): Promise<RateLimitStatus & { allowed: boolean }> {
  const now = new Date();
  const resetsAt = buildResetsAt(now);

  const redis = getRedis();
  if (!redis) {
    // Fail-open: no Redis configured → don't limit
    return {
      allowed: true,
      used: 0,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT,
      resetsAt,
      enabled: false,
    };
  }

  const key = `rl:${getTaipeiDateKey(now)}:${ip}`;

  try {
    // Atomic increment + set TTL on first hit
    const used = await redis.incr(key);
    if (used === 1) {
      await redis.expire(key, secondsUntilTaipeiMidnight(now));
    }

    if (used > DAILY_LIMIT) {
      // Roll back this increment so we don't keep counting past the limit
      // (Optional, but keeps the number meaningful for the user)
      await redis.decr(key);
      return {
        allowed: false,
        used: DAILY_LIMIT,
        limit: DAILY_LIMIT,
        remaining: 0,
        resetsAt,
        enabled: true,
      };
    }

    return {
      allowed: true,
      used,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      resetsAt,
      enabled: true,
    };
  } catch (err) {
    // Fail-open on Redis errors so the app stays usable
    console.error("[rate-limit] Redis incr failed, fail-open:", err);
    return {
      allowed: true,
      used: 0,
      limit: DAILY_LIMIT,
      remaining: DAILY_LIMIT,
      resetsAt,
      enabled: false,
    };
  }
}

/**
 * Extract client IP from request headers.
 * Vercel sets x-forwarded-for and x-real-ip.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the first IP (the original client)
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
