import { Router } from 'express';
import httpStatus from 'http-status';
import prisma from '../../lib/prisma';
import redisClient from '../../lib/redis';

const router = Router();

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
};

/**
 * GET /health — no auth. Pings both Postgres (SELECT 1 via Prisma) and
 * Redis (PING via ioredis) with short timeouts, and returns 503 if either
 * is down. This is exactly what a load balancer / orchestrator (Docker
 * healthcheck, Nginx upstream awareness, an ALB target group, etc.) would
 * probe to decide whether to keep routing traffic to this instance.
 */
router.get('/', async (_req, res) => {
  let dbOk = false;
  let redisOk = false;

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 1500);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  try {
    redisOk = redisClient.client ? await redisClient.ping(1000) : true; // no Redis configured = not a failure
  } catch {
    redisOk = false;
  }

  const healthy = dbOk && redisOk;

  res.status(healthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE).json({
    success: healthy,
    statusCode: healthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE,
    message: healthy ? 'OK' : 'Service degraded',
    data: {
      database: dbOk ? 'up' : 'down',
      redis: redisClient.client ? (redisOk ? 'up' : 'down') : 'not configured',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
