-- AlterTable
ALTER TABLE "Bot"
  ADD COLUMN "exchange" "Exchange" NOT NULL DEFAULT 'BINANCE',
  ADD COLUMN "apiKeyId" TEXT;

-- CreateIndex
CREATE INDEX "Bot_apiKeyId_idx" ON "Bot"("apiKeyId");

-- CreateIndex
CREATE INDEX "Bot_userId_exchange_idx" ON "Bot"("userId", "exchange");

-- AddForeignKey
ALTER TABLE "Bot"
  ADD CONSTRAINT "Bot_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
