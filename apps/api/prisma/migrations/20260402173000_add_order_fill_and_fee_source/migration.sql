-- CreateEnum
CREATE TYPE "FeeSource" AS ENUM ('ESTIMATED', 'EXCHANGE_FILL');

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN "feeSource" "FeeSource" NOT NULL DEFAULT 'ESTIMATED',
  ADD COLUMN "feePending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "feeCurrency" TEXT,
  ADD COLUMN "effectiveFeeRate" DOUBLE PRECISION,
  ADD COLUMN "exchangeTradeId" TEXT;

-- AlterTable
ALTER TABLE "Trade"
  ADD COLUMN "feeSource" "FeeSource" NOT NULL DEFAULT 'ESTIMATED',
  ADD COLUMN "feePending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "feeCurrency" TEXT,
  ADD COLUMN "effectiveFeeRate" DOUBLE PRECISION,
  ADD COLUMN "exchangeTradeId" TEXT;

-- CreateTable
CREATE TABLE "OrderFill" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "botId" TEXT,
  "strategyId" TEXT,
  "orderId" TEXT NOT NULL,
  "tradeId" TEXT,
  "positionId" TEXT,
  "symbol" TEXT NOT NULL,
  "side" "OrderSide" NOT NULL,
  "exchangeTradeId" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "notional" DOUBLE PRECISION NOT NULL,
  "feeCost" DOUBLE PRECISION,
  "feeCurrency" TEXT,
  "feeRate" DOUBLE PRECISION,
  "executedAt" TIMESTAMP(3) NOT NULL,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrderFill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_exchangeOrderId_idx" ON "Order"("exchangeOrderId");

-- CreateIndex
CREATE INDEX "Order_exchangeTradeId_idx" ON "Order"("exchangeTradeId");

-- CreateIndex
CREATE INDEX "Order_feeSource_feePending_idx" ON "Order"("feeSource", "feePending");

-- CreateIndex
CREATE INDEX "Trade_exchangeTradeId_idx" ON "Trade"("exchangeTradeId");

-- CreateIndex
CREATE INDEX "Trade_feeSource_feePending_idx" ON "Trade"("feeSource", "feePending");

-- CreateIndex
CREATE INDEX "OrderFill_userId_idx" ON "OrderFill"("userId");

-- CreateIndex
CREATE INDEX "OrderFill_botId_idx" ON "OrderFill"("botId");

-- CreateIndex
CREATE INDEX "OrderFill_strategyId_idx" ON "OrderFill"("strategyId");

-- CreateIndex
CREATE INDEX "OrderFill_orderId_idx" ON "OrderFill"("orderId");

-- CreateIndex
CREATE INDEX "OrderFill_tradeId_idx" ON "OrderFill"("tradeId");

-- CreateIndex
CREATE INDEX "OrderFill_positionId_idx" ON "OrderFill"("positionId");

-- CreateIndex
CREATE INDEX "OrderFill_exchangeTradeId_idx" ON "OrderFill"("exchangeTradeId");

-- CreateIndex
CREATE INDEX "OrderFill_symbol_idx" ON "OrderFill"("symbol");

-- CreateIndex
CREATE INDEX "OrderFill_executedAt_idx" ON "OrderFill"("executedAt");

-- CreateIndex
CREATE INDEX "OrderFill_userId_executedAt_idx" ON "OrderFill"("userId", "executedAt");

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_botId_fkey"
  FOREIGN KEY ("botId") REFERENCES "Bot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_strategyId_fkey"
  FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_tradeId_fkey"
  FOREIGN KEY ("tradeId") REFERENCES "Trade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderFill"
  ADD CONSTRAINT "OrderFill_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "Position"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
