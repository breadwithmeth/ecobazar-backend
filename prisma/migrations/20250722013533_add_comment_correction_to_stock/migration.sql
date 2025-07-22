-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'CORRECTION';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "comment" TEXT;
