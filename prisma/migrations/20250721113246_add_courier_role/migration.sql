-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'COURIER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierId" INTEGER;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
