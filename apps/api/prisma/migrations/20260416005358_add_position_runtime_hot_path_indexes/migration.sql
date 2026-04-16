-- CreateIndex
CREATE INDEX "Position_userId_botId_status_idx" ON "Position"("userId", "botId", "status");

-- CreateIndex
CREATE INDEX "Position_userId_symbol_status_idx" ON "Position"("userId", "symbol", "status");
