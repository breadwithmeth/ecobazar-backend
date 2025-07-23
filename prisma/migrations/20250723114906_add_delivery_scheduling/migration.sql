-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('ASAP', 'SCHEDULED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryType" "DeliveryType" NOT NULL DEFAULT 'ASAP',
ADD COLUMN     "scheduledDate" TIMESTAMP(3);
