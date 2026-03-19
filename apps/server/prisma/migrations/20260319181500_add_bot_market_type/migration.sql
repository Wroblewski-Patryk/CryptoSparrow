-- CreateEnum
CREATE TYPE "public"."TradeMarket" AS ENUM ('FUTURES', 'SPOT');

-- AlterTable
ALTER TABLE "public"."Bot"
ADD COLUMN "marketType" "public"."TradeMarket" NOT NULL DEFAULT 'FUTURES';
