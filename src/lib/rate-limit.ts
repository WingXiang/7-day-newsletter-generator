import { Redis } from "@upstash/redis";

/** How many full batches (7-email generation) per IP per day. */
export const BATCH_DAILY_LIMIT = 5;
/** How many single-email regenerations per IP per day. */
export const SINGLE_DAILY_LIMIT = 5;
/** How long a batchId stays valid for follow-up calls (10 minutes). */
const BATCH_CLAIM_TTL_SECONDS = 10 * 60;

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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Compute seconds until next midnight in Taipei time.
 */
function secondsUntilTaipeiMidnight(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);

  const elapsed = h * 3600 + m * 60 + s;
  return Math.max(24 * 3600 - elapsed, 60);
}

function buildResetsAt(now: Date = new Date()): string {
  return new Date(now.getTime() + secondsUntilTaipeiMidnight(now) * 1000).toISOString();
}

export interface RateLimitStatus {
  batch: { used: number; limit: number; remaining: number };
  single: { used: number; limit: number; remaining: number };
  resetsAt: string;
  enabled: boolean;
}

const defaultStatus = (now: Date, enabled: boolean): RateLimitStatus => ({
  batch: { used: 0, limit: BATCH_DAILY_LIMIT, remaining: BATCH_DAILY_LIMIT },
  single: { used: 0, limit: SINGLE_DAILY_LIMIT, remaining: SINGLE_DAILY_LIMIT },
  resetsAt: buildResetsAt(now),
  enabled,
});

/**
 * Check current usage WITHOUT incrementing. Used by status endpoint.
 */
export async function getStatus(ip: string): Promise<RateLimitStatus> {
  const now = new Date();
  const redis = getRedis();
  if (!redis) return defaultStatus(now, false);

  const date = getTaipeiDateKey(now);
  const batchKey = `rl:batch:${date}:${ip}`;
  const singleKey = `rl:single:${date}:${ip}`;

  try {
    const [batchUsed, singleUsed] = await Promise.all([
      redis.get<number>(batchKey),
      redis.get<number>(singleKey),
    ]);
    const bu = (batchUsed ?? 0) | 0;
    const su = (singleUsed ?? 0) | 0;
    return {
      batch: {
        used: bu,
        limit: BATCH_DAILY_LIMIT,
        remaining: Math.max(0, BATCH_DAILY_LIMIT - bu),
      },
      single: {
        used: su,
        limit: SINGLE_DAILY_LIMIT,
        remaining: Math.max(0, SINGLE_DAILY_LIMIT - su),
      },
      resetsAt: buildResetsAt(now),
      enabled: true,
    };
  } catch (err) {
    console.error("[rate-limit] Redis get failed, fail-open:", err);
    return defaultStatus(now, false);
  }
}

export interface CheckResult extends RateLimitStatus {
  allowed: boolean;
  /** Which counter triggered a block, if any */
  blockedBy?: "batch" | "single";
}

/**
 * Authorise a batch operation. Same batchId can be called up to 7 times
 * (once per email in the batch) within BATCH_CLAIM_TTL_SECONDS without
 * counting more than once.
 */
export async function checkBatchAndIncrement(
  ip: string,
  batchId: string,
): Promise<CheckResult> {
  const now = new Date();
  const redis = getRedis();
  if (!redis) return { ...defaultStatus(now, false), allowed: true };

  const date = getTaipeiDateKey(now);
  const batchKey = `rl:batch:${date}:${ip}`;
  const singleKey = `rl:single:${date}:${ip}`;
  const claimKey = `rl:batchclaim:${ip}:${batchId}`;

  try {
    // Try to claim this batchId. NX = only set if not exists.
    // Returns "OK" if newly claimed, null if it already existed.
    const claimed = await redis.set(claimKey, "1", {
      nx: true,
      ex: BATCH_CLAIM_TTL_SECONDS,
    });

    if (claimed === "OK") {
      // First call of this batch → check quota and increment
      const used = await redis.incr(batchKey);
      if (used === 1) {
        await redis.expire(batchKey, secondsUntilTaipeiMidnight(now));
      }

      const singleUsed = ((await redis.get<number>(singleKey)) ?? 0) | 0;

      if (used > BATCH_DAILY_LIMIT) {
        // Rollback the increment AND release the claim so user can retry tomorrow
        await Promise.all([redis.decr(batchKey), redis.del(claimKey)]);
        return {
          allowed: false,
          blockedBy: "batch",
          batch: { used: BATCH_DAILY_LIMIT, limit: BATCH_DAILY_LIMIT, remaining: 0 },
          single: {
            used: singleUsed,
            limit: SINGLE_DAILY_LIMIT,
            remaining: Math.max(0, SINGLE_DAILY_LIMIT - singleUsed),
          },
          resetsAt: buildResetsAt(now),
          enabled: true,
        };
      }

      return {
        allowed: true,
        batch: {
          used,
          limit: BATCH_DAILY_LIMIT,
          remaining: Math.max(0, BATCH_DAILY_LIMIT - used),
        },
        single: {
          used: singleUsed,
          limit: SINGLE_DAILY_LIMIT,
          remaining: Math.max(0, SINGLE_DAILY_LIMIT - singleUsed),
        },
        resetsAt: buildResetsAt(now),
        enabled: true,
      };
    }

    // Already-claimed batch → don't increment, just return current state
    const [batchUsed, singleUsed] = await Promise.all([
      redis.get<number>(batchKey),
      redis.get<number>(singleKey),
    ]);
    const bu = (batchUsed ?? 0) | 0;
    const su = (singleUsed ?? 0) | 0;
    return {
      allowed: true,
      batch: { used: bu, limit: BATCH_DAILY_LIMIT, remaining: Math.max(0, BATCH_DAILY_LIMIT - bu) },
      single: { used: su, limit: SINGLE_DAILY_LIMIT, remaining: Math.max(0, SINGLE_DAILY_LIMIT - su) },
      resetsAt: buildResetsAt(now),
      enabled: true,
    };
  } catch (err) {
    console.error("[rate-limit] Batch check failed, fail-open:", err);
    return { ...defaultStatus(now, false), allowed: true };
  }
}

/**
 * Authorise a single-email regeneration.
 */
export async function checkSingleAndIncrement(ip: string): Promise<CheckResult> {
  const now = new Date();
  const redis = getRedis();
  if (!redis) return { ...defaultStatus(now, false), allowed: true };

  const date = getTaipeiDateKey(now);
  const batchKey = `rl:batch:${date}:${ip}`;
  const singleKey = `rl:single:${date}:${ip}`;

  try {
    const used = await redis.incr(singleKey);
    if (used === 1) {
      await redis.expire(singleKey, secondsUntilTaipeiMidnight(now));
    }

    const batchUsed = ((await redis.get<number>(batchKey)) ?? 0) | 0;

    if (used > SINGLE_DAILY_LIMIT) {
      await redis.decr(singleKey);
      return {
        allowed: false,
        blockedBy: "single",
        batch: {
          used: batchUsed,
          limit: BATCH_DAILY_LIMIT,
          remaining: Math.max(0, BATCH_DAILY_LIMIT - batchUsed),
        },
        single: { used: SINGLE_DAILY_LIMIT, limit: SINGLE_DAILY_LIMIT, remaining: 0 },
        resetsAt: buildResetsAt(now),
        enabled: true,
      };
    }

    return {
      allowed: true,
      batch: {
        used: batchUsed,
        limit: BATCH_DAILY_LIMIT,
        remaining: Math.max(0, BATCH_DAILY_LIMIT - batchUsed),
      },
      single: {
        used,
        limit: SINGLE_DAILY_LIMIT,
        remaining: Math.max(0, SINGLE_DAILY_LIMIT - used),
      },
      resetsAt: buildResetsAt(now),
      enabled: true,
    };
  } catch (err) {
    console.error("[rate-limit] Single check failed, fail-open:", err);
    return { ...defaultStatus(now, false), allowed: true };
  }
}

/**
 * Extract client IP from request headers (Vercel sets x-forwarded-for).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
