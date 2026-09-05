import type { Product } from '@prisma/client';

export interface ProductPublicDTO {
  id: string;
  name: string;
  category: Product['category'];
  brand: string | null;
  model: string | null;
  specs: Product['specs'];
  referenceImage: string | null;
  tags: string[];
  status: Product['status'];
  ownedSinceYear: number;
}

export interface ProductOwnerDTO extends ProductPublicDTO {
  price: number;
  currency: string;
  purchaseDate: Date;
  purchasedFrom: string | null;
  warrantyExpiry: Date | null;
  serialNumber: string | null;
  receiptImages: string[];
  notes: string | null;
}

/**
 * Single source of truth for field visibility (spec §5.1 / §6). Every
 * service method that returns product(s) maps through this before calling
 * sendResponse. Public visitors get the sanitized shape; the authenticated
 * owner gets everything, including sensitive purchase/financial fields.
 */
export function toProductDTO(product: Product, isOwner: boolean): ProductPublicDTO | ProductOwnerDTO {
  const publicShape: ProductPublicDTO = {
    id: product.id,
    name: product.name,
    category: product.category,
    brand: product.brand,
    model: product.model,
    specs: product.specs,
    referenceImage: product.referenceImage,
    tags: product.tags,
    status: product.status,
    ownedSinceYear: product.purchaseDate.getFullYear(),
  };

  if (!isOwner) return publicShape;

  return {
    ...publicShape,
    price: product.price,
    currency: product.currency,
    purchaseDate: product.purchaseDate,
    purchasedFrom: product.purchasedFrom,
    warrantyExpiry: product.warrantyExpiry,
    serialNumber: product.serialNumber,
    receiptImages: product.receiptImages,
    notes: product.notes,
  };
}
