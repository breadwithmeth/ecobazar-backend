-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'WAITING_PAYMENT', 'ASSEMBLY', 'SHIPPING', 'DELIVERED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'NEW';
