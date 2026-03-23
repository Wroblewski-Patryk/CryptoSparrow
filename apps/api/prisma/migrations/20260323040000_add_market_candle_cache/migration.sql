CREATE TABLE "MarketCandleCache" (
    "id" TEXT NOT NULL,
    "marketType" "TradeMarket" NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "openTime" BIGINT NOT NULL,
    "closeTime" BIGINT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'BINANCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketCandleCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketCandleCache_marketType_symbol_timeframe_openTime_key"
ON "MarketCandleCache"("marketType", "symbol", "timeframe", "openTime");

CREATE INDEX "MarketCandleCache_marketType_symbol_timeframe_openTime_idx"
ON "MarketCandleCache"("marketType", "symbol", "timeframe", "openTime");

CREATE INDEX "MarketCandleCache_marketType_symbol_timeframe_closeTime_idx"
ON "MarketCandleCache"("marketType", "symbol", "timeframe", "closeTime");
