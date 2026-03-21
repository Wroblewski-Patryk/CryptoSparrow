-- Add market type context to market universes so downstream bot execution can
-- resolve whether symbols come from SPOT or FUTURES catalog.
ALTER TABLE "MarketUniverse"
ADD COLUMN "marketType" "TradeMarket" NOT NULL DEFAULT 'FUTURES';

CREATE INDEX "MarketUniverse_userId_marketType_idx" ON "MarketUniverse"("userId", "marketType");
