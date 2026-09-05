import { PrismaClient } from '@prisma/client';
import config from '../config';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Single Prisma Client singleton — never `new PrismaClient()` per request.
// Reused via globalThis in dev to survive tsx watch reloads without
// exhausting the Postgres connection pool.
const prisma =
  global.__prisma ??
  new PrismaClient({
    log: config.env === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.env !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
