-- Add per-market-group risk budget (MBA-12)
ALTER TABLE "BotMarketGroup"
ADD COLUMN "maxOpenPositions" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "BotMarketGroup_botId_maxOpenPositions_idx"
ON "BotMarketGroup"("botId", "maxOpenPositions");
