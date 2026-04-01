-- Add bot runtime per-symbol stats snapshot model (BMOD-30)
CREATE TABLE "BotRuntimeSymbolStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "longEntries" INTEGER NOT NULL DEFAULT 0,
    "shortEntries" INTEGER NOT NULL DEFAULT 0,
    "exits" INTEGER NOT NULL DEFAULT 0,
    "dcaCount" INTEGER NOT NULL DEFAULT 0,
    "closedTrades" INTEGER NOT NULL DEFAULT 0,
    "winningTrades" INTEGER NOT NULL DEFAULT 0,
    "losingTrades" INTEGER NOT NULL DEFAULT 0,
    "realizedPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossLoss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openPositionCount" INTEGER NOT NULL DEFAULT 0,
    "openPositionQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastPrice" DOUBLE PRECISION,
    "lastSignalAt" TIMESTAMP(3),
    "lastTradeAt" TIMESTAMP(3),
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotRuntimeSymbolStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotRuntimeSymbolStat_sessionId_symbol_key" ON "BotRuntimeSymbolStat"("sessionId", "symbol");
CREATE INDEX "BotRuntimeSymbolStat_userId_idx" ON "BotRuntimeSymbolStat"("userId");
CREATE INDEX "BotRuntimeSymbolStat_botId_idx" ON "BotRuntimeSymbolStat"("botId");
CREATE INDEX "BotRuntimeSymbolStat_sessionId_idx" ON "BotRuntimeSymbolStat"("sessionId");
CREATE INDEX "BotRuntimeSymbolStat_botId_symbol_idx" ON "BotRuntimeSymbolStat"("botId", "symbol");
CREATE INDEX "BotRuntimeSymbolStat_userId_botId_sessionId_idx" ON "BotRuntimeSymbolStat"("userId", "botId", "sessionId");
CREATE INDEX "BotRuntimeSymbolStat_sessionId_realizedPnl_idx" ON "BotRuntimeSymbolStat"("sessionId", "realizedPnl");
CREATE INDEX "BotRuntimeSymbolStat_sessionId_closedTrades_idx" ON "BotRuntimeSymbolStat"("sessionId", "closedTrades");

ALTER TABLE "BotRuntimeSymbolStat" ADD CONSTRAINT "BotRuntimeSymbolStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRuntimeSymbolStat" ADD CONSTRAINT "BotRuntimeSymbolStat_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRuntimeSymbolStat" ADD CONSTRAINT "BotRuntimeSymbolStat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BotRuntimeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
