-- Add bot runtime session model for monitoring windows (BMOD-28)
CREATE TYPE "BotRuntimeSessionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

CREATE TABLE "BotRuntimeSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "mode" "BotMode" NOT NULL,
    "status" "BotRuntimeSessionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotRuntimeSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotRuntimeSession_userId_idx" ON "BotRuntimeSession"("userId");
CREATE INDEX "BotRuntimeSession_botId_idx" ON "BotRuntimeSession"("botId");
CREATE INDEX "BotRuntimeSession_userId_botId_startedAt_idx" ON "BotRuntimeSession"("userId", "botId", "startedAt");
CREATE INDEX "BotRuntimeSession_botId_status_startedAt_idx" ON "BotRuntimeSession"("botId", "status", "startedAt");
CREATE INDEX "BotRuntimeSession_status_startedAt_idx" ON "BotRuntimeSession"("status", "startedAt");

ALTER TABLE "BotRuntimeSession" ADD CONSTRAINT "BotRuntimeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotRuntimeSession" ADD CONSTRAINT "BotRuntimeSession_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
