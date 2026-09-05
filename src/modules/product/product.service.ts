import { Category, Prisma, ProductStatus } from '@prisma/client';
import httpStatus from 'http-status';
import prisma from '../../lib/prisma';
import redisClient from '../../lib/redis';
import AppError from '../../utils/AppError';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  PRODUCT_CACHE_KEY_PREFIX,
  PUBLIC_DETAIL_CACHE_TTL_SECONDS,
  PUBLIC_LIST_CACHE_TTL_SECONDS,
  SortableField,
} from './product.constant';
import { toProductDTO } from './product.dto';
import analyticsService from '../analytics/analytics.service';

export interface GetProductsQuery {
  search?: string;
  category?: Category;
  status?: ProductStatus;
  tags?: string;
  sortBy?: SortableField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Invalidate all cached public product responses, AND the analytics cache
 * (spec §10.2 requires analytics invalidation on mutation too — summary/
 * by-category/by-month/upcoming-warranty all read from the same Product
 * table, so a stale analytics cache would show a different item count/
 * total spend than the product list right after a create/update/delete).
 * TTL-based expiry alone would also be acceptable per spec but an eager
 * wildcard flush keeps every screen consistent immediately after an edit
 * instead of for up to the full cache TTL window.
 */
const invalidateProductCache = async (): Promise<void> => {
  await analyticsService.invalidateAnalyticsCache();
  if (!redisClient.isAvailable()) return;
  try {
    const keys = await redisClient.client!.keys(`${PRODUCT_CACHE_KEY_PREFIX}:*`);
    if (keys.length) await redisClient.client!.del(...keys);
  } catch {
    // best-effort — TTL will still expire the entries naturally
  }
};

const buildWhere = (query: GetProductsQuery): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (query.category) where.category = query.category;
  if (query.status) where.status = query.status;

  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { brand: { contains: term, mode: 'insensitive' } },
      { model: { contains: term, mode: 'insensitive' } },
      { tags: { has: term } },
    ];
  }

  if (query.tags) {
    const tagList = query.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length) where.tags = { hasSome: tagList };
  }

  return where;
};

/**
 * GET /products — list with search/filter/sort/pagination.
 *
 * IMPORTANT: `sortBy` is applied at the Prisma query level using the real
 * `price`/`purchaseDate` columns regardless of whether the caller is
 * authenticated. This is intentional (spec §8.1): an unauthenticated
 * visitor can sort the public showcase by "recency" or implicit value
 * ordering even though those exact field values are stripped out of the
 * response by the DTO layer below. The DB always has the real values;
 * only the *serialized response* is sanitized for non-owners.
 */
const getProducts = async (query: GetProductsQuery, isOwner: boolean) => {
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  const sortBy = query.sortBy ?? 'purchaseDate';
  const sortOrder = query.sortOrder ?? 'desc';

  const cacheKey = `${PRODUCT_CACHE_KEY_PREFIX}:list:${JSON.stringify({ ...query, page, limit, sortBy, sortOrder })}`;

  // Only the public-shape response is ever cached — never the owner
  // (authenticated) response, to avoid accidentally serving sensitive
  // data from a shared cache key.
  if (!isOwner) {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const where = buildWhere(query);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  const result = {
    data: items.map((p) => toProductDTO(p, isOwner)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };

  if (!isOwner) {
    await redisClient.set(cacheKey, JSON.stringify(result), PUBLIC_LIST_CACHE_TTL_SECONDS);
  }

  return result;
};

const getProductById = async (id: string, isOwner: boolean) => {
  const cacheKey = `${PRODUCT_CACHE_KEY_PREFIX}:detail:${id}`;

  if (!isOwner) {
    const cached = await redisClient.get(cacheKey);
    if (cached) return JSON.parse(cached);
  }

  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const dto = toProductDTO(product, isOwner);

  if (!isOwner) {
    await redisClient.set(cacheKey, JSON.stringify(dto), PUBLIC_DETAIL_CACHE_TTL_SECONDS);
  }

  return dto;
};

export interface CreateProductInput {
  name: string;
  category: Category;
  brand?: string | null;
  model?: string | null;
  specs?: Record<string, string>;
  referenceImage?: string | null;
  price: number;
  currency?: string;
  purchaseDate: Date;
  purchasedFrom?: string | null;
  warrantyExpiry?: Date | null;
  serialNumber?: string | null;
  notes?: string | null;
  status?: ProductStatus;
  tags?: string[];
  receiptImages?: string[];
}

const createProduct = async (input: CreateProductInput) => {
  const product = await prisma.product.create({
    data: {
      name: input.name,
      category: input.category,
      brand: input.brand ?? null,
      model: input.model ?? null,
      specs: input.specs ?? {},
      referenceImage: input.referenceImage ?? null,
      price: input.price,
      currency: input.currency ?? 'BDT',
      purchaseDate: input.purchaseDate,
      purchasedFrom: input.purchasedFrom ?? null,
      warrantyExpiry: input.warrantyExpiry ?? null,
      serialNumber: input.serialNumber ?? null,
      notes: input.notes ?? null,
      status: input.status ?? 'ACTIVE',
      tags: input.tags ?? [],
      receiptImages: input.receiptImages ?? [],
    },
  });

  await invalidateProductCache();

  return toProductDTO(product, true);
};

export interface UpdateProductInput extends Partial<CreateProductInput> {}

const updateProduct = async (id: string, input: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  const data: Prisma.ProductUpdateInput = { ...input };

  // If warrantyExpiry changes, reset warrantyNotified so the cron job
  // sends a fresh reminder for the new date instead of staying silent.
  if (
    Object.prototype.hasOwnProperty.call(input, 'warrantyExpiry') &&
    existing.warrantyExpiry?.getTime() !== (input.warrantyExpiry ? input.warrantyExpiry.getTime() : null)
  ) {
    data.warrantyNotified = false;
  }

  const updated = await prisma.product.update({ where: { id }, data });

  await invalidateProductCache();

  return toProductDTO(updated, true);
};

const deleteProduct = async (id: string, hard: boolean) => {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, 'Product not found');
  }

  if (hard) {
    await prisma.product.delete({ where: { id } });
  } else {
    // Soft delete via status (spec §10.7) — preserves purchase
    // history/analytics accuracy. LOST is used as the generic
    // "removed from catalog" status for a plain DELETE call.
    await prisma.product.update({ where: { id }, data: { status: 'LOST' } });
  }

  await invalidateProductCache();
};

/**
 * Async generator that pages through ALL products (owner-only, full
 * fields) in fixed-size batches, so the CSV export controller can stream
 * rows to the response as they're read instead of loading — or
 * stringifying — the entire collection in memory at once.
 */
async function* streamAllForExport(batchSize = 200) {
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.product.findMany({
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;

    for (const product of batch) yield product;

    if (batch.length < batchSize) break;
    cursor = batch[batch.length - 1].id;
  }
}

export default {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  streamAllForExport,
  invalidateProductCache,
};
