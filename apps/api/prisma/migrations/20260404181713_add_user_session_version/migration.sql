-- DropIndex
DROP INDEX "BacktestTrade_backtestRunId_exitReason_idx";

-- DropIndex
DROP INDEX "BotMarketGroup_botId_maxOpenPositions_idx";

-- DropIndex
DROP INDEX "MarketUniverse_userId_marketType_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 1;
