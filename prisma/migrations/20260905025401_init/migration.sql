-- CreateEnum
CREATE TYPE "Category" AS ENUM ('PHONE', 'LAPTOP', 'DESKTOP', 'MONITOR', 'HUB', 'CABLE', 'PENDRIVE', 'KEYBOARD', 'MOUSE', 'HEADPHONE', 'CHARGER', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'SOLD', 'GIFTED', 'BROKEN', 'LOST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "specs" JSONB NOT NULL DEFAULT '{}',
    "referenceImage" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchasedFrom" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "serialNumber" TEXT,
    "receiptImages" TEXT[],
    "notes" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[],
    "warrantyNotified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_purchaseDate_idx" ON "Product"("purchaseDate");

-- CreateIndex
CREATE INDEX "Product_warrantyExpiry_idx" ON "Product"("warrantyExpiry");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");
