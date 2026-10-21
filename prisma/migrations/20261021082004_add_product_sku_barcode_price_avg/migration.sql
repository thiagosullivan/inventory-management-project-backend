/*
  Warnings:

  - A unique constraint covering the columns `[barcode]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `barcode` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Made the column `sku` on table `Product` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "fromSectorId" TEXT,
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "toSectorId" TEXT,
ADD COLUMN     "unitPriceInCents" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "avgPriceInCents" INTEGER,
ADD COLUMN     "barcode" TEXT NOT NULL,
ALTER COLUMN "sku" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sectorId" TEXT;

-- CreateIndex
CREATE INDEX "Movement_fromSectorId_idx" ON "Movement"("fromSectorId");

-- CreateIndex
CREATE INDEX "Movement_toSectorId_idx" ON "Movement"("toSectorId");

-- CreateIndex
CREATE UNIQUE INDEX "product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
