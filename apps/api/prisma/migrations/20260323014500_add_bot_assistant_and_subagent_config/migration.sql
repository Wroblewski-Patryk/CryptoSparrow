-- Add assistant config models (MBA-15, MBA-16)
CREATE TYPE "AssistantSafetyMode" AS ENUM ('STRICT', 'BALANCED', 'EXPERIMENTAL');

CREATE TABLE "BotAssistantConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "mainAgentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mandate" TEXT,
    "modelProfile" TEXT NOT NULL DEFAULT 'balanced',
    "safetyMode" "AssistantSafetyMode" NOT NULL DEFAULT 'STRICT',
    "maxDecisionLatencyMs" INTEGER NOT NULL DEFAULT 2500,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotAssistantConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotSubagentConfig" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "modelProfile" TEXT NOT NULL DEFAULT 'balanced',
    "timeoutMs" INTEGER NOT NULL DEFAULT 1200,
    "safetyMode" "AssistantSafetyMode" NOT NULL DEFAULT 'STRICT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BotSubagentConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotAssistantConfig_botId_key" ON "BotAssistantConfig"("botId");
CREATE INDEX "BotAssistantConfig_userId_idx" ON "BotAssistantConfig"("userId");
CREATE INDEX "BotAssistantConfig_botId_mainAgentEnabled_idx" ON "BotAssistantConfig"("botId", "mainAgentEnabled");

CREATE UNIQUE INDEX "BotSubagentConfig_botId_slotIndex_key" ON "BotSubagentConfig"("botId", "slotIndex");
CREATE INDEX "BotSubagentConfig_userId_idx" ON "BotSubagentConfig"("userId");
CREATE INDEX "BotSubagentConfig_botId_enabled_slotIndex_idx" ON "BotSubagentConfig"("botId", "enabled", "slotIndex");

ALTER TABLE "BotAssistantConfig" ADD CONSTRAINT "BotAssistantConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotAssistantConfig" ADD CONSTRAINT "BotAssistantConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BotSubagentConfig" ADD CONSTRAINT "BotSubagentConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BotSubagentConfig" ADD CONSTRAINT "BotSubagentConfig_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
