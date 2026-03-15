-- CreateEnum
CREATE TYPE "public"."LogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "public"."Log" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "strategyId" TEXT,
    "action" TEXT NOT NULL,
    "level" "public"."LogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "category" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "actor" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Log_userId_idx" ON "public"."Log"("userId");

-- CreateIndex
CREATE INDEX "Log_botId_idx" ON "public"."Log"("botId");

-- CreateIndex
CREATE INDEX "Log_strategyId_idx" ON "public"."Log"("strategyId");

-- CreateIndex
CREATE INDEX "Log_level_idx" ON "public"."Log"("level");

-- CreateIndex
CREATE INDEX "Log_source_idx" ON "public"."Log"("source");

-- CreateIndex
CREATE INDEX "Log_occurredAt_idx" ON "public"."Log"("occurredAt");

-- AddForeignKey
ALTER TABLE "public"."Log" ADD CONSTRAINT "Log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Log" ADD CONSTRAINT "Log_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Log" ADD CONSTRAINT "Log_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
