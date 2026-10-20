/*
  Warnings:

  - A unique constraint covering the columns `[prefix]` on the table `CustomCategory` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `prefix` to the `CustomCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomCategory" ADD COLUMN     "prefix" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CategoryCounter" (
    "categoryId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCounter_pkey" PRIMARY KEY ("categoryId")
);

-- CreateTable
CREATE TABLE "ProductCounter" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastNumber" INTEGER NOT NULL DEFAULT 1000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customcategory_prefix_key" ON "CustomCategory"("prefix");

-- AddForeignKey
ALTER TABLE "CategoryCounter" ADD CONSTRAINT "CategoryCounter_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CustomCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
