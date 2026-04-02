ALTER TABLE "MarketUniverse"
ADD COLUMN "exchange" "Exchange" NOT NULL DEFAULT 'BINANCE';

CREATE INDEX "MarketUniverse_userId_exchange_marketType_baseCurrency_idx"
ON "MarketUniverse"("userId", "exchange", "marketType", "baseCurrency");
