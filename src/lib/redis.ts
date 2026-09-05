import Redis from 'ioredis';
import config from '../config';
import logger from '../utils/logger';

/**
 * Resilient Redis wrapper.
 *
 * If REDIS_URL is unset, or the connection fails/drops, the app must still
 * start and function correctly — caching and the rate-limit store just
 * silently fall back to no-op / in-memory behavior. Every call is wrapped
 * in try/catch so a Redis outage never crashes the process or a request.
 */
class RedisClient {
  public client: Redis | null = null;
  private available = false;

  constructor() {
    if (!config.redisUrl) {
      logger.warn('REDIS_URL not set — caching and shared rate-limit store disabled (falling back to no-op/in-memory).');
      return;
    }

    try {
      this.client = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
        lazyConnect: false,
      });

      this.client.on('connect', () => {
        this.available = true;
        logger.info('Redis connected');
      });

      this.client.on('error', (err) => {
        this.available = false;
        logger.warn(`Redis error (falling back to no-op): ${err.message}`);
      });
    } catch (err) {
      logger.warn(`Failed to initialize Redis client: ${(err as Error).message}`);
      this.client = null;
    }
  }

  isAvailable(): boolean {
    return this.available && !!this.client;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch (err) {
      logger.warn(`Redis GET failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      if (ttlSeconds) {
        await this.client!.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client!.set(key, value);
      }
    } catch (err) {
      logger.warn(`Redis SET failed: ${(err as Error).message}`);
    }
  }

  async del(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.del(pattern);
    } catch (err) {
      logger.warn(`Redis DEL failed: ${(err as Error).message}`);
    }
  }

  async ping(timeoutMs = 1000): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await Promise.race([
        this.client.ping(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

const redisClient = new RedisClient();

export default redisClient;
