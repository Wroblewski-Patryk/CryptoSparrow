CREATE TYPE "BacktestExitReason" AS ENUM ('SIGNAL_EXIT', 'FINAL_CANDLE', 'LIQUIDATION');

ALTER TABLE "BacktestTrade"
ADD COLUMN "exitReason" "BacktestExitReason" NOT NULL DEFAULT 'SIGNAL_EXIT',
ADD COLUMN "liquidated" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "BacktestTrade_backtestRunId_exitReason_idx" ON "BacktestTrade"("backtestRunId", "exitReason");
