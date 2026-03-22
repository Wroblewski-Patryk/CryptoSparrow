-- CreateEnum
CREATE TYPE "public"."BotMode" AS ENUM ('PAPER', 'LIVE', 'LOCAL');

-- CreateTable
CREATE TABLE "public"."Bot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "public"."BotMode" NOT NULL DEFAULT 'PAPER',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "liveOptIn" BOOLEAN NOT NULL DEFAULT false,
    "maxOpenPositions" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BotStrategy" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "strategyId" TEXT NOT NULL,
    "symbolGroupId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bot_userId_idx" ON "public"."Bot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BotStrategy_botId_strategyId_symbolGroupId_key" ON "public"."BotStrategy"("botId", "strategyId", "symbolGroupId");

-- CreateIndex
CREATE INDEX "BotStrategy_botId_idx" ON "public"."BotStrategy"("botId");

-- CreateIndex
CREATE INDEX "BotStrategy_strategyId_idx" ON "public"."BotStrategy"("strategyId");

-- CreateIndex
CREATE INDEX "BotStrategy_symbolGroupId_idx" ON "public"."BotStrategy"("symbolGroupId");

-- AddForeignKey
ALTER TABLE "public"."Bot" ADD CONSTRAINT "Bot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotStrategy" ADD CONSTRAINT "BotStrategy_botId_fkey" FOREIGN KEY ("botId") REFERENCES "public"."Bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotStrategy" ADD CONSTRAINT "BotStrategy_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "public"."Strategy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BotStrategy" ADD CONSTRAINT "BotStrategy_symbolGroupId_fkey" FOREIGN KEY ("symbolGroupId") REFERENCES "public"."SymbolGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
