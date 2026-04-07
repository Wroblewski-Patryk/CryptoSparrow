-- CreateEnum
CREATE TYPE "WalletAllocationMode" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "BotMode" NOT NULL,
    "exchange" "Exchange" NOT NULL DEFAULT 'BINANCE',
    "marketType" "TradeMarket" NOT NULL DEFAULT 'FUTURES',
    "baseCurrency" TEXT NOT NULL DEFAULT 'USDT',
    "paperInitialBalance" DOUBLE PRECISION NOT NULL DEFAULT 10000,
    "liveAllocationMode" "WalletAllocationMode",
    "liveAllocationValue" DOUBLE PRECISION,
    "apiKeyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Bot" ADD COLUMN "walletId" TEXT;
ALTER TABLE "Position" ADD COLUMN "walletId" TEXT;
ALTER TABLE "Order" ADD COLUMN "walletId" TEXT;
ALTER TABLE "Trade" ADD COLUMN "walletId" TEXT;

-- Backfill wallet per existing bot (compatibility-safe)
INSERT INTO "Wallet" (
    "id",
    "userId",
    "name",
    "mode",
    "exchange",
    "marketType",
    "baseCurrency",
    "paperInitialBalance",
    "liveAllocationMode",
    "liveAllocationValue",
    "apiKeyId",
    "createdAt",
    "updatedAt"
)
SELECT
    ('wallet-' || b."id") AS "id",
    b."userId",
    (b."name" || ' Wallet') AS "name",
    b."mode",
    b."exchange",
    b."marketType",
    'USDT' AS "baseCurrency",
    COALESCE(b."paperStartBalance", 10000) AS "paperInitialBalance",
    CASE WHEN b."mode" = 'LIVE' THEN 'PERCENT'::"WalletAllocationMode" ELSE NULL END AS "liveAllocationMode",
    CASE WHEN b."mode" = 'LIVE' THEN 100 ELSE NULL END AS "liveAllocationValue",
    b."apiKeyId",
    b."createdAt",
    b."updatedAt"
FROM "Bot" b
LEFT JOIN "Wallet" w ON w."id" = ('wallet-' || b."id")
WHERE w."id" IS NULL;

UPDATE "Bot" b
SET "walletId" = ('wallet-' || b."id")
WHERE b."walletId" IS NULL;

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");
CREATE INDEX "Wallet_apiKeyId_idx" ON "Wallet"("apiKeyId");
CREATE INDEX "Wallet_userId_exchange_marketType_baseCurrency_idx" ON "Wallet"("userId", "exchange", "marketType", "baseCurrency");

CREATE INDEX "Bot_walletId_idx" ON "Bot"("walletId");
CREATE INDEX "Position_walletId_idx" ON "Position"("walletId");
CREATE INDEX "Order_walletId_idx" ON "Order"("walletId");
CREATE INDEX "Trade_walletId_idx" ON "Trade"("walletId");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Bot" ADD CONSTRAINT "Bot_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
