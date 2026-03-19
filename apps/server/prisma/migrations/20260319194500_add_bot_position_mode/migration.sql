-- CreateEnum
CREATE TYPE "PositionMode" AS ENUM ('ONE_WAY', 'HEDGE');

-- AlterTable
ALTER TABLE "Bot"
ADD COLUMN "positionMode" "PositionMode" NOT NULL DEFAULT 'ONE_WAY';
