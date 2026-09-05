import rateLimit, { Options, Store, IncrementResponse } from 'express-rate-limit';
import redisClient from '../lib/redis';

/**
 * A rate-limit store backed by Redis when available, so limits are shared
 * correctly across multiple horizontally-scaled app instances behind the
 * load balancer. Falls back to a per-process in-memory Map whenever Redis
 * is unavailable (startup not finished, connection dropped, etc.) — this
 * check happens per-request rather than once at boot, so the limiter keeps
 * working correctly through Redis outages and reconnects in either
 * direction without needing a restart.
 */
class ResilientRedisStore implements Store {
  windowMs = 15 * 60 * 1000;
  private keyPrefix: string;
  private memory = new Map<string, { count: number; resetAt: number }>();

  constructor(prefix: string) {
    this.keyPrefix = prefix;
  }

  private memoryIncrement(key: string): IncrementResponse {
    const now = Date.now();
    const existing = this.memory.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.memory.set(key, { count: 1, resetAt });
      return { totalHits: 1, resetTime: new Date(resetAt) };
    }
    existing.count += 1;
    return { totalHits: existing.count, resetTime: new Date(existing.resetAt) };
  }

  async increment(key: string): Promise<IncrementResponse> {
    if (!redisClient.isAvailable()) {
      return this.memoryIncrement(key);
    }
    try {
      const redisKey = `${this.keyPrefix}:${key}`;
      const client = redisClient.client!;
      const count = await client.incr(redisKey);
      if (count === 1) {
        await client.pexpire(redisKey, this.windowMs);
      }
      const ttl = await client.pttl(redisKey);
      return { totalHits: count, resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)) };
    } catch {
      return this.memoryIncrement(key);
    }
  }

  async decrement(key: string): Promise<void> {
    if (!redisClient.isAvailable()) {
      const existing = this.memory.get(key);
      if (existing) existing.count = Math.max(0, existing.count - 1);
      return;
    }
    try {
      await redisClient.client!.decr(`${this.keyPrefix}:${key}`);
    } catch {
      // ignore — best-effort only
    }
  }

  async resetKey(key: string): Promise<void> {
    this.memory.delete(key);
    if (redisClient.isAvailable()) {
      try {
        await redisClient.client!.del(`${this.keyPrefix}:${key}`);
      } catch {
        // ignore
      }
    }
  }

  init(options: Options): void {
    this.windowMs = options.windowMs ?? this.windowMs;
  }
}

const buildLimiter = (prefix: string, options: Partial<Options>) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    store: new ResilientRedisStore(prefix),
    ...options,
  });

// Generous limit for public GET /products traffic.
export const publicReadLimiter = buildLimiter('rl:public', {
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later.' },
});

// Strict limit to prevent brute-forcing the single owner login.
export const loginLimiter = buildLimiter('rl:login', {
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { success: false, statusCode: 429, message: 'Too many login attempts, please try again in 15 minutes.' },
});

// General-purpose global limiter for everything else (mutations, analytics).
export const globalLimiter = buildLimiter('rl:global', {
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: { success: false, statusCode: 429, message: 'Too many requests, please try again later.' },
});
