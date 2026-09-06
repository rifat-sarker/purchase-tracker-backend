import { format } from 'fast-csv';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import storageAdapter from '../../storage';
import productService, { CreateProductInput, GetProductsQuery, UpdateProductInput } from './product.service';

const isOwnerReq = (req: import('express').Request): boolean => !!req.user;

// Prefixes a leading =, +, -, or @ with a tab so spreadsheet apps (Excel,
// Sheets) never interpret an exported field as a formula. Defense in depth
// for CSV formula injection — low real-world exposure here since only the
// owner's own product data ever flows into this export, but free to do.
const csvSafe = (value: string): string => (/^[=+\-@]/.test(value) ? `\t${value}` : value);

const getProducts = catchAsync(async (req, res) => {
  const isOwner = isOwnerReq(req);
  const result = await productService.getProducts(req.query as unknown as GetProductsQuery, isOwner);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Products retrieved successfully',
    meta: result.meta,
    data: result.data,
  });
});

const getProductById = catchAsync(async (req, res) => {
  const isOwner = isOwnerReq(req);
  const product = await productService.getProductById(req.params.id, isOwner);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Product retrieved successfully',
    data: product,
  });
});

const createProduct = catchAsync(async (req, res) => {
  const files = req.files as { referenceImage?: Express.Multer.File[]; receiptImages?: Express.Multer.File[] } | undefined;

  let referenceImageUrl: string | null | undefined = req.body.referenceImage ?? null;
  if (files?.referenceImage?.[0]) {
    const uploaded = await storageAdapter.upload(files.referenceImage[0], 'reference-images');
    referenceImageUrl = uploaded.url;
  }

  let receiptImageUrls: string[] = [];
  if (files?.receiptImages?.length) {
    const uploaded = await Promise.all(files.receiptImages.map((file) => storageAdapter.upload(file, 'receipts')));
    receiptImageUrls = uploaded.map((u) => u.url);
  }

  const payload: CreateProductInput = {
    ...req.body,
    referenceImage: referenceImageUrl,
    receiptImages: receiptImageUrls,
  };

  const product = await productService.createProduct(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'Product created successfully',
    data: product,
  });
});

const updateProduct = catchAsync(async (req, res) => {
  const files = req.files as { referenceImage?: Express.Multer.File[]; receiptImages?: Express.Multer.File[] } | undefined;

  const payload: UpdateProductInput = { ...req.body };

  if (files?.referenceImage?.[0]) {
    const uploaded = await storageAdapter.upload(files.referenceImage[0], 'reference-images');
    payload.referenceImage = uploaded.url;
  }

  if (files?.receiptImages?.length) {
    const uploaded = await Promise.all(files.receiptImages.map((file) => storageAdapter.upload(file, 'receipts')));
    payload.receiptImages = uploaded.map((u) => u.url);
  }

  const product = await productService.updateProduct(req.params.id, payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Product updated successfully',
    data: product,
  });
});

const deleteProduct = catchAsync(async (req, res) => {
  const hard = req.query.hard === 'true';
  await productService.deleteProduct(req.params.id, hard);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: hard ? 'Product permanently deleted' : 'Product soft-deleted successfully',
    data: null,
  });
});

const CSV_HEADERS = [
  'id',
  'name',
  'category',
  'brand',
  'model',
  'price',
  'currency',
  'purchaseDate',
  'purchasedFrom',
  'warrantyExpiry',
  'serialNumber',
  'status',
  'tags',
  'notes',
  'receiptImages',
  'createdAt',
] as const;

/**
 * Streams the owner's full purchase history as CSV using fast-csv, piping
 * rows from an async generator over Prisma cursor pages straight to the
 * response — the whole CSV is never built as one in-memory string.
 */
const exportCsv = catchAsync(async (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="gadget-purchases.csv"');

  const csvStream = format({ headers: [...CSV_HEADERS] });
  csvStream.pipe(res);

  for await (const product of productService.streamAllForExport()) {
    csvStream.write({
      id: product.id,
      name: csvSafe(product.name),
      category: product.category,
      brand: csvSafe(product.brand ?? ''),
      model: csvSafe(product.model ?? ''),
      price: product.price,
      currency: product.currency,
      purchaseDate: product.purchaseDate.toISOString().slice(0, 10),
      purchasedFrom: csvSafe(product.purchasedFrom ?? ''),
      warrantyExpiry: product.warrantyExpiry ? product.warrantyExpiry.toISOString().slice(0, 10) : '',
      serialNumber: csvSafe(product.serialNumber ?? ''),
      status: product.status,
      tags: product.tags.join('|'),
      notes: csvSafe((product.notes ?? '').replace(/\n/g, ' ')),
      receiptImages: product.receiptImages.join('|'),
      createdAt: product.createdAt.toISOString(),
    });
  }

  csvStream.end();
});

export default { getProducts, getProductById, createProduct, updateProduct, deleteProduct, exportCsv };
