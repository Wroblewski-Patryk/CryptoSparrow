-- CreateEnum
CREATE TYPE "public"."PositionSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "public"."PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "public"."OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "public"."OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TAKE_PROFIT', 'TRAILING');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."SignalDirection" AS ENUM ('LONG', 'SHORT', 'EXIT');

-- CreateTable
CREATE TABLE "public"."Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "strategyId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "public"."PositionSide" NOT NULL,
    "status" "public"."PositionStatus" NOT NULL DEFAULT 'OPEN',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "realizedPnl" DOUBLE PRECISION,
    "unrealizedPnl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "strategyId" TEXT,
    "positionId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "public"."OrderSide" NOT NULL,
    "type" "public"."OrderType" NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    "filledQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageFillPrice" DOUBLE PRECISION,
    "fee" DOUBLE PRECISION,
    "exchangeOrderId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "filledAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Trade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "strategyId" TEXT,
    "orderId" TEXT,
    "positionId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "public"."OrderSide" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION,
    "realizedPnl" DOUBLE PRECISION,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Signal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "strategyId" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "direction" "public"."SignalDirection" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "payload" JSONB,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "public"."Position"("userId");

-- CreateIndex
CREATE INDEX "Position_botId_idx" ON "public"."Position"("botId");

-- CreateIndex
CREATE INDEX "Position_strategyId_idx" ON "public"."Position"("strategyId");

-- CreateIndex
CREATE INDEX "Position_symbol_idx" ON "public"."Position"("symbol");

-- CreateIndex
CREATE INDEX "Position_status_idx" ON "public"."Position"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_symbol_open_key" ON "public"."Position"("userId", "symbol") WHERE "status" = 'OPEN';

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "public"."Order"("userId");

-- CreateIndex
CREATE INDEX "Order_botId_idx" ON "public"."Order"("botId");

-- CreateIndex
CREATE INDEX "Order_strategyId_idx" ON "public"."Order"("strategyId");

-- CreateIndex
CREATE INDEX "Order_positionId_idx" ON "public"."Order"("positionId");

-- CreateIndex
CREATE INDEX "Order_symbol_idx" ON "public"."Order"("symbol");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "public"."Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_botId_idx" ON "public"."Trade"("botId");

-- CreateIndex
CREATE INDEX "Trade_strategyId_idx" ON "public"."Trade"("strategyId");

-- CreateIndex
CREATE INDEX "Trade_orderId_idx" ON "public"."Trade"("orderId");

-- CreateIndex
CREATE INDEX "Trade_positionId_idx" ON "public"."Trade"("positionId");

-- CreateIndex
CREATE INDEX "Trade_symbol_idx" ON "public"."Trade"("symbol");

-- CreateIndex
CREATE INDEX "Signal_userId_idx" ON "public"."Signal"("userId");

-- CreateIndex
CREATE INDEX "Signal_botId_idx" ON "public"."Signal"("botId");

-- CreateIndex
CREATE INDEX "Signal_strategyId_idx" ON "public"."Signal"("strategyId");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "public"."Signal"("symbol");

-- CreateIndex
CREATE INDEX "Signal_triggeredAt_idx" ON "public"."Signal"("triggeredAt");

-- AddForeignKey
ALTER TABLE "public"."Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Position" ADD CONSTRAINT "Position_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Position" ADD CONSTRAINT "Position_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Order" ADD CONSTRAINT "Order_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "public"."Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Trade" ADD CONSTRAINT "Trade_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "public"."Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Signal" ADD CONSTRAINT "Signal_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
