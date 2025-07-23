/*
  Warnings:

  - A unique constraint covering the columns `[ownerId]` on the table `Store` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "StoreConfirmationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PARTIAL', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SELLER';

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "ownerId" INTEGER;

-- CreateTable
CREATE TABLE "StoreOrderConfirmation" (
    "id" SERIAL NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "storeId" INTEGER NOT NULL,
    "status" "StoreConfirmationStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedQuantity" INTEGER,
    "notes" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreOrderConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreOrderConfirmation_orderItemId_key" ON "StoreOrderConfirmation"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Store_ownerId_key" ON "Store"("ownerId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderConfirmation" ADD CONSTRAINT "StoreOrderConfirmation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderConfirmation" ADD CONSTRAINT "StoreOrderConfirmation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreOrderConfirmation" ADD CONSTRAINT "StoreOrderConfirmation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
