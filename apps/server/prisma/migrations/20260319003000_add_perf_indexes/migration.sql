CREATE INDEX "Position_userId_openedAt_idx" ON "Position"("userId", "openedAt");
CREATE INDEX "Position_userId_status_openedAt_idx" ON "Position"("userId", "status", "openedAt");
CREATE INDEX "Position_userId_symbol_openedAt_idx" ON "Position"("userId", "symbol", "openedAt");

CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_userId_status_createdAt_idx" ON "Order"("userId", "status", "createdAt");
CREATE INDEX "Order_userId_symbol_createdAt_idx" ON "Order"("userId", "symbol", "createdAt");

CREATE INDEX "BacktestRun_userId_createdAt_idx" ON "BacktestRun"("userId", "createdAt");
CREATE INDEX "BacktestRun_userId_status_createdAt_idx" ON "BacktestRun"("userId", "status", "createdAt");

CREATE INDEX "BacktestTrade_userId_backtestRunId_closedAt_idx" ON "BacktestTrade"("userId", "backtestRunId", "closedAt");

CREATE INDEX "Log_userId_occurredAt_idx" ON "Log"("userId", "occurredAt");
CREATE INDEX "Log_userId_source_occurredAt_idx" ON "Log"("userId", "source", "occurredAt");
CREATE INDEX "Log_userId_actor_occurredAt_idx" ON "Log"("userId", "actor", "occurredAt");
CREATE INDEX "Log_userId_level_occurredAt_idx" ON "Log"("userId", "level", "occurredAt");
