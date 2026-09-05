import { Category, ProductStatus } from '@prisma/client';

export const CATEGORY_VALUES = Object.values(Category) as [Category, ...Category[]];
export const STATUS_VALUES = Object.values(ProductStatus) as [ProductStatus, ...ProductStatus[]];

export const SORTABLE_FIELDS = ['purchaseDate', 'price', 'name'] as const;
export type SortableField = (typeof SORTABLE_FIELDS)[number];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

// Public-shape GET /products and GET /products/:id responses are cached
// for 60-120s. Owner (authenticated) responses are NEVER cached.
export const PUBLIC_LIST_CACHE_TTL_SECONDS = 90;
export const PUBLIC_DETAIL_CACHE_TTL_SECONDS = 90;

export const PRODUCT_CACHE_KEY_PREFIX = 'cache:products';
