import { Server } from 'http';
import app from './app';
import config from './config';
import prisma from './lib/prisma';
import redisClient from './lib/redis';
import scheduleWarrantyCron from './modules/warranty/warranty.cron';
import logger from './utils/logger';

let server: Server;

async function main() {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error(`Failed to connect to the database: ${(err as Error).message}`);
    process.exit(1);
  }

  server = app.listen(config.port, () => {
    logger.info(`Gadget Purchase Tracker API listening on port ${config.port} [${config.env}]`);
  });

  // Only meaningful for a persistent process (VPS/PM2/Docker). On Vercel,
  // this file never runs at all — api/index.ts exports the app directly
  // and the warranty check runs via Vercel Cron hitting /warranty/run
  // instead (see vercel.json + warranty.route.ts).
  scheduleWarrantyCron();
}

/**
 * Graceful shutdown: stop accepting new connections, close the HTTP
 * server, disconnect Prisma and Redis, then exit — required so a load
 * balancer / orchestrator can drain in-flight connections cleanly during
 * a rolling restart or deploy.
 */
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} received — shutting down gracefully.`);

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit.');
    process.exit(1);
  }, 10000);

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    clearTimeout(forceExitTimer);
    try {
      await prisma.$disconnect();
      await redisClient.disconnect();
    } finally {
      logger.info('Shutdown complete.');
      process.exit(0);
    }
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

main();
