-- CreateEnum
CREATE TYPE "BotMarketGroupStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "BotMarketGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "symbolGroupId" TEXT NOT NULL,
    "lifecycleStatus" "BotMarketGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "executionOrder" INTEGER NOT NULL DEFAULT 100,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotMarketGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketGroupStrategyLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "botMarketGroupId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketGroupStrategyLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotMarketGroup_botId_symbolGroupId_key" ON "BotMarketGroup"("botId", "symbolGroupId");

-- CreateIndex
CREATE INDEX "BotMarketGroup_userId_idx" ON "BotMarketGroup"("userId");

-- CreateIndex
CREATE INDEX "BotMarketGroup_botId_idx" ON "BotMarketGroup"("botId");

-- CreateIndex
CREATE INDEX "BotMarketGroup_symbolGroupId_idx" ON "BotMarketGroup"("symbolGroupId");

-- CreateIndex
CREATE INDEX "BotMarketGroup_botId_lifecycleStatus_executionOrder_idx" ON "BotMarketGroup"("botId", "lifecycleStatus", "executionOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MarketGroupStrategyLink_botMarketGroupId_strategyId_key" ON "MarketGroupStrategyLink"("botMarketGroupId", "strategyId");

-- CreateIndex
CREATE INDEX "MarketGroupStrategyLink_userId_idx" ON "MarketGroupStrategyLink"("userId");

-- CreateIndex
CREATE INDEX "MarketGroupStrategyLink_botId_idx" ON "MarketGroupStrategyLink"("botId");

-- CreateIndex
CREATE INDEX "MarketGroupStrategyLink_botMarketGroupId_idx" ON "MarketGroupStrategyLink"("botMarketGroupId");

-- CreateIndex
CREATE INDEX "MarketGroupStrategyLink_strategyId_idx" ON "MarketGroupStrategyLink"("strategyId");

-- CreateIndex
CREATE INDEX "MarketGroupStrategyLink_botMarketGroupId_isEnabled_priority_idx" ON "MarketGroupStrategyLink"("botMarketGroupId", "isEnabled", "priority");

-- AddForeignKey
ALTER TABLE "BotMarketGroup" ADD CONSTRAINT "BotMarketGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMarketGroup" ADD CONSTRAINT "BotMarketGroup_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotMarketGroup" ADD CONSTRAINT "BotMarketGroup_symbolGroupId_fkey" FOREIGN KEY ("symbolGroupId") REFERENCES "SymbolGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketGroupStrategyLink" ADD CONSTRAINT "MarketGroupStrategyLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketGroupStrategyLink" ADD CONSTRAINT "MarketGroupStrategyLink_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketGroupStrategyLink" ADD CONSTRAINT "MarketGroupStrategyLink_botMarketGroupId_fkey" FOREIGN KEY ("botMarketGroupId") REFERENCES "BotMarketGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketGroupStrategyLink" ADD CONSTRAINT "MarketGroupStrategyLink_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
