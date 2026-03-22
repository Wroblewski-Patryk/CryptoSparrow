-- Add runtime origin/management/sync metadata to positions, orders, and trades.
CREATE TYPE "TradingRecordOrigin" AS ENUM ('BOT', 'USER', 'EXCHANGE_SYNC', 'BACKTEST');
CREATE TYPE "PositionManagementMode" AS ENUM ('BOT_MANAGED', 'MANUAL_MANAGED');
CREATE TYPE "SyncState" AS ENUM ('IN_SYNC', 'DRIFT', 'ORPHAN_LOCAL', 'ORPHAN_EXCHANGE');

ALTER TABLE "Position"
ADD COLUMN "externalId" TEXT,
ADD COLUMN "origin" "TradingRecordOrigin" NOT NULL DEFAULT 'BOT',
ADD COLUMN "managementMode" "PositionManagementMode" NOT NULL DEFAULT 'BOT_MANAGED',
ADD COLUMN "syncState" "SyncState" NOT NULL DEFAULT 'IN_SYNC';

ALTER TABLE "Order"
ADD COLUMN "origin" "TradingRecordOrigin" NOT NULL DEFAULT 'BOT',
ADD COLUMN "managementMode" "PositionManagementMode" NOT NULL DEFAULT 'BOT_MANAGED',
ADD COLUMN "syncState" "SyncState" NOT NULL DEFAULT 'IN_SYNC';

ALTER TABLE "Trade"
ADD COLUMN "origin" "TradingRecordOrigin" NOT NULL DEFAULT 'BOT',
ADD COLUMN "managementMode" "PositionManagementMode" NOT NULL DEFAULT 'BOT_MANAGED';

CREATE INDEX "Position_userId_origin_openedAt_idx" ON "Position"("userId", "origin", "openedAt");
CREATE INDEX "Position_userId_managementMode_openedAt_idx" ON "Position"("userId", "managementMode", "openedAt");
CREATE INDEX "Position_externalId_idx" ON "Position"("externalId");

CREATE INDEX "Order_userId_origin_createdAt_idx" ON "Order"("userId", "origin", "createdAt");
CREATE INDEX "Order_userId_managementMode_createdAt_idx" ON "Order"("userId", "managementMode", "createdAt");

CREATE INDEX "Trade_userId_origin_executedAt_idx" ON "Trade"("userId", "origin", "executedAt");
CREATE INDEX "Trade_userId_managementMode_executedAt_idx" ON "Trade"("userId", "managementMode", "executedAt");
