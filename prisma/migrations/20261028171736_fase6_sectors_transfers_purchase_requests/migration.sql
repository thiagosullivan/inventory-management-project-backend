/*
  Warnings:

  - You are about to drop the column `resolvedBy` on the `StockAlert` table. All the data in the column will be lost.
  - Made the column `sectorId` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDENTE', 'CONCLUIDO', 'CANCELADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDENTE', 'EM_ATENDIMENTO', 'ATENDIDO', 'RECUSADO', 'CANCELADO');

-- DropForeignKey
ALTER TABLE "StockAlert" DROP CONSTRAINT "StockAlert_productId_fkey";

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "transferId" TEXT;

-- AlterTable
ALTER TABLE "StockAlert" DROP COLUMN "resolvedBy",
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "sectorId" SET NOT NULL;

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "fromSectorId" TEXT NOT NULL,
    "toSectorId" TEXT NOT NULL,
    "purchaseRequestId" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDENTE',
    "reason" TEXT,
    "cancelReason" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "refusedById" TEXT,
    "cancelledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "TransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequest" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "notes" TEXT,
    "refusalReason" TEXT,
    "finalizeNote" TEXT,
    "createdById" TEXT NOT NULL,
    "finalizedById" TEXT,
    "refusedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "refusedAt" TIMESTAMP(3),

    CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sector_name_key" ON "Sector"("name");

-- CreateIndex
CREATE INDEX "Sector_isWarehouse_idx" ON "Sector"("isWarehouse");

-- CreateIndex
CREATE INDEX "Transfer_fromSectorId_idx" ON "Transfer"("fromSectorId");

-- CreateIndex
CREATE INDEX "Transfer_toSectorId_idx" ON "Transfer"("toSectorId");

-- CreateIndex
CREATE INDEX "Transfer_purchaseRequestId_idx" ON "Transfer"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");

-- CreateIndex
CREATE INDEX "TransferItem_transferId_idx" ON "TransferItem"("transferId");

-- CreateIndex
CREATE INDEX "TransferItem_productId_idx" ON "TransferItem"("productId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_sectorId_idx" ON "PurchaseRequest"("sectorId");

-- CreateIndex
CREATE INDEX "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

-- CreateIndex
CREATE INDEX "PurchaseRequest_createdAt_idx" ON "PurchaseRequest"("createdAt");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_requestId_idx" ON "PurchaseRequestItem"("requestId");

-- CreateIndex
CREATE INDEX "PurchaseRequestItem_productId_idx" ON "PurchaseRequestItem"("productId");

-- CreateIndex
CREATE INDEX "CustomCategory_createdById_idx" ON "CustomCategory"("createdById");

-- CreateIndex
CREATE INDEX "Movement_transferId_idx" ON "Movement"("transferId");

-- CreateIndex
CREATE INDEX "User_sectorId_idx" ON "User"("sectorId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromSectorId_fkey" FOREIGN KEY ("fromSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toSectorId_fkey" FOREIGN KEY ("toSectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_fromSectorId_fkey" FOREIGN KEY ("fromSectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toSectorId_fkey" FOREIGN KEY ("toSectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_refusedById_fkey" FOREIGN KEY ("refusedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferItem" ADD CONSTRAINT "TransferItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequest" ADD CONSTRAINT "PurchaseRequest_refusedById_fkey" FOREIGN KEY ("refusedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
