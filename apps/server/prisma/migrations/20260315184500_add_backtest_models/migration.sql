-- CreateEnum
CREATE TYPE "public"."BacktestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "public"."BacktestRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "public"."BacktestStatus" NOT NULL DEFAULT 'PENDING',
    "seedConfig" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BacktestTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "backtestRunId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" "public"."PositionSide" NOT NULL,
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BacktestReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "backtestRunId" TEXT NOT NULL,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION,
    "netPnl" DOUBLE PRECISION,
    "grossProfit" DOUBLE PRECISION,
    "grossLoss" DOUBLE PRECISION,
    "maxDrawdown" DOUBLE PRECISION,
    "sharpe" DOUBLE PRECISION,
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BacktestReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BacktestRun_userId_idx" ON "public"."BacktestRun"("userId");

-- CreateIndex
CREATE INDEX "BacktestRun_strategyId_idx" ON "public"."BacktestRun"("strategyId");

-- CreateIndex
CREATE INDEX "BacktestRun_status_idx" ON "public"."BacktestRun"("status");

-- CreateIndex
CREATE INDEX "BacktestRun_startedAt_idx" ON "public"."BacktestRun"("startedAt");

-- CreateIndex
CREATE INDEX "BacktestTrade_userId_idx" ON "public"."BacktestTrade"("userId");

-- CreateIndex
CREATE INDEX "BacktestTrade_strategyId_idx" ON "public"."BacktestTrade"("strategyId");

-- CreateIndex
CREATE INDEX "BacktestTrade_backtestRunId_idx" ON "public"."BacktestTrade"("backtestRunId");

-- CreateIndex
CREATE INDEX "BacktestTrade_symbol_idx" ON "public"."BacktestTrade"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "BacktestReport_backtestRunId_key" ON "public"."BacktestReport"("backtestRunId");

-- CreateIndex
CREATE INDEX "BacktestReport_userId_idx" ON "public"."BacktestReport"("userId");

-- AddForeignKey
ALTER TABLE "public"."BacktestRun" ADD CONSTRAINT "BacktestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestRun" ADD CONSTRAINT "BacktestRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestTrade" ADD CONSTRAINT "BacktestTrade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestTrade" ADD CONSTRAINT "BacktestTrade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestTrade" ADD CONSTRAINT "BacktestTrade_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "public"."BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestReport" ADD CONSTRAINT "BacktestReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BacktestReport" ADD CONSTRAINT "BacktestReport_backtestRunId_fkey" FOREIGN KEY ("backtestRunId") REFERENCES "public"."BacktestRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
