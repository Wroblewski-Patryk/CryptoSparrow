-- CreateEnum
CREATE TYPE "RuntimeExecutionCommandType" AS ENUM ('OPEN', 'DCA', 'CLOSE', 'CANCEL');

-- CreateEnum
CREATE TYPE "RuntimeExecutionDedupeStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "RuntimeExecutionDedupe" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "dedupeVersion" TEXT NOT NULL,
    "commandType" "RuntimeExecutionCommandType" NOT NULL,
    "userId" TEXT NOT NULL,
    "botId" TEXT,
    "symbol" TEXT,
    "status" "RuntimeExecutionDedupeStatus" NOT NULL DEFAULT 'PENDING',
    "commandFingerprint" JSONB NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ttlExpiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "positionId" TEXT,
    "errorClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuntimeExecutionDedupe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeExecutionDedupe_dedupeKey_key" ON "RuntimeExecutionDedupe"("dedupeKey");

-- CreateIndex
CREATE INDEX "RuntimeExecutionDedupe_userId_commandType_status_idx" ON "RuntimeExecutionDedupe"("userId", "commandType", "status");

-- CreateIndex
CREATE INDEX "RuntimeExecutionDedupe_botId_idx" ON "RuntimeExecutionDedupe"("botId");

-- CreateIndex
CREATE INDEX "RuntimeExecutionDedupe_ttlExpiresAt_idx" ON "RuntimeExecutionDedupe"("ttlExpiresAt");

-- CreateIndex
CREATE INDEX "RuntimeExecutionDedupe_status_lastSeenAt_idx" ON "RuntimeExecutionDedupe"("status", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "RuntimeExecutionDedupe" ADD CONSTRAINT "RuntimeExecutionDedupe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuntimeExecutionDedupe" ADD CONSTRAINT "RuntimeExecutionDedupe_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
