-- Add bot runtime event model for lifecycle trace storage (BMOD-29)
CREATE TYPE "BotRuntimeEventType" AS ENUM (
    'SESSION_STARTED',
    'SESSION_STOPPED',
    'HEARTBEAT',
    'SIGNAL_DECISION',
    'PRETRADE_BLOCKED',
    'ORDER_SUBMITTED',
    'ORDER_FILLED',
    'POSITION_OPENED',
    'POSITION_CLOSED',
    'DCA_EXECUTED',
    'ERROR'
);

CREATE TYPE "BotRuntimeEventLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

CREATE TABLE "BotRuntimeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "eventType" "BotRuntimeEventType" NOT NULL,
    "level" "BotRuntimeEventLevel" NOT NULL DEFAULT 'INFO',
    "symbol" TEXT,
    "botMarketGroupId" TEXT,
    "strategyId" TEXT,
    "signalDirection" "SignalDirection",
    "message" TEXT,
    "payload" JSONB,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotRuntimeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotRuntimeEvent_userId_idx" ON "BotRuntimeEvent"("userId");
CREATE INDEX "BotRuntimeEvent_botId_idx" ON "BotRuntimeEvent"("botId");
CREATE INDEX "BotRuntimeEvent_sessionId_idx" ON "BotRuntimeEvent"("sessionId");
CREATE INDEX "BotRuntimeEvent_sessionId_eventAt_idx" ON "BotRuntimeEvent"("sessionId", "eventAt");
CREATE INDEX "BotRuntimeEvent_botId_eventAt_idx" ON "BotRuntimeEvent"("botId", "eventAt");
CREATE INDEX "BotRuntimeEvent_eventType_eventAt_idx" ON "BotRuntimeEvent"("eventType", "eventAt");
CREATE INDEX "BotRuntimeEvent_symbol_eventAt_idx" ON "BotRuntimeEvent"("symbol", "eventAt");

ALTER TABLE "BotRuntimeEvent" ADD CONSTRAINT "BotRuntimeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRuntimeEvent" ADD CONSTRAINT "BotRuntimeEvent_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRuntimeEvent" ADD CONSTRAINT "BotRuntimeEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BotRuntimeSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
