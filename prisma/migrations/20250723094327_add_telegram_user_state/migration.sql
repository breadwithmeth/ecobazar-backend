/*
  Warnings:

  - You are about to drop the column `created_at` on the `TelegramUserState` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `TelegramUserState` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `TelegramUserState` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "TelegramUserState_expires_at_idx";

-- AlterTable
ALTER TABLE "TelegramUserState" DROP COLUMN "created_at",
DROP COLUMN "expires_at",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "TelegramUserState_expiresAt_idx" ON "TelegramUserState"("expiresAt");
