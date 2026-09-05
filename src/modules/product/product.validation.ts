import { z } from 'zod';
import { CATEGORY_VALUES, MAX_LIMIT, SORTABLE_FIELDS, STATUS_VALUES } from './product.constant';

// Multipart form fields arrive as strings, so numeric/date/json fields are
// coerced. `.strict()` still rejects genuinely unknown field names.
const specsPreprocess = (val: unknown) => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
};

const tagsPreprocess = (val: unknown) => {
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // not JSON — treat as comma-separated
    }
    return val
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return val;
};

const baseProductFields = {
  name: z.string().min(1, 'Name is required'),
  category: z.enum(CATEGORY_VALUES, { errorMap: () => ({ message: 'Invalid category' }) }),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  specs: z.preprocess(specsPreprocess, z.record(z.string()).default({})),
  referenceImage: z.string().optional().nullable(),
  price: z.coerce.number().positive('Price must be a positive number'),
  currency: z.string().default('BDT'),
  purchaseDate: z.coerce.date({ errorMap: () => ({ message: 'A valid purchaseDate is required' }) }),
  purchasedFrom: z.string().optional().nullable(),
  warrantyExpiry: z.coerce.date().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(STATUS_VALUES).default('ACTIVE'),
  tags: z.preprocess(tagsPreprocess, z.array(z.string()).default([])),
};

const createProductSchema = z.object({
  body: z
    .object(baseProductFields)
    .strict()
    .refine((data) => !data.warrantyExpiry || data.warrantyExpiry >= data.purchaseDate, {
      message: 'warrantyExpiry must be on or after purchaseDate',
      path: ['warrantyExpiry'],
    }),
});

const updateProductSchema = z.object({
  body: z
    .object({
      name: baseProductFields.name.optional(),
      category: baseProductFields.category.optional(),
      brand: baseProductFields.brand,
      model: baseProductFields.model,
      specs: baseProductFields.specs.optional(),
      referenceImage: baseProductFields.referenceImage,
      price: baseProductFields.price.optional(),
      currency: baseProductFields.currency.optional(),
      purchaseDate: baseProductFields.purchaseDate.optional(),
      purchasedFrom: baseProductFields.purchasedFrom,
      warrantyExpiry: baseProductFields.warrantyExpiry,
      serialNumber: baseProductFields.serialNumber,
      notes: baseProductFields.notes,
      status: baseProductFields.status.optional(),
      tags: baseProductFields.tags.optional(),
    })
    .strict()
    .refine((data) => !data.warrantyExpiry || !data.purchaseDate || data.warrantyExpiry >= data.purchaseDate, {
      message: 'warrantyExpiry must be on or after purchaseDate',
      path: ['warrantyExpiry'],
    }),
});

const getProductsQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    category: z.enum(CATEGORY_VALUES).optional(),
    status: z.enum(STATUS_VALUES).optional(),
    tags: z.string().optional(),
    sortBy: z.enum(SORTABLE_FIELDS).default('purchaseDate'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(10),
  }),
});

export default { createProductSchema, updateProductSchema, getProductsQuerySchema };
