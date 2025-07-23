-- CreateTable
CREATE TABLE "TelegramUserState" (
    "id" SERIAL NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramUserState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TelegramUserState_telegram_user_id_key" ON "TelegramUserState"("telegram_user_id");

-- CreateIndex
CREATE INDEX "TelegramUserState_expires_at_idx" ON "TelegramUserState"("expires_at");
