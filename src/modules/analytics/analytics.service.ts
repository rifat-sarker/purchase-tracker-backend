import prisma from '../../lib/prisma';
import redisClient from '../../lib/redis';

const ANALYTICS_CACHE_PREFIX = 'cache:analytics';
const ANALYTICS_CACHE_TTL_SECONDS = 5 * 60; // 5 minutes

const withCache = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const cacheKey = `${ANALYTICS_CACHE_PREFIX}:${key}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached) as T;

  const result = await fetcher();
  await redisClient.set(cacheKey, JSON.stringify(result), ANALYTICS_CACHE_TTL_SECONDS);
  return result;
};

/**
 * Called by product.service.ts on every create/update/delete. Without
 * this, summary/by-category/by-month/upcoming-warranty stay stale for up
 * to the full 5-minute TTL after a mutation — e.g. the dashboard's "Items"
 * and "Total spend" stat cards would keep showing pre-delete numbers even
 * though the product list itself (which isn't cached for the owner)
 * already reflects the change, an inconsistency a user would (rightly)
 * read as a bug.
 */
const invalidateAnalyticsCache = async (): Promise<void> => {
  if (!redisClient.isAvailable()) return;
  try {
    const keys = await redisClient.client!.keys(`${ANALYTICS_CACHE_PREFIX}:*`);
    if (keys.length) await redisClient.client!.del(...keys);
  } catch {
    // best-effort — TTL will still expire the entries naturally
  }
};

const getSummary = () =>
  withCache('summary', async () => {
    const result = await prisma.product.aggregate({
      _sum: { price: true },
      _count: { _all: true },
      _avg: { price: true },
    });

    return {
      totalSpend: result._sum.price ?? 0,
      totalItems: result._count._all,
      averagePrice: result._avg.price ?? 0,
    };
  });

const getByCategory = () =>
  withCache('by-category', async () => {
    const grouped = await prisma.product.groupBy({
      by: ['category'],
      _sum: { price: true },
      _count: { _all: true },
      orderBy: { category: 'asc' },
    });

    return grouped.map((g) => ({
      category: g.category,
      totalSpend: g._sum.price ?? 0,
      count: g._count._all,
    }));
  });

interface MonthlySpendRow {
  month: Date;
  total_spend: number | string;
  item_count: bigint | number;
}

const getByMonth = () =>
  withCache('by-month', async () => {
    // Prisma's groupBy can't truncate dates, so this uses a raw query with
    // DATE_TRUNC('month', "purchaseDate") to bucket spend by calendar month.
    const rows = await prisma.$queryRaw<MonthlySpendRow[]>`
      SELECT DATE_TRUNC('month', "purchaseDate") AS month,
             SUM(price) AS total_spend,
             COUNT(*) AS item_count
      FROM "Product"
      GROUP BY month
      ORDER BY month ASC
    `;

    return rows.map((row) => ({
      month: row.month.toISOString().slice(0, 7), // "YYYY-MM"
      totalSpend: Number(row.total_spend),
      count: Number(row.item_count),
    }));
  });

const getUpcomingWarranty = () =>
  withCache('upcoming-warranty', async () => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: { warrantyExpiry: { gte: now, lte: in30Days } },
      orderBy: { warrantyExpiry: 'asc' },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      warrantyExpiry: p.warrantyExpiry,
      warrantyNotified: p.warrantyNotified,
    }));
  });

export default { getSummary, getByCategory, getByMonth, getUpcomingWarranty, invalidateAnalyticsCache };
